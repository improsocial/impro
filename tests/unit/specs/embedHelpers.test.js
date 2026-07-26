import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { parseRecordLink, resolveRecordFromLink } from "/js/embedHelpers.js";
import { makeTestDataLayer, stubRecordLinkResolution } from "../testHelpers.js";

describe("parseRecordLink", () => {
  it("parses a post link", () => {
    assert.deepEqual(
      parseRecordLink("https://bsky.app/profile/alice.test/post/3abc"),
      {
        collection: "app.bsky.feed.post",
        didOrHandle: "alice.test",
        rkey: "3abc",
      },
    );
  });

  it("parses a feed link", () => {
    assert.deepEqual(
      parseRecordLink("https://bsky.app/profile/alice.test/feed/cool-feed"),
      {
        collection: "app.bsky.feed.generator",
        didOrHandle: "alice.test",
        rkey: "cool-feed",
      },
    );
  });

  it("parses a list link", () => {
    assert.deepEqual(
      parseRecordLink("https://bsky.app/profile/did:plc:abc/lists/3list"),
      {
        collection: "app.bsky.graph.list",
        didOrHandle: "did:plc:abc",
        rkey: "3list",
      },
    );
  });

  it("parses both starter pack link forms", () => {
    assert.deepEqual(
      parseRecordLink("https://bsky.app/profile/alice.test/starter-pack/3pack"),
      {
        collection: "app.bsky.graph.starterpack",
        didOrHandle: "alice.test",
        rkey: "3pack",
      },
    );
    assert.deepEqual(
      parseRecordLink("https://bsky.app/starter-pack/alice.test/3pack"),
      {
        collection: "app.bsky.graph.starterpack",
        didOrHandle: "alice.test",
        rkey: "3pack",
      },
    );
  });

  it("returns null for hosts outside the in-app link domains", () => {
    assert.deepEqual(
      parseRecordLink("https://example.com/profile/alice.test/post/3abc"),
      null,
    );
  });

  it("returns null for unrelated in-app paths", () => {
    assert.deepEqual(
      parseRecordLink("https://bsky.app/profile/alice.test"),
      null,
    );
    assert.deepEqual(parseRecordLink("https://bsky.app/settings"), null);
  });

  it("returns null for invalid urls", () => {
    assert.deepEqual(parseRecordLink("not a url"), null);
    assert.deepEqual(parseRecordLink(""), null);
  });
});

describe("resolveRecordFromLink", () => {
  function makeDeps({ resolveHandleCalls = [] } = {}) {
    const dataLayer = makeTestDataLayer();
    stubRecordLinkResolution(dataLayer, {
      ensurePost: async (uri) => ({
        uri,
        cid: "postcid",
        author: { did: "did:plc:resolved1", handle: "alice.test" },
        record: { text: "Original post", createdAt: "2025-01-01T00:00:00Z" },
        indexedAt: "2025-01-01T00:00:00.000Z",
        labels: [],
      }),
    });
    return {
      identityResolver: {
        resolveHandle: async (handle) => {
          resolveHandleCalls.push(handle);
          return "did:plc:resolved1";
        },
      },
      dataLayer,
    };
  }

  it("resolves a post link to a viewRecord embed", async () => {
    const record = await resolveRecordFromLink(
      "https://bsky.app/profile/alice.test/post/3abc",
      makeDeps(),
    );
    assert.deepEqual(record.$type, "app.bsky.embed.record#viewRecord");
    assert.deepEqual(
      record.uri,
      "at://did:plc:resolved1/app.bsky.feed.post/3abc",
    );
    assert.deepEqual(record.cid, "postcid");
  });

  it("does not resolve the handle for DID-form urls", async () => {
    const resolveHandleCalls = [];
    const record = await resolveRecordFromLink(
      "https://bsky.app/profile/did:plc:direct1/post/3abc",
      makeDeps({ resolveHandleCalls }),
    );
    assert.deepEqual(resolveHandleCalls, []);
    assert.deepEqual(
      record.uri,
      "at://did:plc:direct1/app.bsky.feed.post/3abc",
    );
  });

  it("tags a feed generator view", async () => {
    const record = await resolveRecordFromLink(
      "https://bsky.app/profile/alice.test/feed/cool-feed",
      makeDeps(),
    );
    assert.deepEqual(record.$type, "app.bsky.feed.defs#generatorView");
    assert.deepEqual(
      record.uri,
      "at://did:plc:resolved1/app.bsky.feed.generator/cool-feed",
    );
  });

  it("tags a list view", async () => {
    const record = await resolveRecordFromLink(
      "https://bsky.app/profile/alice.test/lists/3list",
      makeDeps(),
    );
    assert.deepEqual(record.$type, "app.bsky.graph.defs#listView");
  });

  it("tags a starter pack view", async () => {
    const record = await resolveRecordFromLink(
      "https://bsky.app/starter-pack/alice.test/3pack",
      makeDeps(),
    );
    assert.deepEqual(record.$type, "app.bsky.graph.defs#starterPackViewBasic");
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
    assert.deepEqual(
      thrown?.message,
      "Not a record link: https://example.com/profile/alice.test/post/3abc",
    );
  });

  it("propagates resolution failures", async () => {
    const deps = makeDeps();
    mock.method(deps.dataLayer.declarative, "ensurePost", async () => {
      throw new Error("not found");
    });
    let thrown = null;
    try {
      await resolveRecordFromLink(
        "https://bsky.app/profile/alice.test/post/3abc",
        deps,
      );
    } catch (error) {
      thrown = error;
    }
    assert.deepEqual(thrown?.message, "not found");
  });
});
