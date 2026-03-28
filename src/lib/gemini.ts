/// <reference types="vite/client" />
import { GoogleGenAI } from "@google/genai";

const getApiKey = () => {
  if (typeof process !== 'undefined' && process.env && process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY;
  }
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) {
    return import.meta.env.VITE_GEMINI_API_KEY;
  }
  return "";
};

interface GenerateOptions {
  prompt: string;
  systemInstruction: string;
  creativityLevel?: number;
  humanLevel?: number;
  negativePrompt?: string;
  stylePreset?: string;
  apiKey?: string;
}

export async function generateScript({
  prompt,
  systemInstruction,
  creativityLevel = 0.7,
  humanLevel = 0.9,
  negativePrompt = "",
  stylePreset = "Natural",
  apiKey,
}: GenerateOptions): Promise<string> {
  try {
    const finalKey = apiKey || getApiKey();
    
    if (!finalKey) {
      throw new Error("API key is missing. Please add your Gemini API key in the settings or environment variables.");
    }

    const aiInstance = new GoogleGenAI({ apiKey: finalKey });

    // Inject strong human-like instructions
    const enhancedSystemInstruction = `
${systemInstruction}

CRITICAL WRITING GUIDELINES:
- Write exactly like a human content creator speaking naturally.
- DO NOT use AI-sounding words or phrases (e.g., "delve", "testament", "tapestry", "in conclusion", "let's dive in", "ah, the...", "picture this").
- DO NOT include any AI disclaimers, apologies, or meta-commentary about being an AI.
- Keep the tone conversational, authentic, and engaging.
- Use varied sentence structures and natural pacing.
- Style Preset Applied: ${stylePreset}. Adapt the tone to match this style perfectly.
- Human-like Quality Level: ${Math.round(humanLevel * 100)}%. ${humanLevel > 0.8 ? 'Make it indistinguishable from a real human, with slight imperfections or conversational filler if appropriate.' : ''}
${negativePrompt ? `- AVOID the following elements strictly: ${negativePrompt}` : ""}
    `.trim();

    const response = await aiInstance.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        systemInstruction: enhancedSystemInstruction,
        temperature: creativityLevel,
      },
    });
    return response.text || "Failed to generate content.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to generate content: ${error.message}`);
    }
    throw new Error("Failed to generate content. Please try again.");
  }
}
