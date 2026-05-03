/*
 *  ThunderAI [https://micz.it/thunderbird-addon-thunderai/]
 *  Copyright (C) 2024 - 2026  Mic (m@micz.it)
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 */

interface MarkdownRenderer {
  render: (text: string) => string;
  renderer?: {
    rules?: Record<string, unknown>;
  };
}

interface ChatMarkdownRenderer {
  render: (text: string) => string;
}

type MarkdownFactory = () => MarkdownRenderer;

function withSafeLinks(html: string): string {
  return html.replace(/<a\b([^>]*)>/g, (_match, attrs: string) => {
    let nextAttrs = attrs;
    if (!/\starget=/.test(nextAttrs)) {
      nextAttrs += ' target="_blank"';
    }
    if (!/\srel=/.test(nextAttrs)) {
      nextAttrs += ' rel="noopener noreferrer"';
    }
    return `<a${nextAttrs}>`;
  });
}

function withCodeBlockLabels(html: string): string {
  return html.replace(
    /<pre><code class="language-([^"]+)">([\s\S]*?)<\/code><\/pre>/g,
    (_match, language: string, code: string) => {
      const label = language.trim();
      return [
        `<div class="code-block" data-language="${label}">`,
        `<div class="code-block-label">${label}</div>`,
        `<pre><code class="language-${label}">${code}</code></pre>`,
        "</div>",
      ].join("");
    }
  );
}

export function createChatMarkdownRenderer(factory: MarkdownFactory): ChatMarkdownRenderer {
  const markdown = factory();

  return {
    render(text: string): string {
      return withCodeBlockLabels(withSafeLinks(markdown.render(text)));
    },
  };
}
