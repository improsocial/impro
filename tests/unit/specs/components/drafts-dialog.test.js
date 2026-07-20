import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { respondToConfirm } from "../../testHelpers.js";
import { Signal } from "/js/signals.js";
import { getDraftDeviceId } from "/js/drafts.js";
import "/js/components/drafts-dialog.js";

describe("drafts-dialog", () => {
  const originalSetTimeout = globalThis.setTimeout;

  beforeEach(() => {
    document.body.innerHTML = "";
    globalThis.setTimeout = (fn) => originalSetTimeout(fn, 0);
  });

  afterEach(() => {
    globalThis.setTimeout = originalSetTimeout;
  });

  async function nextFrame() {
    // The render effect flushes on requestAnimationFrame (setTimeout(0) in the
    // test env), so one tick applies pending renders.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  async function flushMicrotasks() {
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
    }
  }

  function createFakeDataLayer({ loadDrafts, deleteDraft } = {}) {
    const $hydratedDrafts = new Signal.State(null);
    const loadCalls = [];
    const deleteCalls = [];
    const dataLayer = {
      derived: { $hydratedDrafts },
      requests: {
        loadDrafts: (options) => {
          loadCalls.push(options);
          if (loadDrafts) {
            return loadDrafts(options);
          }
          return Promise.resolve();
        },
      },
      mutations: {
        deleteDraft: (args) => {
          deleteCalls.push(args);
          if (deleteDraft) {
            return deleteDraft(args);
          }
          return Promise.resolve();
        },
      },
    };
    return { dataLayer, $hydratedDrafts, loadCalls, deleteCalls };
  }

  function createDialog(dataLayer) {
    const container = document.createElement("div");
    container.className = "page-visible";
    const element = document.createElement("drafts-dialog");
    element.dataLayer = dataLayer;
    container.appendChild(element);
    document.body.appendChild(container);
    return element;
  }

  // Mirrors the shape produced by derived.$hydratedDrafts: the hydrated posts
  // live on draftView.posts while the raw record (deviceId, localRefs) lives
  // on draftView.draft. The dialog only reads display fields from the
  // hydrated posts, so sharing one array between both is fine here.
  function createDraftView({
    id = "draft-1",
    updatedAt = "2025-01-01T00:00:00.000Z",
    deviceId = getDraftDeviceId(),
    posts = [{ text: "Hello draft" }],
  } = {}) {
    return {
      id,
      updatedAt,
      draft: { deviceId, deviceName: "Web", posts },
      posts,
    };
  }

  function seedDrafts($hydratedDrafts, draftViews, { cursor = null } = {}) {
    $hydratedDrafts.set({ drafts: draftViews, cursor });
  }

  describe("DraftsDialog - loading", () => {
    it("should render the dialog chrome with a loading spinner while drafts are null", () => {
      const { dataLayer } = createFakeDataLayer();
      const element = createDialog(dataLayer);
      const dialog = element.querySelector('[data-testid="drafts-dialog"]');
      assert(dialog !== null);
      assert(dialog.classList.contains("bottom-sheet"));
      assert(dialog.classList.contains("bottom-sheet-stacked"));
      assert(
        element.querySelector('[data-testid="drafts-dialog-back"]') !== null,
      );
      assert(element.querySelector(".loading-spinner") !== null);
      assert.deepEqual(
        element.querySelector('[data-testid="draft-item"]'),
        null,
      );
    });

    it("should load drafts with reload on connect when none are cached", async () => {
      const { dataLayer, loadCalls } = createFakeDataLayer();
      createDialog(dataLayer);
      await flushMicrotasks();
      assert.deepEqual(loadCalls, [{ reload: true }]);
    });

    it("should not reload drafts that are already cached", async () => {
      const { dataLayer, $hydratedDrafts, loadCalls } = createFakeDataLayer();
      seedDrafts($hydratedDrafts, [createDraftView()]);
      createDialog(dataLayer);
      await flushMicrotasks();
      assert.deepEqual(loadCalls.length, 0);
    });

    it("should show the error state when the initial load fails", async (t) => {
      t.mock.method(console, "error", () => {});
      const { dataLayer } = createFakeDataLayer({
        loadDrafts: () => Promise.reject(new Error("boom")),
      });
      const element = createDialog(dataLayer);
      await flushMicrotasks();
      await nextFrame();
      assert(element.querySelector('[data-testid="error-state"]') !== null);
      assert.deepEqual(element.querySelector(".loading-spinner"), null);
    });

    it("should show the empty state when there are no drafts", async () => {
      const { dataLayer, $hydratedDrafts } = createFakeDataLayer();
      seedDrafts($hydratedDrafts, []);
      const element = createDialog(dataLayer);
      assert(element.querySelector('[data-testid="empty-state"]') !== null);
      assert.deepEqual(
        element.querySelector('[data-testid="draft-item"]'),
        null,
      );
    });
  });

  describe("DraftsDialog - draft items", () => {
    it("should render one item per draft with its text and a timestamp", () => {
      const { dataLayer, $hydratedDrafts } = createFakeDataLayer();
      seedDrafts($hydratedDrafts, [
        createDraftView({ id: "draft-1", posts: [{ text: "First draft" }] }),
        createDraftView({ id: "draft-2", posts: [{ text: "Second draft" }] }),
      ]);
      const element = createDialog(dataLayer);
      const items = element.querySelectorAll('[data-testid="draft-item"]');
      assert.deepEqual(items.length, 2);
      assert(items[0].textContent.includes("First draft"));
      assert(items[1].textContent.includes("Second draft"));
      assert(items[0].querySelector(".draft-item-timestamp") !== null);
      assert.deepEqual(
        items[0].querySelectorAll('[data-testid="draft-item-tag-thread"]')
          .length,
        0,
      );
    });

    it("should tag multi-post drafts with the extra post count", () => {
      const { dataLayer, $hydratedDrafts } = createFakeDataLayer();
      seedDrafts($hydratedDrafts, [
        createDraftView({
          id: "draft-1",
          posts: [{ text: "one" }, { text: "two" }],
        }),
        createDraftView({
          id: "draft-2",
          posts: [{ text: "one" }, { text: "two" }, { text: "three" }],
        }),
      ]);
      const element = createDialog(dataLayer);
      const tags = element.querySelectorAll(
        '[data-testid="draft-item-tag-thread"]',
      );
      assert.deepEqual(tags.length, 2);
      assert.deepEqual(tags[0].textContent.trim(), "1 more post");
      assert.deepEqual(tags[1].textContent.trim(), "2 more posts");
    });

    it("should tag drafts containing a quote", () => {
      const { dataLayer, $hydratedDrafts } = createFakeDataLayer();
      seedDrafts($hydratedDrafts, [
        createDraftView({
          posts: [
            {
              text: "quoting",
              embedRecords: [
                { record: { uri: "at://did:plc:a/app.bsky.feed.post/1" } },
              ],
            },
          ],
        }),
      ]);
      const element = createDialog(dataLayer);
      assert(
        element.querySelector('[data-testid="draft-item-tag-quote"]') !== null,
      );
    });

    it("should render media thumbs for drafts from this device", () => {
      const { dataLayer, $hydratedDrafts } = createFakeDataLayer();
      seedDrafts($hydratedDrafts, [
        createDraftView({
          posts: [
            {
              text: "with media",
              embedImages: [
                {
                  localRef: { path: "images/a" },
                  previewUrl: "blob:image-a",
                  exists: true,
                  alt: "an image",
                },
              ],
              embedVideos: [{ localRef: { path: "videos/b" }, exists: true }],
              embedExternals: [
                { uri: "https://media.tenor.com/x/fun.gif?ww=200&hh=100" },
              ],
            },
          ],
        }),
      ]);
      const element = createDialog(dataLayer);
      const media = element.querySelector('[data-testid="draft-item-media"]');
      assert(media !== null);
      const thumbs = media.querySelectorAll(".draft-item-thumb");
      assert.deepEqual(thumbs.length, 3);
      assert.deepEqual(thumbs[0].getAttribute("src"), "blob:image-a");
      assert.deepEqual(thumbs[0].getAttribute("alt"), "an image");
      assert(
        thumbs[1]
          .getAttribute("src")
          .startsWith("https://media.tenor.com/x/fun.gif"),
      );
      assert(thumbs[2].classList.contains("draft-item-video-placeholder"));
      assert.deepEqual(
        element.querySelector('[data-testid="draft-item-tag-missing-media"]'),
        null,
      );
    });

    it("should warn about missing media for drafts from this device", () => {
      const { dataLayer, $hydratedDrafts } = createFakeDataLayer();
      seedDrafts($hydratedDrafts, [
        createDraftView({
          posts: [
            {
              text: "lost media",
              embedImages: [{ localRef: { path: "images/a" }, exists: false }],
            },
          ],
        }),
      ]);
      const element = createDialog(dataLayer);
      assert(
        element.querySelector(
          '[data-testid="draft-item-tag-missing-media"]',
        ) !== null,
      );
      assert.deepEqual(
        element.querySelector('[data-testid="draft-item-tag-foreign-media"]'),
        null,
      );
      assert.deepEqual(
        element.querySelector('[data-testid="draft-item-media"]'),
        null,
      );
    });

    it("should tag foreign-device drafts with missing media and hide their thumbs", () => {
      const { dataLayer, $hydratedDrafts } = createFakeDataLayer();
      seedDrafts($hydratedDrafts, [
        createDraftView({
          deviceId: "another-device",
          posts: [
            {
              text: "foreign media",
              embedImages: [
                {
                  localRef: { path: "images/a" },
                  previewUrl: "blob:image-a",
                  exists: false,
                },
              ],
            },
          ],
        }),
      ]);
      const element = createDialog(dataLayer);
      assert(
        element.querySelector(
          '[data-testid="draft-item-tag-foreign-media"]',
        ) !== null,
      );
      assert.deepEqual(
        element.querySelector('[data-testid="draft-item-tag-missing-media"]'),
        null,
      );
      assert.deepEqual(
        element.querySelector('[data-testid="draft-item-media"]'),
        null,
      );
    });
  });

  describe("DraftsDialog - selecting a draft", () => {
    it("should close and dispatch draft-selected with the draft on click", () => {
      const { dataLayer, $hydratedDrafts } = createFakeDataLayer();
      const draftView = createDraftView();
      seedDrafts($hydratedDrafts, [draftView]);
      const element = createDialog(dataLayer);
      const events = [];
      element.addEventListener("dialog-closed", () => events.push("closed"));
      element.addEventListener("draft-selected", (event) =>
        events.push(event.detail.draftView),
      );
      element.querySelector('[data-testid="draft-item"]').click();
      assert.deepEqual(events, ["closed", draftView]);
    });

    it("should select the draft on Enter", () => {
      const { dataLayer, $hydratedDrafts } = createFakeDataLayer();
      const draftView = createDraftView();
      seedDrafts($hydratedDrafts, [draftView]);
      const element = createDialog(dataLayer);
      let selected = null;
      element.addEventListener("draft-selected", (event) => {
        selected = event.detail.draftView;
      });
      element
        .querySelector('[data-testid="draft-item"]')
        .dispatchEvent(
          new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        );
      assert.deepEqual(selected, draftView);
    });
  });

  describe("DraftsDialog - deleting a draft", () => {
    it("should delete the draft with its local refs and dispatch draft-deleted on confirm", async () => {
      const { dataLayer, $hydratedDrafts, deleteCalls } = createFakeDataLayer();
      seedDrafts($hydratedDrafts, [
        createDraftView({
          id: "draft-9",
          posts: [
            {
              text: "doomed",
              embedImages: [
                { localRef: { path: "images/a" }, previewUrl: "blob:a" },
              ],
              embedVideos: [{ localRef: { path: "videos/b" }, exists: true }],
            },
          ],
        }),
      ]);
      const element = createDialog(dataLayer);
      let deletedDetail = null;
      element.addEventListener("draft-deleted", (event) => {
        deletedDetail = event.detail;
      });
      element.querySelector('[data-testid="draft-item-delete"]').click();
      await respondToConfirm(true);
      await flushMicrotasks();
      assert.deepEqual(deleteCalls, [
        { draftId: "draft-9", localRefs: ["images/a", "videos/b"] },
      ]);
      assert.deepEqual(deletedDetail, { draftId: "draft-9" });
    });

    it("should not delete or dispatch when the confirm is declined", async () => {
      const { dataLayer, $hydratedDrafts, deleteCalls } = createFakeDataLayer();
      seedDrafts($hydratedDrafts, [createDraftView()]);
      const element = createDialog(dataLayer);
      let deleted = false;
      element.addEventListener("draft-deleted", () => {
        deleted = true;
      });
      element.querySelector('[data-testid="draft-item-delete"]').click();
      await respondToConfirm(false);
      await flushMicrotasks();
      assert.deepEqual(deleteCalls.length, 0);
      assert.deepEqual(deleted, false);
    });

    it("should show an error toast and skip draft-deleted when the delete fails", async (t) => {
      t.mock.method(console, "error", () => {});
      const { dataLayer, $hydratedDrafts } = createFakeDataLayer({
        deleteDraft: () => Promise.reject(new Error("boom")),
      });
      seedDrafts($hydratedDrafts, [createDraftView()]);
      const element = createDialog(dataLayer);
      let deleted = false;
      element.addEventListener("draft-deleted", () => {
        deleted = true;
      });
      element.querySelector('[data-testid="draft-item-delete"]').click();
      await respondToConfirm(true);
      await flushMicrotasks();
      assert.deepEqual(deleted, false);
      const toast = document.body.querySelector('[data-testid="toast"]');
      assert(toast !== null, "toast should be shown");
      assert(toast.textContent.includes("Failed to delete draft"));
    });

    it("should not select the draft when the delete button is clicked", async () => {
      const { dataLayer, $hydratedDrafts } = createFakeDataLayer();
      seedDrafts($hydratedDrafts, [createDraftView()]);
      const element = createDialog(dataLayer);
      let selected = false;
      element.addEventListener("draft-selected", () => {
        selected = true;
      });
      element.querySelector('[data-testid="draft-item-delete"]').click();
      await respondToConfirm(false);
      await flushMicrotasks();
      assert.deepEqual(selected, false);
    });
  });

  describe("DraftsDialog - pagination", () => {
    it("should disable the infinite scroll container when there is no cursor", () => {
      const { dataLayer, $hydratedDrafts } = createFakeDataLayer();
      seedDrafts($hydratedDrafts, [createDraftView()]);
      const element = createDialog(dataLayer);
      const container = element.querySelector("infinite-scroll-container");
      assert(container.hasAttribute("disabled"));
    });

    it("should load the next page on load-more and resume when done", async () => {
      let resolveLoad;
      const { dataLayer, $hydratedDrafts, loadCalls } = createFakeDataLayer({
        loadDrafts: () =>
          new Promise((resolve) => {
            resolveLoad = resolve;
          }),
      });
      seedDrafts($hydratedDrafts, [createDraftView()], { cursor: "page-2" });
      const element = createDialog(dataLayer);
      const container = element.querySelector("infinite-scroll-container");
      assert.deepEqual(container.hasAttribute("disabled"), false);
      let resumed = 0;
      container.dispatchEvent(
        new window.CustomEvent("load-more", {
          detail: { resume: () => resumed++ },
        }),
      );
      await nextFrame();
      assert.deepEqual(loadCalls, [undefined]);
      assert(
        container.querySelector(".loading-spinner") !== null,
        "loading-more spinner should show while the page loads",
      );
      assert.deepEqual(resumed, 0);
      resolveLoad();
      await flushMicrotasks();
      await nextFrame();
      assert.deepEqual(resumed, 1);
      assert.deepEqual(container.querySelector(".loading-spinner"), null);
    });

    it("should resume immediately without a second request while a page load is pending", async () => {
      let resolveLoad;
      const { dataLayer, $hydratedDrafts, loadCalls } = createFakeDataLayer({
        loadDrafts: () =>
          new Promise((resolve) => {
            resolveLoad = resolve;
          }),
      });
      seedDrafts($hydratedDrafts, [createDraftView()], { cursor: "page-2" });
      const element = createDialog(dataLayer);
      const container = element.querySelector("infinite-scroll-container");
      const resumes = [];
      container.dispatchEvent(
        new window.CustomEvent("load-more", {
          detail: { resume: () => resumes.push("first") },
        }),
      );
      container.dispatchEvent(
        new window.CustomEvent("load-more", {
          detail: { resume: () => resumes.push("second") },
        }),
      );
      assert.deepEqual(loadCalls.length, 1);
      assert.deepEqual(resumes, ["second"]);
      resolveLoad();
      await flushMicrotasks();
      assert.deepEqual(resumes, ["second", "first"]);
    });
  });

  describe("DraftsDialog - dismissal", () => {
    it("should open the dialog as a modal and close on the back button", () => {
      const { dataLayer, $hydratedDrafts } = createFakeDataLayer();
      seedDrafts($hydratedDrafts, []);
      const element = createDialog(dataLayer);
      element.open();
      const dialog = element.querySelector("dialog");
      assert(dialog.open);
      let closed = false;
      element.addEventListener("dialog-closed", () => {
        closed = true;
      });
      element.querySelector('[data-testid="drafts-dialog-back"]').click();
      assert(closed);
      assert.deepEqual(dialog.open, false);
    });

    it("should close on cancel (Escape)", () => {
      const { dataLayer, $hydratedDrafts } = createFakeDataLayer();
      seedDrafts($hydratedDrafts, []);
      const element = createDialog(dataLayer);
      element.open();
      let closed = false;
      element.addEventListener("dialog-closed", () => {
        closed = true;
      });
      const dialog = element.querySelector("dialog");
      dialog.dispatchEvent(new window.Event("cancel", { bubbles: false }));
      assert(closed);
      assert.deepEqual(dialog.open, false);
    });

    it("should close on a backdrop click but not on a click inside the sheet", () => {
      const { dataLayer, $hydratedDrafts } = createFakeDataLayer();
      seedDrafts($hydratedDrafts, []);
      const element = createDialog(dataLayer);
      element.open();
      let closedCount = 0;
      element.addEventListener("dialog-closed", () => closedCount++);
      element
        .querySelector(".drafts-dialog-content")
        .dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      assert.deepEqual(closedCount, 0);
      const dialog = element.querySelector("dialog");
      dialog.dispatchEvent(new window.MouseEvent("click", { bubbles: false }));
      assert.deepEqual(closedCount, 1);
      assert.deepEqual(dialog.open, false);
    });
  });
});
