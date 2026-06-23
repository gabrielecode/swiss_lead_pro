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

const buildFallbackAnswer = (prompt: string, language?: string): string => {
  const lang = (language || "italiana").toLowerCase();
  const isItalian = lang.includes("it") || lang.includes("ital");

  if (isItalian) {
    return [
      "## Risposta temporanea (modalita fallback)",
      "",
      `Hai chiesto: \"${prompt}\"`,
      "",
      "Al momento il provider AI esterno non e configurato.",
      "Ho comunque preparato una risposta strutturata per non bloccare il flusso:",
      "",
      "1. Definisci obiettivo e vincoli della richiesta.",
      "2. Raccogli 3-5 fonti locali svizzere ufficiali.",
      "3. Confronta requisiti federali e cantonali.",
      "4. Produci una sintesi operativa con prossimi passi.",
      "",
      "Nota: integrazione Perplexity prevista nel prossimo step.",
    ].join("\n");
  }

  return [
    "## Temporary response (fallback mode)",
    "",
    `You asked: \"${prompt}\"`,
    "",
    "The external AI provider is currently not configured.",
    "Here is a structured response path to keep your workflow unblocked:",
    "",
    "1. Define objective and constraints.",
    "2. Collect 3-5 official Swiss-local sources.",
    "3. Compare federal and canton-level requirements.",
    "4. Produce an action-oriented summary with next steps.",
    "",
    "Note: Perplexity integration is planned for the next step.",
  ].join("\n");
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
    const { prompt, language } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Il prompt è obbligatorio" });
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

    res.json({
      answer,
      sources: [],
    });
  } catch (error: any) {
    console.error("[Ask-AI Error]", error);
    res.status(500).json({
      error: error?.message || "Errore durante la richiesta",
    });
  }
}
