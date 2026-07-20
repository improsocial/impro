import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { SourceProvider } from "/js/plugins/sourceProvider.js";

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    async json() {
      return body;
    },
    async text() {
      return typeof body === "string" ? body : JSON.stringify(body);
    },
  };
}

// Installs a stub for `fetch` (used by SourceProvider for local plugins) on
// both globalThis and window. Returns `{ calls, restore }`.
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

function fakePluginCache(handler) {
  const calls = [];
  return {
    calls,
    async fetch(url, options) {
      calls.push({ url, options });
      return handler(url);
    },
  };
}

describe("SourceProvider with local plugins", () => {
  let stub;
  afterEach(() => stub?.restore());

  it("fetches local manifest from /plugins-local/ and appends __LOCAL", async () => {
    stub = stubFetch(async () =>
      jsonResponse({ id: "alpha", name: "Alpha", version: "1.0.0" }),
    );
    const provider = new SourceProvider(null);
    const manifest = await provider.getManifest("alpha__LOCAL");
    assert.deepEqual(
      stub.calls[0].url,
      "/plugins-local/alpha__LOCAL/manifest.json",
    );
    assert.deepEqual(manifest.id, "alpha__LOCAL");
    assert.deepEqual(manifest.version, "1.0.0");
  });

  it("fetches local source from /plugins-local/", async () => {
    stub = stubFetch(async () => jsonResponse("alert(1)"));
    const provider = new SourceProvider(null);
    const source = await provider.getSource("alpha__LOCAL");
    assert.deepEqual(stub.calls[0].url, "/plugins-local/alpha__LOCAL/main.js");
    assert.deepEqual(source, "alert(1)");
  });

  it("rejects local manifest with mismatched id", async () => {
    stub = stubFetch(async () =>
      jsonResponse({ id: "different", name: "A", version: "1.0.0" }),
    );
    const provider = new SourceProvider(null);
    let caught = null;
    try {
      await provider.getManifest("alpha__LOCAL");
    } catch (error) {
      caught = error;
    }
    assert(caught?.message.includes("does not match"));
  });

  it("throws when local manifest is missing required fields", async () => {
    stub = stubFetch(async () => jsonResponse({ id: "alpha", name: "A" }));
    const provider = new SourceProvider(null);
    let caught = null;
    try {
      await provider.getManifest("alpha__LOCAL");
    } catch (error) {
      caught = error;
    }
    assert(caught?.message.includes("version"));
  });

  it("throws when local manifest fetch fails", async () => {
    stub = stubFetch(async () => ({ ok: false, status: 404 }));
    const provider = new SourceProvider(null);
    let caught = null;
    try {
      await provider.getManifest("alpha__LOCAL");
    } catch (error) {
      caught = error;
    }
    assert.deepEqual(caught?.message, "HTTP 404");
  });

  it("getCacheUrls returns empty for local plugins", async () => {
    const provider = new SourceProvider(null);
    assert.deepEqual(await provider.getCacheUrls("alpha__LOCAL"), []);
  });

  it("getStyles returns local styles.css text", async () => {
    stub = stubFetch(async () => ({
      ok: true,
      status: 200,
      async text() {
        return "body{color:red}";
      },
    }));
    const provider = new SourceProvider(null);
    const styles = await provider.getStyles("alpha__LOCAL");
    assert.deepEqual(
      stub.calls[0].url,
      "/plugins-local/alpha__LOCAL/styles.css",
    );
    assert.deepEqual(styles, "body{color:red}");
  });

  it("getStyles returns null when local styles.css is missing", async () => {
    stub = stubFetch(async () => ({ ok: false, status: 404 }));
    const provider = new SourceProvider(null);
    const styles = await provider.getStyles("alpha__LOCAL");
    assert.deepEqual(styles, null);
  });

  it("getLiveManifest delegates to getManifest for local plugins", async () => {
    stub = stubFetch(async () =>
      jsonResponse({ id: "alpha", name: "Alpha", version: "9.9.9" }),
    );
    const provider = new SourceProvider(null);
    const manifest = await provider.getLiveManifest("alpha__LOCAL");
    assert.deepEqual(manifest.version, "9.9.9");
    assert.deepEqual(manifest.id, "alpha__LOCAL");
  });
});

describe("SourceProvider with remote plugins", () => {
  it("fetches manifest from versioned release URL via plugin cache", async () => {
    const pluginCache = fakePluginCache(async () =>
      jsonResponse({ id: "alpha", name: "A", version: "1.0.0" }),
    );
    const provider = new SourceProvider(pluginCache);
    const manifest = await provider.getManifest("alpha", "1.0.0", "ow/alpha");
    assert.deepEqual(
      pluginCache.calls[0].url,
      "https://raw.githubusercontent.com/ow/alpha/refs/tags/1.0.0/manifest.json",
    );
    assert.deepEqual(manifest.id, "alpha");
  });

  it("fetches source from the version that was passed in", async () => {
    const pluginCache = fakePluginCache(async () => ({
      ok: true,
      status: 200,
      async text() {
        return "alert(1)";
      },
    }));
    const provider = new SourceProvider(pluginCache);
    const source = await provider.getSource("alpha", "2.5.0", "ow/alpha");
    assert.deepEqual(
      pluginCache.calls[0].url,
      "https://raw.githubusercontent.com/ow/alpha/refs/tags/2.5.0/main.js",
    );
    assert.deepEqual(source, "alert(1)");
  });

  it("throws when version or repo is omitted for a remote plugin", async () => {
    const provider = new SourceProvider(fakePluginCache(async () => null));
    let caught = null;
    try {
      await provider.getManifest("alpha");
    } catch (error) {
      caught = error;
    }
    assert(caught?.message.includes("Version and repo are required"));

    caught = null;
    try {
      await provider.getSource("alpha", "1.0.0");
    } catch (error) {
      caught = error;
    }
    assert(caught?.message.includes("Version and repo are required"));
  });

  it("rejects remote manifest with mismatched id", async () => {
    const pluginCache = fakePluginCache(async () =>
      jsonResponse({ id: "different", name: "A", version: "1.0.0" }),
    );
    const provider = new SourceProvider(pluginCache);
    let caught = null;
    try {
      await provider.getManifest("alpha", "1.0.0", "ow/alpha");
    } catch (error) {
      caught = error;
    }
    assert(caught?.message.includes("does not match"));
  });

  it("getCacheUrls includes manifest, main.js, and styles.css URLs", async () => {
    const provider = new SourceProvider(null);
    const urls = await provider.getCacheUrls("alpha", "1.2.3", "ow/alpha");
    assert.deepEqual(urls, [
      "https://raw.githubusercontent.com/ow/alpha/refs/tags/1.2.3/manifest.json",
      "https://raw.githubusercontent.com/ow/alpha/refs/tags/1.2.3/main.js",
      "https://raw.githubusercontent.com/ow/alpha/refs/tags/1.2.3/styles.css",
    ]);
  });

  it("getStyles fetches styles.css for remote plugins via the cache", async () => {
    const pluginCache = fakePluginCache(async () => ({
      ok: true,
      status: 200,
      async text() {
        return "body{color:blue}";
      },
    }));
    const provider = new SourceProvider(pluginCache);
    const styles = await provider.getStyles("alpha", "1.0.0", "ow/alpha");
    assert.deepEqual(
      pluginCache.calls[0].url,
      "https://raw.githubusercontent.com/ow/alpha/refs/tags/1.0.0/styles.css",
    );
    assert.deepEqual(pluginCache.calls[0].options, { doCacheNotFound: true });
    assert.deepEqual(styles, "body{color:blue}");
  });

  it("getLiveManifest fetches from githubusercontent main branch", async () => {
    const stub = stubFetch(async () =>
      jsonResponse({ id: "alpha", name: "A", version: "9.9.9" }),
    );
    try {
      const provider = new SourceProvider(null);
      const manifest = await provider.getLiveManifest("alpha", "ow/alpha");
      assert.deepEqual(
        stub.calls[0].url,
        "https://raw.githubusercontent.com/ow/alpha/refs/heads/main/manifest.json",
      );
      assert.deepEqual(stub.calls[0].options?.cache, "no-store");
      assert.deepEqual(manifest.version, "9.9.9");
    } finally {
      stub.restore();
    }
  });

  it("getLiveManifestFromRepo fetches from githubusercontent main branch", async () => {
    const stub = stubFetch(async () =>
      jsonResponse({ id: "alpha", name: "A", version: "1.0.0" }),
    );
    try {
      const provider = new SourceProvider(null);
      const manifest = await provider.getLiveManifestFromRepo("ow/alpha");
      assert.deepEqual(
        stub.calls[0].url,
        "https://raw.githubusercontent.com/ow/alpha/refs/heads/main/manifest.json",
      );
      assert.deepEqual(manifest.id, "alpha");
    } finally {
      stub.restore();
    }
  });

  it("getStyles returns null when remote styles.css 404s", async () => {
    const pluginCache = fakePluginCache(async () => {
      const error = new Error(
        "HTTP 404 https://raw.githubusercontent.com/ow/alpha/refs/tags/1.0.0/styles.css",
      );
      error.status = 404;
      throw error;
    });
    const provider = new SourceProvider(pluginCache);
    const styles = await provider.getStyles("alpha", "1.0.0", "ow/alpha");
    assert.deepEqual(styles, null);
  });
});

describe("SourceProvider with tangled.sh-hosted plugins", () => {
  it("fetches a versioned manifest from tangled.org via plugin cache", async () => {
    const pluginCache = fakePluginCache(async () =>
      jsonResponse({ id: "alpha", name: "A", version: "1.0.0" }),
    );
    const provider = new SourceProvider(pluginCache);
    const manifest = await provider.getManifest(
      "alpha",
      "1.0.0",
      "tangled:ow/alpha",
    );
    assert.deepEqual(
      pluginCache.calls[0].url,
      "https://tangled.org/ow/alpha/raw/1.0.0/manifest.json",
    );
    assert.deepEqual(manifest.id, "alpha");
  });

  it("fetches source from the version that was passed in", async () => {
    const pluginCache = fakePluginCache(async () => ({
      ok: true,
      status: 200,
      async text() {
        return "alert(1)";
      },
    }));
    const provider = new SourceProvider(pluginCache);
    const source = await provider.getSource(
      "alpha",
      "2.5.0",
      "tangled:ow/alpha",
    );
    assert.deepEqual(
      pluginCache.calls[0].url,
      "https://tangled.org/ow/alpha/raw/2.5.0/main.js",
    );
    assert.deepEqual(source, "alert(1)");
  });

  it("getLiveManifest fetches from the main branch", async () => {
    const stub = stubFetch(async () =>
      jsonResponse({ id: "alpha", name: "A", version: "9.9.9" }),
    );
    try {
      const provider = new SourceProvider(null);
      const manifest = await provider.getLiveManifest(
        "alpha",
        "tangled:ow/alpha",
      );
      assert.deepEqual(
        stub.calls[0].url,
        "https://tangled.org/ow/alpha/raw/main/manifest.json",
      );
      assert.deepEqual(manifest.version, "9.9.9");
    } finally {
      stub.restore();
    }
  });

  it("getCacheUrls includes manifest, main.js, and styles.css URLs", async () => {
    const provider = new SourceProvider(null);
    const urls = await provider.getCacheUrls(
      "alpha",
      "1.2.3",
      "tangled:ow/alpha",
    );
    assert.deepEqual(urls, [
      "https://tangled.org/ow/alpha/raw/1.2.3/manifest.json",
      "https://tangled.org/ow/alpha/raw/1.2.3/main.js",
      "https://tangled.org/ow/alpha/raw/1.2.3/styles.css",
    ]);
  });

  it("throws for an unrecognized repo host prefix", async () => {
    const provider = new SourceProvider(fakePluginCache(async () => null));
    let caught = null;
    try {
      await provider.getManifest("alpha", "1.0.0", "gitlab:ow/alpha");
    } catch (error) {
      caught = error;
    }
    assert(caught?.message.includes('Unsupported plugin repo host "gitlab"'));
  });
});
