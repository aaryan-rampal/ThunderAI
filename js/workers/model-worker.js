/*
 *  ThunderAI [https://micz.it/thunderbird-addon-thunderai/]
 *  Copyright (C) 2024 - 2026  Mic (m@micz.it)
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This file contains a modified version of the code from the project at
 *  https://github.com/boxabirds/chatgpt-frontend-nobuild
 *  The original code has been released under the Apache License, Version 2.0.
 */

import { Anthropic } from '../api/anthropic.js';
import { GoogleGemini } from '../api/google_gemini.js';
import { Ollama } from '../api/ollama.js';
import { OpenAIComp } from '../api/openai_comp.js';
import { OpenAI } from '../api/openai_responses.js';
import { taLogger } from '../mzta-logger.js';

// Provider config: per-provider pure logic (mirrors src/workers/providers/).
// These run in the worker thread so they cannot import from src/ (different
// module graph). Keep in sync with the TypeScript versions in src/workers/.

const PROVIDERS = {
  anthropic: {
    configPrefix: 'anthropic_',
    createClient: (cfg) => new Anthropic(cfg),
    formatUserMessage: (text) => ({ role: 'user', content: text }),
    formatAssistantMessage: (text) => ({ role: 'assistant', content: text }),
    extractToken: (p) => {
      if (p.type !== 'content_block_delta') return null;
      const text = p.delta?.text;
      return typeof text === 'string' && text.length > 0 ? text : null;
    },
    isDone: (p) => p.type === 'message_stop',
    stripLine: (line) => {
      if (line === '' || line.startsWith('event: ping')) return null;
      if (!line.startsWith('data: ')) return null;
      return line.slice('data: '.length);
    },
  },

  google_gemini: {
    configPrefix: 'google_gemini_',
    createClient: (cfg) => new GoogleGemini(cfg),
    formatUserMessage: (text) => ({ role: 'user', parts: [{ text }] }),
    formatAssistantMessage: (text) => ({ role: 'model', parts: [{ text }] }),
    extractToken: (p) => {
      const candidates = p.candidates;
      if (!Array.isArray(candidates) || candidates.length === 0) return null;
      const parts = candidates[0]?.content?.parts;
      if (!Array.isArray(parts) || parts.length === 0) return null;
      const text = parts[0]?.text;
      return typeof text === 'string' && text.length > 0 ? text : null;
    },
    isDone: () => false,
    stripLine: (line) => {
      if (line === '') return null;
      if (line.startsWith('data: ')) return line.slice('data: '.length);
      return null;
    },
  },

  ollama: {
    configPrefix: 'ollama_',
    createClient: (cfg) => new Ollama(cfg),
    formatUserMessage: (text) => ({ role: 'user', content: text }),
    formatAssistantMessage: (text) => ({ role: 'assistant', content: text }),
    extractToken: (p) => {
      const content = p.message?.content;
      return typeof content === 'string' && content.length > 0 ? content : null;
    },
    isDone: () => false,
    stripLine: (line) => {
      if (line === '' || line === '[DONE]') return null;
      if (line.startsWith('chunk: ')) return line.slice('chunk: '.length);
      return line;
    },
  },

  openai_comp: {
    configPrefix: 'openai_comp_',
    createClient: (cfg) => new OpenAIComp(cfg),
    formatUserMessage: (text) => ({ role: 'user', content: text }),
    formatAssistantMessage: (text) => ({ role: 'assistant', content: text }),
    extractToken: (p) => {
      const choices = p.choices;
      if (!Array.isArray(choices) || choices.length === 0) return null;
      const content = choices[0]?.delta?.content;
      return typeof content === 'string' && content.length > 0 ? content : null;
    },
    isDone: () => false,
    stripLine: (line) => {
      if (line === '' || line === '[DONE]') return null;
      if (line.startsWith(': OPENROUTER PROCESSING')) return null;
      if (line.startsWith('data: ')) return line.slice('data: '.length);
      return null;
    },
  },

  openai_responses: {
    configPrefix: 'chatgpt_',
    createClient: (cfg) => new OpenAI(cfg),
    formatUserMessage: (text) => ({ role: 'user', content: text }),
    formatAssistantMessage: (text) => ({ role: 'assistant', content: text }),
    extractToken: (p) => {
      if (p.type !== 'response.output_text.delta') return null;
      return typeof p.delta === 'string' && p.delta.length > 0 ? p.delta : null;
    },
    isDone: () => false,
    extractResponseId: (p) => {
      if (p.type !== 'response.created') return null;
      return typeof p.response?.id === 'string' ? p.response.id : null;
    },
    stripLine: (line) => {
      if (line === '' || line === '[DONE]') return null;
      if (line.startsWith('data: ')) return line.slice('data: '.length);
      return null;
    },
  },
};

// Shared worker state
let provider = null;
let client = null;
let conversationHistory = [];
let assistantResponseAccumulator = '';
let stopStreaming = false;
let i18nStrings = {};
let doDebug = false;
let taLog = null;
let previousResponseId = null; // openai_responses only

self.onmessage = async function (event) {
  const { type } = event.data;

  switch (type) {
    case 'init': {
      const providerName = event.data.provider;
      provider = PROVIDERS[providerName] ?? null;
      if (!provider) {
        console.error('[ThunderAI] model-worker: unknown provider:', providerName);
        return;
      }

      const prefix = provider.configPrefix;
      const cfg = { stream: true };
      for (const key in event.data) {
        if (key.startsWith(prefix)) {
          let newKey = key.slice(prefix.length);
          if (newKey === 'api_key') newKey = 'apiKey';
          // openai_responses: skip chatgpt_web_ prefixed keys
          if (providerName === 'openai_responses' && key.startsWith('chatgpt_web_')) continue;
          cfg[newKey] = event.data[key];
        }
      }

      client = provider.createClient(cfg);
      i18nStrings = event.data.i18nStrings ?? {};
      doDebug = Boolean(event.data.do_debug);
      taLog = new taLogger('model-worker', doDebug);
      conversationHistory = [];
      stopStreaming = false;
      previousResponseId = null;
      break;
    }

    case 'chatMessage': {
      if (!provider || !client) {
        console.error('[ThunderAI] model-worker: chatMessage before init');
        return;
      }

      conversationHistory.push(provider.formatUserMessage(event.data.message));

      let messagesToSend = conversationHistory;
      if (previousResponseId) {
        messagesToSend = [conversationHistory[conversationHistory.length - 1]];
      }

      const response = await client.fetchResponse(messagesToSend, 0, previousResponseId);
      postMessage({ type: 'messageSent' });

      if (!response.ok) {
        const errorKey = Object.keys(i18nStrings).find((k) => k.endsWith('api_request_failed'))
          ?? 'api_request_failed';
        let errorDetail = '';
        let errorMessage = '';
        if (response.is_exception === true) {
          errorMessage = response.error;
        } else {
          try {
            const errorJSON = await response.json();
            errorDetail = JSON.stringify(errorJSON);
            errorMessage = errorJSON?.error?.message ?? response.statusText;
          } catch {
            errorMessage = response.statusText;
          }
        }
        postMessage({
          type: 'error',
          payload: `${i18nStrings[errorKey] ?? errorKey}: ${response.status} ${response.statusText}, Detail: ${errorMessage} ${errorDetail}`,
        });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      try {
        while (true) {
          if (stopStreaming) {
            stopStreaming = false;
            reader.cancel();
            taLog.log('AI full response [STOPPED]: ' + assistantResponseAccumulator);
            conversationHistory.push(provider.formatAssistantMessage(assistantResponseAccumulator));
            assistantResponseAccumulator = '';
            postMessage({ type: 'tokensDone' });
            break;
          }

          const { done, value } = await reader.read();
          if (done) {
            taLog.log('AI full response: ' + assistantResponseAccumulator);
            conversationHistory.push(provider.formatAssistantMessage(assistantResponseAccumulator));
            assistantResponseAccumulator = '';
            postMessage({ type: 'tokensDone' });
            break;
          }

          buffer += decoder.decode(value);
          const lines = buffer.split('\n');
          buffer = lines.pop();

          for (const line of lines) {
            const stripped = provider.stripLine(line.trim());
            if (stripped === null) continue;

            let parsed = null;
            try {
              parsed = JSON.parse(stripped);
            } catch {
              taLog.warn('JSON parse warning, skipped: ' + stripped);
              continue;
            }

            if (provider.isDone(parsed)) {
              taLog.log('AI full response: ' + assistantResponseAccumulator);
              conversationHistory.push(provider.formatAssistantMessage(assistantResponseAccumulator));
              assistantResponseAccumulator = '';
              postMessage({ type: 'tokensDone' });
              return;
            }

            if (provider.extractResponseId) {
              const id = provider.extractResponseId(parsed);
              if (id) previousResponseId = id;
            }

            const token = provider.extractToken(parsed);
            if (token) {
              assistantResponseAccumulator += token;
              postMessage({ type: 'newToken', payload: { token } });
            }
          }
        }
      } catch (error) {
        if (error instanceof TypeError && error.message.includes('Error in input stream')) {
          postMessage({ type: 'error', payload: `${i18nStrings['error_connection_interrupted'] ?? 'Connection interrupted'}: ${error.message}` });
        } else {
          postMessage({ type: 'error', payload: String(error) });
        }
      }
      break;
    }

    case 'reset': {
      conversationHistory = [];
      stopStreaming = false;
      previousResponseId = null;
      break;
    }

    case 'replayHistory': {
      if (!provider) return;
      const entry = event.data.role === 'assistant'
        ? provider.formatAssistantMessage(event.data.content)
        : provider.formatUserMessage(event.data.content);
      conversationHistory.push(entry);
      break;
    }

    case 'stop': {
      stopStreaming = true;
      break;
    }
  }
};
