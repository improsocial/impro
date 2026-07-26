import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import "/js/context-provider.js";
import "/js/components/plugin-profiles-list.js";
import { makeTestDataLayer } from "../../testHelpers.js";

function mount(element, dataLayer) {
  const provider = document.createElement("context-provider");
  provider.setAttribute("context-id", "plugin-component-context");
  provider.context = { dataLayer };
  provider.appendChild(element);
  document.body.appendChild(provider);
  return element;
}

describe("plugin-profiles-list", () => {
  function seedProfile(dataLayer, profile) {
    dataLayer.dataStore.$profiles.set(profile.did, profile);
  }

  function makeProfile(did, handle) {
    return { did, handle, displayName: handle };
  }

  async function flushMicrotasks() {
    // Two ticks: the first flushes microtasks (e.g. ensureDetailedProfiles),
    // the second lets the rAF-scheduled effect render run before assertions.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  beforeEach(() => {
    document.body.innerHTML = "";
  });

  describe("PluginProfilesList - loading state", () => {
    it("renders one skeleton per did before profiles resolve", () => {
      const dataLayer = makeTestDataLayer();
      mock.method(
        dataLayer.declarative,
        "ensureDetailedProfiles",
        () => new Promise(() => {}),
      );
      const element = document.createElement("plugin-profiles-list");
      element.setAttribute("dids", "did:test:a,did:test:b,did:test:c");
      mount(element, dataLayer);
      assert.deepEqual(
        element.querySelectorAll("[data-testid='skeleton-avatar']").length,
        3,
      );
    });
  });

  describe("PluginProfilesList - loaded state", () => {
    it("renders profile list items once ensureDetailedProfiles resolves", async () => {
      const dataLayer = makeTestDataLayer();
      mock.method(
        dataLayer.declarative,
        "ensureDetailedProfiles",
        async () => [],
      );
      seedProfile(dataLayer, makeProfile("did:test:a", "a.test"));
      seedProfile(dataLayer, makeProfile("did:test:b", "b.test"));
      const element = document.createElement("plugin-profiles-list");
      element.setAttribute("dids", "did:test:a,did:test:b");
      mount(element, dataLayer);
      await flushMicrotasks();
      const items = element.querySelectorAll(
        "[data-testid='profile-list-item-display-name']",
      );
      assert.deepEqual(items.length, 2);
      assert(items[0].textContent.includes("a.test"));
      assert(items[1].textContent.includes("b.test"));
    });

    it("filters out missing entries from the selector", async () => {
      const dataLayer = makeTestDataLayer();
      mock.method(
        dataLayer.declarative,
        "ensureDetailedProfiles",
        async () => [],
      );
      seedProfile(dataLayer, makeProfile("did:test:a", "a.test"));
      const element = document.createElement("plugin-profiles-list");
      element.setAttribute("dids", "did:test:a,did:test:missing");
      mount(element, dataLayer);
      await flushMicrotasks();
      assert.deepEqual(
        element.querySelectorAll(
          "[data-testid='profile-list-item-display-name']",
        ).length,
        1,
      );
    });

    it("does not render follow buttons on any row", async () => {
      const dataLayer = makeTestDataLayer();
      mock.method(
        dataLayer.declarative,
        "ensureDetailedProfiles",
        async () => [],
      );
      seedProfile(dataLayer, makeProfile("did:test:a", "a.test"));
      seedProfile(dataLayer, makeProfile("did:test:b", "b.test"));
      const element = document.createElement("plugin-profiles-list");
      element.setAttribute("dids", "did:test:a,did:test:b");
      mount(element, dataLayer);
      await flushMicrotasks();
      assert.deepEqual(
        element.querySelectorAll("[data-testid='follow-button']").length,
        0,
      );
    });

    it("does not render the end-of-feed message", async () => {
      const dataLayer = makeTestDataLayer();
      mock.method(
        dataLayer.declarative,
        "ensureDetailedProfiles",
        async () => [],
      );
      seedProfile(dataLayer, makeProfile("did:test:a", "a.test"));
      const element = document.createElement("plugin-profiles-list");
      element.setAttribute("dids", "did:test:a");
      mount(element, dataLayer);
      await flushMicrotasks();
      assert.deepEqual(
        element.querySelector("[data-testid='feed-end-message']"),
        null,
      );
    });
  });

  describe("PluginProfilesList - empty dids", () => {
    it("renders no skeletons or items when dids is empty", () => {
      const dataLayer = makeTestDataLayer();
      const ensureDetailedProfiles = mock.method(
        dataLayer.declarative,
        "ensureDetailedProfiles",
        async () => [],
      );
      const element = document.createElement("plugin-profiles-list");
      element.setAttribute("dids", "");
      mount(element, dataLayer);
      assert.deepEqual(
        element.querySelectorAll("[data-testid='skeleton-avatar']").length,
        0,
      );
      assert.deepEqual(
        element.querySelectorAll(
          "[data-testid='profile-list-item-display-name']",
        ).length,
        0,
      );
      assert.deepEqual(ensureDetailedProfiles.mock.callCount(), 0);
    });
  });

  describe("PluginProfilesList - error state", () => {
    it("renders the error message when ensureDetailedProfiles rejects", async () => {
      const dataLayer = makeTestDataLayer();
      mock.method(dataLayer.declarative, "ensureDetailedProfiles", async () => {
        throw new Error("boom");
      });
      const element = document.createElement("plugin-profiles-list");
      element.setAttribute("dids", "did:test:a");
      mount(element, dataLayer);
      await flushMicrotasks();
      const error = element.querySelector(".profile-list-error");
      assert(error !== null);
      assert(error.textContent.includes("boom"));
    });
  });

  describe("PluginProfilesList - did changes", () => {
    it("reloads when the dids attribute changes", async () => {
      const dataLayer = makeTestDataLayer();
      const ensureDetailedProfiles = mock.method(
        dataLayer.declarative,
        "ensureDetailedProfiles",
        async (dids) => {
          dids.forEach((did) => seedProfile(dataLayer, makeProfile(did, did)));
          return dids.map((did) =>
            dataLayer.derived.$hydratedProfiles.get(did),
          );
        },
      );
      const element = document.createElement("plugin-profiles-list");
      element.setAttribute("dids", "did:test:a");
      mount(element, dataLayer);
      await flushMicrotasks();
      element.setAttribute("dids", "did:test:b,did:test:c");
      await flushMicrotasks();
      assert.deepEqual(ensureDetailedProfiles.mock.callCount(), 2);
      assert.deepEqual(ensureDetailedProfiles.mock.calls[0].arguments[0], [
        "did:test:a",
      ]);
      assert.deepEqual(ensureDetailedProfiles.mock.calls[1].arguments[0], [
        "did:test:b",
        "did:test:c",
      ]);
      assert.deepEqual(
        element.querySelectorAll(
          "[data-testid='profile-list-item-display-name']",
        ).length,
        2,
      );
    });

    it("ignores stale ensureDetailedProfiles results when dids change mid-flight", async () => {
      const dataLayer = makeTestDataLayer();
      let resolveFirst;
      const firstPromise = new Promise((resolve) => {
        resolveFirst = resolve;
      });
      let callIndex = 0;
      mock.method(dataLayer.declarative, "ensureDetailedProfiles", (dids) => {
        callIndex++;
        if (callIndex === 1) return firstPromise;
        dids.forEach((did) => seedProfile(dataLayer, makeProfile(did, did)));
        return Promise.resolve(
          dids.map((did) => dataLayer.derived.$hydratedProfiles.get(did)),
        );
      });
      const element = document.createElement("plugin-profiles-list");
      element.setAttribute("dids", "did:test:stale");
      mount(element, dataLayer);
      element.setAttribute("dids", "did:test:fresh");
      await flushMicrotasks();
      resolveFirst([makeProfile("did:test:stale", "stale")]);
      await flushMicrotasks();
      const items = element.querySelectorAll(
        "[data-testid='profile-list-item-display-name']",
      );
      assert.deepEqual(items.length, 1);
      assert(items[0].textContent.includes("fresh"));
    });
  });

  describe("PluginProfilesList - live updates", () => {
    it("re-renders when a profile signal updates", async () => {
      const dataLayer = makeTestDataLayer();
      mock.method(
        dataLayer.declarative,
        "ensureDetailedProfiles",
        async () => [],
      );
      seedProfile(dataLayer, makeProfile("did:test:a", "a.test"));
      const element = document.createElement("plugin-profiles-list");
      element.setAttribute("dids", "did:test:a");
      mount(element, dataLayer);
      await flushMicrotasks();
      seedProfile(dataLayer, makeProfile("did:test:a", "updated"));
      await flushMicrotasks();
      const items = element.querySelectorAll(
        "[data-testid='profile-list-item-display-name']",
      );
      assert(items[0].textContent.includes("updated"));
    });
  });
});
