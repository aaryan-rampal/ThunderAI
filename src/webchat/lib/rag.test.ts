import { describe, it, expect, vi, beforeEach } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { cosineSimilarity, rankEmbeddings, buildContextPrefix, embedText } from "./rag.js";
import type { EmbeddingRecord } from "./types.js";

beforeEach(() => {
  (globalThis as Record<string, unknown>)["indexedDB"] = new IDBFactory();
});

// ── cosineSimilarity ──────────────────────────────────────────────────────────

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    const v = new Float32Array([1, 2, 3]);
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0);
  });

  it("returns -1 for opposite vectors", () => {
    const a = new Float32Array([1, 0, 0]);
    const b = new Float32Array([-1, 0, 0]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0);
  });

  it("returns 0 for orthogonal vectors", () => {
    const a = new Float32Array([1, 0]);
    const b = new Float32Array([0, 1]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.0);
  });

  it("is not sensitive to vector magnitude", () => {
    const a = new Float32Array([1, 0]);
    const b = new Float32Array([100, 0]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(1.0);
  });
});

// ── rankEmbeddings ────────────────────────────────────────────────────────────

function makeRecord(messageId: string, vector: number[], snippet = ""): EmbeddingRecord {
  return {
    messageId,
    subject: "subject",
    author: "author@example.com",
    date: "2026-01-01",
    snippet,
    vector: new Float32Array(vector),
    model: "test-model",
    indexedAt: 1000,
  };
}

describe("rankEmbeddings", () => {
  it("returns records sorted by similarity descending", () => {
    const query = new Float32Array([1, 0, 0]);
    const records = [
      makeRecord("low",  [0, 1, 0]),   // orthogonal — score ~0
      makeRecord("high", [1, 0, 0]),   // identical — score 1
      makeRecord("mid",  [1, 1, 0]),   // 45 degrees — score ~0.7
    ];
    const result = rankEmbeddings(query, records, 3);
    expect(result.map((r) => r.messageId)).toEqual(["high", "mid", "low"]);
  });

  it("returns at most topK results", () => {
    const query = new Float32Array([1, 0]);
    const records = [
      makeRecord("a", [1, 0]),
      makeRecord("b", [1, 1]),
      makeRecord("c", [0, 1]),
    ];
    expect(rankEmbeddings(query, records, 2)).toHaveLength(2);
  });

  it("returns empty array when no records provided", () => {
    expect(rankEmbeddings(new Float32Array([1, 0]), [], 3)).toEqual([]);
  });

  it("returns all records when topK exceeds record count", () => {
    const query = new Float32Array([1, 0]);
    const records = [makeRecord("a", [1, 0])];
    expect(rankEmbeddings(query, records, 10)).toHaveLength(1);
  });
});

// ── buildContextPrefix ────────────────────────────────────────────────────────

describe("buildContextPrefix", () => {
  it("returns empty string when no records", () => {
    expect(buildContextPrefix([])).toBe("");
  });

  it("includes each snippet in the output", () => {
    const records = [
      makeRecord("m1", [1, 0], "deployment failed at 3am"),
      makeRecord("m2", [1, 0], "rollback initiated"),
    ];
    const result = buildContextPrefix(records);
    expect(result).toContain("deployment failed at 3am");
    expect(result).toContain("rollback initiated");
  });

  it("includes a header line to frame the context for the LLM", () => {
    const records = [makeRecord("m1", [1, 0], "some snippet")];
    const result = buildContextPrefix(records);
    expect(result.toLowerCase()).toContain("context");
  });

  it("ends with a separator so the user prompt is clearly delimited", () => {
    const records = [makeRecord("m1", [1, 0], "snippet")];
    const result = buildContextPrefix(records);
    expect(result).toMatch(/\n\n$/);
  });
});

// ── embedText ─────────────────────────────────────────────────────────────────

describe("embedText", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("calls the OpenRouter embeddings endpoint with the correct body", async () => {
    const mockVector = Array.from({ length: 4 }, (_, i) => i * 0.1);
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ embedding: mockVector }] }),
    } as Response);

    await embedText("hello world", "sk-test", "qwen/qwen3-embedding-8b");

    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://openrouter.ai/api/v1/embeddings");
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("qwen/qwen3-embedding-8b");
    expect(body.input).toBe("hello world");
    expect(body.encoding_format).toBe("float");
  });

  it("strips non-ASCII characters from the API key before sending headers", async () => {
    const mockVector = [0.1, 0.2];
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ embedding: mockVector }] }),
    } as Response);

    await embedText("hello world", " \u23fAsk-test\n", "openai/text-embedding-3-small");

    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer sk-test");
  });

  it("returns a Float32Array of the embedding values", async () => {
    const mockVector = [0.1, 0.2, 0.3, 0.4];
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ embedding: mockVector }] }),
    } as Response);

    const result = await embedText("test", "sk-test", "qwen/qwen3-embedding-8b");
    expect(result).toBeInstanceOf(Float32Array);
    expect(result).toHaveLength(mockVector.length);
    Array.from(result).forEach((v, i) => expect(v).toBeCloseTo(mockVector[i]!, 5));
  });

  it("throws when the API returns a non-ok response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    } as Response);

    await expect(embedText("test", "bad-key", "qwen/qwen3-embedding-8b")).rejects.toThrow("401");
  });
});
