import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PluginBinaryCache } from "/js/plugins/pluginBinaryCache.js";

// A minimal Cache API stand-in, string-keyed throughout (unlike
// pluginCache.test.js's FakeCache, which models .delete(request) against a
// Request-like object — PluginBinaryCache always calls match/put/delete
// with the same plain URL string it builds itself, which the real Cache
// API accepts for all three).
class FakeCache {
  constructor() {
    this._store = new Map(); // url -> ArrayBuffer
  }
  async match(url) {
    const buffer = this._store.get(url);
    return buffer ? { arrayBuffer: async () => buffer } : undefined;
  }
  async put(url, response) {
    this._store.set(url, await response.arrayBuffer());
  }
  async delete(url) {
    return this._store.delete(url);
  }
  async keys(url) {
    const urls = [...this._store.keys()].filter(
      (stored) => url === undefined || stored === url,
    );
    return urls.map((stored) => ({ url: stored }));
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
  async delete(name) {
    return this._buckets.delete(name);
  }
  has(name) {
    return this._buckets.has(name);
  }
}

function stubCaches() {
  const fakeCaches = new FakeCaches();
  const original = globalThis.caches;
  globalThis.caches = fakeCaches;
  return {
    caches: fakeCaches,
    restore() {
      globalThis.caches = original;
    },
  };
}

describe("PluginBinaryCache", () => {
  it("returns null for a key that was never stored", async () => {
    const { restore } = stubCaches();
    try {
      const cache = new PluginBinaryCache();
      assert.deepEqual(await cache.get("plugin-a", "engine"), null);
    } finally {
      restore();
    }
  });

  it("round-trips arbitrary bytes exactly", async () => {
    const { restore } = stubCaches();
    try {
      const cache = new PluginBinaryCache();
      const bytes = new Uint8Array([0, 1, 2, 255, 254, 128]).buffer;
      await cache.put("plugin-a", "engine", bytes);
      const got = new Uint8Array(await cache.get("plugin-a", "engine"));
      assert.deepEqual([...got], [0, 1, 2, 255, 254, 128]);
    } finally {
      restore();
    }
  });

  it("isolates entries between plugin ids", async () => {
    const { restore } = stubCaches();
    try {
      const cache = new PluginBinaryCache();
      await cache.put("plugin-a", "k", new Uint8Array([1]).buffer);
      await cache.put("plugin-b", "k", new Uint8Array([2]).buffer);
      const a = new Uint8Array(await cache.get("plugin-a", "k"));
      const b = new Uint8Array(await cache.get("plugin-b", "k"));
      assert.deepEqual([...a], [1]);
      assert.deepEqual([...b], [2]);
    } finally {
      restore();
    }
  });

  it("delete removes a single entry", async () => {
    const { restore } = stubCaches();
    try {
      const cache = new PluginBinaryCache();
      await cache.put("plugin-a", "k1", new Uint8Array([1]).buffer);
      await cache.put("plugin-a", "k2", new Uint8Array([2]).buffer);
      await cache.delete("plugin-a", "k1");
      assert.deepEqual(await cache.get("plugin-a", "k1"), null);
      assert.notDeepEqual(await cache.get("plugin-a", "k2"), null);
    } finally {
      restore();
    }
  });

  it("has reports presence without reading the body", async () => {
    const { restore } = stubCaches();
    try {
      const cache = new PluginBinaryCache();
      await cache.put("plugin-a", "k1", new Uint8Array([1]).buffer);
      assert.deepEqual(await cache.has("plugin-a", "k1"), true);
      assert.deepEqual(await cache.has("plugin-a", "k2"), false);
      assert.deepEqual(await cache.has("plugin-b", "k1"), false);
    } finally {
      restore();
    }
  });

  it("keys lists a plugin's stored keys, decoded and isolated", async () => {
    const { restore } = stubCaches();
    try {
      const cache = new PluginBinaryCache();
      await cache.put(
        "plugin-a",
        "models/en de.bin",
        new Uint8Array([1]).buffer,
      );
      await cache.put("plugin-a", "k2", new Uint8Array([2]).buffer);
      await cache.put("plugin-b", "other", new Uint8Array([3]).buffer);
      assert.deepEqual((await cache.keys("plugin-a")).sort(), [
        "k2",
        "models/en de.bin",
      ]);
      assert.deepEqual(await cache.keys("plugin-b"), ["other"]);
      assert.deepEqual(await cache.keys("plugin-c"), []);
    } finally {
      restore();
    }
  });

  it("clear drops every entry for a plugin in one call", async () => {
    const { caches, restore } = stubCaches();
    try {
      const cache = new PluginBinaryCache();
      await cache.put("plugin-a", "k1", new Uint8Array([1]).buffer);
      await cache.put("plugin-a", "k2", new Uint8Array([2]).buffer);
      await cache.clear("plugin-a");
      assert.deepEqual(caches.has("plugin-binary-cache:plugin-a"), false);
      assert.deepEqual(await cache.get("plugin-a", "k1"), null);
    } finally {
      restore();
    }
  });
});
