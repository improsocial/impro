import { TestSuite } from "../testSuite.js";
import { assert, assertEquals } from "../testHelpers.js";
import {
  getUnresolvedFacetsFromText,
  resolveFacets,
  getFacetsFromText,
  getTagsFromFacets,
} from "../../src/js/facetHelpers.js";

const t = new TestSuite("facetHelpers");

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

t.describe("getUnresolvedFacetsFromText", (it) => {
  it("should return empty array for null/undefined text", () => {
    assertEquals(getUnresolvedFacetsFromText(null), []);
    assertEquals(getUnresolvedFacetsFromText(undefined), []);
    assertEquals(getUnresolvedFacetsFromText(""), []);
  });

  it("should detect links with valid TLDs", () => {
    const text = "Check out example.com for more info";
    const facets = getUnresolvedFacetsFromText(text);

    assertEquals(facets.length, 1);
    assertEquals(facets[0].features[0].$type, "app.bsky.richtext.facet#link");
    assertEquals(facets[0].features[0].uri, "https://example.com");
  });

  it("should detect links with https protocol", () => {
    const text = "Visit https://example.com today";
    const facets = getUnresolvedFacetsFromText(text);

    assertEquals(facets.length, 1);
    assertEquals(facets[0].features[0].uri, "https://example.com");
  });

  it("should detect links with http protocol", () => {
    const text = "Visit http://example.com today";
    const facets = getUnresolvedFacetsFromText(text);

    assertEquals(facets.length, 1);
    assertEquals(facets[0].features[0].uri, "http://example.com");
  });

  it("should strip trailing punctuation from links", () => {
    const text = "Check out example.com.";
    const facets = getUnresolvedFacetsFromText(text);

    assertEquals(facets.length, 1);
    assertEquals(facets[0].features[0].uri, "https://example.com");
  });

  it("should detect hashtags", () => {
    const text = "Hello #world and #coding";
    const facets = getUnresolvedFacetsFromText(text);

    const hashtags = facets.filter(
      (f) => f.features[0].$type === "app.bsky.richtext.facet#tag"
    );
    assertEquals(hashtags.length, 2);
    assertEquals(hashtags[0].features[0].tag, "world");
    assertEquals(hashtags[1].features[0].tag, "coding");
  });

  it("should detect mentions", () => {
    const text = "Hello @alice.bsky.social and @bob.bsky.social";
    const facets = getUnresolvedFacetsFromText(text);

    const mentions = facets.filter(
      (f) => f.features[0].$type === "app.bsky.richtext.facet#mention"
    );
    assertEquals(mentions.length, 2);
    assertEquals(mentions[0].features[0].handle, "alice.bsky.social");
    assertEquals(mentions[1].features[0].handle, "bob.bsky.social");
  });

  it("should detect mixed content", () => {
    const text =
      "Hey @alice.bsky.social check out example.com #cool";
    const facets = getUnresolvedFacetsFromText(text);

    const links = facets.filter(
      (f) => f.features[0].$type === "app.bsky.richtext.facet#link"
    );
    const hashtags = facets.filter(
      (f) => f.features[0].$type === "app.bsky.richtext.facet#tag"
    );
    const mentions = facets.filter(
      (f) => f.features[0].$type === "app.bsky.richtext.facet#mention"
    );

    assertEquals(links.length, 1);
    assertEquals(hashtags.length, 1);
    assertEquals(mentions.length, 1);
  });

  it("should have correct byte indices", () => {
    const text = "Hi @bob";
    const facets = getUnresolvedFacetsFromText(text);

    assertEquals(facets.length, 1);
    assertEquals(facets[0].index.byteStart, 3);
    assertEquals(facets[0].index.byteEnd, 7);
  });

  it("should handle multibyte characters in byte indices", () => {
    const text = "Hello 世界 @alice.bsky.social";
    const facets = getUnresolvedFacetsFromText(text);

    const mentions = facets.filter(
      (f) => f.features[0].$type === "app.bsky.richtext.facet#mention"
    );
    assertEquals(mentions.length, 1);
    // 'Hello ' = 6 bytes, '世界' = 6 bytes (3 each), ' ' = 1 byte = 13 bytes before @
    assertEquals(mentions[0].index.byteStart, 13);
  });
});

t.describe("resolveFacets", (it) => {
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

    assertEquals(resolved.length, 2);
    assertEquals(resolved[0].features[0].uri, "https://example.com");
    assertEquals(resolved[1].features[0].tag, "test");
  });

  it("should resolve mention handles to DIDs", async () => {
    const facets = [
      {
        index: { byteStart: 0, byteEnd: 18 },
        features: [
          { $type: "app.bsky.richtext.facet#mention", handle: "alice.bsky.social" },
        ],
      },
    ];

    const resolver = createMockIdentityResolver({
      "alice.bsky.social": "did:plc:alice123",
    });
    const resolved = await resolveFacets(facets, resolver);

    assertEquals(resolved.length, 1);
    assertEquals(resolved[0].features[0].$type, "app.bsky.richtext.facet#mention");
    assertEquals(resolved[0].features[0].did, "did:plc:alice123");
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

    assertEquals(resolved.length, 1);
    assertEquals(resolved[0].features[0].did, "did:plc:existing");
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

    assertEquals(resolved.length, 0);
  });

  it("should handle mixed resolved and unresolved mentions", async () => {
    const facets = [
      {
        index: { byteStart: 0, byteEnd: 18 },
        features: [
          { $type: "app.bsky.richtext.facet#mention", handle: "alice.bsky.social" },
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

    assertEquals(resolved.length, 2);
    assertEquals(resolved[0].features[0].tag, "test");
    assertEquals(resolved[1].features[0].did, "did:plc:alice123");
  });
});

t.describe("getFacetsFromText", (it) => {
  it("should extract and resolve facets from text", async () => {
    const text = "Hello @alice.bsky.social";
    const resolver = createMockIdentityResolver({
      "alice.bsky.social": "did:plc:alice123",
    });

    const facets = await getFacetsFromText(text, resolver);

    assertEquals(facets.length, 1);
    assertEquals(facets[0].features[0].$type, "app.bsky.richtext.facet#mention");
    assertEquals(facets[0].features[0].did, "did:plc:alice123");
  });

  it("should handle text with no facets", async () => {
    const text = "Just plain text";
    const resolver = createMockIdentityResolver();

    const facets = await getFacetsFromText(text, resolver);

    assertEquals(facets.length, 0);
  });

  it("should handle text with only hashtags and links", async () => {
    const text = "Check #this at example.com";
    const resolver = createMockIdentityResolver();

    const facets = await getFacetsFromText(text, resolver);

    assertEquals(facets.length, 2);
  });
});

t.describe("getTagsFromFacets", (it) => {
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

    assertEquals(tags.length, 2);
    assertEquals(tags[0].features[0].tag, "hello");
    assertEquals(tags[1].features[0].tag, "world");
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

    assertEquals(tags.length, 0);
  });

  it("should return empty array for empty facets array", () => {
    const tags = getTagsFromFacets([]);

    assertEquals(tags.length, 0);
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

    assertEquals(tags.length, 1);
    assertEquals(tags[0].features[0].$type, "app.bsky.richtext.facet#tag");
  });
});

await t.run();
