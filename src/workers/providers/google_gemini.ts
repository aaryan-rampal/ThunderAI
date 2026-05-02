import type { Provider } from "./types.js";

export const googleGeminiProvider: Provider = {
  configPrefix: "google_gemini_",

  formatUserMessage: (text) => ({ role: "user", parts: [{ text }] }),

  formatAssistantMessage: (text) => ({ role: "model", parts: [{ text }] }),

  extractToken: (parsed) => {
    const candidates = parsed["candidates"];
    if (!Array.isArray(candidates) || candidates.length === 0) return null;
    const content = (candidates[0] as Record<string, unknown>)["content"] as Record<string, unknown> | undefined;
    if (!content) return null;
    const parts = content["parts"];
    if (!Array.isArray(parts) || parts.length === 0) return null;
    const text = (parts[0] as Record<string, unknown>)["text"];
    return typeof text === "string" && text.length > 0 ? text : null;
  },

  isDone: () => false,

  stripLine: (line) => {
    if (line === "") return null;
    if (line.startsWith("data: ")) return line.slice("data: ".length);
    return null;
  },
};
