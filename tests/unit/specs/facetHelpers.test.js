import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getUnresolvedFacetsFromText,
  resolveFacets,
  getFacetsFromText,
  getTagsFromFacets,
  getLinkUrlsFromText,
  stripLeadingOrTrailingLink,
  richTextToString,
} from "/js/facetHelpers.js";

// Mock identity resolver
function createMockIdentityResolver(handleToDidMap = {}) {
  return {
    resolveHandle: async (handle) => {
      if (handleToDidMap[handle]) {
        return handleToDidMap[handle];
      }
      throw new Error(`Could not resolve handle: ${handle}`);
    },
  };
}

describe("getUnresolvedFacetsFromText", () => {
  it("should return empty array for null/undefined text", () => {
    assert.deepEqual(getUnresolvedFacetsFromText(null), []);
    assert.deepEqual(getUnresolvedFacetsFromText(undefined), []);
    assert.deepEqual(getUnresolvedFacetsFromText(""), []);
  });

  it("should detect links with valid TLDs", () => {
    const text = "Check out example.com for more info";
    const facets = getUnresolvedFacetsFromText(text);

    assert.deepEqual(facets.length, 1);
    assert.deepEqual(
      facets[0].features[0].$type,
      "app.bsky.richtext.facet#link",
    );
    assert.deepEqual(facets[0].features[0].uri, "https://example.com");
  });

  it("should detect links with https protocol", () => {
    const text = "Visit https://example.com today";
    const facets = getUnresolvedFacetsFromText(text);

    assert.deepEqual(facets.length, 1);
    assert.deepEqual(facets[0].features[0].uri, "https://example.com");
  });

  it("should detect links with http protocol", () => {
    const text = "Visit http://example.com today";
    const facets = getUnresolvedFacetsFromText(text);

    assert.deepEqual(facets.length, 1);
    assert.deepEqual(facets[0].features[0].uri, "http://example.com");
  });

  it("should strip trailing punctuation from links", () => {
    const text = "Check out example.com.";
    const facets = getUnresolvedFacetsFromText(text);

    assert.deepEqual(facets.length, 1);
    assert.deepEqual(facets[0].features[0].uri, "https://example.com");
  });

  it("should not strip closing paren when URI contains a matching paren", () => {
    const text = "see https://en.wikipedia.org/wiki/Foo_(bar) for context";
    const facets = getUnresolvedFacetsFromText(text);

    const links = facets.filter(
      (f) => f.features[0].$type === "app.bsky.richtext.facet#link",
    );
    assert.deepEqual(links.length, 1);
    assert.deepEqual(
      links[0].features[0].uri,
      "https://en.wikipedia.org/wiki/Foo_(bar)",
    );
  });

  it("should strip a trailing closing paren when URI has none", () => {
    const text = "see (example.com) for more";
    const facets = getUnresolvedFacetsFromText(text);

    const links = facets.filter(
      (f) => f.features[0].$type === "app.bsky.richtext.facet#link",
    );
    assert.deepEqual(links.length, 1);
    assert.deepEqual(links[0].features[0].uri, "https://example.com");
  });

  it("should not detect bare domains with invalid TLDs as links", () => {
    const text = "visit foo.invalidtld today";
    const facets = getUnresolvedFacetsFromText(text);

    const links = facets.filter(
      (f) => f.features[0].$type === "app.bsky.richtext.facet#link",
    );
    assert.deepEqual(links.length, 0);
  });

  it("should not detect a domain inside an email address", () => {
    const text = "Email me at user@example.com";
    const facets = getUnresolvedFacetsFromText(text);

    const links = facets.filter(
      (f) => f.features[0].$type === "app.bsky.richtext.facet#link",
    );
    assert.deepEqual(links.length, 0);
  });

  it("should detect hashtags", () => {
    const text = "Hello #world and #coding";
    const facets = getUnresolvedFacetsFromText(text);

    const hashtags = facets.filter(
      (f) => f.features[0].$type === "app.bsky.richtext.facet#tag",
    );
    assert.deepEqual(hashtags.length, 2);
    assert.deepEqual(hashtags[0].features[0].tag, "world");
    assert.deepEqual(hashtags[1].features[0].tag, "coding");
  });

  it("should detect cashtags", () => {
    const text = "Bought $AAPL and $tsla today";
    const facets = getUnresolvedFacetsFromText(text);

    const tags = facets.filter(
      (f) => f.features[0].$type === "app.bsky.richtext.facet#tag",
    );
    assert.deepEqual(tags.length, 2);
    assert.deepEqual(tags[0].features[0].tag, "$AAPL");
    assert.deepEqual(tags[1].features[0].tag, "$TSLA");
  });

  it("should not detect cashtags mid-word", () => {
    const text = "email me at foo$bar.com or pay me $5";
    const facets = getUnresolvedFacetsFromText(text);

    const tags = facets.filter(
      (f) => f.features[0].$type === "app.bsky.richtext.facet#tag",
    );
    assert.deepEqual(tags.length, 0);
  });

  it("should compute correct byte indices for cashtags", () => {
    const text = "Buy $AAPL now";
    const facets = getUnresolvedFacetsFromText(text);

    const tags = facets.filter(
      (f) => f.features[0].$type === "app.bsky.richtext.facet#tag",
    );
    assert.deepEqual(tags.length, 1);
    assert.deepEqual(tags[0].index.byteStart, 4);
    assert.deepEqual(tags[0].index.byteEnd, 9);
  });

  it("should detect mentions", () => {
    const text = "Hello @alice.bsky.social and @bob.bsky.social";
    const facets = getUnresolvedFacetsFromText(text);

    const mentions = facets.filter(
      (f) => f.features[0].$type === "app.bsky.richtext.facet#mention",
    );
    assert.deepEqual(mentions.length, 2);
    assert.deepEqual(mentions[0].features[0].handle, "alice.bsky.social");
    assert.deepEqual(mentions[1].features[0].handle, "bob.bsky.social");
  });

  it("should detect mixed content", () => {
    const text = "Hey @alice.bsky.social check out example.com #cool";
    const facets = getUnresolvedFacetsFromText(text);

    const links = facets.filter(
      (f) => f.features[0].$type === "app.bsky.richtext.facet#link",
    );
    const hashtags = facets.filter(
      (f) => f.features[0].$type === "app.bsky.richtext.facet#tag",
    );
    const mentions = facets.filter(
      (f) => f.features[0].$type === "app.bsky.richtext.facet#mention",
    );

    assert.deepEqual(links.length, 1);
    assert.deepEqual(hashtags.length, 1);
    assert.deepEqual(mentions.length, 1);
  });

  it("should have correct byte indices", () => {
    const text = "Hi @bob.com";
    const facets = getUnresolvedFacetsFromText(text);

    assert.deepEqual(facets.length, 1);
    assert.deepEqual(facets[0].index.byteStart, 3);
    assert.deepEqual(facets[0].index.byteEnd, 11);
  });

  it("should not detect mentions without valid TLD", () => {
    const text = "Hi @bob";
    const facets = getUnresolvedFacetsFromText(text);

    const mentions = facets.filter(
      (f) => f.features[0].$type === "app.bsky.richtext.facet#mention",
    );
    assert.deepEqual(mentions.length, 0);
  });

  it("should detect mentions preceded by an open paren", () => {
    const text = "see (@alice.bsky.social)";
    const facets = getUnresolvedFacetsFromText(text);

    const mentions = facets.filter(
      (f) => f.features[0].$type === "app.bsky.richtext.facet#mention",
    );
    assert.deepEqual(mentions.length, 1);
    assert.deepEqual(mentions[0].features[0].handle, "alice.bsky.social");
  });

  it("should detect hashtags only when preceded by start or whitespace", () => {
    const text = "no#match but #yes works";
    const facets = getUnresolvedFacetsFromText(text);

    const tags = facets.filter(
      (f) => f.features[0].$type === "app.bsky.richtext.facet#tag",
    );
    assert.deepEqual(tags.length, 1);
    assert.deepEqual(tags[0].features[0].tag, "yes");
  });

  it("should not detect hashtags consisting only of digits", () => {
    const text = "Read #123 carefully";
    const facets = getUnresolvedFacetsFromText(text);

    const tags = facets.filter(
      (f) => f.features[0].$type === "app.bsky.richtext.facet#tag",
    );
    assert.deepEqual(tags.length, 0);
  });

  it("should strip trailing punctuation from hashtags", () => {
    const text = "Hello #world!";
    const facets = getUnresolvedFacetsFromText(text);

    const tags = facets.filter(
      (f) => f.features[0].$type === "app.bsky.richtext.facet#tag",
    );
    assert.deepEqual(tags.length, 1);
    assert.deepEqual(tags[0].features[0].tag, "world");
  });

  it("should not parse email addresses as mentions", () => {
    const text = "Contact me at user@example.com for info";
    const facets = getUnresolvedFacetsFromText(text);

    const mentions = facets.filter(
      (f) => f.features[0].$type === "app.bsky.richtext.facet#mention",
    );
    assert.deepEqual(mentions.length, 0);
  });

  it("should handle multibyte characters in byte indices", () => {
    const text = "Hello 世界 @alice.bsky.social";
    const facets = getUnresolvedFacetsFromText(text);

    const mentions = facets.filter(
      (f) => f.features[0].$type === "app.bsky.richtext.facet#mention",
    );
    assert.deepEqual(mentions.length, 1);
    // 'Hello ' = 6 bytes, '世界' = 6 bytes (3 each), ' ' = 1 byte = 13 bytes before @
    assert.deepEqual(mentions[0].index.byteStart, 13);
  });
});

describe("resolveFacets", () => {
  it("should pass through non-mention facets unchanged", async () => {
    const facets = [
      {
        index: { byteStart: 0, byteEnd: 11 },
        features: [
          { $type: "app.bsky.richtext.facet#link", uri: "https://example.com" },
        ],
      },
      {
        index: { byteStart: 15, byteEnd: 20 },
        features: [{ $type: "app.bsky.richtext.facet#tag", tag: "test" }],
      },
    ];

    const resolver = createMockIdentityResolver();
    const resolved = await resolveFacets(facets, resolver);

    assert.deepEqual(resolved.length, 2);
    assert.deepEqual(resolved[0].features[0].uri, "https://example.com");
    assert.deepEqual(resolved[1].features[0].tag, "test");
  });

  it("should resolve mention handles to DIDs", async () => {
    const facets = [
      {
        index: { byteStart: 0, byteEnd: 18 },
        features: [
          {
            $type: "app.bsky.richtext.facet#mention",
            handle: "alice.bsky.social",
          },
        ],
      },
    ];

    const resolver = createMockIdentityResolver({
      "alice.bsky.social": "did:plc:alice123",
    });
    const resolved = await resolveFacets(facets, resolver);

    assert.deepEqual(resolved.length, 1);
    assert.deepEqual(
      resolved[0].features[0].$type,
      "app.bsky.richtext.facet#mention",
    );
    assert.deepEqual(resolved[0].features[0].did, "did:plc:alice123");
  });

  it("should skip mentions that already have DIDs", async () => {
    const facets = [
      {
        index: { byteStart: 0, byteEnd: 18 },
        features: [
          { $type: "app.bsky.richtext.facet#mention", did: "did:plc:existing" },
        ],
      },
    ];

    const resolver = createMockIdentityResolver();
    const resolved = await resolveFacets(facets, resolver);

    assert.deepEqual(resolved.length, 1);
    assert.deepEqual(resolved[0].features[0].did, "did:plc:existing");
  });

  it("should exclude mentions that cannot be resolved", async () => {
    const facets = [
      {
        index: { byteStart: 0, byteEnd: 18 },
        features: [
          { $type: "app.bsky.richtext.facet#mention", handle: "unknown.user" },
        ],
      },
    ];

    const resolver = createMockIdentityResolver({});
    const resolved = await resolveFacets(facets, resolver);

    assert.deepEqual(resolved.length, 0);
  });

  it("should handle mixed resolved and unresolved mentions", async () => {
    const facets = [
      {
        index: { byteStart: 0, byteEnd: 18 },
        features: [
          {
            $type: "app.bsky.richtext.facet#mention",
            handle: "alice.bsky.social",
          },
        ],
      },
      {
        index: { byteStart: 20, byteEnd: 38 },
        features: [
          { $type: "app.bsky.richtext.facet#mention", handle: "unknown.user" },
        ],
      },
      {
        index: { byteStart: 40, byteEnd: 50 },
        features: [{ $type: "app.bsky.richtext.facet#tag", tag: "test" }],
      },
    ];

    const resolver = createMockIdentityResolver({
      "alice.bsky.social": "did:plc:alice123",
    });
    const resolved = await resolveFacets(facets, resolver);

    assert.deepEqual(resolved.length, 2);
    assert.deepEqual(resolved[0].features[0].tag, "test");
    assert.deepEqual(resolved[1].features[0].did, "did:plc:alice123");
  });
});

describe("getFacetsFromText", () => {
  it("should extract and resolve facets from text", async () => {
    const text = "Hello @alice.bsky.social";
    const resolver = createMockIdentityResolver({
      "alice.bsky.social": "did:plc:alice123",
    });

    const facets = await getFacetsFromText(text, resolver);

    assert.deepEqual(facets.length, 1);
    assert.deepEqual(
      facets[0].features[0].$type,
      "app.bsky.richtext.facet#mention",
    );
    assert.deepEqual(facets[0].features[0].did, "did:plc:alice123");
  });

  it("should handle text with no facets", async () => {
    const text = "Just plain text";
    const resolver = createMockIdentityResolver();

    const facets = await getFacetsFromText(text, resolver);

    assert.deepEqual(facets.length, 0);
  });

  it("should handle text with only hashtags and links", async () => {
    const text = "Check #this at example.com";
    const resolver = createMockIdentityResolver();

    const facets = await getFacetsFromText(text, resolver);

    assert.deepEqual(facets.length, 2);
  });
});

describe("getTagsFromFacets", () => {
  it("should return only tag facets", () => {
    const facets = [
      {
        index: { byteStart: 0, byteEnd: 5 },
        features: [{ $type: "app.bsky.richtext.facet#tag", tag: "hello" }],
      },
      {
        index: { byteStart: 10, byteEnd: 21 },
        features: [
          { $type: "app.bsky.richtext.facet#link", uri: "https://example.com" },
        ],
      },
      {
        index: { byteStart: 25, byteEnd: 30 },
        features: [{ $type: "app.bsky.richtext.facet#tag", tag: "world" }],
      },
    ];

    const tags = getTagsFromFacets(facets);

    assert.deepEqual(tags.length, 2);
    assert.deepEqual(tags[0].features[0].tag, "hello");
    assert.deepEqual(tags[1].features[0].tag, "world");
  });

  it("should return empty array when no tags present", () => {
    const facets = [
      {
        index: { byteStart: 0, byteEnd: 11 },
        features: [
          { $type: "app.bsky.richtext.facet#link", uri: "https://example.com" },
        ],
      },
      {
        index: { byteStart: 15, byteEnd: 33 },
        features: [
          { $type: "app.bsky.richtext.facet#mention", did: "did:plc:abc123" },
        ],
      },
    ];

    const tags = getTagsFromFacets(facets);

    assert.deepEqual(tags.length, 0);
  });

  it("should return empty array for empty facets array", () => {
    const tags = getTagsFromFacets([]);

    assert.deepEqual(tags.length, 0);
  });

  it("should filter out mentions", () => {
    const facets = [
      {
        index: { byteStart: 0, byteEnd: 5 },
        features: [{ $type: "app.bsky.richtext.facet#tag", tag: "test" }],
      },
      {
        index: { byteStart: 10, byteEnd: 28 },
        features: [
          { $type: "app.bsky.richtext.facet#mention", did: "did:plc:user123" },
        ],
      },
    ];

    const tags = getTagsFromFacets(facets);

    assert.deepEqual(tags.length, 1);
    assert.deepEqual(tags[0].features[0].$type, "app.bsky.richtext.facet#tag");
  });
});

describe("richTextToString", () => {
  it("should return empty string for null/undefined text", () => {
    assert.deepEqual(richTextToString(null, []), "");
    assert.deepEqual(richTextToString(undefined, []), "");
    assert.deepEqual(richTextToString("", []), "");
  });

  it("should return text unchanged when no facets are provided", () => {
    assert.deepEqual(richTextToString("hello world", []), "hello world");
    assert.deepEqual(richTextToString("hello world", null), "hello world");
    assert.deepEqual(richTextToString("hello world", undefined), "hello world");
  });

  it("should replace a shortened link with its full URI", () => {
    const text = "check this out: example.com/foo...";
    const facets = [
      {
        index: { byteStart: 16, byteEnd: 34 },
        features: [
          {
            $type: "app.bsky.richtext.facet#link",
            uri: "https://example.com/foo/bar/baz",
          },
        ],
      },
    ];
    assert.deepEqual(
      richTextToString(text, facets),
      "check this out: https://example.com/foo/bar/baz",
    );
  });

  it("should leave non-link facets (mentions, tags) as display text", () => {
    const text = "hi @alice.test #hello";
    const facets = [
      {
        index: { byteStart: 3, byteEnd: 14 },
        features: [
          {
            $type: "app.bsky.richtext.facet#mention",
            did: "did:plc:alice",
          },
        ],
      },
      {
        index: { byteStart: 15, byteEnd: 21 },
        features: [{ $type: "app.bsky.richtext.facet#tag", tag: "hello" }],
      },
    ];
    assert.deepEqual(richTextToString(text, facets), "hi @alice.test #hello");
  });

  it("should handle multiple link facets in order", () => {
    const text = "see a.co/x and b.co/y end";
    const facets = [
      {
        index: { byteStart: 15, byteEnd: 21 },
        features: [
          {
            $type: "app.bsky.richtext.facet#link",
            uri: "https://b.co/y/full",
          },
        ],
      },
      {
        index: { byteStart: 4, byteEnd: 10 },
        features: [
          {
            $type: "app.bsky.richtext.facet#link",
            uri: "https://a.co/x/full",
          },
        ],
      },
    ];
    assert.deepEqual(
      richTextToString(text, facets),
      "see https://a.co/x/full and https://b.co/y/full end",
    );
  });

  it("should handle multibyte characters correctly", () => {
    const text = "héllo example.com/x";
    // "héllo " = 7 bytes (é is 2 bytes), link starts at byte 7
    const facets = [
      {
        index: { byteStart: 7, byteEnd: 20 },
        features: [
          {
            $type: "app.bsky.richtext.facet#link",
            uri: "https://example.com/x/full",
          },
        ],
      },
    ];
    assert.deepEqual(
      richTextToString(text, facets),
      "héllo https://example.com/x/full",
    );
  });
});

describe("getLinkUrlsFromText", () => {
  it("returns urls for links in the text", () => {
    assert.deepEqual(
      getLinkUrlsFromText("check this https://bsky.app/profile/alice.test"),
      ["https://bsky.app/profile/alice.test"],
    );
  });

  it("normalizes scheme-less links to https", () => {
    assert.deepEqual(
      getLinkUrlsFromText("check bsky.app/profile/alice.test/post/3abc out"),
      ["https://bsky.app/profile/alice.test/post/3abc"],
    );
  });

  it("returns an empty array when there are no links", () => {
    assert.deepEqual(getLinkUrlsFromText("just some plain text"), []);
    assert.deepEqual(getLinkUrlsFromText(""), []);
  });
});

describe("stripLeadingOrTrailingLink", () => {
  const url = "https://bsky.app/profile/alice.test/post/3abc";

  it("strips a leading link", () => {
    assert.deepEqual(
      stripLeadingOrTrailingLink(`${url} check this out`, url),
      "check this out",
    );
  });

  it("strips a trailing link", () => {
    assert.deepEqual(
      stripLeadingOrTrailingLink(`check this out ${url}`, url),
      "check this out",
    );
  });

  it("returns an empty string for link-only text", () => {
    assert.deepEqual(stripLeadingOrTrailingLink(url, url), "");
    assert.deepEqual(stripLeadingOrTrailingLink(`  ${url} `, url), "");
  });

  it("leaves a mid-text link in place", () => {
    const text = `look at ${url} right there`;
    assert.deepEqual(stripLeadingOrTrailingLink(text, url), text);
  });

  it("strips a scheme-less link matching the normalized url", () => {
    assert.deepEqual(
      stripLeadingOrTrailingLink(
        "bsky.app/profile/alice.test/post/3abc so cool",
        url,
      ),
      "so cool",
    );
  });

  it("leaves text unchanged when the url does not match any link", () => {
    const text = `check this out ${url}`;
    assert.deepEqual(
      stripLeadingOrTrailingLink(text, "https://bsky.app/profile/other"),
      text,
    );
  });
});
