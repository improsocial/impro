import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { setUpIdentityPrecaching } from "/js/identityPrecaching.js";
import { DataStore } from "/js/dataLayer/dataStore.js";

function setup() {
  const dataStore = new DataStore();
  const dataLayer = {
    dataStore,
    preferencesProvider: { $preferences: { get: () => null } },
  };
  const resolvedHandles = new Map();
  const identityResolver = {
    setDidForHandle: (handle, did) => resolvedHandles.set(handle, did),
  };
  return { dataStore, dataLayer, identityResolver, resolvedHandles };
}

const flushEffects = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("notifications precaching", () => {
  it("should cache author identities from stored notifications", async () => {
    const { dataStore, dataLayer, identityResolver, resolvedHandles } = setup();
    dataStore.$notifications.set({
      notifications: [
        { author: { handle: "alice.test", did: "did:plc:alice" } },
        { author: { handle: "bob.test", did: "did:plc:bob" } },
      ],
      cursor: "c1",
    });

    setUpIdentityPrecaching(dataLayer, identityResolver);

    assert.deepEqual(resolvedHandles.get("alice.test"), "did:plc:alice");
    assert.deepEqual(resolvedHandles.get("bob.test"), "did:plc:bob");
  });

  it("should cache identities when notifications load after setup", async () => {
    const { dataStore, dataLayer, identityResolver, resolvedHandles } = setup();
    setUpIdentityPrecaching(dataLayer, identityResolver);

    dataStore.$notifications.set({
      notifications: [
        { author: { handle: "carol.test", did: "did:plc:carol" } },
      ],
      cursor: null,
    });
    await flushEffects();

    assert.deepEqual(resolvedHandles.get("carol.test"), "did:plc:carol");
  });
});
