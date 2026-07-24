import { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    env: {
      hasOpenRouter: Boolean(process.env.OPENROUTER_API_KEY),
      hasPerplexity: Boolean(process.env.PERPLEXITY_API_KEY),
      hasGoogleMaps: Boolean(process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY),
    },
  };

  // Test 1: local.ch reachable?
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(
      "https://www.local.ch/it/q?what=idraulico&where=Lugano",
      {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; SwissLeadPro/1.0)" },
        signal: ctrl.signal,
      }
    );
    clearTimeout(t);
    const body = await r.text();
    results.localch = {
      status: r.status,
      ok: r.ok,
      preview: body.slice(0, 300),
      hasResults: body.includes("data-testid") || body.includes("ContactGroup") || body.includes("LocalBusiness"),
    };
  } catch (e: any) {
    results.localch = { error: e?.message || "fetch failed" };
  }

  // Test 2: OpenRouter reachable?
  if (process.env.OPENROUTER_API_KEY) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.OPENROUTER_MODEL || "google/gemini-flash-1.5",
          max_tokens: 10,
          messages: [{ role: "user", content: "say hi" }],
        }),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      results.openrouter = { status: r.status, ok: r.ok };
    } catch (e: any) {
      results.openrouter = { error: e?.message || "fetch failed" };
    }
  }

  return res.json(results);
}
