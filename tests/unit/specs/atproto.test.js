import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  resolveHandle,
  resolveIdentity,
  getServiceEndpointForHandle,
  IdentityResolver,
} from "/js/atproto.js";
import { MockFetch } from "../testHelpers.js";

describe("atproto handle resolution", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = new MockFetch();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
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
