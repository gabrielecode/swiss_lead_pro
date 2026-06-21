import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { searchLocalCh, combineGeminiAndLocalCh } from "../../local-ch-integration";
import type { VercelRequest, VercelResponse } from "@vercel/node";

dotenv.config();

const app = express();

app.use(express.json());

// API Key helper
const getGenAIClient = (req: VercelRequest): GoogleGenAI => {
  const clientKey = req.headers["x-gemini-key"] as string | undefined;
  const activeKey = clientKey || process.env.GEMINI_API_KEY;

  if (!activeKey) {
    throw new Error("API Key di Gemini non configurata sul server. Per favore, inserisci la tua chiave API personale di Gemini.");
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

// A helper function to call Google Gemini with automatic transient error retry
const generateWithFallbackAndRetry = async (
  activeGenAI: GoogleGenAI,
  contents: string | any[],
  systemInstruction: string,
  useGrounding = true
) => {
  const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
  let lastError: any;

  for (const model of models) {
    const retries = 3;
    let delayMs = 1500;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await activeGenAI.generateContent({
          model,
          contents,
          systemInstruction,
          generationConfig: {
            maxOutputTokens: 4096,
            temperature: 0.7,
          },
          tools: useGrounding
            ? [
                {
                  googleSearch: {},
                },
              ]
            : undefined,
        });

        return response.response;
      } catch (error: any) {
        if (error.status === 429 || error.status === 503) {
          lastError = error;
          if (attempt < retries - 1) {
            console.log(`[Gemini Execution] Retry in ${delayMs}ms...`);
            await new Promise((r) => setTimeout(r, delayMs));
            delayMs *= 2;
          }
        } else {
          throw error;
        }
      }
    }
  }

  throw lastError;
};

// Smart AI Search Assistant API
app.post("/api/ask-ai", async (req: VercelRequest, res: VercelResponse) => {
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

    const systemInstruction = `Sei un assistente esperto e intelligente per la ricerca in Svizzera.
Rispondi in modo cordiale, preciso e in lingua ${language || "italiana"}.`;

    const response = await generateWithFallbackAndRetry(
      activeGenAI,
      prompt,
      systemInstruction,
      true
    );

    res.json({
      result: response.text,
      candidates: response.candidates,
    });
  } catch (error: any) {
    console.error("[Ask-AI Error]", error);
    res.status(500).json({
      error: error?.message || "Errore durante la richiesta",
    });
  }
});

// Lead Generation API
app.post("/api/generate-leads", async (req: VercelRequest, res: VercelResponse) => {
  try {
    const { keyword, location, canton, radius } = req.body;

    if (!keyword) {
      return res.status(400).json({ error: "Keyword obbligatorio" });
    }

    let activeGenAI: GoogleGenAI;
    try {
      activeGenAI = getGenAIClient(req);
    } catch (err: any) {
      return res.status(401).json({ error: err.message });
    }

    // Simplified lead generation (full version is in server.ts)
    const systemInstruction = `Sei un algoritmo di Lead Generation per aziende svizzere.
Trova aziende reali nel settore "${keyword}" ${location ? `a ${location}` : "in Svizzera"}.
Rispondi con un array JSON di aziende con: company, email, phone, address, website.`;

    const response = await generateWithFallbackAndRetry(
      activeGenAI,
      `Trova aziende nel settore ${keyword} ${location ? `a ${location}` : ""}`,
      systemInstruction,
      true
    );

    res.json({
      leads: response.text,
      sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || [],
    });
  } catch (error: any) {
    console.error("[Lead Generation Error]", error);
    res.status(500).json({
      error: error?.message || "Errore nella generazione dei lead",
    });
  }
});

// Health check
app.get("/api/health", (req: VercelRequest, res: VercelResponse) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default app;
