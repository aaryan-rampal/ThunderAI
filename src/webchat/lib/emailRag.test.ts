import { describe, expect, it, vi } from "vitest";
import type { EmbeddingRecord } from "./types.js";
import {
  buildEmailRagPrompt,
  countIndexedEmails,
  countMessagesInFolders,
  extractEmailRagQuery,
  listAllMessages,
} from "./emailRag.js";

function makeEmbedding(overrides: Partial<EmbeddingRecord> = {}): EmbeddingRecord {
  return {
    messageId: 1,
    subject: "Quarterly planning",
    author: "alice@example.com",
    date: "2026-04-30T12:00:00.000Z",
    snippet: "The budget review moved to Friday.",
    vector: new Float32Array([1, 0]),
    model: "text-embedding-3-small",
    indexedAt: 1000,
    ...overrides,
  };
}

describe("extractEmailRagQuery", () => {
  it("does not trigger RAG for normal prompts", () => {
    expect(extractEmailRagQuery("Summarize this thread")).toEqual({
      shouldUseEmailRag: false,
      query: "Summarize this thread",
    });
  });

  it("strips the @emails token when present", () => {
    expect(extractEmailRagQuery("Find @emails about the renewal")).toEqual({
      shouldUseEmailRag: true,
      query: "Find about the renewal",
    });
  });

  it("strips the @emails token when followed by punctuation", () => {
    expect(extractEmailRagQuery("What is @emails?")).toEqual({
      shouldUseEmailRag: true,
      query: "What is",
    });
    expect(extractEmailRagQuery("@emails: renewal")).toEqual({
      shouldUseEmailRag: true,
      query: "renewal",
    });
  });

  it("falls back to the original text when only the trigger is entered", () => {
    expect(extractEmailRagQuery("@emails")).toEqual({
      shouldUseEmailRag: true,
      query: "@emails",
    });
  });
});

describe("buildEmailRagPrompt", () => {
  it("prepends email metadata and snippets before the stripped user prompt", () => {
    const result = buildEmailRagPrompt("What changed?", [
      makeEmbedding(),
      makeEmbedding({
        messageId: 2,
        subject: "Renewal",
        author: "bob@example.com",
        date: "2026-05-01T09:00:00.000Z",
        snippet: "The renewal date is June 1.",
      }),
    ]);

    expect(result).toContain("Relevant emails:");
    expect(result).toContain("Subject: Quarterly planning");
    expect(result).toContain("From: alice@example.com");
    expect(result).toContain("The renewal date is June 1.");
    expect(result.endsWith("What changed?")).toBe(true);
  });

  it("returns the stripped user prompt when no email records match", () => {
    expect(buildEmailRagPrompt("What changed?", [])).toBe("What changed?");
  });
});

describe("countIndexedEmails", () => {
  it("counts only integer Thunderbird message ids", () => {
    expect(countIndexedEmails([
      makeEmbedding({ messageId: 1 }),
      makeEmbedding({ messageId: 2 }),
      makeEmbedding({ messageId: "chat-message" }),
    ])).toBe(2);
  });
});

describe("listAllMessages", () => {
  it("walks account folders recursively and follows message list pages", async () => {
    const inbox = { id: "inbox", subFolders: [] };
    const archive = { id: "archive", subFolders: [{ id: "year", subFolders: [] }] };
    const api = {
      accounts: {
        list: vi.fn(async () => [{ folders: [inbox, archive] }]),
      },
      messages: {
        list: vi.fn(async (folder: { id: string }) => ({
          id: folder.id === "inbox" ? "next-inbox" : null,
          messages: [{ id: folder.id.length, subject: folder.id }],
        })),
        continueList: vi.fn(async () => ({
          id: null,
          messages: [{ id: 99, subject: "inbox" }],
        })),
      },
    };

    const messages = await listAllMessages(api);

    expect(messages.map((message) => message.subject)).toEqual(["inbox", "inbox", "archive", "year"]);
    expect(api.messages.continueList).toHaveBeenCalledWith("next-inbox");
  });
});

describe("countMessagesInFolders", () => {
  it("counts all messages returned by paginated folder enumeration", async () => {
    const api = {
      accounts: {
        list: vi.fn(async () => [{ folders: [{ id: "inbox", subFolders: [] }] }]),
      },
      messages: {
        list: vi.fn(async () => ({
          id: "next",
          messages: [{ id: 1 }, { id: 2 }],
        })),
        continueList: vi.fn(async () => ({
          id: null,
          messages: [{ id: 3 }],
        })),
      },
    };

    expect(await countMessagesInFolders(api)).toBe(3);
  });
});
