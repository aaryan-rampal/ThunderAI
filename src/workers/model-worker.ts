import { anthropicProvider } from "./providers/anthropic.js";
import { googleGeminiProvider } from "./providers/google_gemini.js";
import { ollamaProvider } from "./providers/ollama.js";
import { openaiCompProvider } from "./providers/openai_comp.js";
import { openaiResponsesProvider } from "./providers/openai_responses.js";
import type { Provider, HistoryMessage } from "./providers/types.js";

const PROVIDERS: Record<string, Provider> = {
  anthropic: anthropicProvider,
  google_gemini: googleGeminiProvider,
  ollama: ollamaProvider,
  openai_comp: openaiCompProvider,
  openai_responses: openaiResponsesProvider,
};

type WorkerMessage = Record<string, unknown> & { type: string };
type PostFn = (msg: unknown) => void;

interface DispatcherState {
  provider: Provider | null;
  history: HistoryMessage[];
  stopStreaming: boolean;
  i18nStrings: Record<string, string>;
  doDebug: boolean;
}

export function createDispatcher(post: PostFn) {
  const state: DispatcherState = {
    provider: null,
    history: [],
    stopStreaming: false,
    i18nStrings: {},
    doDebug: false,
  };

  return function dispatch(msg: WorkerMessage): unknown {
    switch (msg["type"]) {
      case "init": {
        const providerName = msg["provider"] as string | undefined;
        if (!providerName || !(providerName in PROVIDERS)) {
          throw new Error(`Unknown provider: ${String(providerName)}`);
        }
        state.provider = PROVIDERS[providerName]!;
        state.i18nStrings = (msg["i18nStrings"] as Record<string, string>) ?? {};
        state.doDebug = Boolean(msg["do_debug"]);
        state.history = [];
        state.stopStreaming = false;
        return;
      }

      case "chatMessage": {
        if (!state.provider) throw new Error("Worker not initialized");
        const text = msg["message"] as string;
        state.history.push(state.provider.formatUserMessage(text));
        // Actual fetch is handled by the real worker file which calls handleChatMessage.
        // Returning the current state lets the worker proceed with its fetch logic.
        return state;
      }

      case "replayHistory": {
        if (!state.provider) throw new Error("Worker not initialized");
        const role = msg["role"] as string;
        const content = msg["content"] as string;
        const entry =
          role === "assistant"
            ? state.provider.formatAssistantMessage(content)
            : state.provider.formatUserMessage(content);
        state.history.push(entry);
        return;
      }

      case "reset": {
        state.history = [];
        state.stopStreaming = false;
        return;
      }

      case "stop": {
        state.stopStreaming = true;
        return;
      }

      case "_getHistory": {
        // Test-only escape hatch to inspect internal history state.
        return state.history;
      }

      default:
        return;
    }
  };
}
