import type { Provider } from "./types.js";

export const openaiCompProvider: Provider = {
  configPrefix: "openai_comp_",

  formatUserMessage: (text) => ({ role: "user", content: text }),

  formatAssistantMessage: (text) => ({ role: "assistant", content: text }),

  extractToken: (parsed) => {
    const choices = parsed["choices"];
    if (!Array.isArray(choices) || choices.length === 0) return null;
    const delta = (choices[0] as Record<string, unknown>)["delta"] as Record<string, unknown> | undefined;
    const content = delta?.["content"];
    return typeof content === "string" && content.length > 0 ? content : null;
  },

  isDone: () => false,

  stripLine: (line) => {
    if (line === "" || line === "[DONE]") return null;
    if (line.startsWith(": OPENROUTER PROCESSING")) return null;
    if (line.startsWith("data: ")) return line.slice("data: ".length);
    return null;
  },
};
