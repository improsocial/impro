import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { tokenizeRichText, isEmojiOnlyTokens } from "/js/richTextHelpers.js";

describe("tokenizeRichText", () => {
  it("returns a single text token for plain text", () => {
    assert.deepEqual(tokenizeRichText({ text: "hello", facets: [] }), [
      { type: "text", value: "hello" },
    ]);
  });

  it("interleaves text and facet tokens without empty text tokens", () => {
    const text = "#tag in front";
    const facets = [
      {
        index: { byteStart: 0, byteEnd: 4 },
        features: [{ $type: "app.bsky.richtext.facet#tag", tag: "tag" }],
      },
    ];
    const tokens = tokenizeRichText({ text, facets });
    assert.deepEqual(tokens.length, 2);
    assert.deepEqual(tokens[0].type, "facet");
    assert.deepEqual(tokens[0].text, "#tag");
    assert.deepEqual(tokens[1], { type: "text", value: " in front" });
  });

  it("drops overlapping facets like the renderer does", () => {
    const text = "overlap here";
    const facets = [
      {
        index: { byteStart: 0, byteEnd: 7 },
        features: [{ $type: "app.bsky.richtext.facet#tag", tag: "a" }],
      },
      {
        index: { byteStart: 3, byteEnd: 12 },
        features: [{ $type: "app.bsky.richtext.facet#tag", tag: "b" }],
      },
    ];
    const tokens = tokenizeRichText({ text, facets });
    assert.deepEqual(
      tokens.filter((token) => token.type === "facet").length,
      1,
    );
  });
});

describe("isEmojiOnlyTokens", () => {
  it("is true for a single emoji-only text token", () => {
    assert.deepEqual(isEmojiOnlyTokens([{ type: "text", value: "😀" }]), true);
  });

  it("concatenates adjacent text tokens before testing", () => {
    assert.deepEqual(
      isEmojiOnlyTokens([
        { type: "text", value: "😀" },
        { type: "text", value: "🎉" },
      ]),
      true,
    );
  });

  it("is false when the concatenated text is not emoji-only", () => {
    assert.deepEqual(
      isEmojiOnlyTokens([
        { type: "text", value: "😀" },
        { type: "text", value: "a" },
      ]),
      false,
    );
  });

  it("is false when any token is a facet", () => {
    assert.deepEqual(
      isEmojiOnlyTokens([
        { type: "text", value: "😀" },
        { type: "facet", facet: { index: {} }, text: "😀" },
      ]),
      false,
    );
  });

  it("is false when any token is an inline or block node", () => {
    assert.deepEqual(
      isEmojiOnlyTokens([{ type: "inline", node: { tag: "img" } }]),
      false,
    );
    assert.deepEqual(
      isEmojiOnlyTokens([{ type: "block", node: { tag: "pre" } }]),
      false,
    );
  });

  it("is false for an empty array and non-arrays", () => {
    assert.deepEqual(isEmojiOnlyTokens([]), false);
    assert.deepEqual(isEmojiOnlyTokens(null), false);
    assert.deepEqual(isEmojiOnlyTokens(undefined), false);
  });
});
