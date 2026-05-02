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
import type { CustomTextItem, Message, PromptData } from "./lib/types";

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

const WORKER_PATH_MAP: Record<Integration, string> = {
  chatgpt: "../js/workers/model-worker-openai_responses.js",
  google_gemini: "../js/workers/model-worker-google_gemini.js",
  ollama: "../js/workers/model-worker-ollama.js",
  openai_comp: "../js/workers/model-worker-openai_comp.js",
  anthropic: "../js/workers/model-worker-anthropic.js",
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

export function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [llmName, setLlmName] = useState("LLM");
  const [sending, setSending] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [customTextTrigger, setCustomTextTrigger] = useState<CustomTextItem[] | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const promptDataRef = useRef<PromptData | null>(null);
  const streamingIdRef = useRef<string | null>(null);
  const rawTokensRef = useRef<string>("");

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
    streamingIdRef.current = null;
  }, []);

  const sendPrompt = useCallback(
    (message: PromptData & { prompt: string }) => {
      const text = convertNewlinesToBr(message.prompt);
      setSending(true);
      setDisabled(true);
      setStatusMessage(browser.i18n.getMessage("WaitingServerResponse") + "...");
      appendMessage({ id: makeId(), role: "user", content: text });
      workerRef.current?.postMessage({ type: "chatMessage", message: text });
    },
    [appendMessage]
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
    [appendMessage, updateStreamingMessage, flushStreamingMessage]
  );

  // Initialize worker and wire up browser runtime messages
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const llm = urlParams.get("llm") ?? "";
    const call_id = urlParams.get("call_id") ?? "";
    const ph_def_val = urlParams.get("ph_def_val") ?? "";
    const prompt_id = urlParams.get("prompt_id") ?? "";
    const prompt_name = urlParams.get("prompt_name") ?? "";

    const integration = llm.replace("_api", "") as Integration;
    const workerPath = WORKER_PATH_MAP[integration];

    if (!workerPath) {
      console.error("[ThunderAI] API WebChat Unknown LLM type:", llm);
      return;
    }

    const worker = new Worker(workerPath, { type: "module" });
    workerRef.current = worker;
    worker.onmessage = handleWorkerMessage;

    const init = async () => {
      if (!integration_options_config[integration]) return;

      const integration_prefix = integration;
      const options_config = integration_options_config[integration];

      const prefsToGet: Record<string, unknown> = {
        do_debug: prefs_default["do_debug"],
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

      const resolvedLlmName =
        integration === "openai_comp"
          ? (prefs_api["openai_comp_chat_name"] as string | undefined) ?? "OpenAI Comp"
          : (LLM_DISPLAY_NAMES[integration] ?? "API");
      setLlmName(resolvedLlmName);

      document.title += ` [${resolvedLlmName} | ${decodeURIComponent(prompt_name)}]`;

      const workerInitMessage: Record<string, unknown> = {
        type: "init",
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

      // Runtime message handler
      browser.runtime.onMessage.addListener((message) => {
        const msg = message as Record<string, unknown>;
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
      });
    };

    init().catch((err) => console.error("[ThunderAI] init error:", err));

    return () => {
      worker.terminate();
    };
    // sendPrompt and appendMessage are stable useCallback refs; handleWorkerMessage too
  }, [handleWorkerMessage, sendPrompt, appendMessage]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = (text: string) => {
    setSending(true);
    setDisabled(true);
    setStatusMessage(browser.i18n.getMessage("WaitingServerResponse") + "...");
    appendMessage({ id: makeId(), role: "user", content: text });
    workerRef.current?.postMessage({ type: "chatMessage", message: text });
  };

  const handleStop = () => {
    workerRef.current?.postMessage({ type: "stop" });
  };

  return (
    <div
      className="flex flex-col h-screen max-w-[780px] w-full mx-auto"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
    >
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
  );
}
