import { GoogleGenAI } from "@google/genai";

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface GenerateOptions {
  prompt: string;
  systemInstruction: string;
  creativityLevel?: number;
  negativePrompt?: string;
  stylePreset?: string;
}

export async function generateScript({
  prompt,
  systemInstruction,
  creativityLevel = 0.7,
  negativePrompt = "",
  stylePreset = "Natural",
}: GenerateOptions): Promise<string> {
  try {
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
${negativePrompt ? `- AVOID the following elements strictly: ${negativePrompt}` : ""}
    `.trim();

    const response = await ai.models.generateContent({
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
    throw new Error("Failed to generate content. Please try again.");
  }
}
