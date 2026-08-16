import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import {
  resolveHandle,
  resolveIdentity,
  getServiceEndpointForHandle,
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
            options.signal.addEventListener("abort", () =>
              reject(new Error("aborted")),
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
      const endpoint = await getServiceEndpointForHandle("alice.example");
      assert.deepEqual(endpoint, "https://pds.example.com");
    });
  });

  describe("IdentityResolver.resolveHandle", () => {
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
