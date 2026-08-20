import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { QueryStore } from "/js/dataLayer/queryStore.js";
import {
  Resources,
  buildQueryKey,
  feedQueryKey,
  parseFeedQueryKey,
  profileFollowersQueryKey,
} from "/js/dataLayer/queryKeys.js";

describe("QueryStore", () => {
  describe("buildQueryKey", () => {
    it("should spell the same params the same way regardless of order", () => {
      assert.deepEqual(
        buildQueryKey("resource", { b: "2", a: "1" }),
        buildQueryKey("resource", { a: "1", b: "2" }),
      );
    });

    it("should drop absent params", () => {
      assert.deepEqual(
        buildQueryKey("resource", { a: undefined, b: null }),
        buildQueryKey("resource"),
      );
    });

    it("should keep the separator so one resource cannot prefix another", () => {
      assert(!buildQueryKey("posts").startsWith(buildQueryKey("post")));
    });
  });

  describe("writePage", () => {
    const key = profileFollowersQueryKey({ did: "did:plc:a" });

    function seeded() {
      const queries = new QueryStore();
      queries.set(key, {
        pages: [
          { items: ["did:plc:1"], cursor: "c1" },
          { items: ["did:plc:2"], cursor: "c2" },
        ],
      });
      return queries;
    }

    it("should replace the whole collection on reload", () => {
      const queries = seeded();

      const written = queries.writePage(
        key,
        { items: ["did:plc:new"], cursor: "c1" },
        { reload: true, requestCursor: "" },
      );

      assert.deepEqual(written, true);
      assert.deepEqual(queries.getItems(key), ["did:plc:new"]);
    });

    it("should append when not reloading", () => {
      const queries = seeded();

      const written = queries.writePage(
        key,
        { items: ["did:plc:3"], cursor: null },
        { requestCursor: "c2" },
      );

      assert.deepEqual(written, true);
      assert.deepEqual(queries.getItems(key), [
        "did:plc:1",
        "did:plc:2",
        "did:plc:3",
      ]);
    });

    it("should discard an append whose request cursor has been overtaken", () => {
      const queries = seeded();

      const written = queries.writePage(
        key,
        { items: ["did:plc:3"], cursor: null },
        { requestCursor: "c1" },
      );

      assert.deepEqual(written, false);
      assert.deepEqual(queries.getItems(key), ["did:plc:1", "did:plc:2"]);
    });

    it("should not apply the cursor guard to a reload", () => {
      const queries = seeded();

      // A reload starts from an empty cursor even though the slot is at c2.
      const written = queries.writePage(
        key,
        { items: ["did:plc:new"], cursor: null },
        { reload: true, requestCursor: "" },
      );

      assert.deepEqual(written, true);
      assert.deepEqual(queries.getItems(key), ["did:plc:new"]);
    });
  });

  describe("listing a resource's slots", () => {
    it("should return only the keys of the given resource, round-tripping the feed uri", () => {
      const queries = new QueryStore();
      const feedUri = "at://did:plc:a/app.bsky.feed.generator/one";
      queries.set(feedQueryKey({ uri: feedUri }), {
        pages: [{ items: [], cursor: null }],
      });
      queries.set(profileFollowersQueryKey({ did: "did:plc:a" }), {
        pages: [{ items: [], cursor: null }],
      });

      const keys = queries.keysForResource(Resources.FEED);

      assert.deepEqual(keys.map(parseFeedQueryKey), [feedUri]);
    });

    it("should not parse a key belonging to another resource", () => {
      assert.deepEqual(
        parseFeedQueryKey(profileFollowersQueryKey({ did: "did:plc:a" })),
        null,
      );
    });
  });

  describe("updating every slot of a resource", () => {
    function seedTwoSlots() {
      const queries = new QueryStore();
      queries.set(profileFollowersQueryKey({ did: "did:plc:a" }), {
        pages: [{ items: ["did:plc:1"], cursor: "c1" }],
      });
      queries.set(profileFollowersQueryKey({ did: "did:plc:b" }), {
        pages: [
          { items: ["did:plc:2"], cursor: "c2" },
          { items: ["did:plc:1"], cursor: null },
        ],
      });
      return queries;
    }

    it("should prepend to the first page of every slot of the resource", () => {
      const queries = seedTwoSlots();

      queries.prependToResource(Resources.PROFILE_FOLLOWERS, "did:plc:new");

      assert.deepEqual(
        queries.getItems(profileFollowersQueryKey({ did: "did:plc:a" })),
        ["did:plc:new", "did:plc:1"],
      );
      assert.deepEqual(
        queries.getItems(profileFollowersQueryKey({ did: "did:plc:b" })),
        ["did:plc:new", "did:plc:2", "did:plc:1"],
      );
    });

    it("should not prepend to a slot that already holds the id on any page", () => {
      const queries = seedTwoSlots();

      queries.prependToResource(Resources.PROFILE_FOLLOWERS, "did:plc:1");

      // Slot b holds it on its second page, so it must not gain a duplicate.
      assert.deepEqual(
        queries.getItems(profileFollowersQueryKey({ did: "did:plc:b" })),
        ["did:plc:2", "did:plc:1"],
      );
    });

    it("should remove the id from every page of every slot", () => {
      const queries = seedTwoSlots();

      queries.removeFromResource(Resources.PROFILE_FOLLOWERS, "did:plc:1");

      assert.deepEqual(
        queries.getItems(profileFollowersQueryKey({ did: "did:plc:a" })),
        [],
      );
      assert.deepEqual(
        queries.getItems(profileFollowersQueryKey({ did: "did:plc:b" })),
        ["did:plc:2"],
      );
    });

    it("should leave other resources alone", () => {
      const queries = seedTwoSlots();
      const otherKey = buildQueryKey(Resources.BOOKMARKS);
      queries.set(otherKey, {
        pages: [{ items: ["at://post"], cursor: null }],
      });

      queries.removeFromResource(Resources.PROFILE_FOLLOWERS, "did:plc:1");

      assert.deepEqual(queries.getItems(otherKey), ["at://post"]);
    });

    it("should skip slots that have not loaded", () => {
      const queries = new QueryStore();

      queries.prependToResource(Resources.PROFILE_FOLLOWERS, "did:plc:new");

      assert.deepEqual(
        queries.get(profileFollowersQueryKey({ did: "did:plc:a" })),
        null,
      );
    });

    it("should update only the named slot with the key-scoped variants", () => {
      const queries = seedTwoSlots();
      const keyA = profileFollowersQueryKey({ did: "did:plc:a" });
      const keyB = profileFollowersQueryKey({ did: "did:plc:b" });

      queries.prependToQuery(keyA, "did:plc:new");
      queries.removeFromQuery(keyA, "did:plc:1");

      assert.deepEqual(queries.getItems(keyA), ["did:plc:new"]);
      assert.deepEqual(queries.getItems(keyB), ["did:plc:2", "did:plc:1"]);
    });
  });
});
