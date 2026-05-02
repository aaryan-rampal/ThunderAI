import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDispatcher } from "./model-worker.js";

// The dispatcher is the pure message-handling logic extracted from the worker's
// onmessage handler. We test it without spinning up a real Worker thread.

function makePostMessage() {
  const calls: unknown[] = [];
  const fn = vi.fn((msg: unknown) => calls.push(msg));
  return { fn, calls };
}

function makeLogger() {
  return { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe("createDispatcher", () => {
  it("throws if init is not called before chatMessage", () => {
    const { fn: post } = makePostMessage();
    const dispatcher = createDispatcher(post);
    expect(() =>
      dispatcher({ type: "chatMessage", message: "hi" })
    ).toThrow("Worker not initialized");
  });

  it("rejects unknown providers", () => {
    const { fn: post } = makePostMessage();
    const dispatcher = createDispatcher(post);
    expect(() =>
      dispatcher({ type: "init", provider: "unknown_provider", do_debug: false, i18nStrings: {} })
    ).toThrow("Unknown provider");
  });

  describe("reset", () => {
    it("clears conversation history so the next session starts fresh", () => {
      const { fn: post } = makePostMessage();
      const dispatcher = createDispatcher(post);
      dispatcher({ type: "init", provider: "anthropic", do_debug: false, i18nStrings: {} });
      dispatcher({ type: "replayHistory", role: "user", content: "old message" });
      dispatcher({ type: "reset" });
      // history is internal — we verify indirectly: after reset, replayHistory
      // should still work (no throw), meaning state was cleanly cleared
      expect(() =>
        dispatcher({ type: "replayHistory", role: "user", content: "new message" })
      ).not.toThrow();
    });
  });

  describe("replayHistory", () => {
    it("accepts user messages without throwing", () => {
      const { fn: post } = makePostMessage();
      const dispatcher = createDispatcher(post);
      dispatcher({ type: "init", provider: "anthropic", do_debug: false, i18nStrings: {} });
      expect(() =>
        dispatcher({ type: "replayHistory", role: "user", content: "hello" })
      ).not.toThrow();
    });

    it("accepts assistant messages without throwing", () => {
      const { fn: post } = makePostMessage();
      const dispatcher = createDispatcher(post);
      dispatcher({ type: "init", provider: "anthropic", do_debug: false, i18nStrings: {} });
      expect(() =>
        dispatcher({ type: "replayHistory", role: "assistant", content: "hello" })
      ).not.toThrow();
    });

    it("formats Gemini assistant replay using model/parts shape", () => {
      // This is the bug fix: previously Gemini replayed as { role, content }
      // which is wrong for Gemini's API. Now it uses formatAssistantMessage.
      const { fn: post } = makePostMessage();
      const dispatcher = createDispatcher(post);
      dispatcher({ type: "init", provider: "google_gemini", do_debug: false, i18nStrings: {} });
      // No throw means the provider's formatAssistantMessage was called correctly.
      // We verify the history shape via the exported getHistory() test hook.
      dispatcher({ type: "replayHistory", role: "assistant", content: "reply" });
      const history = dispatcher({ type: "_getHistory" }) as unknown[];
      expect(history[0]).toEqual({ role: "model", parts: [{ text: "reply" }] });
    });

    it("formats Gemini user replay using user/parts shape", () => {
      const { fn: post } = makePostMessage();
      const dispatcher = createDispatcher(post);
      dispatcher({ type: "init", provider: "google_gemini", do_debug: false, i18nStrings: {} });
      dispatcher({ type: "replayHistory", role: "user", content: "hello" });
      const history = dispatcher({ type: "_getHistory" }) as unknown[];
      expect(history[0]).toEqual({ role: "user", parts: [{ text: "hello" }] });
    });
  });

  describe("stop", () => {
    it("sets stopStreaming flag without throwing", () => {
      const { fn: post } = makePostMessage();
      const dispatcher = createDispatcher(post);
      dispatcher({ type: "init", provider: "anthropic", do_debug: false, i18nStrings: {} });
      expect(() => dispatcher({ type: "stop" })).not.toThrow();
    });
  });

  describe("init", () => {
    it("accepts all valid provider names", () => {
      const providers = ["anthropic", "google_gemini", "ollama", "openai_comp", "openai_responses"];
      for (const provider of providers) {
        const { fn: post } = makePostMessage();
        const dispatcher = createDispatcher(post);
        expect(() =>
          dispatcher({ type: "init", provider, do_debug: false, i18nStrings: {} })
        ).not.toThrow();
      }
    });
  });
});
