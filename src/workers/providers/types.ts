export type HistoryMessage = Record<string, unknown>;

export interface Provider {
  configPrefix: string;
  formatUserMessage: (text: string) => HistoryMessage;
  formatAssistantMessage: (text: string) => HistoryMessage;
  /** Returns the token string from a parsed SSE line, or null if no token. */
  extractToken: (parsed: Record<string, unknown>) => string | null;
  /** Returns true if this parsed line signals the stream is finished. */
  isDone: (parsed: Record<string, unknown>) => boolean;
  /** Strips line prefix and returns the JSON string, or null to skip the line. */
  stripLine: (line: string) => string | null;
  /** Only for openai_responses: extracts a response ID for conversation threading. */
  extractResponseId?: (parsed: Record<string, unknown>) => string | null;
}
