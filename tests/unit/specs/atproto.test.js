import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import {
  resolveHandle,
  resolveIdentity,
  resolveIdentityEndpoint,
  getServiceEndpointForHandle,
  HandleNotFoundError,
  IdentityResolver,
  computeRecordCid,
} from "/js/atproto.js";
import { MockFetch } from "../testHelpers.js";

describe("atproto handle resolution", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = new MockFetch();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    mock.timers.reset();
  });

  function stubDid(did) {
    globalThis.fetch.__interceptJson(/resolveHandle/, { did });
  }

  function stubPlcDoc(did, doc) {
    globalThis.fetch.__interceptJson(
      `https://plc.directory/${encodeURIComponent(did)}`,
      doc,
    );
  }

  describe("resolveIdentity", () => {
    it("returns did+doc when the DID doc references the handle back", async () => {
      const did = "did:plc:aaaa";
      const doc = {
        alsoKnownAs: ["at://alice.example"],
        service: [
          {
            id: "#atproto_pds",
            serviceEndpoint: "https://pds.example.com",
          },
        ],
      };
      stubDid(did);
      stubPlcDoc(did, doc);

      const result = await resolveIdentity("alice.example");
      assert.deepEqual(result.did, did);
      assert.deepEqual(result.didDoc, doc);
    });

    it("throws when the DID doc does not reference the handle", async () => {
      const did = "did:plc:aaaa";
      stubDid(did);
      stubPlcDoc(did, {
        alsoKnownAs: ["at://someone-else.example"],
        service: [],
      });

      await assert.rejects(
        () => resolveIdentity("alice.example"),
        /does not reference handle/,
      );
    });

    it("returns null when the handle does not resolve", async () => {
      stubDid(null);
      const result = await resolveIdentity("nope.example");
      assert.deepEqual(result, null);
    });
  });

  describe("resolveHandle", () => {
    it("returns the did from the handle resolver without fetching the DID doc", async () => {
      const did = "did:plc:aaaa";
      stubDid(did);
      assert.deepEqual(await resolveHandle("alice.example"), did);
      assert(
        !globalThis.fetch.calls.some((call) =>
          call.url.startsWith("https://plc.directory/"),
        ),
        "resolveHandle should not hit plc.directory",
      );
    });

    it("returns null when the handle does not resolve", async () => {
      stubDid(null);
      assert.deepEqual(await resolveHandle("nope.example"), null);
    });

    it("throws when the resolver does not respond in time", async () => {
      mock.timers.enable({ apis: ["setTimeout"] });
      globalThis.fetch.__intercept(
        /resolveHandle/,
        (url, options) =>
          new Promise((resolve, reject) => {
            // Rejecting with signal.reason is what a real fetch does
            options.signal.addEventListener("abort", () =>
              reject(options.signal.reason),
            );
          }),
      );

      const resolving = resolveHandle("slow.example");
      mock.timers.tick(5000);

      await assert.rejects(resolving, /timed out/);
    });
  });

  describe("getServiceEndpointForHandle", () => {
    it("returns the PDS endpoint after verifying the handle", async () => {
      const did = "did:plc:aaaa";
      stubDid(did);
      stubPlcDoc(did, {
        alsoKnownAs: ["at://alice.example"],
        service: [
          {
            id: "#atproto_pds",
            serviceEndpoint: "https://pds.example.com",
          },
        ],
      });
      const endpoint = await getServiceEndpointForHandle(
        "alice.example",
        new IdentityResolver(),
      );
      assert.deepEqual(endpoint, "https://pds.example.com");
    });
  });

  describe("identifiers that do not resolve", () => {
    function stubMiniDoc(body, status = 200) {
      globalThis.fetch.__intercept(/resolveMiniDoc/, async () => ({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
      }));
    }

    function stubStatus(matcher, status, body = {}) {
      globalThis.fetch.__intercept(matcher, async () => ({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
      }));
    }

    it("reports an unregistered DID as not found", async () => {
      stubMiniDoc({ error: "InvalidRequest" }, 400);
      stubStatus(/plc\.directory/, 404, { message: "DID not registered" });
      assert.deepEqual(await resolveIdentityEndpoint("did:plc:nope"), null);
    });

    it("throws HandleNotFoundError for a DID that does not resolve", async () => {
      stubMiniDoc({ error: "InvalidRequest" }, 400);
      stubStatus(/plc\.directory/, 404, { message: "DID not registered" });
      await assert.rejects(
        () =>
          getServiceEndpointForHandle("did:plc:nope", new IdentityResolver()),
        (error) => error instanceof HandleNotFoundError,
      );
    });

    it("reports an identity with no PDS service as not found", async () => {
      stubMiniDoc({ error: "InvalidRequest" }, 400);
      stubStatus(/plc\.directory/, 200, {
        alsoKnownAs: ["at://alice.example"],
        service: [],
      });
      assert.deepEqual(await resolveIdentityEndpoint("did:plc:aaaa"), null);
    });

    it("throws rather than reporting not-found when the directory errors", async () => {
      stubMiniDoc({ error: "InvalidRequest" }, 400);
      stubStatus(/plc\.directory/, 503);
      await assert.rejects(
        () => resolveIdentityEndpoint("did:plc:aaaa"),
        /HTTP 503/,
      );
    });

    it("throws rather than reporting not-found when the handle resolver errors", async () => {
      stubMiniDoc({ error: "InvalidRequest" }, 400);
      stubStatus(/resolveHandle/, 503);
      await assert.rejects(
        () => resolveIdentityEndpoint("alice.example"),
        /HTTP 503/,
      );
    });

    it("reports an unresolvable handle as not found", async () => {
      stubMiniDoc({ error: "InvalidRequest" }, 400);
      stubStatus(/resolveHandle/, 400, { error: "InvalidRequest" });
      assert.deepEqual(await resolveIdentityEndpoint("nope.example"), null);
    });
  });

  describe("IdentityResolver.resolveHandle", () => {
    function makeProvider(name, impl) {
      const calls = [];
      return {
        calls,
        provider: {
          name,
          resolve: (handle) => {
            calls.push(handle);
            return impl(handle);
          },
        },
      };
    }

    it("caches the resolved DID", async () => {
      const did = "did:plc:aaaa";
      stubDid(did);
      const resolver = new IdentityResolver();
      const first = await resolver.resolveHandle("alice.example");
      const callsAfterFirst = globalThis.fetch.calls.length;
      const second = await resolver.resolveHandle("alice.example");
      assert.deepEqual(first, did);
      assert.deepEqual(second, did);
      assert.deepEqual(globalThis.fetch.calls.length, callsAfterFirst);
    });

    it("falls back to the next provider when the first one fails", async () => {
      const primary = makeProvider("primary", async () => {
        throw new Error("slingshot is down");
      });
      const secondary = makeProvider("secondary", async () => "did:plc:bbbb");
      const resolver = new IdentityResolver({
        providers: [primary.provider, secondary.provider],
      });
      assert.deepEqual(
        await resolver.resolveHandle("alice.example"),
        "did:plc:bbbb",
      );
      assert.deepEqual(primary.calls, ["alice.example"]);
      assert.deepEqual(secondary.calls, ["alice.example"]);
    });

    it("does not consult later providers once one succeeds", async () => {
      const primary = makeProvider("primary", async () => "did:plc:aaaa");
      const secondary = makeProvider("secondary", async () => "did:plc:bbbb");
      const resolver = new IdentityResolver({
        providers: [primary.provider, secondary.provider],
      });
      assert.deepEqual(
        await resolver.resolveHandle("alice.example"),
        "did:plc:aaaa",
      );
      assert.deepEqual(secondary.calls, []);
    });

    it("throws when every provider fails", async () => {
      const primary = makeProvider("primary", async () => {
        throw new Error("down");
      });
      const secondary = makeProvider("secondary", async () => {
        throw new Error("also down");
      });
      const resolver = new IdentityResolver({
        providers: [primary.provider, secondary.provider],
      });
      await assert.rejects(
        () => resolver.resolveHandle("alice.example"),
        /also down/,
      );
    });

    it("does not cache a failure, so a later attempt can succeed", async () => {
      let attempt = 0;
      const flaky = makeProvider("flaky", async () => {
        attempt++;
        if (attempt === 1) throw new Error("transient");
        return "did:plc:aaaa";
      });
      const resolver = new IdentityResolver({ providers: [flaky.provider] });
      await assert.rejects(() => resolver.resolveHandle("alice.example"));
      assert.deepEqual(
        await resolver.resolveHandle("alice.example"),
        "did:plc:aaaa",
      );
    });

    it("re-checks a not-found handle once its TTL has elapsed", async () => {
      let attempt = 0;
      const provider = makeProvider("provider", async () => {
        attempt++;
        return attempt === 1 ? null : "did:plc:aaaa";
      });
      const resolver = new IdentityResolver({
        providers: [provider.provider],
        notFoundTtlMs: 0,
      });
      assert.deepEqual(await resolver.resolveHandle("alice.example"), null);
      assert.deepEqual(
        await resolver.resolveHandle("alice.example"),
        "did:plc:aaaa",
      );
    });

    it("caches a not-found handle for the duration of its TTL", async () => {
      const provider = makeProvider("provider", async () => null);
      const resolver = new IdentityResolver({
        providers: [provider.provider],
        notFoundTtlMs: 60_000,
      });
      assert.deepEqual(await resolver.resolveHandle("alice.example"), null);
      assert.deepEqual(await resolver.resolveHandle("alice.example"), null);
      assert.deepEqual(provider.calls.length, 1);
    });

    it("shares one request between concurrent callers", async () => {
      let release = null;
      const provider = makeProvider(
        "provider",
        () =>
          new Promise((resolve) => {
            release = () => resolve("did:plc:aaaa");
          }),
      );
      const resolver = new IdentityResolver({ providers: [provider.provider] });
      const both = Promise.all([
        resolver.resolveHandle("alice.example"),
        resolver.resolveHandle("alice.example"),
      ]);
      release();
      assert.deepEqual(await both, ["did:plc:aaaa", "did:plc:aaaa"]);
      assert.deepEqual(provider.calls.length, 1);
    });

    it("clears a cached not-found when a DID is supplied directly", async () => {
      const provider = makeProvider("provider", async () => null);
      const resolver = new IdentityResolver({
        providers: [provider.provider],
        notFoundTtlMs: 60_000,
      });
      assert.deepEqual(await resolver.resolveHandle("alice.example"), null);
      resolver.setDidForHandle("alice.example", "did:plc:aaaa");
      assert.deepEqual(
        await resolver.resolveHandle("alice.example"),
        "did:plc:aaaa",
      );
    });
  });

  describe("resolveIdentityEndpoint", () => {
    function stubMiniDoc(body, status = 200) {
      globalThis.fetch.__intercept(/resolveMiniDoc/, async () => ({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
      }));
    }

    it("uses the slingshot mini doc when it matches the handle", async () => {
      stubMiniDoc({
        did: "did:plc:aaaa",
        handle: "alice.example",
        pds: "https://pds.example.com",
      });
      assert.deepEqual(await resolveIdentityEndpoint("alice.example"), {
        did: "did:plc:aaaa",
        pds: "https://pds.example.com",
      });
      assert(
        !globalThis.fetch.calls.some((call) =>
          call.url.startsWith("https://plc.directory/"),
        ),
        "should not need the protocol fallback",
      );
    });

    it("resolves a DID identifier without a handle check", async () => {
      stubMiniDoc({
        did: "did:plc:aaaa",
        handle: "alice.example",
        pds: "https://pds.example.com",
      });
      assert.deepEqual(await resolveIdentityEndpoint("did:plc:aaaa"), {
        did: "did:plc:aaaa",
        pds: "https://pds.example.com",
      });
    });

    it("resolves did:web identities through slingshot", async () => {
      stubMiniDoc({
        did: "did:web:example.com",
        handle: "didweb.example.com",
        pds: "https://pds.example.com",
      });
      assert.deepEqual(await resolveIdentityEndpoint("did:web:example.com"), {
        did: "did:web:example.com",
        pds: "https://pds.example.com",
      });
      assert.deepEqual(await resolveIdentityEndpoint("didweb.example.com"), {
        did: "did:web:example.com",
        pds: "https://pds.example.com",
      });
    });

    it("falls back to the protocol path when slingshot fails", async () => {
      stubMiniDoc({ error: "InvalidRequest" }, 400);
      stubDid("did:plc:aaaa");
      stubPlcDoc("did:plc:aaaa", {
        alsoKnownAs: ["at://alice.example"],
        service: [
          { id: "#atproto_pds", serviceEndpoint: "https://pds.example.com" },
        ],
      });
      assert.deepEqual(await resolveIdentityEndpoint("alice.example"), {
        did: "did:plc:aaaa",
        pds: "https://pds.example.com",
      });
    });

    it("falls back when slingshot answers with a different handle", async () => {
      stubMiniDoc({
        did: "did:plc:bbbb",
        handle: "someone-else.example",
        pds: "https://evil.example.com",
      });
      stubDid("did:plc:aaaa");
      stubPlcDoc("did:plc:aaaa", {
        alsoKnownAs: ["at://alice.example"],
        service: [
          { id: "#atproto_pds", serviceEndpoint: "https://pds.example.com" },
        ],
      });
      assert.deepEqual(await resolveIdentityEndpoint("alice.example"), {
        did: "did:plc:aaaa",
        pds: "https://pds.example.com",
      });
    });

    it("returns null when the handle does not resolve anywhere", async () => {
      stubMiniDoc({ error: "InvalidRequest" }, 400);
      stubDid(null);
      assert.deepEqual(await resolveIdentityEndpoint("nope.example"), null);
    });
  });

  describe("IdentityResolver.resolveEndpoint", () => {
    function stubMiniDoc(body, status = 200) {
      globalThis.fetch.__intercept(/resolveMiniDoc/, async () => ({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
      }));
    }

    const endpoint = {
      did: "did:plc:aaaa",
      handle: "alice.example",
      pds: "https://pds.example.com",
    };

    it("caches the endpoint so a second call makes no request", async () => {
      stubMiniDoc(endpoint);
      const resolver = new IdentityResolver();
      assert.deepEqual(await resolver.resolveEndpoint("alice.example"), {
        did: "did:plc:aaaa",
        pds: "https://pds.example.com",
      });
      const callsAfterFirst = globalThis.fetch.calls.length;
      await resolver.resolveEndpoint("alice.example");
      assert.deepEqual(globalThis.fetch.calls.length, callsAfterFirst);
    });

    it("re-resolves once the endpoint TTL has elapsed", async () => {
      stubMiniDoc(endpoint);
      const resolver = new IdentityResolver({ endpointTtlMs: 0 });
      await resolver.resolveEndpoint("alice.example");
      const callsAfterFirst = globalThis.fetch.calls.length;
      await resolver.resolveEndpoint("alice.example");
      assert(globalThis.fetch.calls.length > callsAfterFirst);
    });

    it("shares one request between concurrent callers", async () => {
      stubMiniDoc(endpoint);
      const resolver = new IdentityResolver();
      const both = await Promise.all([
        resolver.resolveEndpoint("alice.example"),
        resolver.resolveEndpoint("alice.example"),
      ]);
      assert.deepEqual(both[0], both[1]);
      assert.deepEqual(
        globalThis.fetch.calls.filter((call) =>
          call.url.includes("resolveMiniDoc"),
        ).length,
        1,
      );
    });

    it("populates the handle cache, so resolveHandle needs no request", async () => {
      stubMiniDoc(endpoint);
      const resolver = new IdentityResolver();
      await resolver.resolveEndpoint("alice.example");
      const callsAfterFirst = globalThis.fetch.calls.length;
      assert.deepEqual(
        await resolver.resolveHandle("alice.example"),
        "did:plc:aaaa",
      );
      assert.deepEqual(globalThis.fetch.calls.length, callsAfterFirst);
    });

    it("does not file a DID identifier under the handle cache", async () => {
      stubMiniDoc(endpoint);
      const resolver = new IdentityResolver();
      await resolver.resolveEndpoint("did:plc:aaaa");
      assert.deepEqual(resolver.handleToDidMap.has("did:plc:aaaa"), false);
    });

    it("caches a not-found for the duration of the not-found TTL", async () => {
      stubMiniDoc({ error: "InvalidRequest" }, 400);
      stubDid(null);
      const resolver = new IdentityResolver({ notFoundTtlMs: 60_000 });
      assert.deepEqual(await resolver.resolveEndpoint("nope.example"), null);
      const callsAfterFirst = globalThis.fetch.calls.length;
      assert.deepEqual(await resolver.resolveEndpoint("nope.example"), null);
      assert.deepEqual(globalThis.fetch.calls.length, callsAfterFirst);
    });
  });
});

// Expected CIDs are known-answer vectors generated against the reference
// @ipld/dag-cbor + multiformats implementations. Do not update them!
describe("computeRecordCid", () => {
  it("hashes a simple text post", async () => {
    const cid = await computeRecordCid({
      $type: "app.bsky.feed.post",
      text: "Hello, world!",
      createdAt: "2024-01-01T00:00:00.000Z",
      langs: ["en"],
    });
    assert.deepEqual(
      cid,
      "bafyreibbyzcaqi3hqt4wtpnus47pkfdv2kblfrr56qhevkexp3ycvwgceq",
    );
  });

  it("hashes a post with reply refs", async () => {
    const cid = await computeRecordCid({
      $type: "app.bsky.feed.post",
      text: "a reply",
      createdAt: "2024-06-15T12:34:56.789Z",
      reply: {
        root: {
          uri: "at://did:plc:abc123/app.bsky.feed.post/3kabc123def45",
          cid: "bafyreid27zk7lbis4zw5fz4podbvbs4fc5ivwji3dmrwa6zggnj4bnd57u",
        },
        parent: {
          uri: "at://did:plc:abc123/app.bsky.feed.post/3kabc123def46",
          cid: "bafyreid27zk7lbis4zw5fz4podbvbs4fc5ivwji3dmrwa6zggnj4bnd57u",
        },
      },
    });
    assert.deepEqual(
      cid,
      "bafyreifgyyds455cehqwbqwgcvoatcrlwfp44oh3t3awromwcfjcxdk26a",
    );
  });

  it("hashes a post with an image blob ref as an IPLD link", async () => {
    const cid = await computeRecordCid({
      $type: "app.bsky.feed.post",
      text: "with an image",
      createdAt: "2024-06-15T12:34:56.789Z",
      embed: {
        $type: "app.bsky.embed.images",
        images: [
          {
            $type: "app.bsky.embed.images#image",
            alt: "alt text",
            image: {
              $type: "blob",
              ref: {
                $link:
                  "bafkreibvjvcv745gig4mvqs4hctnzwjuzjcvgvsvzxcsw6mn3lzhhydkoe",
              },
              mimeType: "image/jpeg",
              size: 123456,
            },
            aspectRatio: {
              $type: "app.bsky.embed.defs#aspectRatio",
              width: 1600,
              height: 900,
            },
          },
        ],
      },
    });
    assert.deepEqual(
      cid,
      "bafyreicb4xajh3tgzxgrhw2i4vossmohwvf5zwxjlxb2nnkz7sdoojfzfi",
    );
  });

  it("hashes multibyte text and facets with correct UTF-8 lengths", async () => {
    const cid = await computeRecordCid({
      $type: "app.bsky.feed.post",
      text: "héllo 👋 @someone.bsky.social",
      createdAt: "2024-06-15T12:34:56.789Z",
      facets: [
        {
          index: { byteStart: 12, byteEnd: 34 },
          features: [
            {
              $type: "app.bsky.richtext.facet#mention",
              did: "did:plc:abc123",
            },
          ],
        },
      ],
      langs: ["en", "fr"],
    });
    assert.deepEqual(
      cid,
      "bafyreiarwyjnuqd46hebznu7mc3oz65pelmloxhqjzacc5q2pvoe3hdimy",
    );
  });

  it("strips undefined object values before hashing", async () => {
    const cid = await computeRecordCid({
      $type: "app.bsky.feed.post",
      text: "stripped",
      createdAt: "2024-06-15T12:34:56.789Z",
      embed: undefined,
      reply: undefined,
    });
    assert.deepEqual(
      cid,
      "bafyreighlda5ujgmug7xtlswcj7gehub6dltw32fm73ggt33uouqgvypem",
    );
  });

  it("is insensitive to object key insertion order", async () => {
    const first = await computeRecordCid({
      text: "same",
      $type: "app.bsky.feed.post",
      createdAt: "2024-01-01T00:00:00.000Z",
    });
    const second = await computeRecordCid({
      createdAt: "2024-01-01T00:00:00.000Z",
      $type: "app.bsky.feed.post",
      text: "same",
    });
    assert.deepEqual(first, second);
  });

  it("throws on values outside the supported record subset", async () => {
    await assert.rejects(
      () => computeRecordCid({ text: "x", ratio: 1.5 }),
      /non-integer/,
    );
    await assert.rejects(
      () => computeRecordCid({ text: "x", when: new Date(0) }),
      /Cannot CBOR-encode/,
    );
    await assert.rejects(
      () => computeRecordCid({ text: "x", items: [undefined] }),
      /Cannot CBOR-encode/,
    );
  });
});
