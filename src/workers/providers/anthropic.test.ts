import { describe, it, expect } from "vitest";
import { anthropicProvider } from "./anthropic.js";

describe("anthropicProvider", () => {
  it("has the correct config prefix", () => {
    expect(anthropicProvider.configPrefix).toBe("anthropic_");
  });

  describe("formatUserMessage", () => {
    it("wraps text in role/content shape", () => {
      expect(anthropicProvider.formatUserMessage("hello")).toEqual({
        role: "user",
        content: "hello",
      });
    });
  });

  describe("formatAssistantMessage", () => {
    it("wraps text in role/content shape", () => {
      expect(anthropicProvider.formatAssistantMessage("reply")).toEqual({
        role: "assistant",
        content: "reply",
      });
    });
  });

  describe("extractToken", () => {
    it("returns token from content_block_delta with delta.text", () => {
      const line = { type: "content_block_delta", delta: { text: "hello" } };
      expect(anthropicProvider.extractToken(line)).toBe("hello");
    });

    it("returns null for content_block_start", () => {
      expect(anthropicProvider.extractToken({ type: "content_block_start" })).toBeNull();
    });

    it("returns null for message_start", () => {
      expect(anthropicProvider.extractToken({ type: "message_start" })).toBeNull();
    });

    it("returns null when delta has no text", () => {
      const line = { type: "content_block_delta", delta: {} };
      expect(anthropicProvider.extractToken(line)).toBeNull();
    });
  });

  describe("isDone", () => {
    it("returns true for message_stop", () => {
      expect(anthropicProvider.isDone({ type: "message_stop" })).toBe(true);
    });

    it("returns false for other types", () => {
      expect(anthropicProvider.isDone({ type: "content_block_delta" })).toBe(false);
    });
  });

  describe("stripLine", () => {
    it("strips data: prefix", () => {
      expect(anthropicProvider.stripLine("data: {\"type\":\"x\"}")).toBe("{\"type\":\"x\"}");
    });

    it("returns null for ping events", () => {
      expect(anthropicProvider.stripLine("event: ping")).toBeNull();
    });

    it("returns null for empty lines", () => {
      expect(anthropicProvider.stripLine("")).toBeNull();
    });

    it("returns null for lines without data: prefix", () => {
      expect(anthropicProvider.stripLine("event: message_start")).toBeNull();
    });
  });
});
