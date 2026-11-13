import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import {
  tokenizeRichText,
  validateRichTextTokens,
} from "/js/richTextHelpers.js";

const LINK = "app.bsky.richtext.facet#link";

const textEncoder = new TextEncoder();

function byteLength(text) {
  return textEncoder.encode(text).length;
}

function tokenText(token) {
  return token.type === "text" ? token.value : token.text;
}

function facetWithIndex(byteStart, byteEnd) {
  return {
    index: { byteStart, byteEnd },
    features: [{ $type: LINK, uri: "https://example.com" }],
  };
}

const segmentArbitrary = fc.record({
  text: fc.string({ unit: "binary", minLength: 1, maxLength: 8 }),
  isFacet: fc.boolean(),
});

// Text with facets that are in order, non-overlapping and character-aligned.
const wellFormedArbitrary = fc
  .array(segmentArbitrary, { maxLength: 10 })
  .map((segments) => {
    let text = "";
    const facets = [];
    for (const segment of segments) {
      const byteStart = byteLength(text);
      text += segment.text;
      if (segment.isFacet) {
        facets.push(facetWithIndex(byteStart, byteLength(text)));
      }
    }
    return { text, facets, segments };
  });

function characterBoundaries(text) {
  const boundaries = [0];
  let offset = 0;
  for (const character of text) {
    offset += byteLength(character);
    boundaries.push(offset);
  }
  return boundaries;
}

// Facets whose ends sit on character boundaries but are otherwise
// unconstrained: overlapping, inverted, empty, or past the end of the text.
const alignedFacetsArbitrary = fc
  .string({ unit: "binary", maxLength: 12 })
  .chain((text) => {
    const boundaries = characterBoundaries(text);
    const offsetArbitrary = fc.oneof(
      { weight: 6, arbitrary: fc.constantFrom(...boundaries) },
      { weight: 1, arbitrary: fc.constantFrom(-1, boundaries.at(-1) + 5) },
    );
    return fc.record({
      text: fc.constant(text),
      facets: fc.array(
        fc
          .tuple(offsetArbitrary, offsetArbitrary)
          .map(([byteStart, byteEnd]) => facetWithIndex(byteStart, byteEnd)),
        { maxLength: 6 },
      ),
    });
  });

const arbitraryFacetsArbitrary = fc.record({
  text: fc.string({ unit: "binary", maxLength: 12 }),
  facets: fc.array(
    fc
      .tuple(fc.integer({ min: -5, max: 60 }), fc.integer({ min: -5, max: 60 }))
      .map(([byteStart, byteEnd]) => facetWithIndex(byteStart, byteEnd)),
    { maxLength: 6 },
  ),
});

describe("tokenizeRichText properties", () => {
  it("splits well-formed input into exactly its segments", () => {
    fc.assert(
      fc.property(wellFormedArbitrary, ({ text, facets, segments }) => {
        const expected = [];
        for (const segment of segments) {
          const previous = expected.at(-1);
          if (segment.isFacet) {
            expected.push({ type: "facet", text: segment.text });
          } else if (previous?.type === "text") {
            previous.text += segment.text;
          } else {
            expected.push({ type: "text", text: segment.text });
          }
        }
        const actual = tokenizeRichText({ text, facets }).map((token) => ({
          type: token.type,
          text: tokenText(token),
        }));
        assert.deepEqual(actual, expected);
      }),
    );
  });

  it("is insensitive to the order facets are supplied in", () => {
    fc.assert(
      fc.property(
        wellFormedArbitrary.chain(({ text, facets }) =>
          fc.record({
            text: fc.constant(text),
            facets: fc.constant(facets),
            shuffled: fc.shuffledSubarray(facets, { minLength: facets.length }),
          }),
        ),
        ({ text, facets, shuffled }) => {
          assert.deepEqual(
            tokenizeRichText({ text, facets: shuffled }),
            tokenizeRichText({ text, facets }),
          );
        },
      ),
    );
  });

  it("reproduces the text exactly for any character-aligned facets", () => {
    fc.assert(
      fc.property(alignedFacetsArbitrary, ({ text, facets }) => {
        const tokens = tokenizeRichText({ text, facets });
        assert.deepEqual(tokens.map(tokenText).join(""), text);
      }),
      { numRuns: 500 },
    );
  });

  it("emits ordered, in-bounds, non-empty facet tokens for any facets", () => {
    fc.assert(
      fc.property(
        fc.oneof(alignedFacetsArbitrary, arbitraryFacetsArbitrary),
        ({ text, facets }) => {
          const tokens = tokenizeRichText({ text, facets });
          assert(validateRichTextTokens(tokens));
          let cursor = 0;
          for (const token of tokens) {
            if (token.type !== "facet") continue;
            const { byteStart, byteEnd } = token.facet.index;
            assert(byteStart >= cursor);
            assert(byteEnd > byteStart);
            assert(byteEnd <= byteLength(text));
            cursor = byteEnd;
          }
        },
      ),
      { numRuns: 500 },
    );
  });
});
