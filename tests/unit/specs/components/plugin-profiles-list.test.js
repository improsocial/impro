import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import { SignalMap } from "/js/signals.js";
import "/js/components/plugin-profiles-list.js";

const t = new TestSuite("PluginProfilesList");

function makeDataLayer({ ensureProfiles } = {}) {
  const profileSignals = new SignalMap();
  const declarative = {
    ensureProfiles:
      ensureProfiles ??
      (async (dids) =>
        dids.map((did) => profileSignals.get(did).get() ?? null)),
  };
  return {
    declarative,
    derived: {
      $hydratedProfiles: profileSignals,
    },
    __setProfile(did, profile) {
      profileSignals.set(did, profile);
    },
  };
}

function makeProfile(did, handle) {
  return { did, handle, displayName: handle };
}

async function flushMicrotasks() {
  // Two ticks: the first flushes microtasks (e.g. ensureProfiles), the second
  // lets the rAF-scheduled effect render run before assertions.
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

t.beforeEach(() => {
  document.body.innerHTML = "";
});

t.describe("PluginProfilesList - loading state", (it) => {
  it("renders one skeleton per did before profiles resolve", () => {
    const element = document.createElement("plugin-profiles-list");
    element.dataLayer = makeDataLayer({
      ensureProfiles: () => new Promise(() => {}),
    });
    element.setAttribute("dids", "did:test:a,did:test:b,did:test:c");
    document.body.appendChild(element);
    assertEquals(
      element.querySelectorAll("[data-testid='skeleton-avatar']").length,
      3,
    );
  });
});

t.describe("PluginProfilesList - loaded state", (it) => {
  it("renders profile list items once ensureProfiles resolves", async () => {
    const dataLayer = makeDataLayer();
    dataLayer.__setProfile("did:test:a", makeProfile("did:test:a", "a.test"));
    dataLayer.__setProfile("did:test:b", makeProfile("did:test:b", "b.test"));
    const element = document.createElement("plugin-profiles-list");
    element.dataLayer = dataLayer;
    element.setAttribute("dids", "did:test:a,did:test:b");
    document.body.appendChild(element);
    await flushMicrotasks();
    const items = element.querySelectorAll(
      "[data-testid='profile-list-item-display-name']",
    );
    assertEquals(items.length, 2);
    assert(items[0].textContent.includes("a.test"));
    assert(items[1].textContent.includes("b.test"));
  });

  it("filters out missing entries from the selector", async () => {
    const dataLayer = makeDataLayer();
    dataLayer.__setProfile("did:test:a", makeProfile("did:test:a", "a.test"));
    const element = document.createElement("plugin-profiles-list");
    element.dataLayer = dataLayer;
    element.setAttribute("dids", "did:test:a,did:test:missing");
    document.body.appendChild(element);
    await flushMicrotasks();
    assertEquals(
      element.querySelectorAll("[data-testid='profile-list-item-display-name']")
        .length,
      1,
    );
  });

  it("does not render the end-of-feed message", async () => {
    const dataLayer = makeDataLayer();
    dataLayer.__setProfile("did:test:a", makeProfile("did:test:a", "a.test"));
    const element = document.createElement("plugin-profiles-list");
    element.dataLayer = dataLayer;
    element.setAttribute("dids", "did:test:a");
    document.body.appendChild(element);
    await flushMicrotasks();
    assertEquals(
      element.querySelector("[data-testid='feed-end-message']"),
      null,
    );
  });
});

t.describe("PluginProfilesList - empty dids", (it) => {
  it("renders no skeletons or items when dids is empty", () => {
    const element = document.createElement("plugin-profiles-list");
    let called = false;
    element.dataLayer = makeDataLayer({
      ensureProfiles: async () => {
        called = true;
        return [];
      },
    });
    element.setAttribute("dids", "");
    document.body.appendChild(element);
    assertEquals(
      element.querySelectorAll("[data-testid='skeleton-avatar']").length,
      0,
    );
    assertEquals(
      element.querySelectorAll("[data-testid='profile-list-item-display-name']")
        .length,
      0,
    );
    assertEquals(called, false);
  });
});

t.describe("PluginProfilesList - error state", (it) => {
  it("renders the error message when ensureProfiles rejects", async () => {
    const element = document.createElement("plugin-profiles-list");
    element.dataLayer = makeDataLayer({
      ensureProfiles: async () => {
        throw new Error("boom");
      },
    });
    element.setAttribute("dids", "did:test:a");
    document.body.appendChild(element);
    await flushMicrotasks();
    const error = element.querySelector(".profile-list-error");
    assert(error !== null);
    assert(error.textContent.includes("boom"));
  });
});

t.describe("PluginProfilesList - did changes", (it) => {
  it("reloads when the dids attribute changes", async () => {
    const calls = [];
    const dataLayer = makeDataLayer({
      ensureProfiles: async (dids) => {
        calls.push(dids);
        dids.forEach((did) =>
          dataLayer.__setProfile(did, makeProfile(did, did)),
        );
        return dids.map((did) =>
          dataLayer.derived.$hydratedProfiles.get(did).get(),
        );
      },
    });
    const element = document.createElement("plugin-profiles-list");
    element.dataLayer = dataLayer;
    element.setAttribute("dids", "did:test:a");
    document.body.appendChild(element);
    await flushMicrotasks();
    element.setAttribute("dids", "did:test:b,did:test:c");
    await flushMicrotasks();
    assertEquals(calls.length, 2);
    assertEquals(calls[0], ["did:test:a"]);
    assertEquals(calls[1], ["did:test:b", "did:test:c"]);
    assertEquals(
      element.querySelectorAll("[data-testid='profile-list-item-display-name']")
        .length,
      2,
    );
  });

  it("ignores stale ensureProfiles results when dids change mid-flight", async () => {
    const dataLayer = makeDataLayer();
    let resolveFirst;
    const firstPromise = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    let callIndex = 0;
    dataLayer.declarative.ensureProfiles = (dids) => {
      callIndex++;
      if (callIndex === 1) return firstPromise;
      dids.forEach((did) => dataLayer.__setProfile(did, makeProfile(did, did)));
      return Promise.resolve(
        dids.map((did) => dataLayer.derived.$hydratedProfiles.get(did).get()),
      );
    };
    const element = document.createElement("plugin-profiles-list");
    element.dataLayer = dataLayer;
    element.setAttribute("dids", "did:test:stale");
    document.body.appendChild(element);
    element.setAttribute("dids", "did:test:fresh");
    await flushMicrotasks();
    resolveFirst([makeProfile("did:test:stale", "stale")]);
    await flushMicrotasks();
    const items = element.querySelectorAll(
      "[data-testid='profile-list-item-display-name']",
    );
    assertEquals(items.length, 1);
    assert(items[0].textContent.includes("fresh"));
  });
});

t.describe("PluginProfilesList - live updates", (it) => {
  it("re-renders when a profile signal updates", async () => {
    const dataLayer = makeDataLayer();
    dataLayer.__setProfile("did:test:a", makeProfile("did:test:a", "a.test"));
    const element = document.createElement("plugin-profiles-list");
    element.dataLayer = dataLayer;
    element.setAttribute("dids", "did:test:a");
    document.body.appendChild(element);
    await flushMicrotasks();
    dataLayer.__setProfile("did:test:a", makeProfile("did:test:a", "updated"));
    await flushMicrotasks();
    const items = element.querySelectorAll(
      "[data-testid='profile-list-item-display-name']",
    );
    assert(items[0].textContent.includes("updated"));
  });
});

await t.run();
