import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  getAppViewConfig,
  setAppViewConfig,
  resetAppViewConfig,
  handleAppViewResetQueryParam,
  isValidAppViewConfig,
  CUSTOM_APP_VIEW_CONFIG_ID,
} from "/js/appViewConfig.js";
import { AppViewConfig } from "/js/config.js";

describe("appViewConfig", () => {
  const STORAGE_KEY = "appview-config";

  function stripDisplayName({ id, appViewServiceDid, chatServiceDid }) {
    return { id, appViewServiceDid, chatServiceDid };
  }

  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, "", "http://localhost/");
  });

  describe("getAppViewConfig", () => {
    it("returns the Bluesky config when localStorage is empty", () => {
      assert.deepEqual(
        getAppViewConfig(),
        stripDisplayName(AppViewConfig.BLUESKY),
      );
    });

    it("returns stored config when valid", () => {
      const stored = {
        id: CUSTOM_APP_VIEW_CONFIG_ID,
        appViewServiceDid: "did:web:example.com#bsky_appview",
        chatServiceDid: "did:web:example.com#bsky_chat",
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      assert.deepEqual(getAppViewConfig(), stored);
    });

    it("ignores legacy displayName field on stored config", () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          id: "bluesky",
          displayName: "Bluesky",
          appViewServiceDid: AppViewConfig.BLUESKY.appViewServiceDid,
          chatServiceDid: AppViewConfig.BLUESKY.chatServiceDid,
        }),
      );
      assert.deepEqual(
        getAppViewConfig(),
        stripDisplayName(AppViewConfig.BLUESKY),
      );
    });

    it("falls back to defaults when JSON is malformed", () => {
      localStorage.setItem(STORAGE_KEY, "{not json");
      assert.deepEqual(
        getAppViewConfig(),
        stripDisplayName(AppViewConfig.BLUESKY),
      );
    });

    it("falls back to defaults when id is unknown", () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          id: "retired-appview",
          appViewServiceDid: "did:web:example.com#bsky_appview",
          chatServiceDid: "did:web:example.com#bsky_chat",
        }),
      );
      assert.deepEqual(
        getAppViewConfig(),
        stripDisplayName(AppViewConfig.BLUESKY),
      );
    });

    it("falls back to defaults when DIDs are empty strings", () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          id: "bluesky",
          appViewServiceDid: "",
          chatServiceDid: "",
        }),
      );
      assert.deepEqual(
        getAppViewConfig(),
        stripDisplayName(AppViewConfig.BLUESKY),
      );
    });
  });

  describe("setAppViewConfig", () => {
    it("stores and round-trips a default config", () => {
      setAppViewConfig(AppViewConfig.BLACKSKY);
      assert.deepEqual(
        getAppViewConfig(),
        stripDisplayName(AppViewConfig.BLACKSKY),
      );
    });

    it("stores and round-trips a custom config", () => {
      const customConfig = {
        id: CUSTOM_APP_VIEW_CONFIG_ID,
        appViewServiceDid: "did:web:example.com#bsky_appview",
        chatServiceDid: "did:web:example.com#bsky_chat",
      };
      setAppViewConfig(customConfig);
      assert.deepEqual(getAppViewConfig(), customConfig);
    });

    it("does not persist the displayName field", () => {
      setAppViewConfig({
        id: "blacksky",
        displayName: "Blacksky",
        appViewServiceDid: AppViewConfig.BLACKSKY.appViewServiceDid,
        chatServiceDid: AppViewConfig.BLACKSKY.chatServiceDid,
      });
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
      assert.deepEqual(Object.hasOwn(raw, "displayName"), false);
    });

    it("throws when id is missing", () => {
      let threw = false;
      try {
        setAppViewConfig({
          appViewServiceDid: "did:web:example.com#bsky_appview",
          chatServiceDid: "did:web:example.com#bsky_chat",
        });
      } catch {
        threw = true;
      }
      assert(threw, "expected setAppViewConfig to throw when id is missing");
    });

    it("throws when id is unknown", () => {
      let threw = false;
      try {
        setAppViewConfig({
          id: "unknown",
          appViewServiceDid: "did:web:example.com#bsky_appview",
          chatServiceDid: "did:web:example.com#bsky_chat",
        });
      } catch {
        threw = true;
      }
      assert(threw, "expected setAppViewConfig to throw when id is unknown");
    });

    it("throws when DIDs are missing", () => {
      let threw = false;
      try {
        setAppViewConfig({ id: "blacksky" });
      } catch {
        threw = true;
      }
      assert(threw, "expected setAppViewConfig to throw when DIDs are missing");
    });
  });

  describe("isValidAppViewConfig", () => {
    it("accepts a known default config", () => {
      assert(isValidAppViewConfig(AppViewConfig.BLUESKY));
    });

    it("accepts a custom config with non-empty DIDs", () => {
      assert(
        isValidAppViewConfig({
          id: CUSTOM_APP_VIEW_CONFIG_ID,
          appViewServiceDid: "did:web:example.com#bsky_appview",
          chatServiceDid: "did:web:example.com#bsky_chat",
        }),
      );
    });

    it("rejects configs with empty DIDs (e.g. whitespace-trimmed custom input)", () => {
      assert.deepEqual(
        isValidAppViewConfig({
          id: CUSTOM_APP_VIEW_CONFIG_ID,
          appViewServiceDid: "",
          chatServiceDid: "",
        }),
        false,
      );
    });

    it("rejects configs with unknown ids", () => {
      assert.deepEqual(
        isValidAppViewConfig({
          id: "retired-appview",
          appViewServiceDid: "did:web:example.com#bsky_appview",
          chatServiceDid: "did:web:example.com#bsky_chat",
        }),
        false,
      );
    });
  });

  describe("resetAppViewConfig", () => {
    it("removes the stored config", () => {
      setAppViewConfig(AppViewConfig.BLACKSKY);
      resetAppViewConfig();
      assert.deepEqual(localStorage.getItem(STORAGE_KEY), null);
      assert.deepEqual(
        getAppViewConfig(),
        stripDisplayName(AppViewConfig.BLUESKY),
      );
    });
  });

  describe("handleAppViewResetQueryParam", () => {
    it("clears the config and strips the param when present", () => {
      setAppViewConfig(AppViewConfig.BLACKSKY);
      window.history.replaceState(
        {},
        "",
        "http://localhost/?reset-appview=1&other=keep",
      );

      const result = handleAppViewResetQueryParam();

      assert.deepEqual(result, true);
      assert.deepEqual(localStorage.getItem(STORAGE_KEY), null);
      const search = new URLSearchParams(window.location.search);
      assert.deepEqual(search.has("reset-appview"), false);
      assert.deepEqual(search.get("other"), "keep");
    });

    it("is a no-op when the param is absent", () => {
      setAppViewConfig(AppViewConfig.BLACKSKY);
      window.history.replaceState({}, "", "http://localhost/?foo=bar");

      const result = handleAppViewResetQueryParam();

      assert.deepEqual(result, false);
      assert.deepEqual(
        JSON.parse(localStorage.getItem(STORAGE_KEY)).id,
        AppViewConfig.BLACKSKY.id,
      );
      assert.deepEqual(window.location.search, "?foo=bar");
    });
  });
});
