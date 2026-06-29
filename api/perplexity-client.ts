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

export const hasPerplexityKey = (): boolean => Boolean(process.env.OPENROUTER_API_KEY);

export const queryPerplexity = async ({
  systemPrompt,
  userPrompt,
  temperature = 0.2,
  maxTokens = 1400,
  responseFormat,
}: QueryPerplexityParams): Promise<PerplexityResponse> => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY non configurata.");

  const model = process.env.OPENROUTER_MODEL || "mistralai/mistral-7b-instruct";

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.APP_URL || "https://localhost",
      "X-Title": "Swiss Lead Pro",
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
    const message = payload?.error?.message || payloadText || "Errore API OpenRouter";
    throw new Error(message);
  }

  const content = payload?.choices?.[0]?.message?.content;
  const text = typeof content === "string" ? content : JSON.stringify(content ?? "");

  if (!text || text === "{}" || text === "[]") {
    throw new Error("Risposta OpenRouter non valida o vuota.");
  }

  return { text, sources: [] };
};
