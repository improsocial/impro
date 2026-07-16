import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { Slingshot } from "/js/slingshot.js";

describe("Slingshot", () => {
  const VALID_COLLECTION = "blue.moji.collection.item";
  const VALID_RKEY = "blobcat";

  let didCounter = 0;
  function uniqueDid() {
    didCounter++;
    return `did:plc:test${didCounter.toString().padStart(6, "0")}`;
  }

  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function jsonResponse(status, body) {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    };
  }

  function stubFetch(handler) {
    const calls = [];
    const fetchImpl = async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      calls.push(url);
      return handler(url);
    };
    return { calls, fetchImpl };
  }

  describe("getRecord", () => {
    it("fetches from slingshot with the expected query params", async () => {
      const did = uniqueDid();
      const record = {
        uri: `at://${did}/${VALID_COLLECTION}/${VALID_RKEY}`,
        cid: "bafyfake",
        value: { name: "blobcat" },
      };
      const { calls, fetchImpl } = stubFetch(async () =>
        jsonResponse(200, record),
      );
      const slingshot = new Slingshot({ fetchImpl });
      const result = await slingshot.getRecord({
        repo: did,
        collection: VALID_COLLECTION,
        rkey: VALID_RKEY,
      });
      assert.deepEqual(result, record);
      const url = new URL(calls[0]);
      assert.deepEqual(url.origin, "https://slingshot.microcosm.blue");
      assert.deepEqual(url.pathname, "/xrpc/com.atproto.repo.getRecord");
      assert.deepEqual(url.searchParams.get("repo"), did);
      assert.deepEqual(url.searchParams.get("collection"), VALID_COLLECTION);
      assert.deepEqual(url.searchParams.get("rkey"), VALID_RKEY);
    });

    it("returns null on RecordNotFound", async () => {
      const { fetchImpl } = stubFetch(async () =>
        jsonResponse(400, { error: "RecordNotFound", message: "gone" }),
      );
      const slingshot = new Slingshot({ fetchImpl });
      const result = await slingshot.getRecord({
        repo: uniqueDid(),
        collection: VALID_COLLECTION,
        rkey: VALID_RKEY,
      });
      assert.deepEqual(result, null);
    });

    it("throws on non-RecordNotFound 400s", async () => {
      const { fetchImpl } = stubFetch(async () =>
        jsonResponse(400, { error: "InvalidRequest", message: "bad rkey" }),
      );
      const slingshot = new Slingshot({ fetchImpl });
      await assert.rejects(() =>
        slingshot.getRecord({
          repo: uniqueDid(),
          collection: VALID_COLLECTION,
          rkey: VALID_RKEY,
        }),
      );
    });

    it("throws on server errors", async () => {
      const { fetchImpl } = stubFetch(async () => jsonResponse(502, null));
      const slingshot = new Slingshot({ fetchImpl });
      await assert.rejects(() =>
        slingshot.getRecord({
          repo: uniqueDid(),
          collection: VALID_COLLECTION,
          rkey: VALID_RKEY,
        }),
      );
    });

    it("rejects invalid repo/collection/rkey without hitting the network", async () => {
      let fetched = false;
      const slingshot = new Slingshot({
        fetchImpl: async () => {
          fetched = true;
          return jsonResponse(200, {});
        },
      });
      const invalidInputs = [
        { repo: "not-a-did", collection: VALID_COLLECTION, rkey: VALID_RKEY },
        { repo: "did:plc:abc", collection: "not.enough", rkey: VALID_RKEY },
        { repo: "did:plc:abc", collection: VALID_COLLECTION, rkey: "" },
        {
          repo: "did:plc:abc",
          collection: VALID_COLLECTION,
          rkey: "has/slash",
        },
      ];
      for (const inputs of invalidInputs) {
        await assert.rejects(
          () => slingshot.getRecord(inputs),
          `expected rejection for ${JSON.stringify(inputs)}`,
        );
      }
      assert.deepEqual(fetched, false);
    });
  });
});
