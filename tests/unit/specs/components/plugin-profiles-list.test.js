import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import "/js/components/plugin-profiles-list.js";

const t = new TestSuite("PluginProfilesList");

function makeDataLayer(impl) {
  return { declarative: { ensureProfiles: impl } };
}

function makeProfile(did, handle) {
  return { did, handle, displayName: handle };
}

function flushMicrotasks() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

t.beforeEach(() => {
  document.body.innerHTML = "";
});

t.describe("PluginProfilesList - loading state", (it) => {
  it("renders one skeleton per did before profiles resolve", () => {
    const element = document.createElement("plugin-profiles-list");
    element.dataLayer = makeDataLayer(() => new Promise(() => {}));
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
    const profileA = makeProfile("did:test:a", "a.test");
    const profileB = makeProfile("did:test:b", "b.test");
    const element = document.createElement("plugin-profiles-list");
    element.dataLayer = makeDataLayer(async () => [profileA, profileB]);
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

  it("filters out null entries from ensureProfiles", async () => {
    const profileA = makeProfile("did:test:a", "a.test");
    const element = document.createElement("plugin-profiles-list");
    element.dataLayer = makeDataLayer(async () => [profileA, null]);
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
    const element = document.createElement("plugin-profiles-list");
    element.dataLayer = makeDataLayer(async () => [
      makeProfile("did:test:a", "a.test"),
    ]);
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
    element.dataLayer = makeDataLayer(async () => {
      called = true;
      return [];
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
    element.dataLayer = makeDataLayer(async () => {
      throw new Error("boom");
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
    const element = document.createElement("plugin-profiles-list");
    element.dataLayer = makeDataLayer(async (dids) => {
      calls.push(dids);
      return dids.map((did) => makeProfile(did, did));
    });
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
    const element = document.createElement("plugin-profiles-list");
    let resolveFirst;
    const firstPromise = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    let callIndex = 0;
    element.dataLayer = makeDataLayer((dids) => {
      callIndex++;
      if (callIndex === 1) return firstPromise;
      return Promise.resolve(dids.map((did) => makeProfile(did, did)));
    });
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

await t.run();
