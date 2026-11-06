import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createSessionState } from "/js/dataLayer/sessionState.js";

describe("createSessionState", () => {
  const session = { did: "did:plc:testuser" };
  const storageKey = `session-state:${session.did}`;

  // PersistedReactiveStore saves via an effect, which flushes on a double
  // requestAnimationFrame
  function flushEffects() {
    return new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
  }

  function cleanup() {
    localStorage.removeItem(storageKey);
  }

  function stored() {
    return JSON.parse(localStorage.getItem(storageKey));
  }

  beforeEach(cleanup);
  afterEach(cleanup);

  describe("without a session", () => {
    it("uses defaults", () => {
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

    it("persists selection changes", async () => {
      const sessionState = createSessionState(session);
      sessionState.$selectedFeedUri.set("following");
      await flushEffects();
      assert.deepEqual(stored(), { selectedFeedUri: "following" });
    });
  });

  describe("postLanguageHistory", () => {
    it("persists history for the account once it changes", async () => {
      const sessionState = createSessionState(session);
      sessionState.$postLanguageHistory.set([["ja", "en"], ["en"]]);
      await flushEffects();
      assert.deepEqual(stored(), {
        postLanguageHistory: [["ja", "en"], ["en"]],
      });
      const restored = createSessionState(session);
      assert.deepEqual(restored.$postLanguageHistory.get(), [
        ["ja", "en"],
        ["en"],
      ]);
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

    it("persists changes", async () => {
      const sessionState = createSessionState(session);
      sessionState.$trendingHidden.set(true);
      await flushEffects();
      assert.deepEqual(stored(), { trendingHidden: true });
    });
  });
});
