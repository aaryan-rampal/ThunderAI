/*
 *  ThunderAI [https://micz.it/thunderbird-addon-thunderai/]
 *  Copyright (C) 2024 - 2026  Mic (m@micz.it)
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 */

// CSS modules
declare module "*.css" {
  const content: Record<string, string>;
  export default content;
}

// Thunderbird WebExtension globals
declare const browser: {
  runtime: {
    sendMessage: (message: Record<string, unknown>) => Promise<unknown>;
    onMessage: {
      addListener: (
        callback: (
          message: Record<string, unknown>,
          sender: unknown,
          sendResponse: (response?: unknown) => void
        ) => void
      ) => void;
    };
    getURL: (path: string) => string;
  };
  storage: {
    sync: {
      get: (keys: Record<string, unknown>) => Promise<Record<string, unknown>>;
    };
  };
  i18n: {
    getMessage: (key: string) => string;
  };
  windows: {
    getCurrent: () => Promise<{ id: number }>;
  };
  tabs: {
    query: (queryInfo: Record<string, unknown>) => Promise<Array<{ id: number }>>;
  };
};

// markdown-it loaded via <script> tag
declare const markdownit: () => {
  render: (text: string) => string;
};

// diff.js loaded via <script> tag
declare const Diff: {
  diffWords: (
    oldStr: string,
    newStr: string
  ) => Array<{ value: string; added?: boolean; removed?: boolean }>;
};
