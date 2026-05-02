import type { Provider } from "./types.js";

export const openaiResponsesProvider: Provider & {
  extractResponseId: (parsed: Record<string, unknown>) => string | null;
} = {
  configPrefix: "chatgpt_",

  formatUserMessage: (text) => ({ role: "user", content: text }),

  formatAssistantMessage: (text) => ({ role: "assistant", content: text }),

  extractToken: (parsed) => {
    if (parsed["type"] !== "response.output_text.delta") return null;
    const delta = parsed["delta"];
    return typeof delta === "string" && delta.length > 0 ? delta : null;
  },

  isDone: () => false,

  extractResponseId: (parsed) => {
    if (parsed["type"] !== "response.created") return null;
    const response = parsed["response"] as Record<string, unknown> | undefined;
    const id = response?.["id"];
    return typeof id === "string" ? id : null;
  },

  stripLine: (line) => {
    if (line === "" || line === "[DONE]") return null;
    if (line.startsWith("data: ")) return line.slice("data: ".length);
    return null;
  },
};
