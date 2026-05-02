#!/usr/bin/env node
/**
 * RAG latency spike — run once to validate whether IndexedDB + cosine similarity
 * is fast enough before building the full pipeline.
 *
 * Usage:
 *   OPENROUTER_API_KEY=sk-... node scripts/rag-spike.mjs
 *
 * What it measures:
 *   1. Time to embed 20 synthetic "email snippet" strings
 *   2. Time to store 20 EmbeddingRecord objects in IndexedDB (fake-indexeddb)
 *   3. Time to embed a query string
 *   4. Time to retrieve all vectors + run cosine similarity + return top-3
 *   5. Total round-trip from query text to ranked results
 */

import { IDBFactory } from "fake-indexeddb";

// Wire up fake IndexedDB before importing db.ts (compiled to JS via tsx)
globalThis.indexedDB = new IDBFactory();

const OPENROUTER_API_KEY = process.env["OPENROUTER_API_KEY"];
if (!OPENROUTER_API_KEY) {
  console.error("Missing OPENROUTER_API_KEY environment variable.");
  process.exit(1);
}

const EMBEDDING_MODEL = "qwen/qwen3-embedding-8b";
const EMBEDDING_URL = "https://openrouter.ai/api/v1/embeddings";

// ── embedding API ─────────────────────────────────────────────────────────────

async function embed(texts) {
  const res = await fetch(EMBEDDING_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://micz.it/thunderbird-addon-thunderai/",
      "X-Title": "ThunderAI RAG spike",
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts, encoding_format: "float" }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Embedding API error ${res.status}: ${detail}`);
  }

  const json = await res.json();
  return json.data.map((d) => new Float32Array(d.embedding));
}

// ── cosine similarity ─────────────────────────────────────────────────────────

function cosine(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ── fake email snippets ───────────────────────────────────────────────────────

const EMAIL_SNIPPETS = [
  "Can we reschedule the sprint planning meeting to Thursday at 2pm?",
  "The quarterly budget report is attached. Please review before Friday.",
  "Your AWS bill for March was $4,821. See the cost breakdown inside.",
  "Reminder: performance reviews are due by end of next week.",
  "The production deployment failed at 3:42am. Rollback was initiated.",
  "Please sign the updated NDA before your start date on the 15th.",
  "Your flight to SFO on April 10 is confirmed. Seat 14A.",
  "The team retrospective notes are now in Confluence under Q1 2026.",
  "We need your approval on the new vendor contract by COB today.",
  "Security alert: unrecognized login from IP 203.0.113.42.",
  "The design mockups for v3 are ready for review in Figma.",
  "Lunch with the investor group is confirmed for noon on Wednesday.",
  "Your pull request #847 has been approved and merged.",
  "The Docker base image has been updated to fix CVE-2026-1234.",
  "Please complete the mandatory GDPR training by April 30.",
  "The client reported a data export issue in production. P1 ticket opened.",
  "Your expense report for March has been approved. Reimbursement in 5 days.",
  "We're migrating the database to Postgres 17 this weekend.",
  "Interview feedback for the senior engineer candidate is due by Friday.",
  "The new onboarding checklist has been sent to the three new hires.",
];

const QUERY = "deployment failure rollback";

// ── main ──────────────────────────────────────────────────────────────────────

console.log(`Model: ${EMBEDDING_MODEL}`);
console.log(`Corpus: ${EMAIL_SNIPPETS.length} email snippets`);
console.log(`Query: "${QUERY}"\n`);

// Step 1: embed corpus
console.log("Step 1: embedding corpus...");
const t0 = performance.now();
const corpusVectors = await embed(EMAIL_SNIPPETS);
const embedCorpusMs = performance.now() - t0;
console.log(`  ✓ ${EMAIL_SNIPPETS.length} vectors in ${embedCorpusMs.toFixed(0)}ms (${(corpusVectors[0]?.length ?? 0)} dims each)\n`);

// Step 2: store in IndexedDB
console.log("Step 2: storing in IndexedDB...");

// Dynamically import db module after fake-indexeddb is set up.
// We compile on-the-fly using tsx (must be installed).
// db.ts is TypeScript — Vitest handles it via Vite, but plain Node needs the
// compiled output. We inline a minimal implementation here so the spike runs
// without a build step.

async function openSpikeDB() {
  return new Promise((resolve, reject) => {
    const req = globalThis.indexedDB.open("thunderai_spike", 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("embeddings")) {
        db.createObjectStore("embeddings", { keyPath: "messageId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putEmbedding(record) {
  const db = await openSpikeDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("embeddings", "readwrite");
    const req = tx.objectStore("embeddings").put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function getAllEmbeddings() {
  const db = await openSpikeDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("embeddings", "readonly");
    const req = tx.objectStore("embeddings").getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const t1 = performance.now();
for (let i = 0; i < EMAIL_SNIPPETS.length; i++) {
  await putEmbedding({
    messageId: `msg-${i}`,
    subject: `Email ${i}`,
    author: "spike@example.com",
    date: "2026-01-01",
    snippet: EMAIL_SNIPPETS[i],
    vector: corpusVectors[i],
    model: EMBEDDING_MODEL,
    indexedAt: Date.now(),
  });
}
const storeMs = performance.now() - t1;
console.log(`  ✓ stored ${EMAIL_SNIPPETS.length} records in ${storeMs.toFixed(0)}ms\n`);

// Step 3: embed query
console.log("Step 3: embedding query...");
const t2 = performance.now();
const [queryVector] = await embed([QUERY]);
const embedQueryMs = performance.now() - t2;
console.log(`  ✓ query embedded in ${embedQueryMs.toFixed(0)}ms\n`);

// Step 4: retrieve + rank
console.log("Step 4: retrieving + ranking...");
const t3 = performance.now();
const allRecords = await getAllEmbeddings();
const scored = allRecords.map((r) => ({
  snippet: r.snippet,
  score: cosine(queryVector, r.vector),
}));
scored.sort((a, b) => b.score - a.score);
const rankMs = performance.now() - t3;
console.log(`  ✓ retrieved ${allRecords.length} records, ranked in ${rankMs.toFixed(0)}ms\n`);

// Results
console.log("Top 3 results:");
scored.slice(0, 3).forEach((r, i) => {
  console.log(`  ${i + 1}. [${r.score.toFixed(4)}] ${r.snippet}`);
});

// Summary
console.log("\n── Latency summary ──────────────────────────────────────────");
console.log(`  Embed corpus (${EMAIL_SNIPPETS.length} texts): ${embedCorpusMs.toFixed(0)}ms`);
console.log(`  Store to IndexedDB:              ${storeMs.toFixed(0)}ms`);
console.log(`  Embed query (1 text):            ${embedQueryMs.toFixed(0)}ms`);
console.log(`  Retrieve + cosine rank:          ${rankMs.toFixed(0)}ms`);
console.log(`  Query round-trip (steps 3+4):    ${(embedQueryMs + rankMs).toFixed(0)}ms`);
console.log("─────────────────────────────────────────────────────────────");
console.log();
if (embedQueryMs + rankMs < 300) {
  console.log("✓ Round-trip under 300ms — vector similarity is viable.");
} else if (embedQueryMs + rankMs < 1000) {
  console.log("~ Round-trip 300ms–1s — acceptable but consider caching query embeddings.");
} else {
  console.log("✗ Round-trip over 1s — consider BM25 or pre-filtering before cosine ranking.");
}
