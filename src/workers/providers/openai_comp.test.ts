import { describe, it, expect } from "vitest";
import { openaiCompProvider } from "./openai_comp.js";

describe("openaiCompProvider", () => {
  it("has the correct config prefix", () => {
    expect(openaiCompProvider.configPrefix).toBe("openai_comp_");
  });

  describe("formatUserMessage", () => {
    it("wraps text in role/content shape", () => {
      expect(openaiCompProvider.formatUserMessage("hello")).toEqual({
        role: "user",
        content: "hello",
      });
    });
  });

  describe("formatAssistantMessage", () => {
    it("wraps text in role/content shape", () => {
      expect(openaiCompProvider.formatAssistantMessage("reply")).toEqual({
        role: "assistant",
        content: "reply",
      });
    });
  });

  describe("extractToken", () => {
    it("returns content from first choice delta", () => {
      const line = { choices: [{ delta: { content: "hi" } }] };
      expect(openaiCompProvider.extractToken(line)).toBe("hi");
    });

    it("returns null when choices is empty", () => {
      expect(openaiCompProvider.extractToken({ choices: [] })).toBeNull();
    });

    it("returns null when choices is missing", () => {
      expect(openaiCompProvider.extractToken({})).toBeNull();
    });

    it("returns null when delta content is empty string", () => {
      const line = { choices: [{ delta: { content: "" } }] };
      expect(openaiCompProvider.extractToken(line)).toBeNull();
    });
  });

  describe("isDone", () => {
    it("always returns false — openai_comp ends via stream done", () => {
      expect(openaiCompProvider.isDone({})).toBe(false);
    });
  });

  describe("stripLine", () => {
    it("strips data: prefix", () => {
      expect(openaiCompProvider.stripLine("data: {\"choices\":[]}")).toBe("{\"choices\":[]}");
    });

    it("strips OpenRouter processing prefix", () => {
      expect(openaiCompProvider.stripLine(": OPENROUTER PROCESSING")).toBeNull();
    });

    it("returns null for [DONE]", () => {
      expect(openaiCompProvider.stripLine("[DONE]")).toBeNull();
    });

    it("returns null for empty lines", () => {
      expect(openaiCompProvider.stripLine("")).toBeNull();
    });
  });
});
