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
    it("returns the verified did", async () => {
      const did = "did:plc:aaaa";
      stubDid(did);
      stubPlcDoc(did, {
        alsoKnownAs: ["at://alice.example"],
        service: [],
      });
      assert.deepEqual(await resolveHandle("alice.example"), did);
    });

    it("throws on verification failure — callers cannot silently use a spoofed mapping", async () => {
      stubDid("did:plc:aaaa");
      stubPlcDoc("did:plc:aaaa", {
        alsoKnownAs: ["at://mallory.example"],
        service: [],
      });
      await assert.rejects(() => resolveHandle("alice.example"));
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
    it("caches the verified DID and does not re-verify", async () => {
      const did = "did:plc:aaaa";
      stubDid(did);
      stubPlcDoc(did, {
        alsoKnownAs: ["at://alice.example"],
        service: [],
      });
      const resolver = new IdentityResolver();
      const first = await resolver.resolveHandle("alice.example");
      const callsAfterFirst = globalThis.fetch.calls.length;
      const second = await resolver.resolveHandle("alice.example");
      assert.deepEqual(first, did);
      assert.deepEqual(second, did);
      assert.deepEqual(globalThis.fetch.calls.length, callsAfterFirst);
    });

    it("does not cache when verification fails, so retries are possible", async () => {
      stubDid("did:plc:aaaa");
      stubPlcDoc("did:plc:aaaa", {
        alsoKnownAs: ["at://someone-else.example"],
        service: [],
      });
      const resolver = new IdentityResolver();
      await assert.rejects(() => resolver.resolveHandle("alice.example"));
      assert(!resolver.handleToDidMap.has("alice.example"));
    });
  });
});
