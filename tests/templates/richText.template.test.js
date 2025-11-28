import { TestSuite } from "../testSuite.js";
import { assert } from "../testHelpers.js";
import { richTextTemplate } from "/js/templates/richText.template.js";

const t = new TestSuite("richTextTemplate");

t.describe("richTextTemplate", (it) => {
  it("should render plain text", () => {
    const result = richTextTemplate({
      text: "Hello world",
      facets: [],
    });
    assert(result instanceof Object);
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
    assert(result instanceof Object);
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
    assert(result instanceof Object);
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
    assert(result instanceof Object);
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
    assert(result instanceof Object);
  });
});

await t.run();
