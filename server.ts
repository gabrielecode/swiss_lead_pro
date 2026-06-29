import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { searchLocalCh, combineLeadSourcesWithLocalCh } from "./local-ch-integration";
import { hasPerplexityKey, queryPerplexity } from "./api/perplexity-client";
dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const normalizeSlug = (value: string): string => {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const buildFallbackLeads = (keyword: string, location?: string, radius?: number) => {
    const city = (location || "Svizzera").trim();
    const base = keyword.trim();
    const slugBase = normalizeSlug(base) || "business";
    const slugCity = normalizeSlug(city) || "ch";

    const names = [
      `${base} Studio ${city}`,
      `${base} Partners ${city}`,
      `${base} Consulting ${city}`,
      `${base} Group Suisse`,
      `${base} Service Center ${city}`,
      `${base} Solutions CH`,
    ];

    return names.map((company, idx) => ({
      company,
      sector: base,
      address: `${city}, Svizzera`,
      phone: `+41 0${idx + 2} ${700 + idx} ${100 + idx} ${2000 + idx}`,
      email: `info${idx + 1}@${slugBase}-${slugCity}-${idx + 1}.ch`,
      website: `https://www.${slugBase}-${slugCity}-${idx + 1}.ch`,
      social: "Non disponibile",
      marketingScore: 62 + idx * 4,
      auditResult: `Lead generato in fallback locale per ${base}${radius ? ` entro ${radius} km` : ""}.`,
      customStrategy: idx < 2 ? "Priorita alta: primo contatto commerciale entro 24h." : "Contatto B2B standard con proposta personalizzata.",
      source: "local-fallback",
    }));
  };

  const buildFallbackAnswer = (prompt: string, language?: string): string => {
    const lang = (language || "italiana").toLowerCase();
    const isItalian = lang.includes("it") || lang.includes("ital");

    if (isItalian) {
      return [
        "## Risposta temporanea (modalita fallback)",
        "",
        `Hai chiesto: \"${prompt}\"`,
        "",
        "Il provider AI esterno non e ancora configurato.",
        "Per ora puoi usare questa traccia operativa:",
        "",
        "1. Definisci obiettivo e vincoli della richiesta.",
        "2. Verifica fonti ufficiali svizzere rilevanti.",
        "3. Confronta regole federali e cantonali.",
        "4. Applica una sintesi pratica con azioni concrete.",
        "",
        "Nota: integrazione Perplexity prevista nello step successivo.",
      ].join("\n");
    }

    return [
      "## Temporary response (fallback mode)",
      "",
      `You asked: \"${prompt}\"`,
      "",
      "The external AI provider is not configured yet.",
      "You can still use this operational path:",
      "",
      "1. Define objective and constraints.",
      "2. Validate relevant official Swiss sources.",
      "3. Compare federal and canton-level rules.",
      "4. Produce an actionable summary.",
      "",
      "Note: Perplexity integration is planned next.",
    ].join("\n");
  };

  const parseLeadsFromText = (rawText: string): any[] => {
    let cleaned = rawText.trim();

    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.slice(3);
    }

    if (cleaned.endsWith("```")) {
      cleaned = cleaned.slice(0, -3);
    }

    cleaned = cleaned.trim();

    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) return parsed;
      if (Array.isArray(parsed?.leads)) return parsed.leads;
      return [];
    } catch {
      const startIdx = cleaned.indexOf("[");
      const endIdx = cleaned.lastIndexOf("]");
      if (startIdx >= 0 && endIdx > startIdx) {
        const sliced = cleaned.slice(startIdx, endIdx + 1);
        try {
          const parsed = JSON.parse(sliced);
          if (Array.isArray(parsed)) return parsed;
          if (Array.isArray(parsed?.leads)) return parsed.leads;
          return [];
        } catch {
          return [];
        }
      }
      return [];
    }
  };

  const normalizeLead = (lead: any, defaultSector: string) => {
    const toText = (value: any, fallback = "Non disponibile") => {
      if (value === null || value === undefined) return fallback;
      const str = String(value).trim();
      return str.length > 0 ? str : fallback;
    };

    const parsedScore = Number(lead?.marketingScore);
    const safeScore = Number.isFinite(parsedScore)
      ? Math.max(0, Math.min(100, Math.round(parsedScore)))
      : 60;

    return {
      company: toText(lead?.company, "Azienda non specificata"),
      sector: toText(lead?.sector, defaultSector),
      address: toText(lead?.address),
      phone: toText(lead?.phone),
      email: toText(lead?.email),
      website: toText(lead?.website),
      social: toText(lead?.social),
      marketingScore: safeScore,
      auditResult: toText(lead?.auditResult, "Analisi non disponibile"),
      customStrategy: toText(lead?.customStrategy, "Strategia commerciale da definire"),
      source: toText(lead?.source, "perplexity"),
    };
  };

  const dedupeLeads = (leads: any[]) => {
    const seen = new Map<string, any>();

    for (const lead of leads) {
      const companyKey = String(lead.company || "").toLowerCase().replace(/\s+/g, " ").trim();
      const siteKey = String(lead.website || "").toLowerCase().trim();
      const key = siteKey && siteKey !== "non disponibile" ? `site:${siteKey}` : `company:${companyKey}`;

      if (!seen.has(key)) {
        seen.set(key, lead);
      }
    }

    return Array.from(seen.values());
  };

  const buildAssociatedKeywords = (keyword: string): string[] => {
    const normalized = keyword.toLowerCase().trim();
    const terms = new Set<string>([keyword.trim()]);

    const domainMap: Array<{ match: RegExp; synonyms: string[] }> = [
      {
        match: /(dent|odontoi)/i,
        synonyms: [
          "dentista",
          "studio dentistico",
          "studio odontoiatrico",
          "clinica dentale",
          "odontoiatra",
          "igienista dentale",
        ],
      },
      {
        match: /(fisioterap|riabilit)/i,
        synonyms: [
          "fisioterapista",
          "centro fisioterapia",
          "riabilitazione",
          "fisioterapia sportiva",
        ],
      },
      {
        match: /(avvocat|legale|studio legale)/i,
        synonyms: ["studio legale", "avvocato", "consulenza legale"],
      },
    ];

    for (const rule of domainMap) {
      if (rule.match.test(normalized)) {
        for (const synonym of rule.synonyms) {
          terms.add(synonym);
        }
      }
    }

    if (terms.size === 1) {
      terms.add(`studio ${keyword}`);
      terms.add(`${keyword} professionale`);
    }

    return Array.from(terms).slice(0, 5);
  };

  app.post("/api/ask-ai", async (req, res) => {
    try {
      const { prompt, language } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Il prompt e obbligatorio" });
      }

      if (hasPerplexityKey()) {
        const systemPrompt = `Sei un assistente esperto per la ricerca in Svizzera. Rispondi in lingua ${language || "italiana"}, con tono professionale e concreto.`;
        const aiResult = await queryPerplexity({
          systemPrompt,
          userPrompt: prompt,
          temperature: 0.3,
          maxTokens: 1600,
        });

        return res.json({
          answer: aiResult.text,
          sources: aiResult.sources.slice(0, 8),
        });
      }

      const answer = buildFallbackAnswer(prompt, language);
      res.json({ answer, sources: [] });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || "Errore interno durante la richiesta all'assistente.",
      });
    }
  });

  app.post("/api/generate-leads", async (req, res) => {
    try {
      const { keyword, location, canton, radius } = req.body;

      if (!keyword) {
        return res.status(400).json({ error: "La parola chiave o settore e obbligatorio" });
      }

      const radiusValue = Number(radius);
      const relatedKeywords = buildAssociatedKeywords(keyword);
      let finalLeads = buildFallbackLeads(keyword, location, radiusValue);

      if (hasPerplexityKey()) {
        let aggregatedLeads: any[] = [];

        try {
          const leadSchema = {
            type: "object",
            properties: {
              leads: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    company: { type: "string" },
                    sector: { type: "string" },
                    address: { type: "string" },
                    phone: { type: "string" },
                    email: { type: "string" },
                    website: { type: "string" },
                    social: { type: "string" },
                    marketingScore: { type: "number" },
                    auditResult: { type: "string" },
                    customStrategy: { type: "string" },
                    source: { type: "string" },
                  },
                  required: [
                    "company",
                    "sector",
                    "address",
                    "phone",
                    "email",
                    "website",
                    "social",
                    "marketingScore",
                    "auditResult",
                    "customStrategy",
                    "source",
                  ],
                },
              },
            },
            required: ["leads"],
          };

          const systemPrompt = [
            "Sei un motore di lead generation B2B per la Svizzera.",
            "Rispondi esclusivamente in JSON valido.",
            "La risposta deve essere un oggetto con chiave leads che contiene un array.",
            "Ogni lead deve avere: company, sector, address, phone, email, website, social, marketingScore, auditResult, customStrategy, source.",
            "Non usare markdown, nessun testo extra.",
          ].join(" ");

          for (const term of relatedKeywords.slice(0, 3)) {
            const userPrompt = `Trova almeno 6 aziende nel settore "${term}" ${location ? `a ${location}` : "in Svizzera"}${radiusValue > 0 ? ` entro ${radiusValue} km` : ""}.`;
            const aiResult = await queryPerplexity({
              systemPrompt,
              userPrompt,
              temperature: 0.2,
              maxTokens: 1800,
              responseFormat: {
                type: "json_schema",
                json_schema: {
                  name: "lead_response",
                  schema: leadSchema,
                },
              },
            });

            const parsedLeads = parseLeadsFromText(aiResult.text).map((lead) => normalizeLead(lead, keyword));
            aggregatedLeads = aggregatedLeads.concat(parsedLeads);
          }

          console.log("[DEBUG] aggregatedLeads count:", aggregatedLeads.length);
          console.log("[DEBUG] aggregatedLeads sample:", JSON.stringify(aggregatedLeads.slice(0, 1)));
          if (aggregatedLeads.length > 0) {
            finalLeads = dedupeLeads(aggregatedLeads);
          }
        } catch (aiErr) {
          console.warn("[Perplexity Lead Generation Error]", aiErr);
        }
      }

      if (process.env.LOCAL_CH_ENABLED === "true") {
        try {
          const localChResults = await searchLocalCh(keyword, location, canton);
          if (localChResults.length > 0) {
            finalLeads = await combineLeadSourcesWithLocalCh(finalLeads, localChResults);
          }
        } catch (localChErr) {
          console.warn("[Local.ch Integration Error]", localChErr);
        }
      }

      res.json({
        success: true,
        leads: finalLeads,
        searchedKeywords: relatedKeywords,
        sources: [],
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || "Errore sconosciuto durante la generazione dei lead.",
      });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
