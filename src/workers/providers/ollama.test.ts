import { describe, it, expect } from "vitest";
import { ollamaProvider } from "./ollama.js";

describe("ollamaProvider", () => {
  it("has the correct config prefix", () => {
    expect(ollamaProvider.configPrefix).toBe("ollama_");
  });

  describe("formatUserMessage", () => {
    it("wraps text in role/content shape", () => {
      expect(ollamaProvider.formatUserMessage("hello")).toEqual({
        role: "user",
        content: "hello",
      });
    });
  });

  describe("formatAssistantMessage", () => {
    it("wraps text in role/content shape", () => {
      expect(ollamaProvider.formatAssistantMessage("reply")).toEqual({
        role: "assistant",
        content: "reply",
      });
    });
  });

  describe("extractToken", () => {
    it("returns content from message field", () => {
      const line = { message: { content: "hello" } };
      expect(ollamaProvider.extractToken(line)).toBe("hello");
    });

    it("returns null when message is missing", () => {
      expect(ollamaProvider.extractToken({})).toBeNull();
    });

    it("returns null when content is empty string", () => {
      expect(ollamaProvider.extractToken({ message: { content: "" } })).toBeNull();
    });
  });

  describe("isDone", () => {
    it("always returns false — Ollama ends via stream done", () => {
      expect(ollamaProvider.isDone({})).toBe(false);
    });
  });

  describe("stripLine", () => {
    it("strips chunk: prefix", () => {
      expect(ollamaProvider.stripLine("chunk: {\"message\":{}}")).toBe("{\"message\":{}}");
    });

    it("strips no prefix for raw JSON lines", () => {
      expect(ollamaProvider.stripLine("{\"message\":{}}")).toBe("{\"message\":{}}");
    });

    it("returns null for empty lines", () => {
      expect(ollamaProvider.stripLine("")).toBeNull();
    });

    it("returns null for [DONE] sentinel", () => {
      expect(ollamaProvider.stripLine("[DONE]")).toBeNull();
    });
  });
});
