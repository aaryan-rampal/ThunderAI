/*
 *  ThunderAI [https://micz.it/thunderbird-addon-thunderai/]
 *  Copyright (C) 2024 - 2026  Mic (m@micz.it)
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 */

export type MessageRole = "user" | "bot" | "error" | "info";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  isStreaming?: boolean;
  promptData?: PromptData;
  showActionButtons?: boolean;
}

export interface PromptData {
  action: string;
  tabId: number;
  mailMessageId: number;
  prompt_info?: {
    use_diff_viewer?: string;
    selection_text?: string;
    body_text?: string;
    custom_text_array?: CustomTextItem[];
  };
  prompt?: string;
  do_custom_text?: string;
}

export interface CustomTextItem {
  placeholder: string;
  info: string;
  custom_text?: string;
}

export interface Session {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  model: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

export interface EmbeddingRecord {
  messageId: string | number;
  subject: string;
  author: string;
  date: string;
  snippet: string;
  vector: Float32Array;
  model: string;
  indexedAt: number;
}

export interface RagMetaRecord {
  key: string;
  value: unknown;
}
