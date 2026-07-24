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
      openrouterModel: process.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct:free",
    },
  };

  // Test 1: local.ch — fetch + parse
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(
      "https://www.local.ch/it/q?what=idraulico&where=Lugano",
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "text/html",
        },
        signal: ctrl.signal,
      }
    );
    clearTimeout(t);
    const body = await r.text();
    // Count indicators in different contexts
    const businessCount = (body.match(/LocalBusiness|"@type":"LocalBusiness"/g) || []).length;
    const ldJsonTags = (body.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>/gi) || []).length;
    const detailLinks = (body.match(/href="\/it\/d\//g) || []).length;
    const hasNextData = body.includes('id="__NEXT_DATA__"') || body.includes("__NEXT_DATA__");
    const nameMatches = body.match(/"name":"([^"]{3,60})"/g) || [];
    const sampleNames = nameMatches.slice(0, 5).map((s: string) => s.replace(/"name":"/, "").replace(/"$/, ""));

    // Check first ld+json tag content + nested keys - FULL extraction
    const fullLdMatch = body.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
    let firstLdTopKeys: string[] = [];
    let firstLdMainEntityType = "";
    let firstLdItemListSample: string[] = [];
    let firstLdItemCount = 0;
    if (fullLdMatch) {
      try {
        const parsed = JSON.parse(fullLdMatch[1].trim());
        const entry = Array.isArray(parsed) ? parsed[0] : parsed;
        firstLdTopKeys = Object.keys(entry || {});
        const mainEntity = entry?.mainEntity;
        if (mainEntity) {
          firstLdMainEntityType = mainEntity?.["@type"] || "";
          const items = mainEntity?.itemListElement;
          if (Array.isArray(items)) {
            firstLdItemCount = items.length;
            firstLdItemListSample = items.slice(0, 5).map((i: any) => {
              const biz = i?.item || i;
              return biz?.name || JSON.stringify(biz).slice(0, 40);
            });
          }
        }
      } catch (e: any) {
        firstLdTopKeys = ["PARSE_ERROR: " + e?.message?.slice(0, 100)];
      }
    }

    results.localch = {
      status: r.status,
      ok: r.ok,
      bodyLength: body.length,
      ldJsonTagCount: ldJsonTags,
      businessMatches: businessCount,
      detailLinks,
      hasNextData,
      firstLdTopKeys,
      firstLdMainEntityType,
      firstLdItemCount,
      firstLdItemListSample,
      sampleNames,
    };
  } catch (e: any) {
    results.localch = { error: e?.message || "fetch failed" };
  }

  // Test 2: Google Maps Places API
  if (process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY) {
    try {
      const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey!,
          "X-Goog-FieldMask": "places.id,places.displayName",
        },
        body: JSON.stringify({ textQuery: "idraulico Lugano Svizzera", languageCode: "it", regionCode: "CH", maxResultCount: 3 }),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      const data = await r.json();
      results.googleMaps = {
        status: r.status,
        ok: r.ok,
        placesFound: Array.isArray(data.places) ? data.places.length : 0,
        error: data.error?.message || null,
      };
    } catch (e: any) {
      results.googleMaps = { error: e?.message };
    }
  }

  // Test 3: OpenRouter AI
  if (process.env.OPENROUTER_API_KEY) {
    try {
      const model = process.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct:free";
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://swiss-lead-pro.vercel.app",
        },
        body: JSON.stringify({
          model,
          max_tokens: 10,
          messages: [{ role: "user", content: "say hi" }],
        }),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      const data = await r.json();
      results.openrouter = {
        status: r.status,
        ok: r.ok,
        model,
        error: data.error?.message || null,
      };
    } catch (e: any) {
      results.openrouter = { error: e?.message };
    }
  }

  return res.json(results);
}
