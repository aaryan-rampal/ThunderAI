import type { EmbeddingRecord } from "./types.js";

const EMBEDDING_URL = "https://openrouter.ai/api/v1/embeddings";

export async function embedText(
  text: string,
  apiKey: string,
  model: string
): Promise<Float32Array> {
  const cleanApiKey = apiKey.replace(/[^\x21-\x7E]/g, "");
  if (!cleanApiKey) {
    throw new Error("Embedding API key is empty or contains only invalid characters");
  }

  const res = await fetch(EMBEDDING_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cleanApiKey}`,
      "HTTP-Referer": "https://micz.it/thunderbird-addon-thunderai/",
      "X-Title": "ThunderAI",
    },
    body: JSON.stringify({ model, input: text, encoding_format: "float" }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Embedding API error ${res.status}: ${detail}`);
  }

  const json = await res.json() as { data: Array<{ embedding: number[] }> };
  return new Float32Array(json.data[0]!.embedding);
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function rankEmbeddings(
  query: Float32Array,
  records: EmbeddingRecord[],
  topK: number
): EmbeddingRecord[] {
  return records
    .map((r) => ({ record: r, score: cosineSimilarity(query, r.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((r) => r.record);
}

export function buildContextPrefix(records: EmbeddingRecord[]): string {
  if (records.length === 0) return "";
  const snippets = records.map((r) => `- ${r.snippet}`).join("\n");
  return `Relevant context from earlier in this conversation:\n${snippets}\n\n`;
}
