import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { TangledResolver, decodeTangledBlobContent } from "/js/tangled.js";
import { IdentityResolver } from "/js/atproto.js";
import { MockFetch, installFakeIndexedDB } from "../testHelpers.js";

describe("TangledResolver", () => {
  const originalFetch = globalThis.fetch;
  const originalDateNow = Date.now;
  const ownerDid = "did:plc:owner";
  const knot = "knot1.tangled.sh";
  const repoDid = "did:plc:repo";

  let identityResolutions;
  let recordFetches;
  let knotDescribeStatus;
  let resolver;
  // A fresh path per test: the persisted binding is keyed by it, so reusing
  // one would let an earlier test's entry satisfy a later test's first call
  let pathCounter = 0;

  function nextPath() {
    pathCounter += 1;
    return `owner.example/tags-${pathCounter}`;
  }

  function stubResolutionChain() {
    const fetchMock = globalThis.fetch;
    fetchMock.__intercept(/resolveHandle/, async () => {
      identityResolutions += 1;
      return { ok: true, status: 200, json: async () => ({ did: ownerDid }) };
    });
    fetchMock.__interceptJson(/plc\.directory/, {
      alsoKnownAs: ["at://owner.example"],
      service: [
        {
          id: "#atproto_pds",
          type: "AtprotoPersonalDataServer",
          serviceEndpoint: "https://pds.example",
        },
      ],
    });
    fetchMock.__intercept(/com\.atproto\.repo\.getRecord/, async (url) => {
      recordFetches += 1;
      // Only the legacy collection answers here; a declaration lookup
      // falls through to the 404 below unless a test overrides it.
      if (String(url).includes("collection=sh.tangled.repo")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ value: { knot, repoDid } }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });
    fetchMock.__intercept(/org\.tangled\.knot\.describeKnot/, async () => ({
      ok: knotDescribeStatus === 200,
      status: knotDescribeStatus,
      json: async () => ({ did: `did:web:${knot}` }),
    }));
  }

  beforeEach(() => {
    installFakeIndexedDB();
    globalThis.fetch = new MockFetch();
    identityResolutions = 0;
    recordFetches = 0;
    knotDescribeStatus = 200;
    // Own identity resolver per test, so no endpoint is cached across tests
    resolver = new TangledResolver(new IdentityResolver());
    stubResolutionChain();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    Date.now = originalDateNow;
  });

  async function flush() {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  it("resolves through the owner's PDS on a cold cache", async () => {
    const info = await resolver.resolveRepoInfo(nextPath());

    assert.deepEqual(info, { knot, repoDid, api: "git" });
    assert.deepEqual(identityResolutions, 1);
  });

  it("detects a legacy knot that has no describeKnot", async () => {
    knotDescribeStatus = 404;

    const info = await resolver.resolveRepoInfo(nextPath());

    assert.deepEqual(info, { knot, repoDid, api: "legacy" });
  });

  it("fails resolution when the knot can't be described", async () => {
    knotDescribeStatus = 502;

    await assert.rejects(() => resolver.resolveRepoInfo(nextPath()));
  });

  it("re-resolves a persisted binding that has no knot api", async () => {
    const path = nextPath();
    await resolver._store.put(path, {
      knot,
      repoDid,
      resolvedAt: Date.now(),
    });

    const info = await resolver.resolveRepoInfo(path);

    assert.deepEqual(info, { knot, repoDid, api: "git" });
    assert.deepEqual(recordFetches, 1);
  });

  it("memoizes within a session", async () => {
    const path = nextPath();
    await resolver.resolveRepoInfo(path);
    await resolver.resolveRepoInfo(path);

    assert.deepEqual(identityResolutions, 1);
  });

  it("serves the persisted binding without re-resolving the owner handle", async () => {
    const path = nextPath();
    await resolver.resolveRepoInfo(path);
    assert.deepEqual(identityResolutions, 1);

    // A fresh resolver stands in for a new session: only the persisted
    // entry can satisfy this call
    const info = await new TangledResolver(
      new IdentityResolver(),
    ).resolveRepoInfo(path);

    assert.deepEqual(info, { knot, repoDid, api: "git" });
    assert.deepEqual(identityResolutions, 1);
  });

  it("still serves the persisted binding when the handle no longer resolves", async () => {
    const path = nextPath();
    await resolver.resolveRepoInfo(path);

    globalThis.fetch = new MockFetch();
    identityResolutions = 0;
    globalThis.fetch.__intercept(/resolveHandle/, async () => {
      throw new Error("resolveHandle: timed out");
    });

    const info = await new TangledResolver(
      new IdentityResolver(),
    ).resolveRepoInfo(path);

    assert.deepEqual(info, { knot, repoDid, api: "git" });
    assert.deepEqual(identityResolutions, 0);
  });

  it("serves a stale binding immediately and re-resolves in the background", async () => {
    const path = nextPath();
    Date.now = () => originalDateNow() - 30 * 24 * 60 * 60 * 1000;
    await resolver.resolveRepoInfo(path);
    Date.now = originalDateNow;

    identityResolutions = 0;
    const info = await new TangledResolver(
      new IdentityResolver(),
    ).resolveRepoInfo(path);

    // Served without waiting on the revalidation
    assert.deepEqual(info, { knot, repoDid, api: "git" });
    await flush();
    assert.deepEqual(identityResolutions, 1);
  });

  // The owner's PDS endpoint is cached by the IdentityResolver, independently
  // of the knot binding, so re-resolving after invalidate refetches the repo
  // record but need not resolve the owner's identity again.
  it("re-resolves after invalidate", async () => {
    const path = nextPath();
    await resolver.resolveRepoInfo(path);
    await resolver.invalidate(path);
    await resolver.resolveRepoInfo(path);

    assert.deepEqual(recordFetches, 2);
    assert.deepEqual(identityResolutions, 1);
  });

  it("drops the persisted binding on invalidate", async () => {
    const path = nextPath();
    await resolver.resolveRepoInfo(path);
    await resolver.invalidate(path);

    recordFetches = 0;
    identityResolutions = 0;
    const info = await new TangledResolver(
      new IdentityResolver(),
    ).resolveRepoInfo(path);

    assert.deepEqual(info, { knot, repoDid, api: "git" });
    assert.deepEqual(recordFetches, 1);
    assert.deepEqual(identityResolutions, 1);
  });

  it("does not cache a failed resolution", async () => {
    const path = nextPath();
    globalThis.fetch = new MockFetch();
    globalThis.fetch.__intercept(/resolveHandle/, async () => {
      identityResolutions += 1;
      throw new Error("nope");
    });

    await assert.rejects(() => resolver.resolveRepoInfo(path));
    await assert.rejects(() => resolver.resolveRepoInfo(path));

    assert.deepEqual(identityResolutions, 2);
  });

  // Repos created after the org.tangled.* migration have no legacy
  // sh.tangled.repo record at all - only a declaration pointing at the
  // repo DID, whose own document names the knot.
  describe("declaration-only repos (no legacy record)", () => {
    // A fresh, complete stub (MockFetch is first-match-wins, so the
    // beforeEach chain can't be selectively overridden).
    function stubDeclarationChain({ declaration = true } = {}) {
      const fetchMock = new MockFetch();
      globalThis.fetch = fetchMock;
      fetchMock.__intercept(/resolveHandle/, async () => {
        identityResolutions += 1;
        return { ok: true, status: 200, json: async () => ({ did: ownerDid }) };
      });
      // One PLC handler: the repo DID's document names the knot, the
      // owner's names their PDS (MockFetch is first-match-wins, so a
      // single URL-aware route avoids ordering traps).
      fetchMock.__intercept(/plc\.directory/, async (url) => {
        // resolveDid percent-encodes the DID in the path.
        const isRepoDid = decodeURIComponent(String(url)).endsWith(repoDid);
        return {
          ok: true,
          status: 200,
          json: async () =>
            isRepoDid
              ? {
                  id: repoDid,
                  service: [
                    {
                      id: "#atproto_pds",
                      type: "AtprotoPersonalDataServer",
                      serviceEndpoint: `https://${knot}`,
                    },
                  ],
                }
              : {
                  alsoKnownAs: ["at://owner.example"],
                  service: [
                    {
                      id: "#atproto_pds",
                      type: "AtprotoPersonalDataServer",
                      serviceEndpoint: "https://pds.example",
                    },
                  ],
                },
        };
      });
      fetchMock.__intercept(/com\.atproto\.repo\.getRecord/, async (url) => {
        recordFetches += 1;
        const urlStr = String(url);
        if (urlStr.includes("collection=org.tangled.repo.declaration")) {
          if (!declaration) {
            return { ok: false, status: 404, json: async () => ({}) };
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({ value: { repo: repoDid } }),
          };
        }
        // Legacy direct lookup misses.
        return { ok: false, status: 404, json: async () => ({}) };
      });
      fetchMock.__intercept(/com\.atproto\.repo\.listRecords/, async () => ({
        ok: true,
        status: 200,
        json: async () => ({ records: [] }),
      }));
      fetchMock.__intercept(/org\.tangled\.knot\.describeKnot/, async () => ({
        ok: true,
        status: 200,
        json: async () => ({ did: `did:web:${knot}` }),
      }));
      return fetchMock;
    }

    it("resolves via the declaration and the repo DID's knot", async () => {
      stubDeclarationChain();

      const info = await resolver.resolveRepoInfo(nextPath());

      assert.deepEqual(info, { knot, repoDid, api: "git" });
    });

    it("lowercases the declaration rkey", async () => {
      const fetchMock = stubDeclarationChain();

      await resolver.resolveRepoInfo("owner.example/Mixed-Case-Repo");

      const declarationCalls = fetchMock.calls.filter((call) =>
        String(call.url).includes("collection=org.tangled.repo.declaration"),
      );
      assert.equal(declarationCalls.length, 1);
      assert.match(String(declarationCalls[0].url), /rkey=mixed-case-repo/);
    });

    it("still fails when neither record shape exists", async () => {
      stubDeclarationChain({ declaration: false });

      await assert.rejects(
        () => resolver.resolveRepoInfo(nextPath()),
        /Could not find a tangled repo record/,
      );
    });
  });
});

describe("decodeTangledBlobContent", () => {
  function toText(buffer) {
    return new TextDecoder().decode(new Uint8Array(buffer));
  }

  it("decodes a base64-encoded blob", () => {
    const buffer = decodeTangledBlobContent(
      { content: btoa("hello"), encoding: "base64" },
      "main.js",
    );

    assert.deepEqual(toText(buffer), "hello");
  });

  it("encodes plain text content as utf-8", () => {
    const buffer = decodeTangledBlobContent({ content: "héllo" }, "main.js");

    assert.deepEqual(toText(buffer), "héllo");
    assert.deepEqual(buffer.byteLength, 6);
  });

  it("throws when the response has no content", () => {
    assert.throws(
      () => decodeTangledBlobContent({ encoding: "base64" }, "font.woff2"),
      /font\.woff2/,
    );
  });
});
