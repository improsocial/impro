import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import {
  getUnresolvedFacetsFromText,
  richTextToString,
} from "/js/facetHelpers.js";

const LINK = "app.bsky.richtext.facet#link";
const TAG = "app.bsky.richtext.facet#tag";
const MENTION = "app.bsky.richtext.facet#mention";

const textEncoder = new TextEncoder();
const strictDecoder = new TextDecoder("utf-8", { fatal: true });

function byteLength(text) {
  return textEncoder.encode(text).length;
}

function sortByStart(facets) {
  return [...facets].sort(
    (first, second) => first.index.byteStart - second.index.byteStart,
  );
}

const triggerFragments = [
  " ",
  "\n",
  " ",
  "​",
  "️",
  "(",
  ")",
  ".",
  ",",
  "!",
  "#",
  "＃",
  "@",
  "$",
  "/",
  "://",
  "http",
  "https",
  "https://",
  "HTTP://",
  ".com",
  ".social",
  ".notatld",
  "example",
  "bsky",
  "ABC",
  "123",
  "é",
  "日本",
  "👋",
  "🧑‍🚀",
];

const noisyTextArbitrary = fc
  .array(
    fc.oneof(
      { weight: 4, arbitrary: fc.constantFrom(...triggerFragments) },
      { weight: 1, arbitrary: fc.string({ unit: "binary", maxLength: 4 }) },
    ),
    { maxLength: 30 },
  )
  .map((fragments) => fragments.join(""));

const labelArbitrary = fc.stringMatching(/^[a-z][a-z0-9]{0,8}$/);

const mentionTokenArbitrary = labelArbitrary.map((label) => ({
  text: `@${label}.bsky.social`,
  feature: { $type: MENTION, handle: `${label}.bsky.social` },
}));

const hashtagTokenArbitrary = fc
  .tuple(
    fc.constantFrom("#", "＃"),
    fc.constantFrom("a", "Z", "é", "日", "👋"),
    fc.array(fc.constantFrom("a", "Z", "é", "日", "👋", "7", "0"), {
      maxLength: 20,
    }),
  )
  .map(([marker, first, rest]) => {
    const tag = first + rest.join("");
    return { text: marker + tag, feature: { $type: TAG, tag } };
  });

const cashtagTokenArbitrary = fc
  .stringMatching(/^[A-Za-z][A-Za-z0-9]{0,4}$/)
  .map((ticker) => ({
    text: `$${ticker}`,
    feature: { $type: TAG, tag: `$${ticker.toUpperCase()}` },
  }));

const schemeLinkTokenArbitrary = fc
  .tuple(
    fc.constantFrom("http", "https"),
    labelArbitrary,
    fc.stringMatching(/^[a-z0-9]{0,8}$/),
  )
  .map(([scheme, label, path]) => {
    const uri = `${scheme}://${label}.com/${path}`;
    return { text: uri, feature: { $type: LINK, uri } };
  });

const bareLinkTokenArbitrary = fc
  .tuple(labelArbitrary, fc.stringMatching(/^[a-z0-9]{0,8}$/))
  .map(([label, path]) => {
    const text = `${label}.com/${path}`;
    return { text, feature: { $type: LINK, uri: `https://${text}` } };
  });

const tokenArbitrary = fc.oneof(
  mentionTokenArbitrary,
  hashtagTokenArbitrary,
  cashtagTokenArbitrary,
  schemeLinkTokenArbitrary,
  bareLinkTokenArbitrary,
);

const separatorArbitrary = fc.constantFrom(
  " ",
  "\n",
  "  ",
  " 👋 ",
  " é 日本語 ",
  " wörld 🧑‍🚀 ",
);

const tokenizedTextArbitrary = fc
  .tuple(
    fc.constantFrom("", "👋 ", "héllo "),
    fc.array(fc.tuple(tokenArbitrary, separatorArbitrary), { maxLength: 8 }),
  )
  .map(([prefix, tokens]) => {
    let text = prefix;
    const expectedFacets = [];
    for (const [token, separator] of tokens) {
      const byteStart = byteLength(text);
      text += token.text;
      expectedFacets.push({
        index: { byteStart, byteEnd: byteLength(text) },
        features: [token.feature],
      });
      text += separator;
    }
    return { text, expectedFacets };
  });

const linkedSegmentsArbitrary = fc.array(
  fc.oneof(
    fc.record({
      display: fc.string({ unit: "binary" }),
      uri: fc.constant(null),
    }),
    fc.record({
      display: fc.string({ unit: "binary", minLength: 1 }),
      uri: fc.webUrl(),
    }),
  ),
  { maxLength: 10 },
);

describe("getUnresolvedFacetsFromText properties", () => {
  it("detects exactly the tokens present, at their UTF-8 byte offsets", () => {
    fc.assert(
      fc.property(tokenizedTextArbitrary, ({ text, expectedFacets }) => {
        assert.deepEqual(
          sortByStart(getUnresolvedFacetsFromText(text)),
          expectedFacets,
        );
      }),
    );
  });

  it("keeps every facet in bounds and on character boundaries", () => {
    fc.assert(
      fc.property(noisyTextArbitrary, (text) => {
        const bytes = textEncoder.encode(text);
        for (const facet of getUnresolvedFacetsFromText(text)) {
          const { byteStart, byteEnd } = facet.index;
          assert(byteStart >= 0);
          assert(byteStart < byteEnd);
          assert(byteEnd <= bytes.length);
          strictDecoder.decode(bytes.slice(0, byteStart));
          strictDecoder.decode(bytes.slice(byteStart, byteEnd));
          strictDecoder.decode(bytes.slice(byteEnd));
        }
      }),
      { numRuns: 500 },
    );
  });

  it("produces features that agree with the text they cover", () => {
    fc.assert(
      fc.property(noisyTextArbitrary, (text) => {
        const bytes = textEncoder.encode(text);
        for (const facet of getUnresolvedFacetsFromText(text)) {
          const covered = strictDecoder.decode(
            bytes.slice(facet.index.byteStart, facet.index.byteEnd),
          );
          const feature = facet.features[0];
          if (feature.$type === LINK) {
            assert.match(feature.uri, /^https?:\/\//i);
            assert(
              feature.uri === covered || feature.uri === `https://${covered}`,
            );
          } else if (feature.$type === MENTION) {
            assert.deepEqual(covered, `@${feature.handle}`);
          } else if (covered.startsWith("$")) {
            assert.deepEqual(feature.tag, covered.toUpperCase());
          } else {
            assert.match(covered, /^[#＃]/);
            assert.deepEqual(feature.tag, covered.slice(1));
          }
        }
      }),
      { numRuns: 500 },
    );
  });
});

describe("richTextToString properties", () => {
  it("substitutes each link facet's uri for its display text", () => {
    fc.assert(
      fc.property(linkedSegmentsArbitrary, (segments) => {
        let text = "";
        const facets = [];
        for (const segment of segments) {
          const byteStart = byteLength(text);
          text += segment.display;
          if (segment.uri !== null) {
            facets.push({
              index: { byteStart, byteEnd: byteLength(text) },
              features: [{ $type: LINK, uri: segment.uri }],
            });
          }
        }
        const expected = segments
          .map((segment) => segment.uri ?? segment.display)
          .join("");
        assert.deepEqual(richTextToString(text, facets), expected);
      }),
    );
  });
});
