import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  RemotePluginRegistry,
  LocalPluginRegistry,
} from "/js/plugins/pluginRegistry.js";

const REGISTRY_URL = "https://example.test/registry.json";
const LOCAL_INDEX_URL = "/plugins-local/index.json";

const SAMPLE = [
  {
    id: "alpha",
    name: "Alpha",
    author: "ow",
    description: "the first",
    repo: "ow/alpha",
  },
  {
    id: "beta",
    name: "Beta",
    author: "ow",
    description: "the second",
    repo: "ow/beta",
  },
];

// Installs a stub for the global `fetch` (used by LocalPluginRegistry) and
// `window.fetch` (used by RemotePluginRegistry's default fetcher). Returns
// `{ calls, restore }` so tests can inspect requests and clean up.
function stubFetch(payloadsByUrl) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (!(url in payloadsByUrl)) return { ok: false, status: 404 };
    const payload = payloadsByUrl[url];
    return {
      ok: true,
      status: 200,
      async json() {
        return payload;
      },
    };
  };
  const originalGlobal = globalThis.fetch;
  const originalWindow = globalThis.window.fetch;
  globalThis.fetch = fetchImpl;
  globalThis.window.fetch = fetchImpl;
  const restore = () => {
    globalThis.fetch = originalGlobal;
    globalThis.window.fetch = originalWindow;
  };
  return { calls, restore };
}

describe("RemotePluginRegistry.getListings", () => {
  let stub;
  afterEach(() => stub?.restore());

  it("returns the remote listings", async () => {
    stub = stubFetch({ [REGISTRY_URL]: SAMPLE });
    const registry = new RemotePluginRegistry(REGISTRY_URL);
    const listings = await registry.getListings();
    assert.deepEqual(listings, SAMPLE);
  });

  it("caches listings within TTL", async () => {
    stub = stubFetch({ [REGISTRY_URL]: SAMPLE });
    const registry = new RemotePluginRegistry(REGISTRY_URL);
    await registry.getListings();
    await registry.getListings();
    assert.deepEqual(stub.calls.length, 1);
  });

  it("throws when the remote responds with an error status", async () => {
    stub = stubFetch({});
    const registry = new RemotePluginRegistry(REGISTRY_URL);
    let caught = null;
    try {
      await registry.getListings();
    } catch (error) {
      caught = error;
    }
    assert.deepEqual(caught?.message, "registry HTTP 404");
  });
});

describe("RemotePluginRegistry.getListing", () => {
  let stub;
  afterEach(() => stub?.restore());

  it("returns the listing matching the id", async () => {
    stub = stubFetch({ [REGISTRY_URL]: SAMPLE });
    const registry = new RemotePluginRegistry(REGISTRY_URL);
    const listing = await registry.getListing("beta");
    assert.deepEqual(listing.repo, "ow/beta");
  });

  it("returns null when id is not in the registry", async () => {
    stub = stubFetch({ [REGISTRY_URL]: SAMPLE });
    const registry = new RemotePluginRegistry(REGISTRY_URL);
    assert.deepEqual(await registry.getListing("missing"), null);
  });
});

describe("LocalPluginRegistry", () => {
  let stub;
  afterEach(() => stub?.restore());

  const LOCAL_SAMPLE = [
    { id: "gamma", name: "Gamma", author: "me", description: "local" },
  ];

  it("returns listings from the local index", async () => {
    stub = stubFetch({ [LOCAL_INDEX_URL]: LOCAL_SAMPLE });
    const registry = new LocalPluginRegistry();
    assert.deepEqual(await registry.getListings(), LOCAL_SAMPLE);
    assert.deepEqual(stub.calls, [LOCAL_INDEX_URL]);
  });

  it("getListing returns the matching listing", async () => {
    stub = stubFetch({ [LOCAL_INDEX_URL]: LOCAL_SAMPLE });
    const registry = new LocalPluginRegistry();
    const listing = await registry.getListing("gamma");
    assert.deepEqual(listing.name, "Gamma");
  });

  it("getListing returns null when id is missing", async () => {
    stub = stubFetch({ [LOCAL_INDEX_URL]: LOCAL_SAMPLE });
    const registry = new LocalPluginRegistry();
    assert.deepEqual(await registry.getListing("missing"), null);
  });

  it("throws when the local index is not available", async () => {
    stub = stubFetch({});
    const registry = new LocalPluginRegistry();
    let caught = null;
    try {
      await registry.getListings();
    } catch (error) {
      caught = error;
    }
    assert.deepEqual(caught?.message, "local registry HTTP 404");
  });
});
