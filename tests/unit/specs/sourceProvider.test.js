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
    const { doCacheNotFound, isNotFound } = pluginCache.calls[0].options;
    assert.deepEqual(doCacheNotFound, true);
    assert.deepEqual(isNotFound(404, null), true);
    assert.deepEqual(isNotFound(500, "boom"), false);
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

  it("accepts an explicit github: prefix on the repo", async () => {
    const pluginCache = fakePluginCache(async () =>
      jsonResponse({ id: "alpha", name: "A", version: "1.0.0" }),
    );
    const provider = new SourceProvider(pluginCache);
    const manifest = await provider.getManifest(
      "alpha",
      "1.0.0",
      "github:ow/alpha",
    );
    assert.deepEqual(
      pluginCache.calls[0].url,
      "https://raw.githubusercontent.com/ow/alpha/refs/tags/1.0.0/manifest.json",
    );
    assert.deepEqual(manifest.id, "alpha");
  });

  it("getCacheUrls strips the github: prefix from URLs", async () => {
    const provider = new SourceProvider(null);
    const urls = await provider.getCacheUrls(
      "alpha",
      "1.2.3",
      "github:ow/alpha",
    );
    assert.deepEqual(urls, [
      "https://raw.githubusercontent.com/ow/alpha/refs/tags/1.2.3/manifest.json",
      "https://raw.githubusercontent.com/ow/alpha/refs/tags/1.2.3/main.js",
      "https://raw.githubusercontent.com/ow/alpha/refs/tags/1.2.3/styles.css",
    ]);
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

function woff2Bytes(extra = 8) {
  const bytes = new Uint8Array(4 + extra);
  bytes[0] = 0x77;
  bytes[1] = 0x4f;
  bytes[2] = 0x46;
  bytes[3] = 0x32;
  return bytes;
}

function woffBytes(extra = 8) {
  const bytes = new Uint8Array(4 + extra);
  bytes[0] = 0x77;
  bytes[1] = 0x4f;
  bytes[2] = 0x46;
  bytes[3] = 0x46;
  return bytes;
}

function fontResponse(bytes) {
  return {
    ok: true,
    status: 200,
    async arrayBuffer() {
      return bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      );
    },
  };
}

describe("parsePluginManifest fonts", () => {
  const base = { id: "alpha", name: "A", version: "1.0.0" };

  async function parseViaLocal(manifest) {
    const stub = stubFetch(async () => jsonResponse(manifest));
    try {
      return await new SourceProvider(null).getManifest("alpha__LOCAL");
    } finally {
      stub.restore();
    }
  }

  it("accepts a valid fonts array and preserves author fields", async () => {
    const manifest = await parseViaLocal({
      ...base,
      fonts: [
        { family: "MyFont", file: "fonts/myfont.woff2" },
        {
          family: "MyFont",
          file: "fonts/myfont-bold.woff2",
          weight: "700",
          style: "italic",
        },
      ],
    });
    assert.deepEqual(manifest.fonts, [
      { family: "MyFont", file: "fonts/myfont.woff2" },
      {
        family: "MyFont",
        file: "fonts/myfont-bold.woff2",
        weight: "700",
        style: "italic",
      },
    ]);
  });

  it("rejects fonts that is not an array", async () => {
    let caught = null;
    try {
      await parseViaLocal({ ...base, fonts: "nope" });
    } catch (error) {
      caught = error;
    }
    assert(caught?.message.includes("fonts must be an array"));
  });

  const bad = [
    [{ file: "fonts/f.woff2" }, `missing required field "family"`],
    [{ family: "F" }, `missing required field "file"`],
    [{ family: "F", file: "fonts/f.ttf" }, "must end in .woff2 or .woff"],
    [{ family: "F", file: "/abs.woff2" }, "must be a relative path"],
    [
      { family: "F", file: "https://evil.test/f.woff2" },
      "must be a relative path",
    ],
    [{ family: "F", file: "../escape.woff2" }, "must be a relative path"],
  ];
  for (const [entry, fragment] of bad) {
    it(`rejects ${JSON.stringify(entry)}`, async () => {
      let caught = null;
      try {
        await parseViaLocal({ ...base, fonts: [entry] });
      } catch (error) {
        caught = error;
      }
      assert(
        caught?.message.includes(fragment),
        `expected "${caught?.message}" to include "${fragment}"`,
      );
    });
  }
});

describe("SourceProvider.getFont", () => {
  it("returns a Blob for a valid remote woff2", async () => {
    const bytes = woff2Bytes();
    const pluginCache = fakePluginCache(async () => fontResponse(bytes));
    const provider = new SourceProvider(pluginCache);
    const blob = await provider.getFont(
      "alpha",
      "1.0.0",
      "ow/alpha",
      "fonts/f.woff2",
    );
    assert.deepEqual(
      pluginCache.calls[0].url,
      "https://raw.githubusercontent.com/ow/alpha/refs/tags/1.0.0/fonts/f.woff2",
    );
    assert(blob instanceof Blob);
    assert.deepEqual(blob.type, "font/woff2");
    assert.deepEqual(blob.size, bytes.byteLength);
  });

  it("returns a Blob for a valid local woff", async () => {
    const bytes = woffBytes();
    const stub = stubFetch(async () => fontResponse(bytes));
    try {
      const blob = await new SourceProvider(null).getFont(
        "alpha__LOCAL",
        null,
        null,
        "fonts/f.woff",
      );
      assert.deepEqual(
        stub.calls[0].url,
        "/plugins-local/alpha__LOCAL/fonts/f.woff",
      );
      assert.deepEqual(blob.type, "font/woff");
    } finally {
      stub.restore();
    }
  });

  it("rejects a woff2 filename whose bytes aren't a woff2", async () => {
    const notFont = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]);
    const pluginCache = fakePluginCache(async () => fontResponse(notFont));
    const provider = new SourceProvider(pluginCache);
    let caught = null;
    try {
      await provider.getFont("alpha", "1.0.0", "ow/alpha", "fonts/f.woff2");
    } catch (error) {
      caught = error;
    }
    assert(caught?.message.includes("invalid magic bytes"));
  });

  it("rejects a woff2 file whose bytes are a woff", async () => {
    const bytes = woffBytes();
    const pluginCache = fakePluginCache(async () => fontResponse(bytes));
    const provider = new SourceProvider(pluginCache);
    let caught = null;
    try {
      await provider.getFont("alpha", "1.0.0", "ow/alpha", "fonts/f.woff2");
    } catch (error) {
      caught = error;
    }
    assert(caught?.message.includes("invalid magic bytes"));
  });
});

describe("SourceProvider.getCacheUrls with fonts", () => {
  it("includes each declared font URL", async () => {
    const pluginCache = fakePluginCache(async () =>
      jsonResponse({
        id: "alpha",
        name: "A",
        version: "1.2.3",
        fonts: [
          { family: "F", file: "fonts/a.woff2" },
          { family: "F", file: "fonts/b.woff2", weight: "700" },
        ],
      }),
    );
    const provider = new SourceProvider(pluginCache);
    const urls = await provider.getCacheUrls("alpha", "1.2.3", "ow/alpha");
    assert.deepEqual(urls, [
      "https://raw.githubusercontent.com/ow/alpha/refs/tags/1.2.3/manifest.json",
      "https://raw.githubusercontent.com/ow/alpha/refs/tags/1.2.3/main.js",
      "https://raw.githubusercontent.com/ow/alpha/refs/tags/1.2.3/styles.css",
      "https://raw.githubusercontent.com/ow/alpha/refs/tags/1.2.3/fonts/a.woff2",
      "https://raw.githubusercontent.com/ow/alpha/refs/tags/1.2.3/fonts/b.woff2",
    ]);
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

  // tangled.sh's blob backend returns 500 (not 404) for a missing file, so
  // "optional file absent" detection has to special-case it per host.
  const TANGLED_MISSING_BLOB_BODY = JSON.stringify({
    error: "InternalServerError",
    message: "failed to get blob",
  });

  it("getStyles treats tangled's missing-blob 500 as a missing styles.css, not an error", async () => {
    const pluginCache = fakePluginCache(async () => {
      const error = new Error("HTTP 500");
      error.status = 500;
      error.body = TANGLED_MISSING_BLOB_BODY;
      throw error;
    });
    const provider = new SourceProvider(pluginCache);
    const styles = await provider.getStyles(
      "alpha",
      "1.0.0",
      "tangled:ow/alpha",
    );
    assert.deepEqual(styles, null);
    const { isNotFound } = pluginCache.calls[0].options;
    assert.deepEqual(isNotFound(500, TANGLED_MISSING_BLOB_BODY), true);
    assert.deepEqual(isNotFound(500, "boom"), false);
    assert.deepEqual(isNotFound(404, null), true);
  });

  it("getStyles still throws a tangled 500 with an unrelated body", async () => {
    const pluginCache = fakePluginCache(async () => {
      const error = new Error("HTTP 500");
      error.status = 500;
      error.body = JSON.stringify({ error: "InternalServerError" });
      throw error;
    });
    const provider = new SourceProvider(pluginCache);
    let caught = null;
    try {
      await provider.getStyles("alpha", "1.0.0", "tangled:ow/alpha");
    } catch (error) {
      caught = error;
    }
    assert.deepEqual(caught?.status, 500);
  });

  it("getStyles still throws a tangled 500 with a non-JSON body", async () => {
    const pluginCache = fakePluginCache(async () => {
      const error = new Error("HTTP 500");
      error.status = 500;
      error.body = "<html>gateway error</html>";
      throw error;
    });
    const provider = new SourceProvider(pluginCache);
    let caught = null;
    try {
      await provider.getStyles("alpha", "1.0.0", "tangled:ow/alpha");
    } catch (error) {
      caught = error;
    }
    assert.deepEqual(caught?.status, 500);
  });

  it("getStyles still throws a matching-body 500 for non-tangled repos", async () => {
    const pluginCache = fakePluginCache(async () => {
      const error = new Error("HTTP 500");
      error.status = 500;
      error.body = TANGLED_MISSING_BLOB_BODY;
      throw error;
    });
    const provider = new SourceProvider(pluginCache);
    let caught = null;
    try {
      await provider.getStyles("alpha", "1.0.0", "ow/alpha");
    } catch (error) {
      caught = error;
    }
    assert.deepEqual(caught?.status, 500);
  });

  it("getReadme treats tangled's missing-blob 500 as a missing README, not an error", async () => {
    const stub = stubFetch(async () =>
      jsonResponse(TANGLED_MISSING_BLOB_BODY, { ok: false, status: 500 }),
    );
    try {
      const provider = new SourceProvider(null);
      const readme = await provider.getReadme("alpha", "tangled:ow/alpha");
      assert.deepEqual(readme, null);
    } finally {
      stub.restore();
    }
  });

  it("getReadme still throws a tangled 500 with an unrelated body", async () => {
    const stub = stubFetch(async () =>
      jsonResponse("server exploded", { ok: false, status: 500 }),
    );
    try {
      const provider = new SourceProvider(null);
      let caught = null;
      try {
        await provider.getReadme("alpha", "tangled:ow/alpha");
      } catch (error) {
        caught = error;
      }
      assert(caught?.message.includes("500"));
    } finally {
      stub.restore();
    }
  });
});
