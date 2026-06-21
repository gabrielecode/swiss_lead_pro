import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { VercelRequest, VercelResponse } from "@vercel/node";

dotenv.config();

const getGenAIClient = (req: VercelRequest): GoogleGenAI => {
  const clientKey = req.headers["x-gemini-key"] as string | undefined;
  const activeKey = clientKey || process.env.GEMINI_API_KEY;

  if (!activeKey) {
    throw new Error("API Key di Gemini non configurata");
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Gemini-Key");

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

    let activeGenAI: GoogleGenAI;
    try {
      activeGenAI = getGenAIClient(req);
    } catch (err: any) {
      return res.status(401).json({ error: err.message });
    }

    const systemInstruction = `Sei un assistente esperto per la ricerca in Svizzera.
Rispondi in modo cordiale, preciso e in lingua ${language || "italiana"}.`;

    const response = await activeGenAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      systemInstruction,
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.7,
      },
      tools: [
        {
          googleSearch: {},
        },
      ],
    });

    res.json({
      result: response.response?.text,
      candidates: response.candidates,
    });
  } catch (error: any) {
    console.error("[Ask-AI Error]", error);
    res.status(500).json({
      error: error?.message || "Errore durante la richiesta",
    });
  }
}
