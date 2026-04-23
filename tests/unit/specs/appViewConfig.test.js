import { TestSuite } from "../testSuite.js";
import { assert, assertEquals } from "../testHelpers.js";
import {
  getAppViewConfig,
  setAppViewConfig,
  resetAppViewConfig,
  handleAppViewResetQueryParam,
  isValidAppViewConfig,
  CUSTOM_APP_VIEW_CONFIG_ID,
} from "/js/appViewConfig.js";
import { AppViewConfig } from "/js/config.js";

const STORAGE_KEY = "appview-config";

function stripDisplayName({ id, appViewServiceDid, chatServiceDid }) {
  return { id, appViewServiceDid, chatServiceDid };
}

const t = new TestSuite("appViewConfig");

t.beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, "", "http://localhost/");
});

t.describe("getAppViewConfig", (it) => {
  it("returns the Bluesky config when localStorage is empty", () => {
    assertEquals(getAppViewConfig(), stripDisplayName(AppViewConfig.BLUESKY));
  });

  it("returns stored config when valid", () => {
    const stored = {
      id: CUSTOM_APP_VIEW_CONFIG_ID,
      appViewServiceDid: "did:web:example.com#bsky_appview",
      chatServiceDid: "did:web:example.com#bsky_chat",
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    assertEquals(getAppViewConfig(), stored);
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
    assertEquals(getAppViewConfig(), stripDisplayName(AppViewConfig.BLUESKY));
  });

  it("falls back to defaults when JSON is malformed", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    assertEquals(getAppViewConfig(), stripDisplayName(AppViewConfig.BLUESKY));
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
    assertEquals(getAppViewConfig(), stripDisplayName(AppViewConfig.BLUESKY));
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
    assertEquals(getAppViewConfig(), stripDisplayName(AppViewConfig.BLUESKY));
  });
});

t.describe("setAppViewConfig", (it) => {
  it("stores and round-trips a default config", () => {
    setAppViewConfig(AppViewConfig.BLACKSKY);
    assertEquals(getAppViewConfig(), stripDisplayName(AppViewConfig.BLACKSKY));
  });

  it("stores and round-trips a custom config", () => {
    const customConfig = {
      id: CUSTOM_APP_VIEW_CONFIG_ID,
      appViewServiceDid: "did:web:example.com#bsky_appview",
      chatServiceDid: "did:web:example.com#bsky_chat",
    };
    setAppViewConfig(customConfig);
    assertEquals(getAppViewConfig(), customConfig);
  });

  it("does not persist the displayName field", () => {
    setAppViewConfig({
      id: "blacksky",
      displayName: "Blacksky",
      appViewServiceDid: AppViewConfig.BLACKSKY.appViewServiceDid,
      chatServiceDid: AppViewConfig.BLACKSKY.chatServiceDid,
    });
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    assertEquals(Object.hasOwn(raw, "displayName"), false);
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

t.describe("isValidAppViewConfig", (it) => {
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
    assertEquals(
      isValidAppViewConfig({
        id: CUSTOM_APP_VIEW_CONFIG_ID,
        appViewServiceDid: "",
        chatServiceDid: "",
      }),
      false,
    );
  });

  it("rejects configs with unknown ids", () => {
    assertEquals(
      isValidAppViewConfig({
        id: "retired-appview",
        appViewServiceDid: "did:web:example.com#bsky_appview",
        chatServiceDid: "did:web:example.com#bsky_chat",
      }),
      false,
    );
  });
});

t.describe("resetAppViewConfig", (it) => {
  it("removes the stored config", () => {
    setAppViewConfig(AppViewConfig.BLACKSKY);
    resetAppViewConfig();
    assertEquals(localStorage.getItem(STORAGE_KEY), null);
    assertEquals(getAppViewConfig(), stripDisplayName(AppViewConfig.BLUESKY));
  });
});

t.describe("handleAppViewResetQueryParam", (it) => {
  it("clears the config and strips the param when present", () => {
    setAppViewConfig(AppViewConfig.BLACKSKY);
    window.history.replaceState(
      {},
      "",
      "http://localhost/?reset-appview=1&other=keep",
    );

    const result = handleAppViewResetQueryParam();

    assertEquals(result, true);
    assertEquals(localStorage.getItem(STORAGE_KEY), null);
    const search = new URLSearchParams(window.location.search);
    assertEquals(search.has("reset-appview"), false);
    assertEquals(search.get("other"), "keep");
  });

  it("is a no-op when the param is absent", () => {
    setAppViewConfig(AppViewConfig.BLACKSKY);
    window.history.replaceState({}, "", "http://localhost/?foo=bar");

    const result = handleAppViewResetQueryParam();

    assertEquals(result, false);
    assertEquals(
      JSON.parse(localStorage.getItem(STORAGE_KEY)).id,
      AppViewConfig.BLACKSKY.id,
    );
    assertEquals(window.location.search, "?foo=bar");
  });
});

await t.run();
