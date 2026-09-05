import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createSessionState } from "/js/dataLayer/sessionState.js";

describe("createSessionState", () => {
  const session = { did: "did:plc:testuser" };
  const storageKey = `session-state:${session.did}`;
  const legacyFeedKey = "home-view-currentFeedUri";
  const legacyDisplayKey = "display-preferences";

  // PersistedReactiveStore saves via an effect, which flushes on a double
  // requestAnimationFrame
  function flushEffects() {
    return new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
  }

  function cleanup() {
    localStorage.removeItem(storageKey);
    localStorage.removeItem(legacyFeedKey);
    localStorage.removeItem(legacyDisplayKey);
  }

  function stored() {
    return JSON.parse(localStorage.getItem(storageKey));
  }

  beforeEach(cleanup);
  afterEach(cleanup);

  describe("without a session", () => {
    it("uses defaults and ignores legacy keys", () => {
      localStorage.setItem(legacyFeedKey, JSON.stringify("following"));
      localStorage.setItem(
        legacyDisplayKey,
        JSON.stringify({ trendingHidden: true }),
      );
      const sessionState = createSessionState(null);
      assert.deepEqual(sessionState.$selectedFeedUri.get(), null);
      assert.deepEqual(sessionState.$trendingHidden.get(), false);
    });

    it("keeps changes in memory without persisting", async () => {
      const sessionState = createSessionState(null);
      sessionState.$selectedFeedUri.set("following");
      sessionState.$trendingHidden.set(true);
      await flushEffects();
      assert.deepEqual(sessionState.$selectedFeedUri.get(), "following");
      assert.deepEqual(sessionState.$trendingHidden.get(), true);
      assert.deepEqual(localStorage.getItem(storageKey), null);
    });
  });

  describe("selectedFeedUri", () => {
    it("restores the stored selection for the account", () => {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ selectedFeedUri: "following" }),
      );
      const sessionState = createSessionState(session);
      assert.deepEqual(sessionState.$selectedFeedUri.get(), "following");
    });

    it("migrates a selection stored under the legacy key", () => {
      localStorage.setItem(legacyFeedKey, JSON.stringify("following"));
      const sessionState = createSessionState(session);
      assert.deepEqual(sessionState.$selectedFeedUri.get(), "following");
      assert.deepEqual(localStorage.getItem(legacyFeedKey), null);
    });

    it("prefers the session-state key over the legacy key", () => {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ selectedFeedUri: "following" }),
      );
      localStorage.setItem(legacyFeedKey, JSON.stringify("stale"));
      const sessionState = createSessionState(session);
      assert.deepEqual(sessionState.$selectedFeedUri.get(), "following");
      assert.deepEqual(localStorage.getItem(legacyFeedKey), null);
    });

    it("persists selection changes", async () => {
      const sessionState = createSessionState(session);
      sessionState.$selectedFeedUri.set("following");
      await flushEffects();
      assert.deepEqual(stored(), { selectedFeedUri: "following" });
    });
  });

  describe("trendingHidden", () => {
    it("defaults to shown", () => {
      const sessionState = createSessionState(session);
      assert.deepEqual(sessionState.$trendingHidden.get(), false);
    });

    it("restores the stored value for the account", () => {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ trendingHidden: true }),
      );
      const sessionState = createSessionState(session);
      assert.deepEqual(sessionState.$trendingHidden.get(), true);
    });

    it("migrates a value stored under the legacy display-preferences key", () => {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ selectedFeedUri: "following" }),
      );
      localStorage.setItem(
        legacyDisplayKey,
        JSON.stringify({ trendingHidden: true }),
      );
      const sessionState = createSessionState(session);
      assert.deepEqual(sessionState.$trendingHidden.get(), true);
      assert.deepEqual(sessionState.$selectedFeedUri.get(), "following");
      assert.deepEqual(localStorage.getItem(legacyDisplayKey), null);
    });

    it("prefers the session-state key over the legacy key", () => {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ trendingHidden: false }),
      );
      localStorage.setItem(
        legacyDisplayKey,
        JSON.stringify({ trendingHidden: true }),
      );
      const sessionState = createSessionState(session);
      assert.deepEqual(sessionState.$trendingHidden.get(), false);
      assert.deepEqual(localStorage.getItem(legacyDisplayKey), null);
    });

    it("ignores a malformed legacy value", () => {
      localStorage.setItem(legacyDisplayKey, "{not json");
      const sessionState = createSessionState(session);
      assert.deepEqual(sessionState.$trendingHidden.get(), false);
      assert.deepEqual(localStorage.getItem(legacyDisplayKey), null);
    });

    it("persists changes", async () => {
      const sessionState = createSessionState(session);
      sessionState.$trendingHidden.set(true);
      await flushEffects();
      assert.deepEqual(stored(), { trendingHidden: true });
    });
  });
});
