import { describe, it, expect } from "vitest";
import { googleGeminiProvider } from "./google_gemini.js";

describe("googleGeminiProvider", () => {
  it("has the correct config prefix", () => {
    expect(googleGeminiProvider.configPrefix).toBe("google_gemini_");
  });

  describe("formatUserMessage", () => {
    it("wraps text in Gemini parts shape", () => {
      expect(googleGeminiProvider.formatUserMessage("hello")).toEqual({
        role: "user",
        parts: [{ text: "hello" }],
      });
    });
  });

  describe("formatAssistantMessage", () => {
    it("uses model role and parts shape", () => {
      expect(googleGeminiProvider.formatAssistantMessage("reply")).toEqual({
        role: "model",
        parts: [{ text: "reply" }],
      });
    });
  });

  describe("extractToken", () => {
    it("returns text from first candidate content part", () => {
      const line = {
        candidates: [{ content: { parts: [{ text: "hi" }] } }],
      };
      expect(googleGeminiProvider.extractToken(line)).toBe("hi");
    });

    it("returns null when candidates is empty", () => {
      expect(googleGeminiProvider.extractToken({ candidates: [] })).toBeNull();
    });

    it("returns null when candidates is missing", () => {
      expect(googleGeminiProvider.extractToken({})).toBeNull();
    });

    it("returns null when parts is empty", () => {
      const line = { candidates: [{ content: { parts: [] } }] };
      expect(googleGeminiProvider.extractToken(line)).toBeNull();
    });

    it("returns null when content is missing", () => {
      const line = { candidates: [{ finishReason: "STOP" }] };
      expect(googleGeminiProvider.extractToken(line)).toBeNull();
    });
  });

  describe("isDone", () => {
    it("always returns false — Gemini ends via stream done", () => {
      expect(googleGeminiProvider.isDone({})).toBe(false);
    });
  });

  describe("stripLine", () => {
    it("strips data: prefix", () => {
      expect(googleGeminiProvider.stripLine("data: {\"candidates\":[]}")).toBe("{\"candidates\":[]}");
    });

    it("returns null for empty lines", () => {
      expect(googleGeminiProvider.stripLine("")).toBeNull();
    });
  });
});
