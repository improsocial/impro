import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PluginDataProvider } from "/js/plugins/pluginDataProvider.js";

function makeStubBridge() {
  const handlers = new Map();
  return {
    addHostMethod: (name, handler) => handlers.set(name, handler),
    handlers,
  };
}

function makeStubComputedMap(lookup) {
  const calls = [];
  const map = {
    get: (key) => {
      calls.push(key);
      return lookup(key);
    },
  };
  return { map, calls };
}

function makeDataProvider({
  dataLayer = {},
  pluginRequests = null,
  slingshot = null,
  constellation = null,
  session = { did: "did:plc:me", handle: "me.test" },
} = {}) {
  const provider = new PluginDataProvider({
    dataLayer,
    pluginRequests,
    slingshot,
    constellation,
    session,
  });
  const bridge = makeStubBridge();
  provider.registerHostMethods(bridge);
  return { provider, handlers: bridge.handlers };
}

describe("app.data host methods", () => {
  it("getProfile returns the hydrated profile from derived", async () => {
    const profiles = makeStubComputedMap((did) => ({
      did,
      handle: "alice.test",
    }));
    const { handlers } = makeDataProvider({
      dataLayer: { derived: { $hydratedProfiles: profiles.map } },
    });
    const result = await handlers.get("getProfile")(null, {
      did: "did:plc:abc",
    });
    assert.deepEqual(profiles.calls, ["did:plc:abc"]);
    assert.deepEqual(result, { did: "did:plc:abc", handle: "alice.test" });
  });

  it("getProfile fetches on a cache miss and returns the basic hydrated profile", async () => {
    let loaded = false;
    const profiles = makeStubComputedMap((did) =>
      loaded ? { did, handle: "alice.test" } : null,
    );
    const ensureCalls = [];
    const { handlers } = makeDataProvider({
      dataLayer: {
        derived: { $hydratedProfiles: profiles.map },
        declarative: {
          ensureDetailedProfile: async (did) => {
            ensureCalls.push(did);
            loaded = true;
          },
        },
      },
    });
    const result = await handlers.get("getProfile")(null, {
      did: "did:plc:abc",
    });
    assert.deepEqual(ensureCalls, ["did:plc:abc"]);
    assert.deepEqual(result, { did: "did:plc:abc", handle: "alice.test" });
  });

  it("getProfile returns null when the profile cannot be loaded", async () => {
    const { handlers } = makeDataProvider({
      dataLayer: {
        derived: { $hydratedProfiles: makeStubComputedMap(() => null).map },
        declarative: {
          ensureDetailedProfile: async () => {
            throw new Error("Profile not found");
          },
        },
      },
    });
    const result = await handlers.get("getProfile")(null, {
      did: "did:plc:missing",
    });
    assert.deepEqual(result, null);
  });

  it("getPost fetches the post on a cache miss", async () => {
    const ensureCalls = [];
    const { handlers } = makeDataProvider({
      dataLayer: {
        declarative: {
          ensurePost: async (uri) => {
            ensureCalls.push(uri);
            return { uri, record: { text: "fetched" } };
          },
        },
      },
    });
    const result = await handlers.get("getPost")(null, {
      uri: "at://example/post/1",
    });
    assert.deepEqual(ensureCalls, ["at://example/post/1"]);
    assert.deepEqual(result, {
      uri: "at://example/post/1",
      record: { text: "fetched" },
    });
  });

  it("getPost returns null when the post cannot be loaded", async () => {
    const { handlers } = makeDataProvider({
      dataLayer: {
        declarative: {
          ensurePost: async () => {
            throw new Error("Post not found");
          },
        },
      },
    });
    const result = await handlers.get("getPost")(null, {
      uri: "at://example/post/gone",
    });
    assert.deepEqual(result, null);
  });

  it("getKnownFollowers resolves via the declarative layer", async () => {
    const knownFollowers = { followers: [{ did: "did:plc:follower" }] };
    const ensureCalls = [];
    const { handlers } = makeDataProvider({
      dataLayer: {
        declarative: {
          ensureKnownFollowers: async (did) => {
            ensureCalls.push(did);
            return knownFollowers;
          },
        },
      },
    });
    const result = await handlers.get("getKnownFollowers")(null, {
      did: "did:plc:abc",
    });
    assert.deepEqual(ensureCalls, ["did:plc:abc"]);
    assert.deepEqual(result, knownFollowers);
  });

  it("getKnownFollowers returns null when the list cannot be loaded", async () => {
    const { handlers } = makeDataProvider({
      dataLayer: {
        declarative: {
          ensureKnownFollowers: async () => {
            throw new Error("Known followers not found");
          },
        },
      },
    });
    const result = await handlers.get("getKnownFollowers")(null, {
      did: "did:plc:missing",
    });
    assert.deepEqual(result, null);
  });

  // The remaining ensure-backed read methods share one shape: resolve via
  // the declarative layer, null on failure.
  const ensureBackedMethods = [
    {
      method: "getPostThread",
      ensure: "ensurePostThread",
      arg: { uri: "at://example/post/1" },
      expectedKey: "at://example/post/1",
    },
    {
      method: "getDetailedProfile",
      ensure: "ensureDetailedProfile",
      arg: { did: "did:plc:abc" },
      expectedKey: "did:plc:abc",
    },
    {
      method: "getList",
      ensure: "ensureList",
      arg: { uri: "at://example/list/1" },
      expectedKey: "at://example/list/1",
    },
    {
      method: "getFeedGenerator",
      ensure: "ensureFeedGenerator",
      arg: { uri: "at://example/feed/1" },
      expectedKey: "at://example/feed/1",
    },
  ];

  for (const methodCase of ensureBackedMethods) {
    it(`${methodCase.method} resolves via the declarative layer`, async () => {
      const value = { data: methodCase.method };
      const ensureCalls = [];
      const { handlers } = makeDataProvider({
        dataLayer: {
          declarative: {
            [methodCase.ensure]: async (key) => {
              ensureCalls.push(key);
              return value;
            },
          },
        },
      });
      const result = await handlers.get(methodCase.method)(
        null,
        methodCase.arg,
      );
      assert.deepEqual(ensureCalls, [methodCase.expectedKey]);
      assert.deepEqual(result, value);
    });

    it(`${methodCase.method} returns null when the data cannot be loaded`, async () => {
      const { handlers } = makeDataProvider({
        dataLayer: {
          declarative: {
            [methodCase.ensure]: async () => {
              throw new Error("not found");
            },
          },
        },
      });
      const result = await handlers.get(methodCase.method)(
        null,
        methodCase.arg,
      );
      assert.deepEqual(result, null);
    });
  }

  it("getCurrentUser returns the session identity, or null signed out", async () => {
    const { handlers } = makeDataProvider();
    assert.deepEqual(await handlers.get("getCurrentUser")(null, {}), {
      did: "did:plc:me",
      handle: "me.test",
    });

    const signedOut = makeDataProvider({ session: null });
    assert.deepEqual(
      await signedOut.handlers.get("getCurrentUser")(null, {}),
      null,
    );
  });

  it("getCurrentUserProfile returns the full current user when signed in", async () => {
    const currentUser = {
      did: "did:plc:me",
      handle: "me.test",
      displayName: "Me",
    };
    const { handlers } = makeDataProvider({
      dataLayer: {
        declarative: { ensureCurrentUser: async () => currentUser },
      },
    });
    assert.deepEqual(
      await handlers.get("getCurrentUserProfile")(null, {}),
      currentUser,
    );
  });

  it("getCurrentUserProfile returns null when signed out", async () => {
    let ensureCalled = false;
    const { handlers } = makeDataProvider({
      session: null,
      dataLayer: {
        declarative: {
          ensureCurrentUser: async () => {
            ensureCalled = true;
          },
        },
      },
    });
    assert.deepEqual(
      await handlers.get("getCurrentUserProfile")(null, {}),
      null,
    );
    assert.deepEqual(ensureCalled, false);
  });

  it("getBacklinks validates the limit before querying", async () => {
    const linkCalls = [];
    const { handlers } = makeDataProvider({
      constellation: {
        getLinks: async (query) => {
          linkCalls.push(query);
          return [];
        },
      },
    });
    const handler = handlers.get("getBacklinks");
    await assert.rejects(
      async () =>
        handler(null, { subject: "did:plc:abc", source: "a:b", limit: 0 }),
      /invalid limit/,
    );
    await assert.rejects(
      async () =>
        handler(null, { subject: "did:plc:abc", source: "a:b", limit: 1001 }),
      /invalid limit/,
    );
    assert.deepEqual(linkCalls, []);
    await handler(null, { subject: "did:plc:abc", source: "a:b", limit: 10 });
    assert.deepEqual(linkCalls, [
      { subject: "did:plc:abc", source: "a:b", limit: 10 },
    ]);
  });
});

describe("xrpcQuery host method", () => {
  const queryPlugin = { pluginId: "test-plugin" };

  function makeXrpcProvider() {
    const xrpcCalls = [];
    const { handlers } = makeDataProvider({
      pluginRequests: {
        pluginXrpcRequest: async (plugin, nsid, params) => {
          xrpcCalls.push({ plugin, nsid, params });
          return { ok: true, status: 200, data: {} };
        },
      },
    });
    return { handler: handlers.get("xrpcQuery"), xrpcCalls };
  }

  it("delegates to pluginXrpcRequest with the calling plugin", async () => {
    const { handler, xrpcCalls } = makeXrpcProvider();
    const result = await handler(queryPlugin, {
      nsid: "app.bsky.feed.getQuotes",
      params: { uri: "at://example/post/1", limit: 25 },
    });
    assert.deepEqual(result, { ok: true, status: 200, data: {} });
    assert.deepEqual(xrpcCalls, [
      {
        plugin: queryPlugin,
        nsid: "app.bsky.feed.getQuotes",
        params: { uri: "at://example/post/1", limit: 25 },
      },
    ]);
  });

  it("requires an nsid", async () => {
    const { handler, xrpcCalls } = makeXrpcProvider();
    await assert.rejects(
      async () => handler(queryPlugin, { params: {} }),
      /requires a nsid/,
    );
    assert.deepEqual(xrpcCalls, []);
  });
});

describe("host method argument guards", () => {
  // Guards run before the catch-to-null wrapping, so a missing argument is
  // a loud rejection rather than a silent null.
  const guardCases = [
    { method: "getPost", payload: {}, message: /getPost requires a uri/ },
    { method: "getProfile", payload: {}, message: /getProfile requires a did/ },
    {
      method: "getDetailedProfile",
      payload: {},
      message: /getDetailedProfile requires a did/,
    },
    {
      method: "getKnownFollowers",
      payload: {},
      message: /getKnownFollowers requires a did/,
    },
    {
      method: "getPostThread",
      payload: {},
      message: /getPostThread requires a uri/,
    },
    { method: "getList", payload: {}, message: /getList requires a uri/ },
    {
      method: "getFeedGenerator",
      payload: {},
      message: /getFeedGenerator requires a uri/,
    },
    {
      method: "getRecord",
      payload: { collection: "app.bsky.feed.post", rkey: "1" },
      message: /getRecord requires a repo/,
    },
    {
      method: "getRecord",
      payload: { repo: "did:plc:abc", rkey: "1" },
      message: /getRecord requires a collection/,
    },
    {
      method: "getRecord",
      payload: { repo: "did:plc:abc", collection: "app.bsky.feed.post" },
      message: /getRecord requires a rkey/,
    },
    {
      method: "getBacklinks",
      payload: { source: "a:b", limit: 10 },
      message: /getBacklinks requires a subject/,
    },
    {
      method: "getBacklinks",
      payload: { subject: "did:plc:abc", limit: 10 },
      message: /getBacklinks requires a source/,
    },
  ];

  for (const guardCase of guardCases) {
    it(`${guardCase.method} rejects ${guardCase.message.source}`, async () => {
      const { handlers } = makeDataProvider();
      await assert.rejects(
        async () => handlers.get(guardCase.method)(null, guardCase.payload),
        guardCase.message,
      );
    });
  }
});
