/*
 *  ThunderAI [https://micz.it/thunderbird-addon-thunderai/]
 *  Copyright (C) 2024 - 2026  Mic (m@micz.it)
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *
 *  This file contains a modified version of the code from the project at
 *  https://github.com/boxabirds/chatgpt-frontend-nobuild
 *  The original code has been released under the Apache License, Version 2.0.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { MessagesArea } from "./components/MessagesArea";
import { MessageInput } from "./components/MessageInput";
import { Sidebar } from "./components/Sidebar";
import type { CustomTextItem, Message, PromptData, Session } from "./lib/types";
import {
  createSession,
  listSessions,
  getMessages as dbGetMessages,
  addMessage,
  updateSession,
  getAllEmbeddings,
  getEmbedding,
  putEmbedding,
  deleteEmbedding,
  setRagMeta,
  getRagMeta,
} from "./lib/db";
import { embedText, rankEmbeddings } from "./lib/rag";
import {
  buildEmailRagPrompt,
  countIndexedEmails,
  emailEmbeddingText,
  extractEmailRagQuery,
  extractTextFromMessagePart,
  listAllMessages,
  toEmailEmbeddingRecord,
  type MailApi,
} from "./lib/emailRag";

// These modules are external — they live in the extension and are loaded at
// runtime from api_webchat/index.html. Vite leaves them as bare imports.
// We declare them as globals with `any` to avoid TS path-resolution failures.
/* eslint-disable @typescript-eslint/no-explicit-any */
declare const prefs_default: Record<string, any>;
declare const integration_options_config: Record<string, Record<string, unknown>>;
declare const placeholdersUtils: {
  hasPlaceholder: (text: string, placeholder: string) => boolean;
  replacePlaceholders: (opts: {
    text: string;
    replacements: Record<string, string>;
    use_default_value: boolean;
  }) => string;
};
declare const getAPIsInitMessageString: (opts: {
  api_string: string;
  model_string?: string;
  host_string?: string;
  version_string?: string;
  additional_messages?: Array<{ label: string; value: unknown }>;
}) => string;
declare const convertNewlinesToBr: (text: string) => string;
declare const loadPrompt: (id: string) => Promise<Record<string, unknown> | null>;
/* eslint-enable @typescript-eslint/no-explicit-any */

type Integration = "chatgpt" | "google_gemini" | "ollama" | "openai_comp" | "anthropic";

interface RagStatus {
  indexed: number;
  total: number;
  indexing: boolean;
}

const WORKER_PATH = "../js/workers/model-worker.js";

const PROVIDER_NAME: Record<Integration, string> = {
  chatgpt: "openai_responses",
  google_gemini: "google_gemini",
  ollama: "ollama",
  openai_comp: "openai_comp",
  anthropic: "anthropic",
};

const LLM_DISPLAY_NAMES: Partial<Record<Integration, string>> = {
  chatgpt: "ChatGPT",
  google_gemini: "Google Gemini",
  ollama: "Ollama Local",
  anthropic: "Claude",
};

const API_STRINGS: Record<Integration, string> = {
  chatgpt: "ChatGPT API",
  google_gemini: "Google Gemini API",
  ollama: "Ollama API",
  openai_comp: "OpenAI Compatible API",
  anthropic: "Claude API",
};

function makeId(): string {
  return Math.random().toString(36).slice(2);
}

function makeUUID(): string {
  return crypto.randomUUID();
}

export function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [llmName, setLlmName] = useState("LLM");
  const [sending, setSending] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [customTextTrigger, setCustomTextTrigger] = useState<CustomTextItem[] | null>(null);

  // Copilot mode state
  const [isCopilot, setIsCopilot] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [ragEnabled, setRagEnabled] = useState(false);
  const [ragStatus, setRagStatus] = useState<RagStatus>({
    indexed: 0,
    total: 0,
    indexing: false,
  });

  const workerRef = useRef<Worker | null>(null);
  const promptDataRef = useRef<PromptData | null>(null);
  const streamingIdRef = useRef<string | null>(null);
  const rawTokensRef = useRef<string>("");
  // Tracks whether first AI response in a session has been received (for title gen)
  const firstResponseDoneRef = useRef(false);
  const activeSessionIdRef = useRef<string | null>(null);
  const llmNameRef = useRef<string>("LLM");
  const modelRef = useRef<string>("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prefsApiRef = useRef<Record<string, any>>({});
  const integrationRef = useRef<Integration | null>(null);
  const ragApiKeyRef = useRef<string>("");
  const ragModelRef = useRef<string>("");
  const ragEnabledRef = useRef(false);
  const indexingRef = useRef(false);

  const appendMessage = useCallback((msg: Message) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const updateStreamingMessage = useCallback((token: string) => {
    setMessages((prev) => {
      const id = streamingIdRef.current;
      if (!id) return prev;
      return prev.map((m) =>
        m.id === id ? { ...m, content: m.content + token, isStreaming: true } : m
      );
    });
  }, []);

  const flushStreamingMessage = useCallback((promptData: PromptData | null) => {
    const fullText = rawTokensRef.current;
    rawTokensRef.current = "";

    const html = markdownit().render(fullText);

    setMessages((prev) => {
      const id = streamingIdRef.current;
      if (!id) return prev;
      return prev.map((m) => {
        if (m.id !== id) return m;
        const base: Message = {
          ...m,
          content: html,
          isStreaming: false,
          showActionButtons: promptData !== null,
        };
        if (promptData !== null) {
          base.promptData = promptData;
        }
        return base;
      });
    });

    // Persist assistant message to IndexedDB in copilot mode
    if (activeSessionIdRef.current) {
      const sessionId = activeSessionIdRef.current;
      void addMessage({
        id: makeUUID(),
        sessionId,
        role: "assistant",
        content: html,
        timestamp: Date.now(),
      });
      void updateSession(sessionId, { updatedAt: Date.now() });
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, updatedAt: Date.now() } : s))
          .sort((a, b) => b.updatedAt - a.updatedAt)
      );
    }

    streamingIdRef.current = null;
  }, []);

  // Generate a session title after the first AI response
  const generateTitle = useCallback(
    async (sessionId: string, firstUserMessage: string) => {
      const worker = workerRef.current;
      if (!worker) return;

      const titlePrompt =
        `Based on this message, generate a short 4-6 word title for the conversation. ` +
        `Reply with only the title, no punctuation:\n\n${firstUserMessage.slice(0, 500)}`;

      // Fire a one-shot title generation by posting directly to the worker
      // and listening for a single tokensDone response tagged with our session
      const titleWorker = new Worker(WORKER_PATH, { type: "module" });
      const integration = integrationRef.current ?? "chatgpt";
      const initMsg: Record<string, unknown> = {
        type: "init",
        provider: PROVIDER_NAME[integration],
        do_debug: false,
        i18nStrings: {},
      };
      const opts = integration_options_config[integration] ?? {};
      for (const key in opts) {
        const prefKey = `${integration}_${key}`;
        initMsg[prefKey] = prefsApiRef.current[prefKey];
      }
      titleWorker.postMessage(initMsg);
      titleWorker.postMessage({ type: "chatMessage", message: titlePrompt });

      let titleTokens = "";
      titleWorker.onmessage = (event: MessageEvent) => {
        const { type, payload } = event.data as { type: string; payload: Record<string, unknown> };
        if (type === "newToken") {
          titleTokens += (payload["token"] as string | undefined) ?? "";
        } else if (type === "tokensDone") {
          const title = titleTokens.trim().slice(0, 60);
          void updateSession(sessionId, { title });
          setSessions((prev) =>
            prev.map((s) => (s.id === sessionId ? { ...s, title } : s))
          );
          titleWorker.terminate();
        } else if (type === "error") {
          titleWorker.terminate();
        }
      };
    },
    []
  );

  const refreshRagStatus = useCallback(async (total?: number) => {
    const records = await getAllEmbeddings();
    const indexed = countIndexedEmails(records);
    const storedTotal = total ?? (await getRagMeta<number>("email_total")) ?? 0;
    setRagStatus((prev) => ({
      indexed,
      total: Math.max(storedTotal, indexed),
      indexing: prev.indexing,
    }));
  }, []);

  const syncEmailIndex = useCallback(async (promptIfEmpty: boolean) => {
    if (indexingRef.current || !ragEnabledRef.current) return;
    if (!ragApiKeyRef.current || !ragModelRef.current) return;

    indexingRef.current = true;
    setRagStatus((prev) => ({ ...prev, indexing: true }));

    try {
      const api = browser as unknown as MailApi;
      const messagesToIndex = await listAllMessages(api);
      const total = messagesToIndex.length;
      await setRagMeta("email_total", total);

      const existingRecords = (await getAllEmbeddings())
        .filter((record) => typeof record.messageId === "number");
      if (promptIfEmpty && existingRecords.length === 0) {
        const shouldIndex = window.confirm(
          `${total} emails found. Index them for RAG? This will use your embedding API.`
        );
        if (!shouldIndex) {
          ragEnabledRef.current = false;
          setRagEnabled(false);
          await browser.storage.sync.set({ rag_enabled: false });
          return;
        }
      }

      const validIds = new Set<number>();
      for (const record of existingRecords) {
        const messageId = record.messageId;
        if (typeof messageId !== "number") continue;
        try {
          await browser.messages.get(messageId);
          validIds.add(messageId);
        } catch {
          await deleteEmbedding(messageId);
        }
      }

      setRagStatus({ indexed: validIds.size, total, indexing: true });

      for (const header of messagesToIndex) {
        if (!ragEnabledRef.current) break;
        if (validIds.has(header.id)) continue;
        if (await getEmbedding(header.id)) continue;

        const fullMessage = await browser.messages.getFull(header.id);
        const bodyText = extractTextFromMessagePart(fullMessage);
        const vector = await embedText(
          emailEmbeddingText(header, bodyText),
          ragApiKeyRef.current,
          ragModelRef.current
        );
        await putEmbedding(toEmailEmbeddingRecord(header, bodyText, vector, ragModelRef.current));
        validIds.add(header.id);
        setRagStatus({ indexed: validIds.size, total, indexing: true });
      }
    } catch (error) {
      console.error("[ThunderAI] Email RAG indexing failed:", error);
    } finally {
      indexingRef.current = false;
      setRagStatus((prev) => ({ ...prev, indexing: false }));
      void refreshRagStatus();
    }
  }, [refreshRagStatus]);

  const sendWithEmailRag = useCallback(async (text: string) => {
    const { shouldUseEmailRag, query } = extractEmailRagQuery(text);
    let prompt = shouldUseEmailRag ? query : text;

    if (
      shouldUseEmailRag &&
      ragEnabledRef.current &&
      ragApiKeyRef.current &&
      ragModelRef.current
    ) {
      try {
        const [queryVector, records] = await Promise.all([
          embedText(query, ragApiKeyRef.current, ragModelRef.current),
          getAllEmbeddings(),
        ]);
        const emailRecords = records.filter((record) => typeof record.messageId === "number");
        const top = rankEmbeddings(queryVector, emailRecords, 3);
        prompt = buildEmailRagPrompt(query, top);
      } catch (error) {
        console.error("[ThunderAI] Email RAG lookup failed:", error);
        prompt = query;
      }
    }

    workerRef.current?.postMessage({ type: "chatMessage", message: prompt });
  }, []);

  const sendPrompt = useCallback(
    (message: PromptData & { prompt: string }) => {
      const text = convertNewlinesToBr(message.prompt);
      setSending(true);
      setDisabled(true);
      setStatusMessage(browser.i18n.getMessage("WaitingServerResponse") + "...");
      appendMessage({ id: makeId(), role: "user", content: text });

      const msgId = makeUUID();
      if (activeSessionIdRef.current) {
        void addMessage({
          id: msgId,
          sessionId: activeSessionIdRef.current,
          role: "user",
          content: text,
          timestamp: Date.now(),
        });
      }

      void sendWithEmailRag(text);
    },
    [appendMessage, sendWithEmailRag]
  );

  // Worker message handler — set up once the worker ref is populated
  const handleWorkerMessage = useCallback(
    (event: MessageEvent) => {
      const { type, payload } = event.data as {
        type: string;
        payload: Record<string, unknown>;
      };
      switch (type) {
        case "messageSent":
          break;
        case "newToken": {
          const token = (payload["token"] as string | undefined) ?? "";
          if (!streamingIdRef.current) {
            const id = makeId();
            streamingIdRef.current = id;
            rawTokensRef.current = "";
            setMessages((prev) => [
              ...prev,
              { id, role: "bot", content: "", isStreaming: true },
            ]);
          }
          rawTokensRef.current += token;
          updateStreamingMessage(token);
          setStatusMessage(browser.i18n.getMessage("apiwebchat_receiving_data") + "...");
          break;
        }
        case "tokensDone": {
          flushStreamingMessage(promptDataRef.current);
          setSending(false);
          setDisabled(false);
          setStatusMessage("");

          // Title generation after first assistant response
          if (!firstResponseDoneRef.current && activeSessionIdRef.current) {
            firstResponseDoneRef.current = true;
            const sessionId = activeSessionIdRef.current;
            // Find the first user message text from current messages
            setMessages((prev) => {
              const firstUser = prev.find((m) => m.role === "user");
              if (firstUser) {
                void generateTitle(sessionId, firstUser.content);
              }
              return prev;
            });
          }
          break;
        }
        case "error": {
          appendMessage({
            id: makeId(),
            role: "error",
            content: typeof payload === "string" ? payload : JSON.stringify(payload),
          });
          setSending(false);
          setDisabled(false);
          setStatusMessage("");
          break;
        }
        default:
          console.error("[ThunderAI] Unknown event type from API worker:", type);
      }
    },
    [appendMessage, updateStreamingMessage, flushStreamingMessage, generateTitle]
  );

  // Load an existing session's messages into the chat view
  const loadSession = useCallback(async (sessionId: string) => {
    setActiveSessionId(sessionId);
    activeSessionIdRef.current = sessionId;
    firstResponseDoneRef.current = true; // don't re-title existing sessions
    // Reset worker history and replay from DB so context matches what's shown
    workerRef.current?.postMessage({ type: "reset" });
    const dbMsgs = await dbGetMessages(sessionId);
    const uiMessages: Message[] = dbMsgs.map((m) => ({
      id: m.id,
      role: m.role === "user" ? "user" : m.role === "assistant" ? "bot" : "info",
      content: m.content,
    }));
    // Replay history into the worker so it has context for follow-up messages
    for (const m of dbMsgs) {
      if (m.role === "user" || m.role === "assistant") {
        workerRef.current?.postMessage({ type: "replayHistory", role: m.role, content: m.content });
      }
    }
    setMessages(uiMessages);
  }, []);

  // Create a new session and clear the chat
  const newSession = useCallback(
    (model: string) => {
      const id = makeUUID();
      const now = Date.now();
      const session: Session = {
        id,
        title: browser.i18n.getMessage("copilot_untitled_session"),
        createdAt: now,
        updatedAt: now,
        model,
      };
      void createSession(session);
      setSessions((prev) => [session, ...prev]);
      setActiveSessionId(id);
      activeSessionIdRef.current = id;
      firstResponseDoneRef.current = false;
      setMessages([]);
      // Clear the worker's conversation history so the new session starts fresh
      workerRef.current?.postMessage({ type: "reset" });
      return id;
    },
    []
  );

  // Initialize worker and wire up browser runtime messages
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const llm = urlParams.get("llm") ?? "";
    const call_id = urlParams.get("call_id") ?? "";
    const ph_def_val = urlParams.get("ph_def_val") ?? "";
    const prompt_id = urlParams.get("prompt_id") ?? "";
    const prompt_name = urlParams.get("prompt_name") ?? "";
    const copilot = urlParams.get("copilot") === "1";

    setIsCopilot(copilot);

    const integration = llm.replace("_api", "") as Integration;
    integrationRef.current = integration;

    if (!PROVIDER_NAME[integration]) {
      console.error("[ThunderAI] API WebChat Unknown LLM type:", llm);
      return;
    }

    const worker = new Worker(WORKER_PATH, { type: "module" });
    workerRef.current = worker;
    worker.onmessage = handleWorkerMessage;

    const init = async () => {
      if (!integration_options_config[integration]) return;

      const integration_prefix = integration;
      const options_config = integration_options_config[integration];

      const prefsToGet: Record<string, unknown> = {
        do_debug: prefs_default["do_debug"],
        rag_enabled: prefs_default["rag_enabled"],
        rag_embedding_api_key: prefs_default["rag_embedding_api_key"],
        rag_embedding_model: prefs_default["rag_embedding_model"],
      };
      for (const key in options_config) {
        prefsToGet[`${integration_prefix}_${key}`] = prefs_default[`${integration_prefix}_${key}`];
      }
      if (integration === "openai_comp") {
        prefsToGet["openai_comp_chat_name"] = prefs_default["openai_comp_chat_name"];
      }

      let prefs_api = await browser.storage.sync.get(prefsToGet);

      if (prompt_id) {
        try {
          const prompt = await loadPrompt(prompt_id);
          if (prompt && prompt["api_type"] === llm) {
            for (const key in options_config) {
              const prefKey = `${integration_prefix}_${key}`;
              if (prompt[prefKey] !== undefined) {
                prefs_api[prefKey] = prompt[prefKey];
              }
            }
          }
        } catch (e) {
          console.error("[ThunderAI] Error loading prompt settings:", e);
        }
      }

      prefsApiRef.current = prefs_api;
      ragEnabledRef.current = Boolean(prefs_api["rag_enabled"]);
      setRagEnabled(ragEnabledRef.current);
      ragApiKeyRef.current = (prefs_api["rag_embedding_api_key"] as string | undefined) ?? "";
      ragModelRef.current = (prefs_api["rag_embedding_model"] as string | undefined) ?? "";

      const i18nStrings: Record<string, string> = {};
      const i18n_msg_key =
        integration === "openai_comp"
          ? "OpenAIComp_api_request_failed"
          : `${integration}_api_request_failed`;
      i18nStrings[i18n_msg_key] = browser.i18n.getMessage(i18n_msg_key);
      i18nStrings["error_connection_interrupted"] = browser.i18n.getMessage(
        "error_connection_interrupted"
      );

      const modelKey = `${integration_prefix}_model`;
      const model = (prefs_api[modelKey] as string | undefined) ?? "";
      modelRef.current = model;

      const resolvedLlmName =
        integration === "openai_comp"
          ? (prefs_api["openai_comp_chat_name"] as string | undefined) ?? "OpenAI Comp"
          : (LLM_DISPLAY_NAMES[integration] ?? "API");
      setLlmName(resolvedLlmName);
      llmNameRef.current = resolvedLlmName;

      document.title += ` [${resolvedLlmName} | ${decodeURIComponent(prompt_name)}]`;

      const workerInitMessage: Record<string, unknown> = {
        type: "init",
        provider: PROVIDER_NAME[integration],
        do_debug: prefs_api["do_debug"],
        i18nStrings,
      };
      for (const key in options_config) {
        const prefKey = `${integration_prefix}_${key}`;
        workerInitMessage[prefKey] = prefs_api[prefKey];
      }
      worker.postMessage(workerInitMessage);

      const additional_messages_config: Record<
        string,
        Array<{ key: string; labelKey: string; type: string }>
      > = {
        chatgpt: [
          { key: "store", labelKey: "ChatGPT_chatgpt_api_store", type: "boolean" },
          { key: "developer_messages", labelKey: "ChatGPT_Developer_Messages", type: "string" },
          { key: "temperature", labelKey: "prefs_api_temperature", type: "string" },
        ],
        google_gemini: [
          { key: "system_instruction", labelKey: "GoogleGemini_SystemInstruction", type: "string" },
          { key: "temperature", labelKey: "prefs_api_temperature", type: "string" },
          {
            key: "thinking_budget",
            labelKey: "prefs_google_gemini_thinking_budget",
            type: "string",
          },
        ],
        ollama: [
          { key: "think", labelKey: "prefs_ollama_think", type: "boolean" },
          { key: "temperature", labelKey: "prefs_api_temperature", type: "string" },
          { key: "num_ctx", labelKey: "prefs_ollama_num_ctx", type: "number_gt_zero" },
        ],
        openai_comp: [{ key: "temperature", labelKey: "prefs_api_temperature", type: "string" }],
        anthropic: [
          { key: "system_prompt", labelKey: "Anthropic_System_Prompt", type: "string" },
          {
            key: "max_tokens",
            labelKey: "prefs_OptionText_anthropic_max_tokens",
            type: "number_gt_zero",
          },
          { key: "temperature", labelKey: "prefs_api_temperature", type: "string" },
        ],
      };

      const getAdditionalMessages = (
        integ: string,
        prefs: Record<string, unknown>
      ): Array<{ label: string; value: unknown }> => {
        const msgs: Array<{ label: string; value: unknown }> = [];
        const config = additional_messages_config[integ];
        if (!config) return msgs;

        for (const item of config) {
          const prefKey = `${integ}_${item.key}`;
          const value = prefs[prefKey];
          if (value === undefined || value === null || value === "") continue;

          let displayValue: unknown;
          let shouldAdd = false;

          if (item.type === "boolean") {
            displayValue = value ? "Yes" : "No";
            shouldAdd = true;
          } else if (item.type === "string" && typeof value === "string" && value.length > 0) {
            displayValue = value;
            shouldAdd = true;
          } else if (
            item.type === "number_gt_zero" &&
            typeof value === "number" &&
            value > 0
          ) {
            displayValue = value;
            shouldAdd = true;
          }

          if (shouldAdd) {
            msgs.push({ label: browser.i18n.getMessage(item.labelKey), value: displayValue });
          }
        }
        return msgs;
      };

      // In copilot mode: load existing sessions, wait for first api_send to create one
      if (copilot) {
        const existingSessions = await listSessions();
        setSessions(existingSessions);
        await refreshRagStatus();
        if (ragEnabledRef.current) {
          void syncEmailIndex(true);
        }
        console.log('[ThunderAI copilot] Tab init done, sending copilot_ready. isCopilot state will update next render.');
        // Signal background that this copilot tab is ready to receive prompts
        await browser.runtime.sendMessage({ command: "copilot_ready" });
        console.log('[ThunderAI copilot] copilot_ready sent to background.');
        return;
      }

      // Non-copilot (one-shot) mode: existing behavior
      const additional_text_elements: Array<{ label: string; value: unknown }> = [];
      additional_text_elements.push({
        label: browser.i18n.getMessage("prompt_string"),
        value: `[${prompt_id}] ${decodeURIComponent(prompt_name)}`,
      });
      additional_text_elements.push(...getAdditionalMessages(integration, prefs_api));

      const hostStr = prefs_api[`${integration_prefix}_host`] as string | undefined;
      const versionStr = prefs_api[`${integration_prefix}_version`] as string | undefined;
      const infoContent = getAPIsInitMessageString({
        api_string: API_STRINGS[integration] ?? "",
        model_string: model,
        ...(hostStr !== undefined && { host_string: hostStr }),
        ...(versionStr !== undefined && { version_string: versionStr }),
        additional_messages: additional_text_elements,
      });

      appendMessage({ id: makeId(), role: "info", content: infoContent });

      const win = await browser.windows.getCurrent();
      await browser.runtime.sendMessage({
        command: `${llm}_ready_${call_id}`,
        window_id: win.id,
      });

      // Runtime message handler (one-shot mode)
      browser.runtime.onMessage.addListener((message) => {
        const msg = message as Record<string, unknown>;
        handleApiMessage(msg, ph_def_val);
      });
    };

    init().catch((err) => console.error("[ThunderAI] init error:", err));

    return () => {
      worker.terminate();
    };
    // sendPrompt and appendMessage are stable useCallback refs; handleWorkerMessage too
  }, [handleWorkerMessage, sendPrompt, appendMessage, refreshRagStatus, syncEmailIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // In copilot mode, the runtime listener is set up separately so it persists
  // across new sessions (not removed after first message).
  useEffect(() => {
    if (!isCopilot) return;

    const urlParams = new URLSearchParams(window.location.search);
    const ph_def_val = urlParams.get("ph_def_val") ?? "";

    console.log('[ThunderAI copilot] Attaching persistent runtime message listener (isCopilot=true)');

    const listener = (message: unknown) => {
      const msg = message as Record<string, unknown>;
      console.log('[ThunderAI copilot] runtime message received:', msg["command"]);
      if (msg["command"] === "api_send" || msg["command"] === "api_error" || msg["command"] === "api_send_custom_text") {
        if (msg["command"] === "api_send") {
          const id = newSession(modelRef.current);
          activeSessionIdRef.current = id;
          firstResponseDoneRef.current = false;
          console.log('[ThunderAI copilot] New session created:', id, 'prompt:', (msg["prompt"] as string)?.slice(0, 80));
        }
        handleApiMessage(msg, ph_def_val);
      }
    };

    browser.runtime.onMessage.addListener(listener);
    return () => browser.runtime.onMessage.removeListener(listener);
  }, [isCopilot, newSession]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleApiMessage = (msg: Record<string, unknown>, ph_def_val: string) => {
    switch (msg["command"]) {
      case "api_send": {
        promptDataRef.current = msg as unknown as PromptData;
        if (msg["do_custom_text"] === "1") {
          const ctArr = (
            msg as { prompt_info?: { custom_text_array?: CustomTextItem[] } }
          ).prompt_info?.custom_text_array ?? [];
          setCustomTextTrigger(ctArr);
        } else {
          sendPrompt(msg as unknown as PromptData & { prompt: string });
        }
        break;
      }
      case "api_send_custom_text": {
        const userInput = msg["custom_text"] as CustomTextItem[] | string | null;
        if (userInput !== null && promptDataRef.current) {
          const promptData = { ...promptDataRef.current };
          const promptText = promptData.prompt ?? "";
          if (!placeholdersUtils.hasPlaceholder(promptText, "additional_text")) {
            const inputText = Array.isArray(userInput)
              ? userInput.map((obj) => obj.custom_text ?? "").join(" ")
              : userInput;
            promptData.prompt = promptText + " " + inputText;
          } else {
            const finalSubs: Record<string, string> = {};
            if (Array.isArray(userInput)) {
              userInput.forEach((obj) => {
                const key = obj.placeholder.replace(/^\{%|%\}$/g, "").trim();
                finalSubs[key] = obj.custom_text ?? "";
              });
            } else {
              finalSubs["additional_text"] = userInput;
            }
            promptData.prompt = placeholdersUtils.replacePlaceholders({
              text: promptText,
              replacements: finalSubs,
              use_default_value: ph_def_val === "1",
            });
          }
          promptDataRef.current = promptData;
          sendPrompt(promptData as PromptData & { prompt: string });
        }
        break;
      }
      case "api_error": {
        appendMessage({
          id: makeId(),
          role: "error",
          content: (msg["error"] as string | undefined) ?? "Unknown error",
        });
        setSending(false);
        setDisabled(false);
        setStatusMessage("");
        break;
      }
    }
  };

  const handleSend = (text: string) => {
    setSending(true);
    setDisabled(true);
    setStatusMessage(browser.i18n.getMessage("WaitingServerResponse") + "...");
    appendMessage({ id: makeId(), role: "user", content: text });

    const msgId = makeUUID();
    if (activeSessionIdRef.current) {
      void addMessage({
        id: msgId,
        sessionId: activeSessionIdRef.current,
        role: "user",
        content: text,
        timestamp: Date.now(),
      });
    }

    void sendWithEmailRag(text);
  };

  const handleStop = () => {
    workerRef.current?.postMessage({ type: "stop" });
  };

  const handleSelectSession = async (id: string) => {
    await loadSession(id);
  };

  const handleNewChat = () => {
    newSession(modelRef.current);
  };

  const handleToggleRag = (enabled: boolean) => {
    ragEnabledRef.current = enabled;
    setRagEnabled(enabled);
    void browser.storage.sync.set({ rag_enabled: enabled });
    if (enabled) {
      void syncEmailIndex(false);
    }
  };

  if (isCopilot) {
    return (
      <div className="copilot-root">
        <Sidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={handleSelectSession}
          onNewChat={handleNewChat}
          ragEnabled={ragEnabled}
          ragStatus={ragStatus}
          onToggleRag={handleToggleRag}
        />
        <div className="copilot-chat-area">
          <MessagesArea messages={messages} llmName={llmName} isCopilot={true} />
          <MessageInput
            onSend={handleSend}
            onStop={handleStop}
            disabled={disabled}
            sending={sending}
            model={llmName}
            statusMessage={statusMessage}
            customTextTrigger={customTextTrigger}
            onCustomTextDone={() => setCustomTextTrigger(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="non-copilot-root">
      <div className="flex flex-col h-screen max-w-[780px] w-full mx-auto">
        <MessagesArea messages={messages} llmName={llmName} />
        <MessageInput
          onSend={handleSend}
          onStop={handleStop}
          disabled={disabled}
          sending={sending}
          model={llmName}
          statusMessage={statusMessage}
          customTextTrigger={customTextTrigger}
          onCustomTextDone={() => setCustomTextTrigger(null)}
        />
      </div>
    </div>
  );
}
