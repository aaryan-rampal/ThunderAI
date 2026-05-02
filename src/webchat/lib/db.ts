/*
 *  ThunderAI [https://micz.it/thunderbird-addon-thunderai/]
 *  Copyright (C) 2024 - 2026  Mic (m@micz.it)
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 */

import type { Session, ChatMessage, EmbeddingRecord } from "./types";

const DB_NAME = "thunderai_copilot";
const DB_VERSION = 1;

type StoreNames = "sessions" | "messages" | "embeddings" | "rag_meta";

let dbPromise: Promise<IDBDatabase> | null = null;

export function resetDBCache(): void {
  dbPromise = null;
}

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains("sessions")) {
        const sessions = db.createObjectStore("sessions", { keyPath: "id" });
        sessions.createIndex("updatedAt", "updatedAt");
      }

      if (!db.objectStoreNames.contains("messages")) {
        const messages = db.createObjectStore("messages", { keyPath: "id" });
        messages.createIndex("sessionId", "sessionId");
        messages.createIndex("timestamp", "timestamp");
      }

      if (!db.objectStoreNames.contains("embeddings")) {
        const embeddings = db.createObjectStore("embeddings", { keyPath: "messageId" });
        embeddings.createIndex("indexedAt", "indexedAt");
      }

      if (!db.objectStoreNames.contains("rag_meta")) {
        db.createObjectStore("rag_meta", { keyPath: "key" });
      }
    };

    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };

    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });

  return dbPromise;
}

function tx(
  db: IDBDatabase,
  stores: StoreNames | StoreNames[],
  mode: IDBTransactionMode
): IDBTransaction {
  return db.transaction(stores, mode);
}

function promisifyRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Sessions

export async function createSession(session: Session): Promise<void> {
  const db = await openDB();
  const store = tx(db, "sessions", "readwrite").objectStore("sessions");
  await promisifyRequest(store.put(session));
}

export async function getSession(id: string): Promise<Session | undefined> {
  const db = await openDB();
  const store = tx(db, "sessions", "readonly").objectStore("sessions");
  return promisifyRequest(store.get(id));
}

export async function listSessions(): Promise<Session[]> {
  const db = await openDB();
  const store = tx(db, "sessions", "readonly").objectStore("sessions");
  const index = store.index("updatedAt");
  const results = await promisifyRequest<Session[]>(index.getAll());
  return results.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function updateSession(id: string, patch: Partial<Omit<Session, "id">>): Promise<void> {
  const db = await openDB();
  const t = tx(db, "sessions", "readwrite");
  const store = t.objectStore("sessions");
  const existing = await promisifyRequest<Session>(store.get(id));
  if (!existing) return;
  await promisifyRequest(store.put({ ...existing, ...patch }));
}

export async function deleteSession(id: string): Promise<void> {
  const db = await openDB();
  const t = tx(db, ["sessions", "messages"], "readwrite");
  t.objectStore("sessions").delete(id);
  const msgStore = t.objectStore("messages");
  const index = msgStore.index("sessionId");
  const keys = await promisifyRequest<IDBValidKey[]>(index.getAllKeys(id));
  for (const key of keys) {
    msgStore.delete(key);
  }
  await new Promise<void>((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

// Messages

export async function addMessage(msg: ChatMessage): Promise<void> {
  const db = await openDB();
  const store = tx(db, "messages", "readwrite").objectStore("messages");
  await promisifyRequest(store.put(msg));
}

export async function getMessages(sessionId: string): Promise<ChatMessage[]> {
  const db = await openDB();
  const store = tx(db, "messages", "readonly").objectStore("messages");
  const index = store.index("sessionId");
  const results = await promisifyRequest<ChatMessage[]>(index.getAll(sessionId));
  return results.sort((a, b) => a.timestamp - b.timestamp);
}

// Embeddings

export async function putEmbedding(record: EmbeddingRecord): Promise<void> {
  const db = await openDB();
  const store = tx(db, "embeddings", "readwrite").objectStore("embeddings");
  await promisifyRequest(store.put(record));
}

export async function getAllEmbeddings(): Promise<EmbeddingRecord[]> {
  const db = await openDB();
  const store = tx(db, "embeddings", "readonly").objectStore("embeddings");
  return promisifyRequest(store.getAll());
}

export async function getEmbeddingsBySession(sessionId: string): Promise<EmbeddingRecord[]> {
  const db = await openDB();
  const msgIds = await promisifyRequest<IDBValidKey[]>(
    tx(db, "messages", "readonly").objectStore("messages").index("sessionId").getAllKeys(sessionId)
  );
  if (msgIds.length === 0) return [];
  const idSet = new Set(msgIds.map(String));
  const all = await promisifyRequest<EmbeddingRecord[]>(
    tx(db, "embeddings", "readonly").objectStore("embeddings").getAll()
  );
  return all.filter((r) => idSet.has(r.messageId));
}
