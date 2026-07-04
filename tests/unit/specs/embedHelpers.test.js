import { TestSuite } from "../testSuite.js";
import { assertEquals } from "../testHelpers.js";
import { parseRecordLink, resolveRecordFromLink } from "/js/embedHelpers.js";

const t = new TestSuite("embedHelpers");

t.describe("parseRecordLink", (it) => {
  it("parses a post link", () => {
    assertEquals(
      parseRecordLink("https://bsky.app/profile/alice.test/post/3abc"),
      {
        collection: "app.bsky.feed.post",
        didOrHandle: "alice.test",
        rkey: "3abc",
      },
    );
  });

  it("parses a feed link", () => {
    assertEquals(
      parseRecordLink("https://bsky.app/profile/alice.test/feed/cool-feed"),
      {
        collection: "app.bsky.feed.generator",
        didOrHandle: "alice.test",
        rkey: "cool-feed",
      },
    );
  });

  it("parses a list link", () => {
    assertEquals(
      parseRecordLink("https://bsky.app/profile/did:plc:abc/lists/3list"),
      {
        collection: "app.bsky.graph.list",
        didOrHandle: "did:plc:abc",
        rkey: "3list",
      },
    );
  });

  it("parses both starter pack link forms", () => {
    assertEquals(
      parseRecordLink("https://bsky.app/profile/alice.test/starter-pack/3pack"),
      {
        collection: "app.bsky.graph.starterpack",
        didOrHandle: "alice.test",
        rkey: "3pack",
      },
    );
    assertEquals(
      parseRecordLink("https://bsky.app/starter-pack/alice.test/3pack"),
      {
        collection: "app.bsky.graph.starterpack",
        didOrHandle: "alice.test",
        rkey: "3pack",
      },
    );
  });

  it("returns null for hosts outside the in-app link domains", () => {
    assertEquals(
      parseRecordLink("https://example.com/profile/alice.test/post/3abc"),
      null,
    );
  });

  it("returns null for unrelated in-app paths", () => {
    assertEquals(parseRecordLink("https://bsky.app/profile/alice.test"), null);
    assertEquals(parseRecordLink("https://bsky.app/settings"), null);
  });

  it("returns null for invalid urls", () => {
    assertEquals(parseRecordLink("not a url"), null);
    assertEquals(parseRecordLink(""), null);
  });
});

t.describe("resolveRecordFromLink", (it) => {
  function makeDeps({ resolveHandleCalls = [] } = {}) {
    return {
      identityResolver: {
        resolveHandle: async (handle) => {
          resolveHandleCalls.push(handle);
          return "did:plc:resolved1";
        },
      },
      dataLayer: {
        declarative: {
          ensurePost: async (uri) => ({
            uri,
            cid: "postcid",
            author: { did: "did:plc:resolved1", handle: "alice.test" },
            record: {
              text: "Original post",
              createdAt: "2025-01-01T00:00:00Z",
            },
            indexedAt: "2025-01-01T00:00:00.000Z",
            labels: [],
          }),
          ensureFeedGenerator: async (uri) => ({
            uri,
            cid: "feedcid",
            displayName: "Cool Feed",
          }),
          ensureList: async (uri) => ({
            uri,
            cid: "listcid",
            name: "Cool List",
          }),
          ensureStarterPack: async (uri) => ({
            uri,
            cid: "packcid",
            record: { name: "Cool Pack" },
          }),
        },
      },
    };
  }

  it("resolves a post link to a viewRecord embed", async () => {
    const record = await resolveRecordFromLink(
      "https://bsky.app/profile/alice.test/post/3abc",
      makeDeps(),
    );
    assertEquals(record.$type, "app.bsky.embed.record#viewRecord");
    assertEquals(record.uri, "at://did:plc:resolved1/app.bsky.feed.post/3abc");
    assertEquals(record.cid, "postcid");
  });

  it("does not resolve the handle for DID-form urls", async () => {
    const resolveHandleCalls = [];
    const record = await resolveRecordFromLink(
      "https://bsky.app/profile/did:plc:direct1/post/3abc",
      makeDeps({ resolveHandleCalls }),
    );
    assertEquals(resolveHandleCalls, []);
    assertEquals(record.uri, "at://did:plc:direct1/app.bsky.feed.post/3abc");
  });

  it("tags a feed generator view", async () => {
    const record = await resolveRecordFromLink(
      "https://bsky.app/profile/alice.test/feed/cool-feed",
      makeDeps(),
    );
    assertEquals(record.$type, "app.bsky.feed.defs#generatorView");
    assertEquals(
      record.uri,
      "at://did:plc:resolved1/app.bsky.feed.generator/cool-feed",
    );
  });

  it("tags a list view", async () => {
    const record = await resolveRecordFromLink(
      "https://bsky.app/profile/alice.test/lists/3list",
      makeDeps(),
    );
    assertEquals(record.$type, "app.bsky.graph.defs#listView");
  });

  it("tags a starter pack view", async () => {
    const record = await resolveRecordFromLink(
      "https://bsky.app/starter-pack/alice.test/3pack",
      makeDeps(),
    );
    assertEquals(record.$type, "app.bsky.graph.defs#starterPackViewBasic");
  });

  it("throws an informative error for urls that are not record links", async () => {
    let thrown = null;
    try {
      await resolveRecordFromLink(
        "https://example.com/profile/alice.test/post/3abc",
        makeDeps(),
      );
    } catch (error) {
      thrown = error;
    }
    assertEquals(
      thrown?.message,
      "Not a record link: https://example.com/profile/alice.test/post/3abc",
    );
  });

  it("propagates resolution failures", async () => {
    const deps = makeDeps();
    deps.dataLayer.declarative.ensurePost = async () => {
      throw new Error("not found");
    };
    let thrown = null;
    try {
      await resolveRecordFromLink(
        "https://bsky.app/profile/alice.test/post/3abc",
        deps,
      );
    } catch (error) {
      thrown = error;
    }
    assertEquals(thrown?.message, "not found");
  });
});

await t.run();
