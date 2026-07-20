import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { PluginCache } from "/js/plugins/pluginCache.js";

class FakeCache {
  constructor() {
    this._store = new Map(); // url -> Response
  }
  async match(url) {
    return this._store.get(url) ?? undefined;
  }
  async put(url, response) {
    this._store.set(url, response);
  }
  async keys() {
    return [...this._store.keys()].map((url) => ({ url }));
  }
  async delete(request) {
    return this._store.delete(request.url);
  }
}

class FakeCaches {
  constructor() {
    this._buckets = new Map();
  }
  async open(name) {
    if (!this._buckets.has(name)) this._buckets.set(name, new FakeCache());
    return this._buckets.get(name);
  }
}

function makeResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    _body: body,
    clone() {
      return makeResponse(body, { ok, status });
    },
    async text() {
      return body;
    },
    async json() {
      return JSON.parse(body);
    },
  };
}

// Installs a stub for `fetch` on globalThis and window. Returns
// `{ calls, restore }` so tests can inspect requests and clean up.
function stubFetch(handler) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return handler(url, options);
  };
  const originalGlobal = globalThis.fetch;
  const originalWindow = globalThis.window.fetch;
  globalThis.fetch = fetchImpl;
  globalThis.window.fetch = fetchImpl;
  return {
    calls,
    restore() {
      globalThis.fetch = originalGlobal;
      globalThis.window.fetch = originalWindow;
    },
  };
}

// Installs a fresh FakeCaches on globalThis and window. Returns the fake plus
// a restore function.
function stubCaches() {
  const fakeCaches = new FakeCaches();
  const originalGlobal = globalThis.caches;
  const originalWindow = globalThis.window.caches;
  globalThis.caches = fakeCaches;
  globalThis.window.caches = fakeCaches;
  return {
    caches: fakeCaches,
    restore() {
      globalThis.caches = originalGlobal;
      globalThis.window.caches = originalWindow;
    },
  };
}

describe("PluginCache.fetch", () => {
  let fetchStub;
  let cachesStub;
  beforeEach(() => {
    cachesStub = stubCaches();
  });
  afterEach(() => {
    fetchStub?.restore();
    cachesStub.restore();
  });

  it("fetches on miss and stores in cache", async () => {
    fetchStub = stubFetch(async () => makeResponse("hello"));
    const cache = new PluginCache();
    const response = await cache.fetch("https://example.test/a.js");
    assert.deepEqual(await response.text(), "hello");
    assert.deepEqual(fetchStub.calls.length, 1);
    const bucket = await cachesStub.caches.open("plugins-v1");
    assert(await bucket.match("https://example.test/a.js"));
  });

  it("reuses cached response on hit", async () => {
    fetchStub = stubFetch(async () => makeResponse("hello"));
    const cache = new PluginCache();
    await cache.fetch("https://example.test/a.js");
    await cache.fetch("https://example.test/a.js");
    assert.deepEqual(fetchStub.calls.length, 1);
  });

  it("throws on non-OK responses and does not cache them", async () => {
    fetchStub = stubFetch(async () =>
      makeResponse("nope", { ok: false, status: 404 }),
    );
    const cache = new PluginCache();
    let threw = false;
    try {
      await cache.fetch("https://example.test/missing.js");
    } catch (error) {
      threw = true;
      assert(error.message.includes("404"));
    }
    assert(threw);
    const bucket = await cachesStub.caches.open("plugins-v1");
    assert.deepEqual((await bucket.keys()).length, 0);
  });

  it("caches 404s with doCacheNotFound and skips refetching them", async () => {
    fetchStub = stubFetch(async () =>
      makeResponse("nope", { ok: false, status: 404 }),
    );
    const cache = new PluginCache();
    const url = "https://example.test/styles.css";
    await assert.rejects(cache.fetch(url, { doCacheNotFound: true }), /404/);
    const error = await cache
      .fetch(url, { doCacheNotFound: true })
      .then(null, (thrown) => thrown);
    assert.deepEqual(error.status, 404);
    assert.deepEqual(fetchStub.calls.length, 1);
  });

  it("caches errors a custom isNotFound predicate matches on the body", async () => {
    fetchStub = stubFetch(async () =>
      makeResponse("failed to get blob", { ok: false, status: 500 }),
    );
    const cache = new PluginCache();
    const url = "https://example.test/styles.css";
    const options = {
      doCacheNotFound: true,
      isNotFound: (status, body) =>
        status === 500 && body === "failed to get blob",
    };
    const error = await cache
      .fetch(url, options)
      .then(null, (thrown) => thrown);
    assert.deepEqual(error.status, 500);
    assert.deepEqual(error.body, "failed to get blob");
    await assert.rejects(cache.fetch(url, options), /500/);
    assert.deepEqual(fetchStub.calls.length, 1);
  });

  it("does not cache non-404 errors with the default isNotFound", async () => {
    fetchStub = stubFetch(async () =>
      makeResponse("boom", { ok: false, status: 500 }),
    );
    const cache = new PluginCache();
    const url = "https://example.test/styles.css";
    await assert.rejects(cache.fetch(url, { doCacheNotFound: true }), /500/);
    await assert.rejects(cache.fetch(url, { doCacheNotFound: true }), /500/);
    assert.deepEqual(fetchStub.calls.length, 2);
  });

  it("does not cache not-found responses without doCacheNotFound", async () => {
    fetchStub = stubFetch(async () =>
      makeResponse("nope", { ok: false, status: 404 }),
    );
    const cache = new PluginCache();
    const url = "https://example.test/styles.css";
    await assert.rejects(
      cache.fetch(url, { isNotFound: (status) => status === 404 }),
      /404/,
    );
    await assert.rejects(
      cache.fetch(url, { isNotFound: (status) => status === 404 }),
      /404/,
    );
    assert.deepEqual(fetchStub.calls.length, 2);
  });

  it("attaches the response body text to errors on non-OK responses", async () => {
    fetchStub = stubFetch(async () =>
      makeResponse(
        '{"error":"InternalServerError","message":"failed to get blob"}',
        {
          ok: false,
          status: 500,
        },
      ),
    );
    const cache = new PluginCache();
    const error = await cache
      .fetch("https://example.test/styles.css")
      .then(null, (thrown) => thrown);
    assert.deepEqual(error.status, 500);
    assert.deepEqual(
      error.body,
      '{"error":"InternalServerError","message":"failed to get blob"}',
    );
  });
});

describe("PluginCache.reconcile", () => {
  let cachesStub;
  beforeEach(() => {
    cachesStub = stubCaches();
  });
  afterEach(() => cachesStub.restore());

  it("deletes entries not in the wanted set", async () => {
    const bucket = await cachesStub.caches.open("plugins-v1");
    await bucket.put("https://x.test/keep.js", makeResponse("k"));
    await bucket.put("https://x.test/old.js", makeResponse("o"));
    const cache = new PluginCache();
    await cache.reconcile(["https://x.test/keep.js"]);
    const remaining = (await bucket.keys()).map((request) => request.url);
    assert.deepEqual(remaining, ["https://x.test/keep.js"]);
  });

  it("keeps wanted entries even if not all are present", async () => {
    const bucket = await cachesStub.caches.open("plugins-v1");
    await bucket.put("https://x.test/keep.js", makeResponse("k"));
    const cache = new PluginCache();
    await cache.reconcile([
      "https://x.test/keep.js",
      "https://x.test/not-yet-fetched.js",
    ]);
    const remaining = (await bucket.keys()).map((request) => request.url);
    assert.deepEqual(remaining, ["https://x.test/keep.js"]);
  });
});
