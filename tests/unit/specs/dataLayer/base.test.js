import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import { DataStore } from "/js/dataLayer/dataStore.js";
import { PatchStore } from "/js/dataLayer/patchStore.js";
import * as base from "/js/dataLayer/base.js";

const t = new TestSuite("base");

t.describe("getProfile", (it) => {
  const profileDID = "did:test:profile";
  const testProfile = {
    did: profileDID,
    handle: "test.profile",
    displayName: "Test Profile",
    viewer: { following: null },
  };

  it("returns null when profile does not exist", () => {
    const dataStore = new DataStore();
    const patchStore = new PatchStore();
    assertEquals(base.getProfile(dataStore, patchStore, profileDID), null);
  });

  it("returns profile with patches applied", () => {
    const dataStore = new DataStore();
    const patchStore = new PatchStore();
    dataStore.setProfile(profileDID, testProfile);
    patchStore.addProfilePatch(profileDID, { type: "followProfile" });
    const result = base.getProfile(dataStore, patchStore, profileDID);
    assertEquals(result.viewer.following, "fake following");
    assertEquals(result.did, profileDID);
  });

  it("returns a copy of the profile when no patches exist", () => {
    const dataStore = new DataStore();
    const patchStore = new PatchStore();
    dataStore.setProfile(profileDID, testProfile);
    const result = base.getProfile(dataStore, patchStore, profileDID);
    assertEquals(result, testProfile);
    assert(result !== testProfile);
  });
});

await t.run();
