import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  richTextTemplate,
  richTextTokensTemplate,
} from "/js/templates/richText.template.js";
import { render } from "/js/lib/lit-html.js";

describe("richTextTemplate", () => {
  it("should render plain text", () => {
    const result = richTextTemplate({
      text: "Hello world",
      facets: [],
    });
    const container = document.createElement("div");
    render(result, container);
    const richText = container.querySelector("[data-testid='rich-text']");
    assert(richText !== null);
    assert(richText.textContent.includes("Hello world"));
  });

  it("should render text with link facet without truncating by default", () => {
    const text = "Check out example.com";
    const facets = [
      {
        index: { byteStart: 10, byteEnd: 21 },
        features: [
          {
            $type: "app.bsky.richtext.facet#link",
            uri: "https://example.com",
          },
        ],
      },
    ];
    const result = richTextTemplate({ text, facets });
    const container = document.createElement("div");
    render(result, container);
    const link = container.querySelector("a");
    assert(link !== null);
    assert(link.getAttribute("href").startsWith("https://example.com"));
    assert.deepEqual(link.textContent, "example.com");
  });

  it("should not truncate long link text by default", () => {
    const url = "https://example.com/very/long/path/to/page";
    const text = "See " + url;
    const facets = [
      {
        index: { byteStart: 4, byteEnd: 4 + url.length },
        features: [
          {
            $type: "app.bsky.richtext.facet#link",
            uri: url,
          },
        ],
      },
    ];
    const result = richTextTemplate({ text, facets });
    const container = document.createElement("div");
    render(result, container);
    const link = container.querySelector("a");
    assert(link !== null);
    assert.deepEqual(link.getAttribute("href"), url);
    assert.deepEqual(link.textContent, url);
  });

  it("should truncate long link text when truncateUrls is true", () => {
    const url = "https://example.com/very/long/path/to/page";
    const text = "See " + url;
    const facets = [
      {
        index: { byteStart: 4, byteEnd: 4 + url.length },
        features: [
          {
            $type: "app.bsky.richtext.facet#link",
            uri: url,
          },
        ],
      },
    ];
    const result = richTextTemplate({ text, facets, truncateUrls: true });
    const container = document.createElement("div");
    render(result, container);
    const link = container.querySelector("a");
    assert(link !== null);
    assert.deepEqual(link.getAttribute("href"), url);
    assert.deepEqual(link.textContent, "example.com/very/long/pa...");
  });

  it("should not truncate short link text when truncateUrls is true", () => {
    const url = "https://example.com/short";
    const text = "See " + url;
    const facets = [
      {
        index: { byteStart: 4, byteEnd: 4 + url.length },
        features: [
          {
            $type: "app.bsky.richtext.facet#link",
            uri: url,
          },
        ],
      },
    ];
    const result = richTextTemplate({ text, facets, truncateUrls: true });
    const container = document.createElement("div");
    render(result, container);
    const link = container.querySelector("a");
    assert.deepEqual(link.textContent, "example.com/short");
  });

  it("should render text with mention facet", () => {
    const text = "Hello @user";
    const facets = [
      {
        index: { byteStart: 6, byteEnd: 11 },
        features: [
          {
            $type: "app.bsky.richtext.facet#mention",
            did: "did:plc:123",
          },
        ],
      },
    ];
    const result = richTextTemplate({ text, facets });
    const container = document.createElement("div");
    render(result, container);
    const link = container.querySelector("a");
    assert(link !== null);
    assert(link.getAttribute("href").includes("did:plc:123"));
    assert.deepEqual(link.textContent, "@user");
  });

  it("should render text with tag facet", () => {
    const text = "Hello #world";
    const facets = [
      {
        index: { byteStart: 6, byteEnd: 12 },
        features: [
          {
            $type: "app.bsky.richtext.facet#tag",
            tag: "world",
          },
        ],
      },
    ];
    const result = richTextTemplate({ text, facets });
    const container = document.createElement("div");
    render(result, container);
    const link = container.querySelector("a");
    assert(link !== null);
    assert(link.getAttribute("href").includes("world"));
    assert.deepEqual(link.textContent, "#world");
  });

  it("should render text with multiple facets", () => {
    const text = "Hello @user check out #tag";
    const facets = [
      {
        index: { byteStart: 6, byteEnd: 11 },
        features: [
          {
            $type: "app.bsky.richtext.facet#mention",
            did: "did:plc:123",
          },
        ],
      },
      {
        index: { byteStart: 22, byteEnd: 26 },
        features: [
          {
            $type: "app.bsky.richtext.facet#tag",
            tag: "tag",
          },
        ],
      },
    ];
    const result = richTextTemplate({ text, facets });
    const container = document.createElement("div");
    render(result, container);
    const links = container.querySelectorAll("a");
    assert.deepEqual(links.length, 2);
  });

  it("should preserve newlines in multiline text", () => {
    const text = "Line one\nLine two\nLine three";
    const result = richTextTemplate({ text, facets: [] });
    const container = document.createElement("div");
    render(result, container);
    const richText = container.querySelector("[data-testid='rich-text']");
    assert.deepEqual(richText.textContent, text);
  });

  it("should render a facet that spans multiple lines", () => {
    const url = "https://example.com";
    const text = `before\n${url}\nafter`;
    const facets = [
      {
        index: { byteStart: 7, byteEnd: 7 + url.length },
        features: [
          {
            $type: "app.bsky.richtext.facet#link",
            uri: url,
          },
        ],
      },
    ];
    const result = richTextTemplate({ text, facets });
    const container = document.createElement("div");
    render(result, container);
    const link = container.querySelector("a");
    assert(link !== null);
    assert.deepEqual(link.textContent, url);
    const richText = container.querySelector("[data-testid='rich-text']");
    assert.deepEqual(richText.textContent, text);
  });

  it("should render a facet with an unknown type as plain text", (t) => {
    t.mock.method(console, "warn", () => {});
    const text = "before unknown after";
    const facets = [
      {
        index: { byteStart: 7, byteEnd: 14 },
        features: [{ $type: "com.example.facet#mystery" }],
      },
    ];
    const result = richTextTemplate({ text, facets });
    const container = document.createElement("div");
    render(result, container);
    const richText = container.querySelector("[data-testid='rich-text']");
    assert.deepEqual(richText.textContent, text);
    assert.deepEqual(container.querySelector("a"), null);
  });
});

describe("richTextTokensTemplate", () => {
  function renderTokenAsElement(token) {
    const element = document.createElement(token.node.tag);
    element.textContent = token.node.text ?? "";
    return element;
  }

  it("renders inline tokens inside the rich text flow", () => {
    const result = richTextTokensTemplate({
      tokens: [
        { type: "text", value: "use " },
        {
          type: "inline",
          pluginId: "p1",
          node: { tag: "code", text: "npm i" },
        },
        { type: "text", value: " now" },
      ],
      renderNodeToken: renderTokenAsElement,
    });
    const container = document.createElement("div");
    render(result, container);
    const richText = container.querySelector("[data-testid='rich-text']");
    const code = richText.querySelector("code");
    assert(code !== null);
    assert.deepEqual(code.textContent, "npm i");
    assert.deepEqual(richText.textContent, "use npm i now");
  });

  it("wraps block tokens and trims the adjoining newlines", () => {
    const result = richTextTokensTemplate({
      tokens: [
        { type: "text", value: "before\n" },
        {
          type: "block",
          pluginId: "p1",
          node: { tag: "pre", text: "const a = 1;" },
        },
        { type: "text", value: "\nafter" },
      ],
      renderNodeToken: renderTokenAsElement,
    });
    const container = document.createElement("div");
    render(result, container);
    const richText = container.querySelector("[data-testid='rich-text']");
    const block = richText.querySelector(".rich-text-block");
    assert(block !== null);
    assert.deepEqual(block.querySelector("pre").textContent, "const a = 1;");
    // The newlines flanking the block are trimmed so the pre-wrap text
    // doesn't add gaps around it.
    assert.deepEqual(richText.textContent, "before" + "const a = 1;" + "after");
  });

  it("skips inline/block tokens the renderer returns null for", () => {
    const result = richTextTokensTemplate({
      tokens: [
        { type: "text", value: "hello" },
        { type: "inline", node: { tag: "code", text: "x" } },
      ],
    });
    const container = document.createElement("div");
    render(result, container);
    const richText = container.querySelector("[data-testid='rich-text']");
    assert.deepEqual(richText.textContent, "hello");
    assert.deepEqual(richText.querySelector("code"), null);
  });
});
