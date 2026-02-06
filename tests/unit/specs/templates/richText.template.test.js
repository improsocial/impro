import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import { richTextTemplate } from "/js/templates/richText.template.js";
import { render } from "/js/lib/lit-html.js";

const t = new TestSuite("richTextTemplate");

t.describe("richTextTemplate", (it) => {
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

  it("should render text with link facet", () => {
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
    assertEquals(link.textContent, "example.com");
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
    assertEquals(link.textContent, "@user");
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
    assertEquals(link.textContent, "#world");
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
    assertEquals(links.length, 2);
  });

  it("should render multiline text with separate divs", () => {
    const text = "Line one\nLine two\nLine three";
    const result = richTextTemplate({ text, facets: [] });
    const container = document.createElement("div");
    render(result, container);
    const richText = container.querySelector("[data-testid='rich-text']");
    const divs = richText.querySelectorAll("div");
    assertEquals(divs.length, 3);
  });

  it("should render empty line as br element", () => {
    const text = "Line one\n\nLine three";
    const result = richTextTemplate({ text, facets: [] });
    const container = document.createElement("div");
    render(result, container);
    const br = container.querySelector("br");
    assert(br !== null);
  });
});

await t.run();
