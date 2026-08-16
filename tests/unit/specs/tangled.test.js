import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { TangledResolver, decodeTangledBlobContent } from "/js/tangled.js";
import { MockFetch, installFakeIndexedDB } from "../testHelpers.js";

describe("TangledResolver", () => {
  const originalFetch = globalThis.fetch;
  const originalDateNow = Date.now;
  const ownerDid = "did:plc:owner";
  const knot = "knot1.tangled.sh";
  const repoDid = "did:plc:repo";

  let identityResolutions;
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
    fetchMock.__interceptJson(/com\.atproto\.repo\.getRecord/, {
      value: { knot, repoDid },
    });
  }

  beforeEach(() => {
    installFakeIndexedDB();
    globalThis.fetch = new MockFetch();
    identityResolutions = 0;
    resolver = new TangledResolver();
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

    assert.deepEqual(info, { knot, repoDid });
    assert.deepEqual(identityResolutions, 1);
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
    const info = await new TangledResolver().resolveRepoInfo(path);

    assert.deepEqual(info, { knot, repoDid });
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

    const info = await new TangledResolver().resolveRepoInfo(path);

    assert.deepEqual(info, { knot, repoDid });
    assert.deepEqual(identityResolutions, 0);
  });

  it("serves a stale binding immediately and re-resolves in the background", async () => {
    const path = nextPath();
    Date.now = () => originalDateNow() - 30 * 24 * 60 * 60 * 1000;
    await resolver.resolveRepoInfo(path);
    Date.now = originalDateNow;

    identityResolutions = 0;
    const info = await new TangledResolver().resolveRepoInfo(path);

    // Served without waiting on the revalidation
    assert.deepEqual(info, { knot, repoDid });
    await flush();
    assert.deepEqual(identityResolutions, 1);
  });

  it("re-resolves after invalidate", async () => {
    const path = nextPath();
    await resolver.resolveRepoInfo(path);
    await resolver.invalidate(path);
    await resolver.resolveRepoInfo(path);

    assert.deepEqual(identityResolutions, 2);
  });

  it("drops the persisted binding on invalidate", async () => {
    const path = nextPath();
    await resolver.resolveRepoInfo(path);
    await resolver.invalidate(path);

    identityResolutions = 0;
    const info = await new TangledResolver().resolveRepoInfo(path);

    assert.deepEqual(info, { knot, repoDid });
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
