import { VercelRequest, VercelResponse } from "@vercel/node";

const hasAiKey = (): boolean =>
  Boolean(process.env.OPENROUTER_API_KEY || process.env.PERPLEXITY_API_KEY);

async function callAI(text: string): Promise<string[]> {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.PERPLEXITY_API_KEY;
  const isOpenRouter = Boolean(process.env.OPENROUTER_API_KEY);
  const endpoint = isOpenRouter
    ? "https://openrouter.ai/api/v1/chat/completions"
    : "https://api.perplexity.ai/chat/completions";
  const defaultModel = isOpenRouter
    ? "mistralai/mistral-7b-instruct"
    : "sonar-pro";

  const systemPrompt =
    "Sei un esperto di marketing digitale. Il tuo compito è estrarre un elenco di servizi o prodotti offerti da un sito web, leggendo il testo della homepage.";

  const userPrompt = `Dal seguente testo estratto da un sito web, elenca SOLO i servizi o prodotti offerti (es. 'Web Design', 'SEO', 'Social Media Marketing'). Restituisci SOLO un array JSON di stringhe brevi (max 6 parole ciascuna), senza spiegazioni. Esempio: ["Web Design", "SEO Locale", "Google Ads"]. Testo:\n\n${text.slice(0, 4000)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(isOpenRouter ? { "HTTP-Referer": "https://swiss-lead-pro.vercel.app" } : {}),
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || process.env.PERPLEXITY_MODEL || defaultModel,
      temperature: 0.2,
      max_tokens: 400,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI error ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "";

  // Try to parse JSON array from response
  const match = content.match(/\[[\s\S]*?\]/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) {
        return parsed.filter((s) => typeof s === "string" && s.trim()).slice(0, 12);
      }
    } catch {
      // fallback below
    }
  }

  // Fallback: split by newlines/commas
  return content
    .split(/[\n,]/)
    .map((s) => s.replace(/^[-*\d.\s"']+|["']+$/g, "").trim())
    .filter((s) => s.length > 2 && s.length < 80)
    .slice(0, 12);
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { url } = req.body ?? {};
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "URL obbligatorio" });
  }

  let normalizedUrl = url.trim();
  if (!/^https?:\/\//i.test(normalizedUrl)) normalizedUrl = "https://" + normalizedUrl;

  try {
    new URL(normalizedUrl);
  } catch {
    return res.status(400).json({ error: "URL non valido" });
  }

  try {
    // Fetch website HTML
    const fetchRes = await fetch(normalizedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SwissLeadPro/1.0)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined,
    });

    if (!fetchRes.ok) {
      return res.status(502).json({ error: `Impossibile raggiungere il sito (HTTP ${fetchRes.status})` });
    }

    const html = await fetchRes.text();
    const plainText = stripHtml(html);

    if (!hasAiKey()) {
      // Fallback: try to extract keywords from meta tags / title
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
      const title = titleMatch ? titleMatch[1].trim() : "";
      const desc = descMatch ? descMatch[1].trim() : "";
      const fallback = [title, desc].filter(Boolean).join(" — ");
      return res.json({ services: fallback ? [fallback] : ["Servizi non estratti (AI non configurata)"] });
    }

    const services = await callAI(plainText);
    return res.json({ services });
  } catch (err: any) {
    console.error("[extract-services]", err);
    return res.status(500).json({ error: err?.message || "Errore durante l'estrazione" });
  }
}
