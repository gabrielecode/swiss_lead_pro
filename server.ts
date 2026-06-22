import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { searchLocalCh, combineGeminiAndLocalCh } from "./local-ch-integration";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Key helper
  const getGenAIClient = (req: express.Request): GoogleGenAI => {
    const clientKey = req.headers["x-gemini-key"] as string | undefined;
    const activeKey = clientKey || process.env.GEMINI_API_KEY;

    if (!activeKey) {
      throw new Error("API Key di Gemini non configurata sul server. Per favore, inserisci la tua chiave API personale di Gemini nell'apposito campo 'Quota/API Key Gemini (Opzionale)' direttamente nel modulo d'estrazione del Lead Generator, oppure configurala tra i Secrets.");
    }

    return new GoogleGenAI({
      apiKey: activeKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  };

  // A helper function to call Google Gemini with automatic transient error retry and cascading model fallback to handle temporary 503 load spikes seamlessly.
  const generateWithFallbackAndRetry = async (
    activeGenAI: GoogleGenAI,
    contents: string | any[],
    systemInstruction: string,
    useGrounding = true
  ) => {
    // Latest Gemini models in order of preference
    // 2.5-pro: Newest, most capable (May 2025)
    // 2.5-flash: Fast, reliable alternative
    // 2.0-flash: Stable proven model
    // All support Google Search grounding
    const models = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"];
    let lastError: any;

    for (const model of models) {
      const retries = 3;
      let delayMs = 1500;
      console.log(`[Gemini Execution] Attempting generation with model ${model} (Grounding: ${useGrounding})...`);

      for (let i = 0; i < retries; i++) {
        try {
          const config: any = {
            systemInstruction,
            generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
            }
          };
          if (useGrounding) {
            config.tools = [{ googleSearch: {} }];
          }

          const response = await activeGenAI.models.generateContent({
            model,
            contents,
            ...config,
          } as any);
          console.log(`[Gemini Execution] ✅ Success with model ${model}`);
          return response;
        } catch (error: any) {
          lastError = error;
          const errStr = (typeof error === "object" && error !== null) ? (error.message || JSON.stringify(error)) : String(error);
          const isTransient = errStr.includes("503") || errStr.includes("UNAVAILABLE") || errStr.toLowerCase().includes("high demand") || errStr.toLowerCase().includes("temporary spikes") || errStr.toLowerCase().includes("unavailable") || errStr.toLowerCase().includes("timeout");
          
          if (isTransient) {
            if (i < retries - 1) {
              console.warn(`[Gemini Retry] Transient error on model ${model}. Retrying attempt ${i + 2}/${retries} in ${delayMs}ms... Error: ${errStr.substring(0, 80)}`);
              await new Promise((resolve) => setTimeout(resolve, delayMs));
              delayMs *= 2; // Exponential backoff
              continue;
            } else {
              console.warn(`[Gemini Fallback] Model ${model} failed after ${retries} retries. Trying next fallback model...`);
            }
          } else {
            // Throw immediate non-transient errors (e.g. invalid key, quota 429, permission error)
            console.error(`[Gemini Error] Non-transient error with ${model}: ${errStr.substring(0, 120)}`);
            throw error;
          }
        }
      }
    }
    
    throw lastError;
  };

  // Smart AI Search Assistant API
  app.post("/api/ask-ai", async (req, res) => {
    try {
      const { prompt, cantonCode, language } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Il prompt è obbligatorio" });
      }

      let activeGenAI: GoogleGenAI;
      try {
        activeGenAI = getGenAIClient(req);
      } catch (err: any) {
        return res.status(401).json({ error: err.message });
      }

      const systemInstruction = `Sei un assistente esperto e intelligente portale di ricerca per Tutta la Svizzera (comuni, cantoni, leggi, attualità, lavoro, alloggi, trasporti).
Rispondi in modo cordiale, preciso, estremamente esaustivo e in lingua ${language || "italiana"}.
Se il contesto menziona un canton specifico (${cantonCode || "nessun cantone selezionato"}), forniscimi informazioni su di esso ma contestualizza sempre a livello svizzero generale con confronti, differenze o requisiti federali se applicabile.
Usa un formato elegante con paragrafi, titoli Markdown e icone evocative.
Se l'utente cerca lavoro, appartamenti, informazioni su imposte o permessi (come permessi L, B, C, G per frontalieri), rispondi con l'esatta procedura o indicazioni ufficiali svizzere.`;

      // Call Gemini with automatic transient error retry and model fallback
      const response = await generateWithFallbackAndRetry(
        activeGenAI,
        prompt,
        systemInstruction,
        true // useGrounding
      );

      const answer = response.text || "Nessun risultato generato.";

      // Extract search grounding metadata if available for citations
      const searchMetadata = response.candidates?.[0]?.groundingMetadata;
      const sources = searchMetadata?.groundingChunks?.map((chunk: any) => ({
        title: chunk.web?.title || chunk.web?.uri,
        uri: chunk.web?.uri,
      })) || [];

      res.json({
        answer,
        sources: sources.filter((item: any, index: number, self: any[]) => 
          self.findIndex((t: any) => t.uri === item.uri) === index
        ).slice(0, 5) // unique links, top 5
      });
    } catch (error: any) {
      console.error("Gemini API Error in Server:", error);
      let errMsg = error.message || "Errore sconosciuto nell'elaborazione della risposta con Gemini.";
      const errStr = (typeof error === "object" && error !== null) ? (error.message || JSON.stringify(error)) : String(error);
      
      if (errStr.includes("429") || errStr.toLowerCase().includes("quota") || errStr.includes("RESOURCE_EXHAUSTED") || errStr.toLowerCase().includes("limit")) {
        errMsg = "Attenzione durante l'elaborazione dell'assistente: Quota gratuita esaurita per il server del portale (Errore 429: RESOURCE_EXHAUSTED). Per continuare a usare in tempo reale l'Assistente Intelligente con Google Search Grounding integrato, ti consigliamo di inserire la tua chiave API personale di Gemini nell'apposito campo in alto o nel modulo d'estrazione.";
      } else if (errStr.includes("503") || errStr.includes("UNAVAILABLE") || errStr.toLowerCase().includes("high demand") || errStr.toLowerCase().includes("temporary spikes") || errStr.toLowerCase().includes("unavailable")) {
        errMsg = "I server di Google Gemini sono attualmente sovraccarichi (Errore 503: Service Unavailable o alta densità di richieste). Si tratta di un rallentamento temporaneo dei sistemi di Google. Ti invitiamo a riprovare tra pochissimi secondi o ad inserire la tua chiave API personale di Gemini nell'apposito campo in alto o nel modulo d'estrazione.";
      }
      res.status(500).json({
        error: errMsg,
      });
    }
  });  // Premium Lead Generator API with Search Grounding
  app.post("/api/generate-leads", async (req, res) => {
    try {
      const { keyword, location, canton, radius } = req.body;
      
      if (!keyword) {
        return res.status(400).json({ error: "La parola chiave o settore è obbligatorio" });
      }

      let activeGenAI: GoogleGenAI;
      try {
        activeGenAI = getGenAIClient(req);
      } catch (err: any) {
        return res.status(401).json({ error: err.message });
      }

      const radiusText = radius && Number(radius) > 0 ? `con espansione raggio di ${radius} km nei comuni limitrofi` : "area esatta";

      // STEP 1: Generate related keywords/terms
      console.log(`[Lead Generation] Generando termini correlati a "${keyword}"...`);
      
      const keywordGenerationSystemInstruction = `Sei un esperto di ricerca commerciale svizzera. Generi termini di ricerca correlati per massimizzare il reach della lead generation.
Dato il keyword principale, genera 6-8 termini correlati, sinonimi e varianti che aiutino a trovare TUTTE le aziende rilevanti.
Rispondi ESCLUSIVAMENTE con un array JSON di stringhe, niente altro.
Esempio per "parrucchiere": ["parrucchiere", "parrucchiera", "barbiere", "salone di capelli", "hairdesigner", "taglio capelli", "salone unisex", "hairstylist"]`;

      const keywordResponse = await generateWithFallbackAndRetry(
        activeGenAI,
        `Genera termini di ricerca correlati per: "${keyword}". Lingua: italiano. Rispondi con solo un array JSON.`,
        keywordGenerationSystemInstruction,
        false // useGrounding: no, solo generazione
      );

      const keywordRawText = keywordResponse.text || '["' + keyword + '"]';
      let relatedKeywords: string[] = [keyword];
      
      try {
        let cleaned = keywordRawText.trim();
        if (cleaned.startsWith("```json")) {
          cleaned = cleaned.substring(7);
        } else if (cleaned.startsWith("```")) {
          cleaned = cleaned.substring(3);
        }
        if (cleaned.endsWith("```")) {
          cleaned = cleaned.substring(0, cleaned.length - 3);
        }
        cleaned = cleaned.trim();
        
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed) && parsed.length > 0) {
          relatedKeywords = parsed;
          console.log(`[Lead Generation] Termini correlati generati: ${relatedKeywords.join(", ")}`);
        }
      } catch (e) {
        console.warn("[Lead Generation] Errore nel parsing dei termini correlati, uso solo il keyword principale");
        relatedKeywords = [keyword];
      }

      // STEP 2: Execute searches for each keyword
      const systemInstruction = `Sei l'algoritmo centrale di "Swiss Business Crawler" (SBC), uno strumento premium di Lead Generation ad alta densità per tutte le 26 regioni e cantoni svizzeri.
Il tuo obiettivo principale è individuare aziende SVIZZERE REALI operanti nel settore richiesto, raccogliere i dati accurati ed effettuare email intelligence di alta precisione utilizzando Google Search Grounding.

SOTTO-ALGORITMO DEEP SEARCH (ALTISSIMA DENSITÀ):
- Se l'area geografica è una città svizzera principale o media (esempio: Lugano, Zurigo, Ginevra, Berna, Basilea, Losanna, Bellinzona, Chiasso, Locarno, San Gallo, San Gallo, Aarau, Zugo, Friburgo, Neuchâtel):
  Spacca internamente la query in micro-aree, quartieri, CAP (NPA) o vie adiacenti svizzere (per es. a Lugano cerca a Besso, Paradiso, Pregassona, Viganello, Melide, ecc. A Zurigo cerca ad Altstetten, Oerlikon, Wiedikon, Seefeld. A Bellinzona cerca a Giubiasco, Gnosca, Monte Carasso) e analizza i risultati cumulativamente per garantire oltre 10-15 contatti e-mail reali di target B2B.
- Se viene specificato un raggio d'azione (> 0 km), espandi esponenzialmente l'analisi ai piccoli villaggi e comuni confinanti entro la fascia chilometrica indicativa.

COGNITIVE EMAIL INTELLIGENCE ENGINE:
- Per ogni azienda, effettua una query di validazione internet mirata (come site:[dominio] email OR "contatto" OR "info@" OR "scrivici") per estrarre l'indirizzo email REALE e ATTIVO del business (es: info@nomeazienda.ch).
- Non utilizzare mai email segnaposto o fittizie. Se l'email non è pubblicamente visibile su internet o sul sito, indica "Non disponibile" o "Contatto via Form".
- Calcola un rigidissimo "marketingScore" da 20 a 95 indicante quanto l'azienda ha urgente bisogno di miglioramenti digitali (sito lento, non ottimizzato mobile, assenza di email aziendale idonea, mancanza di canali social, assenza di campagne pubblicitarie attive, scarsa visibilità locale).
- Formula in italiano una diagnosi brevissima della loro presenza sul web ("auditResult") e una strategia di outreach B2B su misura ("customStrategy").

OUTPUT JSON RIGIDO:
Devi rispondere esclusivamente con un array di oggetti JSON validamente formattato, senza spiegazioni testuali, preamboli o markdown extra al di fuori delle tre virgolette del blocco di codice json (e se possibile restituisci solo l'array per eliminare errori di decodifica).
Struttura del singolo oggetto:
{
  "company": "Nome dell'azienda svizzera reale",
  "sector": "Settore commerciale preciso",
  "address": "Indirizzo completo (Via, NPA, Località, Svizzera)",
  "phone": "Numero telefonico svizzero (+41...)",
  "email": "E-mail verificata reale",
  "website": "Sito Web ufficiale completo o 'Non disponibile'",
  "social": "LinkedIn, Instagram o Facebook se presenti, altrimenti 'Non disponibile'",
  "marketingScore": 85,
  "auditResult": "Analisi rapida ma accurata del sito o schede mappe",
  "customStrategy": "Consiglio mirato e angolo di attacco commerciale per vendere servizi digitali"
}

Usa esclusivamente dati estratti in tempo reale dalle fonti ufficiali svizzere via Google Maps Places API e Google Search Grounding più i siti proprietari dei brand.`;

      let allLeads: any[] = [];
      let allSources: any[] = [];

      // Perform search for each related keyword
      for (const searchKeyword of relatedKeywords) {
        console.log(`[Lead Generation] Cercando per termine: "${searchKeyword}"...`);
        
        try {
          const response = await generateWithFallbackAndRetry(
            activeGenAI,
            `Scansiona con "Deep Search" per: settore "${searchKeyword}" a "${location || "tutta la Svizzera"}" ${canton ? "nel Canton " + canton : ""} ${radiusText}. Esegui Email Intelligence con Google Search Grounding per estrarre indirizzi email reali e validi. Genera contatti commerciali accurati.`,
            systemInstruction,
            true // useGrounding
          );

          const rawText = response.text || "[]";
          
          // Clean and Parse JSON response
          let cleaned = rawText.trim();
          if (cleaned.startsWith("```json")) {
            cleaned = cleaned.substring(7);
          } else if (cleaned.startsWith("```")) {
            cleaned = cleaned.substring(3);
          }
          if (cleaned.endsWith("```")) {
            cleaned = cleaned.substring(0, cleaned.length - 3);
          }
          cleaned = cleaned.trim();
          
          let leads = [];
          try {
            leads = JSON.parse(cleaned);
          } catch (parseError) {
            // Fallback: extract substring between first [ and last ]
            const startIdx = cleaned.indexOf("[");
            const endIdx = cleaned.lastIndexOf("]");
            if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
              try {
                leads = JSON.parse(cleaned.substring(startIdx, endIdx + 1));
              } catch (e) {
                console.error("Sub-parsing failed for keyword", searchKeyword);
                leads = [];
              }
            }
          }

          if (Array.isArray(leads) && leads.length > 0) {
            allLeads = allLeads.concat(leads);
            console.log(`[Lead Generation] Trovati ${leads.length} risultati per "${searchKeyword}"`);
          }

          // Extract search grounding metadata
          const searchMetadata = response.candidates?.[0]?.groundingMetadata;
          const sources = searchMetadata?.groundingChunks?.map((chunk: any) => ({
            title: chunk.web?.title || chunk.web?.uri,
            uri: chunk.web?.uri,
          })) || [];
          
          allSources = allSources.concat(sources);
        } catch (err) {
          console.warn(`[Lead Generation] Errore per termine "${searchKeyword}":`, err);
          continue; // Continue with next keyword
        }
      }

      // STEP 3: Deduplicate leads by email or company name
      const uniqueLeads = Array.from(new Map(
        allLeads.map(lead => [
          (lead.email || lead.company || "").toLowerCase(), 
          lead
        ])
      ).values());

      console.log(`[Lead Generation] Risultati finali dopo deduplicazione: ${uniqueLeads.length} lead unici`);

      // 🔍 Integra risultati da local.ch se abilitato
      let finalLeads = uniqueLeads;
      
      if (process.env.LOCAL_CH_ENABLED === "true") {
        try {
          console.log("[Local.ch Integration] Ricercando risultati complementari...");
          const localChResults = await searchLocalCh(keyword, location, canton);
          
          if (localChResults.length > 0) {
            console.log(`[Local.ch Integration] Trovati ${localChResults.length} risultati`);
            finalLeads = await combineGeminiAndLocalCh(finalLeads, localChResults);
          }
        } catch (localChErr) {
          console.warn("[Local.ch Integration Error]", localChErr);
          // Non blocca se local.ch fallisce, continua con i risultati Gemini
        }
      }

      res.json({
        success: true,
        leads: finalLeads,
        searchedKeywords: relatedKeywords,
        sources: allSources.filter((item: any, index: number, self: any[]) => 
          self.findIndex((t: any) => t.uri === item.uri) === index
        ).slice(0, 5)
      });

    } catch (error: any) {
      console.error("Lead Generation API Error in Server:", error);
      let errMsg = error.message || "Errore sconosciuto durante la generazione dei lead con Google Grounding.";
      const errStr = (typeof error === "object" && error !== null) ? (error.message || JSON.stringify(error)) : String(error);

      if (errStr.includes("429") || errStr.toLowerCase().includes("quota") || errStr.includes("RESOURCE_EXHAUSTED") || errStr.toLowerCase().includes("limit")) {
        errMsg = "Attenzione durante la lead generation: Quota gratuita esaurita per il server del portale (Errore 429: RESOURCE_EXHAUSTED). Per continuare a usare in tempo reale il Deep Search Crawler di Swiss Business Crawler con Google Search Grounding integrato, ti consigliamo di inserire la tua chiave API personale di Gemini ottenibile gratis da Google AI Studio direttamente nel modulo d'estrazione (campo 'Quota/API Key Gemini (Opzionale)').";
      } else if (errStr.includes("503") || errStr.includes("UNAVAILABLE") || errStr.toLowerCase().includes("high demand") || errStr.toLowerCase().includes("temporary spikes") || errStr.toLowerCase().includes("unavailable")) {
        errMsg = "Attenzione durante la lead generation: I server di Google Gemini sono attualmente sovraccarichi (Errore 503: Service Unavailable o alta densità di richieste). Si tratta di un rallentamento temporaneo dei sistemi di Google. Ti invitiamo a riprovare tra pochissimi secondi o ad inserire la tua chiave API personale di Gemini ottenibile gratis da Google AI Studio direttamente nel modulo d'estrazione (campo 'Quota/API Key Gemini (Opzionale)').";
      }
      res.status(500).json({
        success: false,
        error: errMsg,
      });
    }
  });

  // Serve Vite or Static files depending on environment
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
