import { TestSuite } from "../testSuite.js";
import { assertEquals } from "../testHelpers.js";
import { setUpIdentityPrecaching } from "/js/identityPrecaching.js";
import { DataStore } from "/js/dataLayer/dataStore.js";

const t = new TestSuite("identityPrecaching");

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

t.describe("notifications precaching", (it) => {
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

    assertEquals(resolvedHandles.get("alice.test"), "did:plc:alice");
    assertEquals(resolvedHandles.get("bob.test"), "did:plc:bob");
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

    assertEquals(resolvedHandles.get("carol.test"), "did:plc:carol");
  });
});

await t.run();
