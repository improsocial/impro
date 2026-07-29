import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import {
  showPluginModal as _showPluginModal,
  updatePluginModal as _updatePluginModal,
  hidePluginModal,
} from "/js/plugins/pluginModal.js";
import { PluginRenderer } from "/js/plugins/pluginRendering.js";

function showPluginModal(opts) {
  const pluginRenderer = new PluginRenderer(null, opts.pluginId);
  return _showPluginModal({ pluginRenderer, ...opts });
}

function updatePluginModal(opts) {
  const pluginRenderer = new PluginRenderer(null, opts.pluginId);
  return _updatePluginModal({ pluginRenderer, ...opts });
}

function clearDOM() {
  document.body.innerHTML = "";
}

let pluginModalCounter = 0;
function uniqueModalId(prefix) {
  pluginModalCounter += 1;
  return `${prefix}-${pluginModalCounter}`;
}

describe("showPluginModal", () => {
  it("should create a dialog with plugin-modal class and pluginId dataset", () => {
    clearDOM();
    showPluginModal({
      pluginId: "test.plugin",
      modalId: uniqueModalId("create"),
      title: { tag: "span", text: "Hello" },
      content: { tag: "div", text: "Body" },
    });
    const dialog = document.querySelector("dialog.plugin-modal");
    assert(dialog !== null);
    assert.deepEqual(dialog.dataset.pluginId, "test.plugin");
    assert(dialog.classList.contains("bottom-sheet"));
    assert(dialog.hasAttribute("open"));
  });

  it("should take the initial focus itself so content is not scrolled into view", () => {
    clearDOM();
    showPluginModal({
      pluginId: "p",
      modalId: uniqueModalId("autofocus"),
      title: { tag: "span", text: "T" },
      content: {
        tag: "div",
        children: [{ tag: "button", text: "Deep button" }],
      },
    });
    const dialog = document.querySelector("dialog.plugin-modal");
    assert(dialog.hasAttribute("autofocus"));
  });

  it("should render the body as a scroll region with the title outside it", () => {
    clearDOM();
    showPluginModal({
      pluginId: "p",
      modalId: uniqueModalId("scroll"),
      title: { tag: "span", text: "T" },
      content: { tag: "div", text: "Body" },
    });
    const body = document.querySelector(".plugin-modal-body");
    assert(body !== null);
    assert(body.classList.contains("sheet-scroll-region"));
    const title = document.querySelector(".modal-dialog-title");
    assert(title.parentElement === body.parentElement);
    assert(body.querySelector(".modal-dialog-title") === null);
  });

  it("should render the title with the modal-dialog-title class", () => {
    clearDOM();
    showPluginModal({
      pluginId: "p",
      modalId: uniqueModalId("title"),
      title: { tag: "span", text: "My Title" },
      content: { tag: "div", text: "Body" },
    });
    const title = document.querySelector(".modal-dialog-title");
    assert(title !== null);
    assert.deepEqual(title.textContent, "My Title");
  });

  it("should skip the title when it is empty", () => {
    clearDOM();
    showPluginModal({
      pluginId: "p",
      modalId: uniqueModalId("no-title"),
      title: { tag: "span", text: "" },
      content: { tag: "div", text: "Body only" },
    });
    const title = document.querySelector(".modal-dialog-title");
    assert(title === null);
  });

  it("should render content children when content has children", () => {
    clearDOM();
    showPluginModal({
      pluginId: "p",
      modalId: uniqueModalId("children"),
      title: { tag: "span", text: "T" },
      content: {
        tag: "div",
        children: [
          { tag: "p", text: "First" },
          { tag: "p", text: "Second" },
        ],
      },
    });
    const paragraphs = document.querySelectorAll(".plugin-modal-body > p");
    assert.deepEqual(paragraphs.length, 2);
    assert.deepEqual(paragraphs[0].textContent, "First");
    assert.deepEqual(paragraphs[1].textContent, "Second");
  });

  it("should render the content node directly when it has no children", () => {
    clearDOM();
    showPluginModal({
      pluginId: "p",
      modalId: uniqueModalId("single"),
      title: { tag: "span", text: "T" },
      content: { tag: "p", text: "Single body" },
    });
    const body = document.querySelector(".plugin-modal-body > p");
    assert(body !== null);
    assert.deepEqual(body.textContent, "Single body");
  });

  it("should show a modal with new content when reopened after hiding", async () => {
    clearDOM();
    const pluginId = "reuse.plugin";
    const modalId = uniqueModalId("reuse");
    showPluginModal({
      pluginId,
      modalId,
      title: { tag: "span", text: "First Title" },
      content: { tag: "p", text: "First body" },
    });
    hidePluginModal({ pluginId, modalId });
    showPluginModal({
      pluginId,
      modalId,
      title: { tag: "span", text: "Second Title" },
      content: { tag: "p", text: "Second body" },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const dialogs = document.querySelectorAll("dialog.plugin-modal");
    assert.deepEqual(dialogs.length, 1);
    const title = document.querySelector(".modal-dialog-title");
    assert.deepEqual(title.textContent, "Second Title");
    const body = document.querySelector(".plugin-modal-body > p");
    assert.deepEqual(body.textContent, "Second body");
    assert(dialogs[0].hasAttribute("open"));
  });

  it("should not reopen a queued modal that was hidden while closing", async () => {
    clearDOM();
    const pluginId = "reuse.plugin";
    const modalId = uniqueModalId("queued-hide");
    showPluginModal({
      pluginId,
      modalId,
      title: { tag: "span", text: "First Title" },
      content: { tag: "p", text: "First body" },
    });
    hidePluginModal({ pluginId, modalId });
    showPluginModal({
      pluginId,
      modalId,
      title: { tag: "span", text: "Second Title" },
      content: { tag: "p", text: "Second body" },
    });
    hidePluginModal({ pluginId, modalId });
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert(document.querySelector("dialog.plugin-modal[open]") === null);
  });

  it("should be a no-op when called with the same key while already open", () => {
    clearDOM();
    const pluginId = "noop.plugin";
    const modalId = uniqueModalId("noop");
    showPluginModal({
      pluginId,
      modalId,
      title: { tag: "span", text: "Original" },
      content: { tag: "p", text: "Original body" },
    });
    showPluginModal({
      pluginId,
      modalId,
      title: { tag: "span", text: "Replaced" },
      content: { tag: "p", text: "Replaced body" },
    });
    const title = document.querySelector(".modal-dialog-title");
    assert.deepEqual(title.textContent, "Original");
    hidePluginModal({ pluginId, modalId });
  });

  it("should invoke onDismiss when dismissed via backdrop click", async () => {
    clearDOM();
    const onDismiss = mock.fn();
    showPluginModal({
      pluginId: "backdrop.plugin",
      modalId: uniqueModalId("backdrop"),
      title: { tag: "span", text: "T" },
      content: { tag: "p", text: "B" },
      onDismiss,
    });
    const dialog = document.querySelector("dialog.plugin-modal");
    dialog.dispatchEvent(new Event("click", { bubbles: true }));
    await Promise.resolve();
    assert(!dialog.hasAttribute("open"));
    assert.deepEqual(onDismiss.mock.callCount(), 1);
  });

  it("should invoke onDismiss when dismissed via cancel event", async () => {
    clearDOM();
    const onDismiss = mock.fn();
    showPluginModal({
      pluginId: "cancel.plugin",
      modalId: uniqueModalId("cancel"),
      title: { tag: "span", text: "T" },
      content: { tag: "p", text: "B" },
      onDismiss,
    });
    const dialog = document.querySelector("dialog.plugin-modal");
    const cancelEvent = new Event("cancel");
    cancelEvent.preventDefault = () => {};
    dialog.dispatchEvent(cancelEvent);
    await Promise.resolve();
    assert(!dialog.hasAttribute("open"));
    assert.deepEqual(onDismiss.mock.callCount(), 1);
  });

  it("should not require an onDismiss callback", () => {
    clearDOM();
    showPluginModal({
      pluginId: "no-cb.plugin",
      modalId: uniqueModalId("no-cb"),
      title: { tag: "span", text: "T" },
      content: { tag: "p", text: "B" },
    });
    const dialog = document.querySelector("dialog.plugin-modal");
    dialog.dispatchEvent(new Event("click", { bubbles: true }));
    assert(!dialog.hasAttribute("open"));
  });

  it("should isolate modals by pluginId/modalId key", () => {
    clearDOM();
    const modalIdA = uniqueModalId("isoA");
    const modalIdB = uniqueModalId("isoB");
    showPluginModal({
      pluginId: "iso.plugin",
      modalId: modalIdA,
      title: { tag: "span", text: "A" },
      content: { tag: "p", text: "A body" },
    });
    showPluginModal({
      pluginId: "iso.plugin",
      modalId: modalIdB,
      title: { tag: "span", text: "B" },
      content: { tag: "p", text: "B body" },
    });
    const dialogs = document.querySelectorAll("dialog.plugin-modal");
    assert.deepEqual(dialogs.length, 2);
    hidePluginModal({ pluginId: "iso.plugin", modalId: modalIdA });
    hidePluginModal({ pluginId: "iso.plugin", modalId: modalIdB });
  });
});

describe("updatePluginModal", () => {
  it("should patch existing content in place, preserving element identity", () => {
    clearDOM();
    const pluginId = "update.plugin";
    const modalId = uniqueModalId("patch");
    showPluginModal({
      pluginId,
      modalId,
      title: { tag: "span", text: "T" },
      content: { tag: "p", text: "One" },
    });
    const body = document.querySelector(".plugin-modal-body > p");
    updatePluginModal({
      pluginId,
      modalId,
      title: { tag: "span", text: "T" },
      content: { tag: "p", text: "Two" },
    });
    const updated = document.querySelector(".plugin-modal-body > p");
    assert(updated === body);
    assert.deepEqual(updated.textContent, "Two");
    hidePluginModal({ pluginId, modalId });
  });

  it("should add and remove content children across updates", () => {
    clearDOM();
    const pluginId = "update.plugin";
    const modalId = uniqueModalId("children");
    showPluginModal({
      pluginId,
      modalId,
      title: { tag: "span", text: "T" },
      content: { tag: "div", children: [{ tag: "p", text: "First" }] },
    });
    updatePluginModal({
      pluginId,
      modalId,
      title: { tag: "span", text: "T" },
      content: {
        tag: "div",
        children: [
          { tag: "p", text: "First" },
          { tag: "p", text: "Second" },
        ],
      },
    });
    let paragraphs = document.querySelectorAll(".plugin-modal-body > p");
    assert.deepEqual(paragraphs.length, 2);
    assert.deepEqual(paragraphs[1].textContent, "Second");
    updatePluginModal({
      pluginId,
      modalId,
      title: { tag: "span", text: "T" },
      content: { tag: "div", children: [{ tag: "p", text: "Only" }] },
    });
    paragraphs = document.querySelectorAll(".plugin-modal-body > p");
    assert.deepEqual(paragraphs.length, 1);
    assert.deepEqual(paragraphs[0].textContent, "Only");
    hidePluginModal({ pluginId, modalId });
  });

  it("should toggle the title on and off across updates", () => {
    clearDOM();
    const pluginId = "update.plugin";
    const modalId = uniqueModalId("title-toggle");
    showPluginModal({
      pluginId,
      modalId,
      title: { tag: "span", text: "" },
      content: { tag: "p", text: "Body" },
    });
    assert(document.querySelector(".modal-dialog-title") === null);
    updatePluginModal({
      pluginId,
      modalId,
      title: { tag: "span", text: "Now titled" },
      content: { tag: "p", text: "Body" },
    });
    const title = document.querySelector(".modal-dialog-title");
    assert(title !== null);
    assert.deepEqual(title.textContent, "Now titled");
    updatePluginModal({
      pluginId,
      modalId,
      title: { tag: "span", text: "" },
      content: { tag: "p", text: "Body" },
    });
    assert(document.querySelector(".modal-dialog-title") === null);
    hidePluginModal({ pluginId, modalId });
  });

  it("should be a no-op when no modal exists for the key", () => {
    clearDOM();
    updatePluginModal({
      pluginId: "missing.plugin",
      modalId: "missing-modal",
      title: { tag: "span", text: "T" },
      content: { tag: "p", text: "B" },
    });
    assert(document.querySelector("dialog") === null);
  });

  it("should be a no-op after the modal is hidden", () => {
    clearDOM();
    const pluginId = "update.plugin";
    const modalId = uniqueModalId("after-hide");
    showPluginModal({
      pluginId,
      modalId,
      title: { tag: "span", text: "T" },
      content: { tag: "p", text: "Original" },
    });
    hidePluginModal({ pluginId, modalId });
    updatePluginModal({
      pluginId,
      modalId,
      title: { tag: "span", text: "T" },
      content: { tag: "p", text: "Changed" },
    });
    const dialog = document.querySelector("dialog.plugin-modal");
    assert(dialog === null || !dialog.hasAttribute("open"));
  });
});

describe("hidePluginModal", () => {
  it("should close the dialog without invoking onDismiss", () => {
    clearDOM();
    const onDismiss = mock.fn();
    const pluginId = "hide.plugin";
    const modalId = uniqueModalId("hide");
    showPluginModal({
      pluginId,
      modalId,
      title: { tag: "span", text: "T" },
      content: { tag: "p", text: "B" },
      onDismiss,
    });
    const dialog = document.querySelector("dialog.plugin-modal");
    assert(dialog.hasAttribute("open"));
    hidePluginModal({ pluginId, modalId });
    assert(!dialog.hasAttribute("open"));
    assert.deepEqual(onDismiss.mock.callCount(), 0);
  });

  it("should be a no-op when no modal exists for the key", () => {
    clearDOM();
    hidePluginModal({ pluginId: "missing.plugin", modalId: "missing-modal" });
    assert(document.querySelector("dialog") === null);
  });

  it("should be a no-op when the modal is already closed", () => {
    clearDOM();
    const onDismiss = mock.fn();
    const pluginId = "double-hide.plugin";
    const modalId = uniqueModalId("double-hide");
    showPluginModal({
      pluginId,
      modalId,
      title: { tag: "span", text: "T" },
      content: { tag: "p", text: "B" },
      onDismiss,
    });
    hidePluginModal({ pluginId, modalId });
    hidePluginModal({ pluginId, modalId });
    assert.deepEqual(onDismiss.mock.callCount(), 0);
  });
});
