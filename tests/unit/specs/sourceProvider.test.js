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

// tangled.org's own HTTP endpoints don't set CORS headers, so
// SourceProvider resolves tangled: repos entirely through standard AT
// Protocol infrastructure instead: owner handle -> the owner's PDS (for the
// repo's own "sh.tangled.repo" record, which carries {knot, repoDid}) ->
// the knot's own CORS-enabled blob endpoint. The handle -> PDS step is
// slingshot's mini doc, falling back to resolveHandle -> plc.directory.
// This stubs global fetch to answer those resolution requests by URL
// pattern; the actual file-content request is left to the caller (via
// fakePluginCache, or a further branch here for plain-fetch methods).
// legacyRecordKey simulates repos created before the "rkey = repo name"
// scheme existed: the direct getRecord lookup 404s (well, 400s — standard
// atproto RecordNotFound), and the record only turns up via listRecords,
// keyed by an opaque TID with an explicit "name" field. Confirmed for real
// against tangled.org's own account (its "infra" repo still uses this).
function stubTangledResolution({
  ownerHandle,
  ownerDid,
  pds,
  knot,
  repoDid,
  repoName = "alpha",
  content = null,
  legacyRecordKey = false,
}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), options });
    const urlStr = String(url);
    if (urlStr.includes("blue.microcosm.identity.resolveMiniDoc")) {
      return jsonResponse({
        did: ownerDid,
        handle: ownerHandle,
        pds,
      });
    }
    if (urlStr.includes("com.atproto.identity.resolveHandle")) {
      return jsonResponse({ did: ownerDid });
    }
    if (urlStr.startsWith("https://plc.directory/")) {
      return jsonResponse({
        id: ownerDid,
        alsoKnownAs: [`at://${ownerHandle}`],
        service: [
          {
            id: "#atproto_pds",
            type: "AtprotoPersonalDataServer",
            serviceEndpoint: pds,
          },
        ],
      });
    }
    if (
      urlStr.startsWith(pds) &&
      urlStr.includes("com.atproto.repo.getRecord")
    ) {
      if (legacyRecordKey) {
        return jsonResponse(
          { error: "RecordNotFound", message: "not found" },
          { ok: false, status: 400 },
        );
      }
      return jsonResponse({ value: { knot, repoDid } });
    }
    if (
      urlStr.startsWith(pds) &&
      urlStr.includes("com.atproto.repo.listRecords")
    ) {
      if (!legacyRecordKey) {
        throw new Error(
          "listRecords should only be hit as a fallback (legacyRecordKey: true)",
        );
      }
      return jsonResponse({
        records: [
          {
            uri: `at://${ownerDid}/sh.tangled.repo/3lxfwy4ifg622`,
            value: { knot, repoDid, name: repoName },
          },
        ],
      });
    }
    if (content && urlStr.startsWith(`https://${knot}/`)) {
      return content;
    }
    throw new Error(`Unexpected fetch in stubTangledResolution: ${urlStr}`);
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

function knotBlobUrl({ knot, repoDid, ref, path }) {
  const params = new URLSearchParams({ repo: repoDid, ref, path, raw: "true" });
  return `https://${knot}/xrpc/sh.tangled.repo.blob?${params}`;
}

// resolveTangledRepoInfo caches per repo path at module scope, so each test
// below uses its own unique owner handle to avoid one test's cached
// resolution masking another test's stub (and hiding real bugs).
let identityCounter = 0;
function makeIdentity() {
  const n = ++identityCounter;
  return {
    ownerHandle: `owner${n}.example`,
    ownerDid: `did:plc:owner${n}`,
    pds: `https://pds${n}.example`,
    knot: `knot${n}.example`,
    repoDid: `did:plc:repo${n}`,
  };
}

describe("SourceProvider with tangled.sh-hosted plugins", () => {
  it("resolves via atproto and fetches a versioned manifest from the knot", async () => {
    const identity = makeIdentity();
    const stub = stubTangledResolution(identity);
    const pluginCache = fakePluginCache(async () =>
      jsonResponse({ id: "alpha", name: "A", version: "1.0.0" }),
    );
    try {
      const provider = new SourceProvider(pluginCache);
      const manifest = await provider.getManifest(
        "alpha",
        "1.0.0",
        `tangled:${identity.ownerHandle}/alpha`,
      );
      assert.deepEqual(
        pluginCache.calls[0].url,
        knotBlobUrl({ ...identity, ref: "1.0.0", path: "manifest.json" }),
      );
      assert.deepEqual(manifest.id, "alpha");
      // resolveMiniDoc, getRecord
      assert.deepEqual(stub.calls.length, 2);
    } finally {
      stub.restore();
    }
  });

  it("fetches source from the version that was passed in", async () => {
    const identity = makeIdentity();
    const stub = stubTangledResolution(identity);
    const pluginCache = fakePluginCache(async () => ({
      ok: true,
      status: 200,
      async text() {
        return "alert(1)";
      },
    }));
    try {
      const provider = new SourceProvider(pluginCache);
      const source = await provider.getSource(
        "alpha",
        "2.5.0",
        `tangled:${identity.ownerHandle}/alpha`,
      );
      assert.deepEqual(
        pluginCache.calls[0].url,
        knotBlobUrl({ ...identity, ref: "2.5.0", path: "main.js" }),
      );
      assert.deepEqual(source, "alert(1)");
    } finally {
      stub.restore();
    }
  });

  it("getLiveManifest resolves via atproto and fetches from the knot's main ref", async () => {
    const identity = makeIdentity();
    const stub = stubTangledResolution({
      ...identity,
      content: jsonResponse({ id: "alpha", name: "A", version: "9.9.9" }),
    });
    try {
      const provider = new SourceProvider(null);
      const manifest = await provider.getLiveManifest(
        "alpha",
        `tangled:${identity.ownerHandle}/alpha`,
      );
      assert.deepEqual(manifest.version, "9.9.9");
      const finalCall = stub.calls.at(-1);
      assert.deepEqual(
        finalCall.url,
        knotBlobUrl({ ...identity, ref: "main", path: "manifest.json" }),
      );
    } finally {
      stub.restore();
    }
  });

  it("caches the resolved knot/repoDid so a second fetch doesn't re-resolve", async () => {
    const identity = makeIdentity();
    const stub = stubTangledResolution(identity);
    const pluginCache = fakePluginCache(async () =>
      jsonResponse({ id: "alpha", name: "A", version: "1.0.0" }),
    );
    try {
      const provider = new SourceProvider(pluginCache);
      const repo = `tangled:${identity.ownerHandle}/alpha`;
      await provider.getManifest("alpha", "1.0.0", repo);
      await provider.getSource("alpha", "1.0.0", repo);
      // Still just the 2 resolution calls, not 4 — the second fetch reused
      // the cached {knot, repoDid}.
      assert.deepEqual(stub.calls.length, 2);
      assert.deepEqual(pluginCache.calls.length, 2);
    } finally {
      stub.restore();
    }
  });

  it("getCacheUrls resolves once and includes manifest, main.js, and styles.css URLs", async () => {
    const identity = makeIdentity();
    const stub = stubTangledResolution(identity);
    try {
      const provider = new SourceProvider(null);
      const urls = await provider.getCacheUrls(
        "alpha",
        "1.2.3",
        `tangled:${identity.ownerHandle}/alpha`,
      );
      assert.deepEqual(urls, [
        knotBlobUrl({ ...identity, ref: "1.2.3", path: "manifest.json" }),
        knotBlobUrl({ ...identity, ref: "1.2.3", path: "main.js" }),
        knotBlobUrl({ ...identity, ref: "1.2.3", path: "styles.css" }),
      ]);
    } finally {
      stub.restore();
    }
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

  it("throws a clear error when the owner handle can't be resolved", async () => {
    const stub = stubFetch(async () => jsonResponse({ did: null }));
    try {
      const provider = new SourceProvider(fakePluginCache(async () => null));
      let caught = null;
      try {
        await provider.getManifest(
          "alpha",
          "1.0.0",
          "tangled:unknown.example/alpha",
        );
      } catch (error) {
        caught = error;
      }
      assert(caught?.message.includes("Could not resolve tangled repo owner"));
    } finally {
      stub.restore();
    }
  });

  it("falls back to listRecords for repos using the older TID record key", async () => {
    const identity = makeIdentity();
    const stub = stubTangledResolution({
      ...identity,
      repoName: "alpha",
      legacyRecordKey: true,
    });
    const pluginCache = fakePluginCache(async () =>
      jsonResponse({ id: "alpha", name: "A", version: "1.0.0" }),
    );
    try {
      const provider = new SourceProvider(pluginCache);
      const manifest = await provider.getManifest(
        "alpha",
        "1.0.0",
        `tangled:${identity.ownerHandle}/alpha`,
      );
      assert.deepEqual(manifest.id, "alpha");
      assert.deepEqual(
        pluginCache.calls[0].url,
        knotBlobUrl({ ...identity, ref: "1.0.0", path: "manifest.json" }),
      );
      // resolveMiniDoc, getRecord (404), listRecords
      assert.deepEqual(stub.calls.length, 3);
    } finally {
      stub.restore();
    }
  });

  it("throws a clear error when no record matches by rkey or name", async () => {
    const identity = makeIdentity();
    const stub = stubTangledResolution({
      ...identity,
      repoName: "some-other-repo",
      legacyRecordKey: true,
    });
    try {
      const provider = new SourceProvider(fakePluginCache(async () => null));
      let caught = null;
      try {
        await provider.getManifest(
          "alpha",
          "1.0.0",
          `tangled:${identity.ownerHandle}/alpha`,
        );
      } catch (error) {
        caught = error;
      }
      assert(
        caught?.message.includes(
          'Could not find a tangled repo record named "alpha"',
        ),
      );
    } finally {
      stub.restore();
    }
  });

  it("getStyles returns null when the knot 404s (no styles.css)", async () => {
    const identity = makeIdentity();
    const stub = stubTangledResolution(identity);
    const pluginCache = fakePluginCache(async () => {
      const error = new Error("HTTP 404");
      error.status = 404;
      throw error;
    });
    try {
      const provider = new SourceProvider(pluginCache);
      const styles = await provider.getStyles(
        "alpha",
        "1.0.0",
        `tangled:${identity.ownerHandle}/alpha`,
      );
      assert.deepEqual(styles, null);
    } finally {
      stub.restore();
    }
  });

  it("getReadme returns null when the knot 404s (no README.md)", async () => {
    const identity = makeIdentity();
    const stub = stubTangledResolution({
      ...identity,
      content: { ok: false, status: 404 },
    });
    try {
      const provider = new SourceProvider(null);
      const readme = await provider.getReadme(
        "alpha",
        `tangled:${identity.ownerHandle}/alpha`,
      );
      assert.deepEqual(readme, null);
    } finally {
      stub.restore();
    }
  });
});

// The knot's raw=true mode 403s for font mime types, so getFont fetches the
// JSON-wrapped (base64) response for tangled repos instead and decodes it
// client-side. Verified against a real binary file on the live server
// (byte-for-byte identical to a raw=true fetch of the same file) separately
// from this suite; these tests cover the decode logic in isolation.
function wrappedFontResponse(bytes) {
  return jsonResponse({
    content: Buffer.from(bytes).toString("base64"),
    encoding: "base64",
    isBinary: true,
  });
}

describe("SourceProvider.getFont with tangled.sh-hosted plugins", () => {
  it("fetches the non-raw wrapped response and decodes it into a Blob", async () => {
    const identity = makeIdentity();
    const stub = stubTangledResolution(identity);
    const bytes = woff2Bytes();
    const pluginCache = fakePluginCache(async () => wrappedFontResponse(bytes));
    try {
      const provider = new SourceProvider(pluginCache);
      const blob = await provider.getFont(
        "alpha",
        "1.0.0",
        `tangled:${identity.ownerHandle}/alpha`,
        "fonts/f.woff2",
      );
      const params = new URLSearchParams({
        repo: identity.repoDid,
        ref: "1.0.0",
        path: "fonts/f.woff2",
      });
      assert.deepEqual(
        pluginCache.calls[0].url,
        `https://${identity.knot}/xrpc/sh.tangled.repo.blob?${params}`,
      );
      assert(!pluginCache.calls[0].url.includes("raw="));
      assert(blob instanceof Blob);
      assert.deepEqual(blob.type, "font/woff2");
      assert.deepEqual(blob.size, bytes.byteLength);
    } finally {
      stub.restore();
    }
  });

  it("rejects invalid magic bytes the same way as GitHub/local fonts", async () => {
    const identity = makeIdentity();
    const stub = stubTangledResolution(identity);
    const notFont = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]);
    const pluginCache = fakePluginCache(async () =>
      wrappedFontResponse(notFont),
    );
    try {
      const provider = new SourceProvider(pluginCache);
      let caught = null;
      try {
        await provider.getFont(
          "alpha",
          "1.0.0",
          `tangled:${identity.ownerHandle}/alpha`,
          "fonts/f.woff2",
        );
      } catch (error) {
        caught = error;
      }
      assert(caught?.message.includes("invalid magic bytes"));
    } finally {
      stub.restore();
    }
  });
});

// The knot binding outlives the session, so a repo that moved to a different
// knot would keep failing against the old one. These cover which failures the
// provider reads as "this binding is wrong" — see _fetchRequiredAsset.
function fakeTangledResolver() {
  return {
    invalidated: [],
    async resolveRepoInfo() {
      return { knot: "knot.example", repoDid: "did:plc:repo" };
    },
    async invalidate(path) {
      this.invalidated.push(path);
    },
  };
}

function httpError(status) {
  const error = new Error(`HTTP ${status}`);
  error.status = status;
  return error;
}

describe("SourceProvider tangled knot invalidation", () => {
  const repo = "tangled:owner.example/alpha";
  const path = "owner.example/alpha";

  function providerThatFailsWith(error) {
    const resolver = fakeTangledResolver();
    const provider = new SourceProvider(
      fakePluginCache(async () => {
        throw error;
      }),
      resolver,
    );
    return { provider, resolver };
  }

  it("drops the binding when the knot errors on a versioned manifest", async () => {
    const { provider, resolver } = providerThatFailsWith(httpError(404));

    await assert.rejects(() => provider.getManifest("alpha", "1.0.0", repo));

    assert.deepEqual(resolver.invalidated, [path]);
  });

  it("drops the binding when the knot errors on main.js", async () => {
    const { provider, resolver } = providerThatFailsWith(httpError(500));

    await assert.rejects(() => provider.getSource("alpha", "1.0.0", repo));

    assert.deepEqual(resolver.invalidated, [path]);
  });

  it("drops the binding when the knot errors on a live manifest", async () => {
    const resolver = fakeTangledResolver();
    const stub = stubFetch(async () =>
      jsonResponse({}, { ok: false, status: 404 }),
    );
    try {
      const provider = new SourceProvider(null, resolver);
      await assert.rejects(() => provider.getLiveManifest("alpha", repo));
    } finally {
      stub.restore();
    }
    assert.deepEqual(resolver.invalidated, [path]);
  });

  it("keeps the binding on a network-level failure", async () => {
    // Indistinguishable from being offline, where the binding is what lets a
    // warm cache still serve the plugin
    const { provider, resolver } = providerThatFailsWith(
      new TypeError("Failed to fetch"),
    );

    await assert.rejects(() => provider.getSource("alpha", "1.0.0", repo));

    assert.deepEqual(resolver.invalidated, []);
  });

  it("keeps the binding when an optional styles.css is missing", async () => {
    const { provider, resolver } = providerThatFailsWith(httpError(404));

    assert.deepEqual(await provider.getStyles("alpha", "1.0.0", repo), null);

    assert.deepEqual(resolver.invalidated, []);
  });

  it("does not invalidate for GitHub-hosted repos", async () => {
    const { provider, resolver } = providerThatFailsWith(httpError(404));

    await assert.rejects(() =>
      provider.getManifest("alpha", "1.0.0", "ow/alpha"),
    );

    assert.deepEqual(resolver.invalidated, []);
  });
});
