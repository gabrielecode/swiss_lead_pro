export interface PerplexitySource {
  title: string;
  uri: string;
}

export interface PerplexityResponse {
  text: string;
  sources: PerplexitySource[];
}

interface QueryPerplexityParams {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: any;
}

const normalizeSource = (item: any): PerplexitySource | null => {
  if (!item) return null;

  if (typeof item === "string") {
    return { title: item, uri: item };
  }

  const uri = item.uri || item.url || item.link;
  if (!uri || typeof uri !== "string") return null;

  return {
    title: item.title || uri,
    uri,
  };
};

const collectSources = (data: any): PerplexitySource[] => {
  const fromCitations = Array.isArray(data?.citations) ? data.citations : [];
  const fromSearchResults = Array.isArray(data?.search_results) ? data.search_results : [];

  const raw = [...fromCitations, ...fromSearchResults]
    .map(normalizeSource)
    .filter((item): item is PerplexitySource => Boolean(item));

  return raw.filter((source, index, self) => self.findIndex((s) => s.uri === source.uri) === index);
};

export const hasPerplexityKey = (): boolean => Boolean(process.env.PERPLEXITY_API_KEY);

export const queryPerplexity = async ({
  systemPrompt,
  userPrompt,
  temperature = 0.2,
  maxTokens = 1400,
  responseFormat,
}: QueryPerplexityParams): Promise<PerplexityResponse> => {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error("PERPLEXITY_API_KEY non configurata.");
  }

  const model = process.env.PERPLEXITY_MODEL || "sonar-pro";

  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
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

  return {
    text,
    sources: collectSources(payload),
  };
};
