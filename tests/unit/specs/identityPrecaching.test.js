import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { setUpIdentityPrecaching } from "/js/identityPrecaching.js";
import { DataStore } from "/js/dataLayer/dataStore.js";
import { createSessionState } from "/js/dataLayer/sessionState.js";

function setup() {
  const dataStore = new DataStore(createSessionState(null));
  const dataLayer = {
    dataStore,
    preferencesProvider: { $preferences: { get: () => null } },
  };
  const resolvedHandles = new Map();
  const identityResolver = {
    setDidForHandle: (handle, did) => resolvedHandles.set(handle, did),
  };
  return { dataStore, dataLayer, identityResolver, resolvedHandles };
}

const flushEffects = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("profile precaching", () => {
  it("should cache identities for profiles stored before setup", () => {
    const { dataStore, dataLayer, identityResolver, resolvedHandles } = setup();
    dataStore.setProfiles([
      { handle: "alice.test", did: "did:plc:alice" },
      { handle: "bob.test", did: "did:plc:bob" },
    ]);

    setUpIdentityPrecaching(dataLayer, identityResolver);

    assert.deepEqual(resolvedHandles.get("alice.test"), "did:plc:alice");
    assert.deepEqual(resolvedHandles.get("bob.test"), "did:plc:bob");
  });

  it("should cache identities for profiles stored after setup", async () => {
    const { dataStore, dataLayer, identityResolver, resolvedHandles } = setup();
    setUpIdentityPrecaching(dataLayer, identityResolver);

    dataStore.setProfiles([{ handle: "carol.test", did: "did:plc:carol" }]);
    await flushEffects();

    assert.deepEqual(resolvedHandles.get("carol.test"), "did:plc:carol");
  });

  it("should cache the new handle when a stored profile's handle changes", async () => {
    const { dataStore, dataLayer, identityResolver, resolvedHandles } = setup();
    setUpIdentityPrecaching(dataLayer, identityResolver);

    dataStore.setProfiles([{ handle: "old.test", did: "did:plc:dave" }]);
    await flushEffects();
    dataStore.setProfiles([{ handle: "new.test", did: "did:plc:dave" }]);
    await flushEffects();

    assert.deepEqual(resolvedHandles.get("new.test"), "did:plc:dave");
  });

  it("should not cache invalid handles", async () => {
    const { dataStore, dataLayer, identityResolver, resolvedHandles } = setup();
    setUpIdentityPrecaching(dataLayer, identityResolver);

    dataStore.setProfiles([{ handle: "handle.invalid", did: "did:plc:eve" }]);
    await flushEffects();

    assert.deepEqual(resolvedHandles.size, 0);
  });
});

describe("current user precaching", () => {
  it("should cache the current user's identity", async () => {
    const { dataStore, dataLayer, identityResolver, resolvedHandles } = setup();
    setUpIdentityPrecaching(dataLayer, identityResolver);

    dataStore.setCurrentUser({ handle: "me.test", did: "did:plc:me" });
    await flushEffects();

    assert.deepEqual(resolvedHandles.get("me.test"), "did:plc:me");
  });
});

describe("creator precaching", () => {
  it("should cache list creators", async () => {
    const { dataStore, dataLayer, identityResolver, resolvedHandles } = setup();
    setUpIdentityPrecaching(dataLayer, identityResolver);

    dataStore.$lists.set("at://did:plc:lister/app.bsky.graph.list/1", {
      uri: "at://did:plc:lister/app.bsky.graph.list/1",
      creator: { handle: "lister.test", did: "did:plc:lister" },
    });
    await flushEffects();

    assert.deepEqual(resolvedHandles.get("lister.test"), "did:plc:lister");
  });

  it("should cache creators of paginated actor lists", async () => {
    const { dataStore, dataLayer, identityResolver, resolvedHandles } = setup();
    setUpIdentityPrecaching(dataLayer, identityResolver);

    dataStore.$actorLists.set("did:plc:owner", {
      lists: [
        {
          uri: "at://did:plc:owner/app.bsky.graph.list/1",
          creator: { handle: "owner.test", did: "did:plc:owner" },
        },
      ],
      cursor: "c1",
    });
    await flushEffects();

    assert.deepEqual(resolvedHandles.get("owner.test"), "did:plc:owner");
  });

  it("should cache starter pack creators", async () => {
    const { dataStore, dataLayer, identityResolver, resolvedHandles } = setup();
    setUpIdentityPrecaching(dataLayer, identityResolver);

    dataStore.$starterPacks.set(
      "at://did:plc:packer/app.bsky.graph.starterpack/1",
      {
        uri: "at://did:plc:packer/app.bsky.graph.starterpack/1",
        creator: { handle: "packer.test", did: "did:plc:packer" },
      },
    );
    await flushEffects();

    assert.deepEqual(resolvedHandles.get("packer.test"), "did:plc:packer");
  });
});

describe("reposter precaching", () => {
  it("should cache reposters from feeds and author feeds", async () => {
    const { dataStore, dataLayer, identityResolver, resolvedHandles } = setup();
    setUpIdentityPrecaching(dataLayer, identityResolver);

    const repostItem = (handle, did) => ({
      post: { uri: `at://${did}/app.bsky.feed.post/1` },
      reason: {
        $type: "app.bsky.feed.defs#reasonRepost",
        by: { handle, did },
      },
    });
    dataStore.$feeds.set("following", {
      feed: [
        { post: { uri: "at://did:plc:plain/app.bsky.feed.post/1" } },
        repostItem("reposter.test", "did:plc:reposter"),
      ],
      cursor: "c1",
    });
    dataStore.$authorFeeds.set("author-feed", {
      feed: [repostItem("author-reposter.test", "did:plc:authorreposter")],
      cursor: "c1",
    });
    await flushEffects();

    assert.deepEqual(resolvedHandles.get("reposter.test"), "did:plc:reposter");
    assert.deepEqual(
      resolvedHandles.get("author-reposter.test"),
      "did:plc:authorreposter",
    );
  });

  it("should cache reposters from later feed pages", async () => {
    const { dataStore, dataLayer, identityResolver, resolvedHandles } = setup();
    setUpIdentityPrecaching(dataLayer, identityResolver);

    dataStore.$feeds.set("following", { feed: [], cursor: "c1" });
    await flushEffects();
    dataStore.$feeds.set("following", {
      feed: [
        {
          post: { uri: "at://did:plc:x/app.bsky.feed.post/1" },
          reason: { by: { handle: "late.test", did: "did:plc:late" } },
        },
      ],
      cursor: "c2",
    });
    await flushEffects();

    assert.deepEqual(resolvedHandles.get("late.test"), "did:plc:late");
  });
});

describe("chat precaching", () => {
  it("should cache convo members", async () => {
    const { dataStore, dataLayer, identityResolver, resolvedHandles } = setup();
    setUpIdentityPrecaching(dataLayer, identityResolver);

    dataStore.$convos.set("convo1", {
      id: "convo1",
      members: [{ handle: "chatter.test", did: "did:plc:chatter" }],
    });
    dataStore.$convoMemberLists.set("convo2", {
      members: [{ handle: "groupie.test", did: "did:plc:groupie" }],
      cursor: null,
    });
    await flushEffects();

    assert.deepEqual(resolvedHandles.get("chatter.test"), "did:plc:chatter");
    assert.deepEqual(resolvedHandles.get("groupie.test"), "did:plc:groupie");
  });

  it("should cache join link preview owners", async () => {
    const { dataStore, dataLayer, identityResolver, resolvedHandles } = setup();
    setUpIdentityPrecaching(dataLayer, identityResolver);

    dataStore.$joinLinkPreviewsByCode.set("code1", {
      code: "code1",
      owner: { handle: "host.test", did: "did:plc:host" },
    });
    await flushEffects();

    assert.deepEqual(resolvedHandles.get("host.test"), "did:plc:host");
  });
});

describe("post precaching", () => {
  it("should cache identities for posts normalized from nested quotes", async () => {
    const { dataStore, dataLayer, identityResolver, resolvedHandles } = setup();
    setUpIdentityPrecaching(dataLayer, identityResolver);

    const nestedQuote = {
      $type: "app.bsky.embed.record#viewRecord",
      uri: "at://did:plc:nested/app.bsky.feed.post/1",
      author: { handle: "nested.test", did: "did:plc:nested" },
      value: { text: "nested quote" },
    };
    const quote = {
      $type: "app.bsky.embed.record#viewRecord",
      uri: "at://did:plc:quote/app.bsky.feed.post/1",
      author: { handle: "quote.test", did: "did:plc:quote" },
      value: { text: "quote" },
      embeds: [
        {
          $type: "app.bsky.embed.record#view",
          record: nestedQuote,
        },
      ],
    };

    dataStore.setPosts([
      {
        uri: "at://did:plc:root/app.bsky.feed.post/1",
        author: { handle: "root.test", did: "did:plc:root" },
        record: { text: "root" },
        embed: {
          $type: "app.bsky.embed.record#view",
          record: quote,
        },
      },
    ]);
    await flushEffects();

    assert.deepEqual(resolvedHandles.get("root.test"), "did:plc:root");
    assert.deepEqual(resolvedHandles.get("quote.test"), "did:plc:quote");
    assert.deepEqual(resolvedHandles.get("nested.test"), "did:plc:nested");
  });
});
