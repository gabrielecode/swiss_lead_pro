import { VercelRequest, VercelResponse } from "@vercel/node";
import { hasGoogleMapsKey, searchGoogleMapsPlaces } from "./google-maps";
import { LOCAL_CH_POPULAR_CATEGORIES } from "./local-ch-categories";

// Accetta sia la chiave OpenRouter che Perplexity per non andare in blocco
const hasPerplexityKey = (): boolean => Boolean(process.env.OPENROUTER_API_KEY || process.env.PERPLEXITY_API_KEY);

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
  maxTokens = 4000,
  responseFormat,
}: {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: any;
}) => {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error("Chiave API non configurata su Vercel.");
  }

  const isOpenRouter = Boolean(process.env.OPENROUTER_API_KEY);
  const endpoint = isOpenRouter ? "https://openrouter.ai/api/v1/chat/completions" : "https://api.perplexity.ai/chat/completions";
  const defaultModel = isOpenRouter ? "google/gemini-flash-1.5" : "sonar-pro";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || process.env.PERPLEXITY_MODEL || defaultModel,
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
    const message = payload?.error?.message || payload?.message || payloadText || "Errore API";
    throw new Error(message);
  }

  const content = payload?.choices?.[0]?.message?.content;
  const text = typeof content === "string" ? content : JSON.stringify(content ?? "");
  if (!text || text === "{}" || text === "[]") {
    throw new Error("Risposta API vuota.");
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

const normalizeSearchTerm = (value: string): string => {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const isLocalChUrl = (value: string): boolean => /https?:\/\/(?:www\.)?local\.ch\//i.test(value);
const isLocalSearchUrl = (value: string): boolean => /https?:\/\/(?:www\.)?localsearch\.ch\//i.test(value);

const decodeHtmlEntities = (value: string): string => {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
};

const cleanHtmlText = (value: string): string => {
  return decodeHtmlEntities(String(value || ""))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const splitLocalChCategories = (value: string): string[] => {
  return cleanHtmlText(value)
    .split(/[•|,/]| - /g)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter((part) => part.length >= 3);
};

const slugToLabel = (value: string): string => {
  return decodeHtmlEntities(value)
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const stripCategoryQualifier = (value: string): string => value.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();

const categoryFromDetailUrl = (value?: string): string => {
  if (!value) return "";
  const match = value.match(/\/it\/d\/[^/]+\/\d+\/([^/]+)\//i);
  return match ? slugToLabel(match[1]) : "";
};

const buildFallbackLeads = (keyword: string, location?: string, radius?: number) => {
  const city = (location || "Svizzera").trim();
  const base = keyword.trim();
  const slugBase = normalizeSlug(base) || "business";
  const slugCity = normalizeSlug(city) || "ch";

  const names = [
    `${base} Sagl`,
    `${base} SA`,
    `${base} GmbH`,
    `${base} ${city}`,
    `${base} di ${city}`,
    `${base} Agenzia ${city}`,
    `${base} Studio ${city}`,
    `${base} Svizzera`,
    `${base} Service ${city}`,
    `${base} Suisse`,
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
    email: sanitizeEmail(lead?.email),
    website: sanitizeWebsite(lead?.website),
    social: toText(lead?.social),
    marketingScore: safeScore,
    auditResult: toText(lead?.auditResult, "Analisi non disponibile"),
    customStrategy: toText(lead?.customStrategy, "Strategia commerciale da definire"),
    source: toText(lead?.source, "live-search"),
    detailUrl: typeof lead?.detailUrl === "string" ? lead.detailUrl.trim() : undefined,
    categories: Array.isArray(lead?.categories)
      ? lead.categories.map((item: any) => String(item).trim()).filter((item: string) => item.length > 0)
      : undefined,
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
  const original = keyword.trim();
  const normalized = normalizeSearchTerm(original);
  const seen = new Set<string>();
  const terms: string[] = [];

  const pushTerm = (value?: string) => {
    const cleaned = String(value || "").replace(/\s+/g, " ").trim();
    if (cleaned.length < 3) return;
    const normalizedValue = normalizeSearchTerm(cleaned);
    if (!normalizedValue || seen.has(normalizedValue)) return;
    seen.add(normalizedValue);
    terms.push(cleaned);
  };

  pushTerm(original);

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
    {
      match: /(event|organizz|matrimon|riceviment|party|festa|congress|catering|banquet|cerimoni)/i,
      synonyms: [
        "organizzazione eventi",
        "event planner",
        "location eventi",
        "sale per eventi",
        "ricevimenti",
        "wedding planner",
        "catering eventi",
      ],
    },
    {
      match: /(ball|danz|sala da ballo|scuola di ballo)/i,
      synonyms: [
        "sala da ballo",
        "scuola di ballo",
        "accademia di danza",
        "organizzazione eventi",
        "location eventi",
      ],
    },
    {
      match: /(ristor|trattor|oster|pizzer|bar|lounge)/i,
      synonyms: [
        "ristorante",
        "sala eventi",
        "ristorante per eventi",
        "location per feste",
      ],
    },
  ];

  for (const rule of domainMap) {
    if (rule.match.test(normalized)) {
      rule.synonyms.forEach(pushTerm);
    }
  }

  const queryTokens = normalized.split(" ").filter((token) => token.length >= 4);
  const matchedCatalogCategories = LOCAL_CH_POPULAR_CATEGORIES
    .map((label) => {
      const normalizedLabel = normalizeSearchTerm(stripCategoryQualifier(label));
      const labelTokens = normalizedLabel.split(" ").filter((token) => token.length >= 4);
      let score = 0;

      if (normalizedLabel === normalized) score += 100;
      if (normalizedLabel.includes(normalized) || normalized.includes(normalizedLabel)) score += 50;

      for (const token of queryTokens) {
        if (labelTokens.includes(token)) {
          score += 18;
          continue;
        }

        if (labelTokens.some((labelToken) => labelToken.startsWith(token) || token.startsWith(labelToken))) {
          score += 10;
        }
      }

      return { label, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 6);

  for (const item of matchedCatalogCategories) {
    pushTerm(item.label);
    pushTerm(stripCategoryQualifier(item.label));
  }

  [
    `servizi ${original}`,
    `${original} professionale`,
    `${original} aziende`,
    `${original} svizzera`,
  ].forEach(pushTerm);

  if (terms.length < 5) {
    [
      `studio ${original}`,
      `agenzia ${original}`,
      `attivita ${original}`,
      `${original} premium`,
    ].forEach(pushTerm);
  }

  return terms.slice(0, 8);
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

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const sanitizeEmail = (value: any): string => {
  if (value === null || value === undefined) return "Non disponibile";
  const raw = String(value).trim().replace(/^mailto:/i, "");
  if (!raw || /^https?:\/\//i.test(raw) || raw.includes("/")) return "Non disponibile";
  return emailRegex.test(raw) ? raw : "Non disponibile";
};

const sanitizeWebsite = (value: any): string => {
  if (value === null || value === undefined) return "Non disponibile";
  const raw = String(value).trim();
  if (!raw || emailRegex.test(raw) || isLocalChUrl(raw) || isLocalSearchUrl(raw)) return "Non disponibile";
  return raw;
};

const extractHttpUrlsFromHtml = (html: string): string[] => {
  const matches = Array.from(html.matchAll(/href="(https?:\/\/[^"]+)"/gi)).map((match) => match[1]);
  return Array.from(new Set(matches));
};

const extractEmailsFromHtml = (html: string): string[] => {
  const mailtoMatches = Array.from(html.matchAll(/mailto:([^"'\\\s<]+)/gi)).map((m) => m[1]);
  const directMatches = html.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];

  const candidates = [...mailtoMatches, ...directMatches]
    .map((value) => String(value).replace(/[\\/,;]+$/g, "").trim())
    .map((value) => sanitizeEmail(value))
    .filter((value) => value !== "Non disponibile")
    .filter((value) => !/localsearch\.ch$/i.test(value) && !/local\.ch$/i.test(value));

  return Array.from(new Set(candidates));
};

const fetchHtmlPage = async (url: string, timeoutMs = 6000): Promise<string | null> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) {
      return null;
    }

    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

const toAbsoluteUrl = (baseUrl: string, candidate: string): string | null => {
  try {
    return new URL(candidate, baseUrl).toString();
  } catch {
    return null;
  }
};

const discoverContactPages = (html: string, websiteUrl: string): string[] => {
  const contactPatterns = /(contact|contatt|kontakt|impressum|chi-siamo|about|support|team)/i;
  const allUrls = extractHttpUrlsFromHtml(html);
  const urlsFromAnchors = Array.from(html.matchAll(/href="([^"]+)"/gi))
    .map((match) => toAbsoluteUrl(websiteUrl, match[1]))
    .filter((value): value is string => Boolean(value));

  return Array.from(new Set([...allUrls, ...urlsFromAnchors]))
    .filter((value) => value.startsWith(new URL(websiteUrl).origin))
    .filter((value) => contactPatterns.test(value))
    .slice(0, 3);
};

const enrichLeadsFromWebsiteContacts = async (leads: any[]) => {
  const enriched = [...leads];
  const targets = enriched
    .map((lead, index) => ({ lead, index }))
    .filter(({ lead }) =>
      lead?.website &&
      lead.website !== "Non disponibile" &&
      lead.email === "Non disponibile" &&
      !isLocalChUrl(lead.website) &&
      !isLocalSearchUrl(lead.website)
    )
    .slice(0, 10);

  const results = await Promise.allSettled(
    targets.map(async ({ lead, index }) => {
      const homepageHtml = await fetchHtmlPage(lead.website);
      if (!homepageHtml) {
        return { index, email: "Non disponibile" };
      }

      const homepageEmails = extractEmailsFromHtml(homepageHtml);
      if (homepageEmails.length > 0) {
        return { index, email: homepageEmails[0] };
      }

      const contactPages = discoverContactPages(homepageHtml, lead.website);
      for (const contactPage of contactPages) {
        const contactHtml = await fetchHtmlPage(contactPage, 5000);
        if (!contactHtml) continue;
        const contactEmails = extractEmailsFromHtml(contactHtml);
        if (contactEmails.length > 0) {
          return { index, email: contactEmails[0] };
        }
      }

      return { index, email: "Non disponibile" };
    }),
  );

  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    const current = enriched[result.value.index];
    if (!current || result.value.email === "Non disponibile") continue;
    enriched[result.value.index] = {
      ...current,
      email: result.value.email,
    };
  }

  return enriched;
};

const extractOfficialWebsitesFromHtml = (html: string): string[] => {
  const websiteLabelIndex = html.toLowerCase().indexOf("sito web");
  const websiteSnippet = websiteLabelIndex >= 0 ? html.slice(websiteLabelIndex, websiteLabelIndex + 3000) : html;
  const websiteMatches = Array.from(websiteSnippet.matchAll(/href="(https?:\/\/[^"]+)"/gi))
    .map((match) => sanitizeWebsite(match[1]))
    .filter((value) => value !== "Non disponibile");

  return Array.from(new Set(websiteMatches));
};

const extractContactGroupBlock = (html: string, label: string): string => {
  const labelIndex = html.toLowerCase().indexOf(label.toLowerCase());
  if (labelIndex < 0) return "";

  const windowStart = Math.max(0, labelIndex - 200);
  const windowEnd = Math.min(html.length, labelIndex + 2500);
  return html.slice(windowStart, windowEnd);
};

const extractPhonesFromHtml = (html: string): string[] => {
  const phoneMatches = Array.from(html.matchAll(/href="tel:([^"]+)"/gi))
    .map((match) => cleanHtmlText(match[1]))
    .filter(Boolean);

  return Array.from(new Set(phoneMatches));
};

const extractLocalChStructuredBusiness = (html: string) => {
  const matches = Array.from(html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi));
  const queue: any[] = [];

  for (const match of matches) {
    const payload = match[1]?.trim();
    if (!payload) continue;
    try {
      queue.push(JSON.parse(payload));
    } catch {
      continue;
    }
  }

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }
    if (typeof current !== "object") continue;
    if (Array.isArray(current["@graph"])) {
      queue.push(...current["@graph"]);
    }

    const types = Array.isArray(current["@type"]) ? current["@type"] : [current["@type"]];
    if (types.some((type) => typeof type === "string" && /localbusiness|organization/i.test(type))) {
      return current;
    }
  }

  return null;
};

const extractLocalChContactDetails = async (profileUrl: string) => {
  if (!isLocalChUrl(profileUrl)) {
    return {
      email: "Non disponibile",
      website: "Non disponibile",
      phone: "Non disponibile",
      address: "Non disponibile",
      sector: "",
      categories: [] as string[],
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(profileUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return { email: "Non disponibile", website: "Non disponibile" };
    }

    const html = await response.text();
    const structured = extractLocalChStructuredBusiness(html);
    const emails = extractEmailsFromHtml(html);
    const emailBlock = extractContactGroupBlock(html, "E-mail");
    const websiteBlock = extractContactGroupBlock(html, "Sito web");
    const phoneBlock = extractContactGroupBlock(html, "Telefono");
    const websites = extractOfficialWebsitesFromHtml(websiteBlock || html);
    const phones = extractPhonesFromHtml(phoneBlock || html);
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const titleText = cleanHtmlText(titleMatch?.[1] || "");
    const sectorFromTitleMatch = titleText.match(/^[^-]+-\s*(.+?)\s+a\s+.+?\|\s*local\.ch$/i);
    const structuredAddress = structured?.address
      ? [
          structured.address.streetAddress,
          structured.address.postalCode,
          structured.address.addressLocality,
          structured.address.addressCountry,
        ].filter(Boolean).join(", ")
      : "";
    const structuredCategories = Array.from(new Set([
      ...splitLocalChCategories(sectorFromTitleMatch?.[1] || ""),
      ...splitLocalChCategories(categoryFromDetailUrl(profileUrl)),
    ]));

    return {
      email: emails[0] || "Non disponibile",
      website: sanitizeWebsite(structured?.sameAs || structured?.url) !== "Non disponibile"
        ? sanitizeWebsite(structured?.sameAs || structured?.url)
        : websites[0] || "Non disponibile",
      phone: structured?.telephone || phones[0] || "Non disponibile",
      address: structuredAddress || "Non disponibile",
      sector: sectorFromTitleMatch?.[1] || categoryFromDetailUrl(profileUrl),
      categories: structuredCategories,
    };
  } catch {
    return {
      email: "Non disponibile",
      website: "Non disponibile",
      phone: "Non disponibile",
      address: "Non disponibile",
      sector: "",
      categories: [] as string[],
    };
  } finally {
    clearTimeout(timeout);
  }
};

const enrichLocalChLeads = async (leads: any[]) => {
  const enriched = [...leads];
  const targets = enriched
    .map((lead, index) => ({ lead, index }))
    .filter(({ lead }) =>
      lead?.source === "local.ch" &&
      typeof lead?.detailUrl === "string" &&
      lead.detailUrl.length > 0 &&
      (
        lead.email === "Non disponibile" ||
        lead.website === "Non disponibile" ||
        lead.phone === "Non disponibile" ||
        lead.address === "Non disponibile"
      )
    )
    .slice(0, 18);

  const results = await Promise.allSettled(
    targets.map(async ({ lead, index }) => ({
      index,
      details: await extractLocalChContactDetails(lead.detailUrl),
    })),
  );

  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    const current = enriched[result.value.index];
    if (!current) continue;

    const { email, website, phone, address, sector, categories } = result.value.details;
    enriched[result.value.index] = {
      ...current,
      email: current.email !== "Non disponibile" ? current.email : email,
      website: current.website !== "Non disponibile" ? current.website : website,
      phone: current.phone !== "Non disponibile" ? current.phone : phone,
      address: current.address !== "Non disponibile" ? current.address : address,
      sector: current.sector && current.sector !== "Non disponibile" && current.sector !== current.source ? current.sector : (sector || current.sector),
      categories: Array.from(new Set([...(current.categories || []), ...(categories || [])])),
    };
  }

  return enriched;
};

const deriveLocalChAssociatedKeywords = (leads: any[], seedTerms: string[]) => {
  const seen = new Set(seedTerms.map((term) => normalizeSearchTerm(term)));
  const discovered: string[] = [];
  const pushTerm = (value?: string) => {
    const cleaned = String(value || "").replace(/\s+/g, " ").trim();
    const normalized = normalizeSearchTerm(cleaned);
    if (cleaned.length < 3 || !normalized || seen.has(normalized)) return;
    seen.add(normalized);
    discovered.push(cleaned);
  };

  for (const lead of leads) {
    splitLocalChCategories(lead?.sector || "").forEach(pushTerm);
    splitLocalChCategories(categoryFromDetailUrl(lead?.detailUrl)).forEach(pushTerm);
    if (Array.isArray(lead?.categories)) {
      lead.categories.forEach(pushTerm);
    }
  }

  return discovered.slice(0, 6);
};

const parseLocalChHtmlCards = (html: string, keyword: string, location?: string) => {
  const results = new Map<string, any>();
  const cardRegex = /href="(\/it\/d\/[^"]+)"[\s\S]{0,800}?<h2[^>]*>([^<]+)<\/h2>[\s\S]{0,300}?<span[^>]*>([^<]+)<\/span>/gi;
  const forbiddenPatterns = [
    /Filtrabile per/i,
    /I migliori/i,
    /Migliori servizi/i,
    /Trova il tuo/i,
    /Offerte/i,
    /\blocal\.ch\b/i,
    /pubblicit|annuncio|sponsored|advert/i,
    /[🔥⭐]/,
  ];
  let match: RegExpExecArray | null;

  while ((match = cardRegex.exec(html))) {
    const detailUrl = `https://www.local.ch${match[1]}`;
    const company = cleanHtmlText(match[2]);
    const categoryLabel = cleanHtmlText(match[3]);
    const categories = splitLocalChCategories(categoryLabel);
    const sector = categories[0] || categoryFromDetailUrl(detailUrl) || keyword;

    if (!company || forbiddenPatterns.some((pattern) => pattern.test(company))) {
      continue;
    }

    if (!results.has(detailUrl)) {
      results.set(detailUrl, {
        company,
        sector,
        address: `${location || "Svizzera"}, Svizzera`,
        phone: "Non disponibile",
        email: "Non disponibile",
        website: "Non disponibile",
        social: "Non disponibile",
        marketingScore: 58,
        auditResult: `Lead individuato da local.ch nella categoria ${sector}.`,
        customStrategy: "Contatto commerciale locale con focus geolocalizzato.",
        source: "local.ch",
        detailUrl,
        categories,
      });
    }
  }

  return Array.from(results.values());
};

const scoreLeadQuality = (lead: any): number => {
  let score = 0;
  if (lead?.email && lead.email !== "Non disponibile") score += 3;
  if (lead?.website && lead.website !== "Non disponibile") score += 2;
  if (lead?.phone && lead.phone !== "Non disponibile") score += 1;
  if (lead?.source === "google-maps") score += 2;
  if (lead?.source === "local.ch") score += 1;
  return score;
};

const parseLocalChLeads = (html: string, keyword: string, location?: string) => {
  const leads: any[] = [];
  const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const matches = Array.from(html.matchAll(scriptRegex));
  const extractedEmails = extractEmailsFromHtml(html);

  // FILTRI RIGIDI: Scarta pubblicità, menu e il sito stesso
  const forbiddenPatterns = [
    /Filtrabile per/i, 
    /I migliori/i, 
    /Migliori servizi/i,
    /Trova il tuo/i, 
    /Offerte/i, 
    /\blocal\.ch\b/i,
    /pubblicit|annuncio|sponsored|advert/i,
    /[🔥⭐]/,
  ];

  const pushLead = (item: any) => {
    const name = item?.name || item?.legalName;
    if (!name || typeof name !== "string") return;
    
    // Blocca il caricamento se corrisponde a una pubblicità
    if (forbiddenPatterns.some(pattern => pattern.test(name.trim()))) return;

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
      email: sanitizeEmail(item?.email),
      website: sanitizeWebsite(item?.url),
      social: "Non disponibile",
      marketingScore: 58,
      auditResult: "Lead individuato da local.ch",
      customStrategy: "Contatto commerciale locale con focus geolocalizzato.",
      source: "local.ch",
      detailUrl: typeof item?.url === "string" ? item.url : undefined,
      categories: splitLocalChCategories(categoryFromDetailUrl(typeof item?.url === "string" ? item.url : "")),
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

  const htmlCardLeads = parseLocalChHtmlCards(html, keyword, location);
  const deduped = dedupeLeads(leads.concat(htmlCardLeads));
  return deduped.map((lead) => {
    if (lead.email && lead.email !== "Non disponibile") return lead;
    const matchingEmail = extractedEmails.find((email) => {
      const domain = email.split("@")[1] || "";
      const companySlug = normalizeSlug(lead.company || "");
      return companySlug.length > 0 && domain.replace(/\.[^.]+$/, "").includes(companySlug.slice(0, 6));
    });
    return matchingEmail ? { ...lead, email: matchingEmail } : lead;
  }).slice(0, 45);
};

const searchLocalCh = async (keyword: string, location?: string) => {
  const where = location && location.trim().length > 0 ? location.trim() : "Svizzera";
  // FIX: la riga precedente conteneva un link in stile Markdown incollato per errore
  // dentro la template literal, rendendo l'URL invalido e {encodeURIComponent(keyword)}
  // un testo letterale (mancava il simbolo $ per l'interpolazione).
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
    const searchedKeywords = [...associatedKeywords];
    let aggregatedLeads: any[] = [];
    let aggregatedSources: { title: string; uri: string }[] = [];

    if (hasGoogleMapsKey()) {
      const googleTerms = associatedKeywords.slice(0, 4);
      const googleResults = await Promise.allSettled(
        googleTerms.map((term) => searchGoogleMapsPlaces(term, effectiveLocation, radiusValue)),
      );

      for (const result of googleResults) {
        if (result.status !== "fulfilled") continue;
        aggregatedLeads = aggregatedLeads.concat(
          result.value.map((lead) =>
            normalizeLead(
              {
                ...lead,
                email: "Non disponibile",
                detailUrl: lead.googleMapsUrl,
                auditResult: "Lead individuato tramite Google Maps Places.",
                customStrategy: "Contatto commerciale locale basato sulla scheda Google Maps e sulla presenza digitale.",
              },
              effectiveKeyword,
            ),
          ),
        );
      }
    }

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
        "La risposta deve essere un oggetto con chiave leads che contains un array.",
        "Ogni lead deve avere: company, sector, address, phone, email, website, social, marketingScore, auditResult, customStrategy, source.",
        "Usa solo aziende reali e pertinenti alla localita richiesta.",
        "Non inventare email, siti web, telefoni o indirizzi: se non verificabili usa 'Non disponibile'.",
        "Non usare markdown, nessun testo extra.",
      ].join(" ");

      const termsToSearch = associatedKeywords.slice(0, 6);
      const perplexityTasks = termsToSearch.map(async (term) => {
        const userPrompt = `Trova almeno 30 aziende nel settore "${term}" ${effectiveLocation ? `a ${effectiveLocation}` : "in Svizzera"}${radiusValue > 0 ? ` entro ${radiusValue} km` : ""}.`;
        const aiResult = await queryPerplexity({
          systemPrompt,
          userPrompt,
          temperature: 0.2,
          maxTokens: 4000,
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
        }
      }
    }

    // Estrazione e unione dei dati reali da Local.ch
    const runLocalChBatch = async (terms: string[]) => {
      const localResultsSettled = await Promise.allSettled(terms.map((term) => searchLocalCh(term, effectiveLocation)));
      const collected: any[] = [];
      for (const result of localResultsSettled) {
        if (result.status === "fulfilled" && result.value.length > 0) {
          collected.push(...result.value);
        }
      }
      return collected;
    };

    const initialLocalTerms = associatedKeywords.slice(0, 4);
    let localLeads = await runLocalChBatch(initialLocalTerms);
    const discoveredCategoryTerms = deriveLocalChAssociatedKeywords(localLeads, searchedKeywords);

    for (const term of discoveredCategoryTerms) {
      searchedKeywords.push(term);
    }

    if (discoveredCategoryTerms.length > 0) {
      localLeads = localLeads.concat(await runLocalChBatch(discoveredCategoryTerms));
    }

    for (const lead of localLeads.map((lead) => normalizeLead(lead, effectiveKeyword))) {
      aggregatedLeads.push(lead);
    }

    let finalLeads = dedupeLeads(aggregatedLeads);
    finalLeads = await enrichLocalChLeads(finalLeads);
    finalLeads = await enrichLeadsFromWebsiteContacts(finalLeads);
    finalLeads = dedupeLeads(finalLeads)
      .sort((left, right) => scoreLeadQuality(right) - scoreLeadQuality(left) || left.company.localeCompare(right.company));

    const finalSources = aggregatedSources
      .filter((source, index, self) => self.findIndex((item) => item.uri === source.uri) === index)
      .slice(0, 10);

    return res.json({
      success: true,
      leads: finalLeads.slice(0, 30),
      searchedKeywords: Array.from(new Set(searchedKeywords)),
      sources: finalSources,
      message: finalLeads.length === 0
        ? `Nessun lead verificato trovato per "${effectiveKeyword}"${effectiveLocation ? ` a ${effectiveLocation}` : ""}. Prova con una localita piu precisa o un termine correlato.`
        : undefined,
    });

  } catch (error: any) {
    console.error("[Lead Generation Error]", error);
    res.status(500).json({
      error: error?.message || "Errore nella generazione dei lead",
    });
  }
}
