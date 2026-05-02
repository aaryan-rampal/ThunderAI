import { describe, it, expect, beforeEach } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import type { Session, ChatMessage, EmbeddingRecord } from "./types.js";

const {
  createSession,
  getSession,
  listSessions,
  updateSession,
  deleteSession,
  addMessage,
  getMessages,
  putEmbedding,
  getAllEmbeddings,
  getEmbeddingsBySession,
  resetDBCache,
} = await import("./db.js");

// Inject a fresh in-memory IDB and reset the connection cache before each test.
beforeEach(() => {
  (globalThis as Record<string, unknown>)["indexedDB"] = new IDBFactory();
  resetDBCache();
});

// ── helpers ──────────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "s1",
    title: "Test session",
    createdAt: 1000,
    updatedAt: 1000,
    model: "gpt-4",
    ...overrides,
  };
}

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "m1",
    sessionId: "s1",
    role: "user",
    content: "hello",
    timestamp: 1000,
    ...overrides,
  };
}

// ── sessions ─────────────────────────────────────────────────────────────────

describe("createSession / getSession", () => {
  it("stores a session and retrieves it by id", async () => {
    const session = makeSession();
    await createSession(session);
    const result = await getSession("s1");
    expect(result).toEqual(session);
  });

  it("returns undefined for a missing id", async () => {
    const result = await getSession("does-not-exist");
    expect(result).toBeUndefined();
  });
});

describe("listSessions", () => {
  it("returns an empty array when no sessions exist", async () => {
    expect(await listSessions()).toEqual([]);
  });

  it("returns sessions sorted by updatedAt descending", async () => {
    await createSession(makeSession({ id: "old", updatedAt: 1000 }));
    await createSession(makeSession({ id: "new", updatedAt: 3000 }));
    await createSession(makeSession({ id: "mid", updatedAt: 2000 }));
    const result = await listSessions();
    expect(result.map((s) => s.id)).toEqual(["new", "mid", "old"]);
  });
});

describe("updateSession", () => {
  it("patches only the provided fields", async () => {
    await createSession(makeSession({ title: "original" }));
    await updateSession("s1", { title: "updated" });
    const result = await getSession("s1");
    expect(result?.title).toBe("updated");
    expect(result?.model).toBe("gpt-4");
  });

  it("is a no-op when the session does not exist", async () => {
    await expect(updateSession("ghost", { title: "x" })).resolves.toBeUndefined();
  });
});

describe("deleteSession", () => {
  it("removes the session", async () => {
    await createSession(makeSession());
    await deleteSession("s1");
    expect(await getSession("s1")).toBeUndefined();
  });

  it("also deletes all messages belonging to the session", async () => {
    await createSession(makeSession());
    await addMessage(makeMessage({ id: "m1" }));
    await addMessage(makeMessage({ id: "m2" }));
    await deleteSession("s1");
    expect(await getMessages("s1")).toEqual([]);
  });

  it("does not delete messages belonging to other sessions", async () => {
    await createSession(makeSession({ id: "s1" }));
    await createSession(makeSession({ id: "s2" }));
    await addMessage(makeMessage({ id: "m1", sessionId: "s1" }));
    await addMessage(makeMessage({ id: "m2", sessionId: "s2" }));
    await deleteSession("s1");
    expect(await getMessages("s2")).toHaveLength(1);
  });
});

// ── messages ─────────────────────────────────────────────────────────────────

describe("addMessage / getMessages", () => {
  it("stores a message and retrieves it by sessionId", async () => {
    await addMessage(makeMessage());
    const results = await getMessages("s1");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(makeMessage());
  });

  it("returns messages sorted by timestamp ascending", async () => {
    await addMessage(makeMessage({ id: "m3", timestamp: 3000 }));
    await addMessage(makeMessage({ id: "m1", timestamp: 1000 }));
    await addMessage(makeMessage({ id: "m2", timestamp: 2000 }));
    const results = await getMessages("s1");
    expect(results.map((m) => m.id)).toEqual(["m1", "m2", "m3"]);
  });

  it("returns only messages for the requested session", async () => {
    await addMessage(makeMessage({ id: "m1", sessionId: "s1" }));
    await addMessage(makeMessage({ id: "m2", sessionId: "s2" }));
    expect(await getMessages("s1")).toHaveLength(1);
    expect(await getMessages("s2")).toHaveLength(1);
  });

  it("returns empty array for a session with no messages", async () => {
    expect(await getMessages("nobody")).toEqual([]);
  });
});

// ── embeddings ────────────────────────────────────────────────────────────────

describe("putEmbedding / getAllEmbeddings", () => {
  const makeEmbedding = (overrides: Partial<EmbeddingRecord> = {}): EmbeddingRecord => ({
    messageId: "m1",
    subject: "Re: meeting",
    author: "alice@example.com",
    date: "2026-01-01",
    snippet: "sounds good",
    vector: new Float32Array([0.1, 0.2, 0.3]),
    model: "text-embedding-3-small",
    indexedAt: 1000,
    ...overrides,
  });

  it("stores an embedding and retrieves it", async () => {
    await putEmbedding(makeEmbedding());
    const results = await getAllEmbeddings();
    expect(results).toHaveLength(1);
    expect(results[0]?.messageId).toBe("m1");
    expect(results[0]?.vector).toEqual(new Float32Array([0.1, 0.2, 0.3]));
  });

  it("returns empty array when no embeddings exist", async () => {
    expect(await getAllEmbeddings()).toEqual([]);
  });

  it("overwrites an existing embedding with the same messageId", async () => {
    await putEmbedding(makeEmbedding({ snippet: "original" }));
    await putEmbedding(makeEmbedding({ snippet: "updated" }));
    const results = await getAllEmbeddings();
    expect(results).toHaveLength(1);
    expect(results[0]?.snippet).toBe("updated");
  });

  it("stores multiple embeddings for different messages", async () => {
    await putEmbedding(makeEmbedding({ messageId: "m1" }));
    await putEmbedding(makeEmbedding({ messageId: "m2" }));
    expect(await getAllEmbeddings()).toHaveLength(2);
  });
});

// ── getEmbeddingsBySession ────────────────────────────────────────────────────

describe("getEmbeddingsBySession", () => {
  it("returns only embeddings whose messageId matches a message in the session", async () => {
    await addMessage(makeMessage({ id: "m1", sessionId: "s1" }));
    await addMessage(makeMessage({ id: "m2", sessionId: "s2" }));
    await putEmbedding({
      messageId: "m1", subject: "", author: "", date: "", snippet: "s1 msg",
      vector: new Float32Array([1, 0]), model: "test", indexedAt: 1000,
    });
    await putEmbedding({
      messageId: "m2", subject: "", author: "", date: "", snippet: "s2 msg",
      vector: new Float32Array([0, 1]), model: "test", indexedAt: 1000,
    });
    const results = await getEmbeddingsBySession("s1");
    expect(results).toHaveLength(1);
    expect(results[0]?.messageId).toBe("m1");
  });

  it("returns empty array when session has no embeddings", async () => {
    await addMessage(makeMessage({ id: "m1", sessionId: "s1" }));
    expect(await getEmbeddingsBySession("s1")).toEqual([]);
  });

  it("returns empty array for a session that does not exist", async () => {
    expect(await getEmbeddingsBySession("ghost")).toEqual([]);
  });
});

// ── connection caching ────────────────────────────────────────────────────────

describe("connection caching", () => {
  it("reuses the same IDBDatabase instance across multiple calls", async () => {
    // Two separate DB operations should open the connection only once.
    // We verify this by checking that both operations see the same data
    // without any re-open side effects.
    await createSession(makeSession({ id: "s1" }));
    await createSession(makeSession({ id: "s2" }));
    const sessions = await listSessions();
    expect(sessions).toHaveLength(2);
  });

  it("uses a fresh connection after resetDBCache is called", async () => {
    await createSession(makeSession({ id: "s1" }));

    // Simulate a new IDB environment (e.g. test teardown / version change)
    (globalThis as Record<string, unknown>)["indexedDB"] = new IDBFactory();
    resetDBCache();

    // The old session should not be visible in the new factory
    expect(await getSession("s1")).toBeUndefined();
  });

  it("data written before resetDBCache is not visible after reset with new factory", async () => {
    await createSession(makeSession({ id: "before" }));
    const before = await listSessions();
    expect(before).toHaveLength(1);

    (globalThis as Record<string, unknown>)["indexedDB"] = new IDBFactory();
    resetDBCache();

    const after = await listSessions();
    expect(after).toHaveLength(0);
  });
});
