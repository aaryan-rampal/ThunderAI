import { describe, it, expect } from "vitest";
import { openaiResponsesProvider } from "./openai_responses.js";

describe("openaiResponsesProvider", () => {
  it("has the correct config prefix", () => {
    expect(openaiResponsesProvider.configPrefix).toBe("chatgpt_");
  });

  describe("formatUserMessage", () => {
    it("wraps text in role/content shape", () => {
      expect(openaiResponsesProvider.formatUserMessage("hello")).toEqual({
        role: "user",
        content: "hello",
      });
    });
  });

  describe("formatAssistantMessage", () => {
    it("wraps text in role/content shape", () => {
      expect(openaiResponsesProvider.formatAssistantMessage("reply")).toEqual({
        role: "assistant",
        content: "reply",
      });
    });
  });

  describe("extractToken", () => {
    it("returns delta from response.output_text.delta event", () => {
      const line = { type: "response.output_text.delta", delta: "hi" };
      expect(openaiResponsesProvider.extractToken(line)).toBe("hi");
    });

    it("returns null for other event types", () => {
      expect(openaiResponsesProvider.extractToken({ type: "response.created" })).toBeNull();
    });

    it("returns null when delta is empty string", () => {
      const line = { type: "response.output_text.delta", delta: "" };
      expect(openaiResponsesProvider.extractToken(line)).toBeNull();
    });
  });

  describe("isDone", () => {
    it("always returns false — ends via stream done", () => {
      expect(openaiResponsesProvider.isDone({})).toBe(false);
    });
  });

  describe("extractResponseId", () => {
    it("returns response id from response.created event", () => {
      const line = { type: "response.created", response: { id: "resp_123" } };
      expect(openaiResponsesProvider.extractResponseId?.(line)).toBe("resp_123");
    });

    it("returns null for other event types", () => {
      const line = { type: "response.output_text.delta", delta: "hi" };
      expect(openaiResponsesProvider.extractResponseId?.(line)).toBeNull();
    });
  });

  describe("stripLine", () => {
    it("strips data: prefix", () => {
      expect(openaiResponsesProvider.stripLine("data: {\"type\":\"x\"}")).toBe("{\"type\":\"x\"}");
    });

    it("returns null for [DONE]", () => {
      expect(openaiResponsesProvider.stripLine("[DONE]")).toBeNull();
    });

    it("returns null for empty lines", () => {
      expect(openaiResponsesProvider.stripLine("")).toBeNull();
    });
  });
});
