import type { Provider } from "./types.js";

export const ollamaProvider: Provider = {
  configPrefix: "ollama_",

  formatUserMessage: (text) => ({ role: "user", content: text }),

  formatAssistantMessage: (text) => ({ role: "assistant", content: text }),

  extractToken: (parsed) => {
    const message = parsed["message"] as Record<string, unknown> | undefined;
    if (!message) return null;
    const content = message["content"];
    return typeof content === "string" && content.length > 0 ? content : null;
  },

  isDone: () => false,

  stripLine: (line) => {
    if (line === "" || line === "[DONE]") return null;
    if (line.startsWith("chunk: ")) return line.slice("chunk: ".length);
    return line;
  },
};
