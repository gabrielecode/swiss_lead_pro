import { VercelRequest, VercelResponse } from "@vercel/node";

const hasPerplexityKey = (): boolean => Boolean(process.env.PERPLEXITY_API_KEY);

const collectSources = (data: any) => {
  const fromCitations = Array.isArray(data?.citations) ? data.citations : [];
  const fromSearchResults = Array.isArray(data?.search_results) ? data.search_results : [];

  const raw = [...fromCitations, ...fromSearchResults]
    .map((item: any) => {
      if (!item) return null;
      if (typeof item === "string") return { title: item, uri: item };

      const uri = item.uri || item.url || item.link;
      if (!uri || typeof uri !== "string") return null;

      return { title: item.title || uri, uri };
    })
    .filter(Boolean) as { title: string; uri: string }[];

  return raw.filter((source, index, self) => self.findIndex((item) => item.uri === source.uri) === index);
};

const queryPerplexity = async ({
  systemPrompt,
  userPrompt,
  temperature = 0.2,
  maxTokens = 1400,
  responseFormat,
}: {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: any;
}) => {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error("PERPLEXITY_API_KEY non configurata.");
  }

  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.PERPLEXITY_MODEL || "sonar-pro",
      temperature,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      ...(responseFormat ? { response_format: responseFormat } : {}),
    }),
  });

  const payloadText = await response.text();
  let payload: any = {};

  try {
    payload = payloadText ? JSON.parse(payloadText) : {};
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || payloadText || "Errore API Perplexity";
    throw new Error(message);
  }

  const content = payload?.choices?.[0]?.message?.content;
  const text = typeof content === "string" ? content : JSON.stringify(content ?? "");
  if (!text || text === "{}" || text === "[]") {
    throw new Error("Risposta Perplexity non valida o vuota.");
  }

  return { text, sources: collectSources(payload) };
};

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

const parseCompactSearchInput = (rawKeyword: string, rawLocation?: string) => {
  const location = String(rawLocation || "")
    .replace(/\+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const keyword = String(rawKeyword || "").replace(/\s+/g, " ").trim();

  if (location.length > 0) {
    return {
      keyword: keyword.replace(/\+/g, " ").replace(/\s+/g, " ").trim(),
      location,
    };
  }

  const chunks = keyword
    .split("+")
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);

  if (chunks.length >= 2) {
    return {
      keyword: chunks[0],
      location: chunks.slice(1).join(" "),
    };
  }

  return {
    keyword: keyword.replace(/\+/g, " ").replace(/\s+/g, " ").trim(),
    location: "",
  };
};

const parseLocalChLeads = (html: string, keyword: string, location?: string) => {
  const leads: any[] = [];
  const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const matches = Array.from(html.matchAll(scriptRegex));

  const pushLead = (item: any) => {
    const name = item?.name || item?.legalName;
    if (!name || typeof name !== "string") return;

    const addressObj = item?.address;
    const address = addressObj
      ? [addressObj.streetAddress, addressObj.postalCode, addressObj.addressLocality, addressObj.addressCountry]
          .filter(Boolean)
          .join(", ")
      : `${location || "Svizzera"}, Svizzera`;

    leads.push({
      company: name,
      sector: keyword,
      address,
      phone: item?.telephone || "Non disponibile",
      email: item?.email || "Non disponibile",
      website: item?.url || "Non disponibile",
      social: "Non disponibile",
      marketingScore: 58,
      auditResult: "Lead individuato da local.ch",
      customStrategy: "Contatto commerciale locale con focus geolocalizzato.",
      source: "local.ch",
    });
  };

  for (const match of matches) {
    const payload = match[1]?.trim();
    if (!payload) continue;

    try {
      const parsed = JSON.parse(payload);
      const queue = Array.isArray(parsed) ? parsed : [parsed];

      for (const entry of queue) {
        if (entry?.itemListElement && Array.isArray(entry.itemListElement)) {
          for (const item of entry.itemListElement) {
            pushLead(item?.item || item);
          }
        } else {
          pushLead(entry);
        }
      }
    } catch {
      continue;
    }
  }

  return dedupeLeads(leads).slice(0, 8);
};

const searchLocalCh = async (keyword: string, location?: string) => {
  const where = location && location.trim().length > 0 ? location.trim() : "Svizzera";
  const url = `https://www.local.ch/it/q?what=${encodeURIComponent(keyword)}&where=${encodeURIComponent(where)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return [];
    }

    const html = await response.text();
    return parseLocalChLeads(html, keyword, where);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { keyword, location, radius } = req.body;
    const parsedInput = parseCompactSearchInput(keyword, location);
    const effectiveKeyword = parsedInput.keyword;
    const effectiveLocation = parsedInput.location;

    if (!effectiveKeyword) {
      return res.status(400).json({ error: "Keyword obbligatorio" });
    }

    const radiusValue = Number(radius);

    const associatedKeywords = buildAssociatedKeywords(effectiveKeyword);
    let aggregatedLeads: any[] = [];
    let aggregatedSources: { title: string; uri: string }[] = [];

    if (hasPerplexityKey()) {
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

      const termsToSearch = associatedKeywords.slice(0, 3);
      const perplexityTasks = termsToSearch.map(async (term) => {
        const userPrompt = `Trova almeno 6 aziende nel settore "${term}" ${effectiveLocation ? `a ${effectiveLocation}` : "in Svizzera"}${radiusValue > 0 ? ` entro ${radiusValue} km` : ""}.`;
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

        return {
          term,
          leads: parseLeadsFromText(aiResult.text).map((lead) => normalizeLead(lead, effectiveKeyword)),
          sources: aiResult.sources,
        };
      });

      const perplexityResults = await Promise.allSettled(perplexityTasks);
      for (const result of perplexityResults) {
        if (result.status === "fulfilled") {
          aggregatedLeads = aggregatedLeads.concat(result.value.leads);
          aggregatedSources = aggregatedSources.concat(result.value.sources);
        } else {
          console.warn("[Lead Generation][Perplexity term error]", result.reason);
        }
      }
    }

    const localChTerms = associatedKeywords.slice(0, 2);
    const localTasks = localChTerms.map((term) => searchLocalCh(term, effectiveLocation));
    const localResultsSettled = await Promise.allSettled(localTasks);
    for (const result of localResultsSettled) {
      if (result.status === "fulfilled" && result.value.length > 0) {
        aggregatedLeads = aggregatedLeads.concat(result.value.map((lead) => normalizeLead(lead, effectiveKeyword)));
      }
    }

    const finalLeads = dedupeLeads(aggregatedLeads);
    if (finalLeads.length > 0) {
      const finalSources = aggregatedSources
        .filter((source, index, self) => self.findIndex((item) => item.uri === source.uri) === index)
        .slice(0, 10);

      return res.json({
        success: true,
        leads: finalLeads,
        searchedKeywords: associatedKeywords,
        sources: finalSources,
      });
    }

    const leadsArray = buildFallbackLeads(effectiveKeyword, effectiveLocation, radiusValue);

    res.json({
      success: true,
      leads: leadsArray,
      searchedKeywords: [effectiveKeyword],
      sources: [],
    });
  } catch (error: any) {
    console.error("[Lead Generation Error]", error);
    res.status(500).json({
      error: error?.message || "Errore nella generazione dei lead",
    });
  }
}
