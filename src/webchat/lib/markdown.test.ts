import { describe, expect, it } from "vitest";
import { createChatMarkdownRenderer } from "./markdown.js";

describe("createChatMarkdownRenderer", () => {
  it("renders links with safe browser attributes", () => {
    const renderer = createChatMarkdownRenderer(() => ({
      renderer: { rules: {} },
      render: () => '<p><a href="https://example.com">Example</a></p>\n',
    }));

    expect(renderer.render("[Example](https://example.com)")).toBe(
      [
        '<p><a href="https://example.com" target="_blank" ',
        'rel="noopener noreferrer">Example</a></p>\n',
      ].join("")
    );
  });

  it("wraps fenced code blocks with a language label", () => {
    const renderer = createChatMarkdownRenderer(() => ({
      renderer: { rules: {} },
      render: () => '<pre><code class="language-ts">const x = 1;</code></pre>\n',
    }));

    expect(renderer.render("```ts\nconst x = 1;\n```")).toBe(
      [
        '<div class="code-block" data-language="ts">',
        '<div class="code-block-label">ts</div>',
        '<pre><code class="language-ts">const x = 1;</code></pre>',
        "</div>\n",
      ].join("")
    );
  });
});
