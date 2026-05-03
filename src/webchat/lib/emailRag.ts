import type { EmbeddingRecord } from "./types.js";

export interface MailFolder {
  id: string;
  subFolders?: MailFolder[];
}

export interface MailAccount {
  folders?: MailFolder[];
}

export interface MessageHeader {
  id: number;
  subject?: string;
  author?: string;
  date?: Date | string;
}

export interface MessageListPage {
  id: string | null;
  messages: MessageHeader[];
}

export interface MessagePart {
  body?: string;
  contentType?: string;
  headers?: Record<string, string | string[]>;
  parts?: MessagePart[];
}

export interface MailApi {
  accounts: {
    list: () => Promise<MailAccount[]>;
  };
  messages: {
    list: (folder: MailFolder) => Promise<MessageListPage>;
    continueList: (messageListId: string) => Promise<MessageListPage>;
    get?: (messageId: number) => Promise<MessageHeader>;
    getFull?: (messageId: number) => Promise<MessagePart>;
  };
}

const EMAIL_TRIGGER = /(^|\s)@emails(?:[?:,.;!])?(?=\s|$)/i;

export function extractEmailRagQuery(text: string): {
  shouldUseEmailRag: boolean;
  query: string;
} {
  if (!EMAIL_TRIGGER.test(text)) {
    return { shouldUseEmailRag: false, query: text };
  }

  const stripped = text.replace(EMAIL_TRIGGER, " ").replace(/\s+/g, " ").trim();
  return {
    shouldUseEmailRag: true,
    query: stripped.length > 0 ? stripped : text,
  };
}

export function buildEmailRagPrompt(query: string, records: EmbeddingRecord[]): string {
  if (records.length === 0) return query;

  const snippets = records
    .map((record) => {
      const date = record.date ? `Date: ${record.date}` : "Date: unknown";
      return [
        `Subject: ${record.subject || "(no subject)"}`,
        `From: ${record.author || "unknown"}`,
        date,
        `Snippet: ${record.snippet}`,
      ].join("\n");
    })
    .join("\n\n");

  return `Relevant emails:\n${snippets}\n\nUser request:\n${query}`;
}

export function countIndexedEmails(records: EmbeddingRecord[]): number {
  return records.filter((record) => typeof record.messageId === "number").length;
}

export async function listAllMessages(api: MailApi): Promise<MessageHeader[]> {
  const accounts = await api.accounts.list();
  const folders = accounts.flatMap((account) => flattenFolders(account.folders ?? []));
  const messages: MessageHeader[] = [];

  for (const folder of folders) {
    let page = await api.messages.list(folder);
    messages.push(...page.messages);

    while (page.id) {
      page = await api.messages.continueList(page.id);
      messages.push(...page.messages);
    }
  }

  return messages;
}

export async function countMessagesInFolders(api: MailApi): Promise<number> {
  const messages = await listAllMessages(api);
  return messages.length;
}

export function emailEmbeddingText(header: MessageHeader, bodyText: string): string {
  return [
    `Subject: ${header.subject ?? ""}`,
    `From: ${header.author ?? ""}`,
    `Date: ${formatMessageDate(header.date)}`,
    "",
    bodyText,
  ].join("\n");
}

export function toEmailEmbeddingRecord(
  header: MessageHeader,
  bodyText: string,
  vector: Float32Array,
  model: string
): EmbeddingRecord {
  return {
    messageId: header.id,
    subject: header.subject ?? "",
    author: header.author ?? "",
    date: formatMessageDate(header.date),
    snippet: normalizeWhitespace(bodyText).slice(0, 200),
    vector,
    model,
    indexedAt: Date.now(),
  };
}

export function extractTextFromMessagePart(part: MessagePart): string {
  const textParts: string[] = [];
  const htmlParts: string[] = [];

  walkMessageParts(part, (child) => {
    if (!child.body || !child.contentType?.startsWith("text/")) return;
    if (child.contentType === "text/html") {
      htmlParts.push(stripHtml(child.body));
    } else {
      textParts.push(child.body);
    }
  });

  const body = textParts.join("\n").trim() || htmlParts.join("\n").trim() || (part.body ?? "");
  return normalizeWhitespace(stripHtml(body));
}

function flattenFolders(folders: MailFolder[]): MailFolder[] {
  const result: MailFolder[] = [];
  for (const folder of folders) {
    result.push(folder);
    result.push(...flattenFolders(folder.subFolders ?? []));
  }
  return result;
}

function walkMessageParts(part: MessagePart, visit: (part: MessagePart) => void): void {
  visit(part);
  for (const child of part.parts ?? []) {
    walkMessageParts(child, visit);
  }
}

function stripHtml(text: string): string {
  if (!/<[a-z][\s\S]*>/i.test(text)) return text;
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function formatMessageDate(date: Date | string | undefined): string {
  if (!date) return "";
  if (date instanceof Date) return date.toISOString();
  return date;
}
