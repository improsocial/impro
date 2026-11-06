import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { PreferencesProvider } from "/js/dataLayer/preferencesProvider.js";
import { LabelerDefsProvider } from "/js/dataLayer/labelerDefsProvider.js";
import { BSKY_LABELER_DID } from "/js/config.js";

describe("LabelerDefsProvider", () => {
  const subscribedLabelerDid = "did:plc:subscribed";
  const labelersPref = {
    $type: "app.bsky.actor.defs#labelersPref",
    labelers: [{ did: subscribedLabelerDid }],
  };

  function labelerDef(did) {
    return { creator: { did }, policies: { labelValueDefinitions: [] } };
  }

  function makeProvider(apiOverrides = {}) {
    const api = {
      isAuthenticated: true,
      getPreferences: async () => [labelersPref],
      getLabelers: async (dids) => dids.map(labelerDef),
      ...apiOverrides,
    };
    return new LabelerDefsProvider(api, new PreferencesProvider(api));
  }

  beforeEach(() => {
    for (const toast of document.querySelectorAll('[data-testid="toast"]')) {
      toast.remove();
    }
  });

  it("should fetch definitions for the labelers in the user's preferences", async () => {
    let requestedDids = null;
    const provider = makeProvider({
      getLabelers: async (dids) => {
        requestedDids = dids;
        return dids.map(labelerDef);
      },
    });

    const labelerDefs = await provider.requireLabelerDefs();

    assert.deepEqual(requestedDids, [subscribedLabelerDid, BSKY_LABELER_DID]);
    assert.deepEqual(
      labelerDefs.map((def) => def.creator.did),
      [subscribedLabelerDid, BSKY_LABELER_DID],
    );
    assert.deepEqual(provider.$labelerDefs.get(), labelerDefs);
  });

  it("should resolve to no definitions without fetching when logged out", async () => {
    let fetchCount = 0;
    const provider = makeProvider({
      isAuthenticated: false,
      getLabelers: async () => {
        fetchCount++;
        return [];
      },
    });

    assert.deepEqual(await provider.requireLabelerDefs(), []);
    assert.deepEqual(fetchCount, 0);
  });

  it("should share one fetch and not refetch once loaded", async () => {
    let fetchCount = 0;
    const provider = makeProvider({
      getLabelers: async (dids) => {
        fetchCount++;
        return dids.map(labelerDef);
      },
    });

    await Promise.all([
      provider.requireLabelerDefs(),
      provider.requireLabelerDefs(),
    ]);
    await provider.requireLabelerDefs();

    assert.deepEqual(fetchCount, 1);
  });

  it("should fall back to no definitions with a toast when the labeler service fails", async () => {
    const provider = makeProvider({
      getLabelers: async () => {
        throw new Error("502");
      },
    });

    assert.deepEqual(await provider.requireLabelerDefs(), []);
    const toasts = document.querySelectorAll('[data-testid="toast"]');
    assert.deepEqual(toasts.length, 1);
  });

  it("should reject when preferences fail to load, and recover on a later call", async () => {
    let shouldFail = true;
    const realSetTimeout = globalThis.setTimeout;
    // The preferences retry waits a second before its second attempt.
    globalThis.setTimeout = (callback) => realSetTimeout(callback, 0);
    try {
      const provider = makeProvider({
        getPreferences: async () => {
          if (shouldFail) throw new Error("preferences down");
          return [labelersPref];
        },
      });

      await assert.rejects(() => provider.requireLabelerDefs());
      assert.deepEqual(provider.$labelerDefs.get(), null);

      shouldFail = false;
      const labelerDefs = await provider.requireLabelerDefs();
      assert.deepEqual(labelerDefs.length, 2);
    } finally {
      globalThis.setTimeout = realSetTimeout;
    }
  });

  it("should add a definition once and remove it by DID", async () => {
    const provider = makeProvider();
    await provider.requireLabelerDefs();

    await provider.addLabelerDef(labelerDef("did:plc:new"));
    await provider.addLabelerDef(labelerDef("did:plc:new"));
    assert.deepEqual(
      provider.$labelerDefs.get().map((def) => def.creator.did),
      [subscribedLabelerDid, BSKY_LABELER_DID, "did:plc:new"],
    );

    await provider.removeLabelerDef(subscribedLabelerDid);
    assert.deepEqual(
      provider.$labelerDefs.get().map((def) => def.creator.did),
      [BSKY_LABELER_DID, "did:plc:new"],
    );
  });
});
