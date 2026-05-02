import type { Provider } from "./types.js";

export const anthropicProvider: Provider = {
  configPrefix: "anthropic_",

  formatUserMessage: (text) => ({ role: "user", content: text }),

  formatAssistantMessage: (text) => ({ role: "assistant", content: text }),

  extractToken: (parsed) => {
    if (parsed["type"] !== "content_block_delta") return null;
    const delta = parsed["delta"] as Record<string, unknown> | undefined;
    const text = delta?.["text"];
    return typeof text === "string" && text.length > 0 ? text : null;
  },

  isDone: (parsed) => parsed["type"] === "message_stop",

  stripLine: (line) => {
    if (line === "" || line.startsWith("event: ping")) return null;
    if (!line.startsWith("data: ")) return null;
    return line.slice("data: ".length);
  },
};
