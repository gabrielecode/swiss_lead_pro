/**
 * Local.ch Integration Module
 * Integra le ricerche su local.ch (portale svizzero di ricerca locale)
 */

export interface LocalChResult {
  name: string;
  sector: string;
  address: string;
  phone?: string;
  email?: string;
  website?: string;
  canton: string;
  rating?: number;
  source: "local.ch";
}

/**
 * Ricerca aziende su local.ch
 * Simula una ricerca su local.ch e estrae i risultati
 */
export async function searchLocalCh(
  keyword: string,
  location: string,
  canton?: string
): Promise<LocalChResult[]> {
  try {
    // URL di ricerca local.ch
    const searchQuery = encodeURIComponent(`${keyword} ${location}`);
    const localChUrl = `https://www.local.ch/it/q/${searchQuery}`;

    console.log(`[Local.ch Search] Cercando: ${keyword} a ${location}`);
    console.log(`[Local.ch URL] ${localChUrl}`);

    // In un ambiente di produzione, faremmo un fetch e parsing HTML
    // Per ora, ritorniamo risultati mock per dimostrare l'integrazione
    const mockResults: LocalChResult[] = [
      {
        name: `${keyword} - Local.ch Result 1`,
        sector: keyword,
        address: `Via ${location}, Svizzera`,
        canton: canton || "ZH",
        rating: 4.5,
        source: "local.ch",
      },
      {
        name: `${keyword} - Local.ch Result 2`,
        sector: keyword,
        address: `Piazza ${location}, Svizzera`,
        canton: canton || "ZH",
        rating: 4.2,
        source: "local.ch",
      },
    ];

    return mockResults;
  } catch (error) {
    console.error("[Local.ch Search Error]", error);
    return [];
  }
}

/**
 * Combina risultati da Gemini + local.ch
 */
export async function combineGeminiAndLocalCh(
  geminiLeads: any[],
  localChLeads: LocalChResult[]
): Promise<any[]> {
  // Deduplica e combina i risultati
  const combined = [...geminiLeads];

  // Aggiungi risultati da local.ch che non sono già in geminiLeads
  for (const localLead of localChLeads) {
    const exists = combined.some(
      (g) =>
        g.company.toLowerCase().includes(localLead.name.toLowerCase()) ||
        g.address.toLowerCase().includes(localLead.address.toLowerCase())
    );

    if (!exists) {
      combined.push({
        company: localLead.name,
        sector: localLead.sector,
        address: localLead.address,
        phone: localLead.phone || "Non disponibile",
        email: localLead.email || "Non disponibile",
        website: localLead.website || "Non disponibile",
        social: "Non disponibile",
        marketingScore: 55,
        auditResult: `Trovato su local.ch, portale di ricerca locale svizzero. Rating: ${localLead.rating}/5`,
        customStrategy:
          "Contatto diretto tramite local.ch per integrazione profilo e verificazione dati.",
        source: "local.ch",
      });
    }
  }

  return combined;
}
