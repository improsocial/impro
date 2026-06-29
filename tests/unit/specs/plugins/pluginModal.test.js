import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals, mock } from "../../testHelpers.js";
import {
  showPluginModal as _showPluginModal,
  hidePluginModal,
} from "/js/plugins/pluginModal.js";
import { PluginRenderer } from "/js/plugins/pluginRendering.js";

function showPluginModal(opts) {
  const pluginRenderer = new PluginRenderer(null, opts.pluginId);
  return _showPluginModal({ pluginRenderer, ...opts });
}

const t = new TestSuite("pluginModal");

function clearDOM() {
  document.body.innerHTML = "";
}

let pluginModalCounter = 0;
function uniqueModalId(prefix) {
  pluginModalCounter += 1;
  return `${prefix}-${pluginModalCounter}`;
}

t.describe("showPluginModal", (it) => {
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
    assertEquals(dialog.dataset.pluginId, "test.plugin");
    assert(dialog.classList.contains("modal-dialog"));
    assert(dialog.hasAttribute("open"));
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
    assertEquals(title.textContent, "My Title");
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
    const paragraphs = document.querySelectorAll(".modal-dialog-content > p");
    assertEquals(paragraphs.length, 2);
    assertEquals(paragraphs[0].textContent, "First");
    assertEquals(paragraphs[1].textContent, "Second");
  });

  it("should render the content node directly when it has no children", () => {
    clearDOM();
    showPluginModal({
      pluginId: "p",
      modalId: uniqueModalId("single"),
      title: { tag: "span", text: "T" },
      content: { tag: "p", text: "Single body" },
    });
    const body = document.querySelector(".modal-dialog-content > p");
    assert(body !== null);
    assertEquals(body.textContent, "Single body");
  });

  it("should reuse the existing dialog and replace its content on a second call", () => {
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
    const dialogs = document.querySelectorAll("dialog.plugin-modal");
    assertEquals(dialogs.length, 1);
    const title = document.querySelector(".modal-dialog-title");
    assertEquals(title.textContent, "Second Title");
    const body = document.querySelector(".modal-dialog-content > p");
    assertEquals(body.textContent, "Second body");
    assert(dialogs[0].hasAttribute("open"));
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
    assertEquals(title.textContent, "Original");
    hidePluginModal({ pluginId, modalId });
  });

  it("should invoke onDismiss when dismissed via backdrop click", () => {
    clearDOM();
    const onDismiss = mock();
    showPluginModal({
      pluginId: "backdrop.plugin",
      modalId: uniqueModalId("backdrop"),
      title: { tag: "span", text: "T" },
      content: { tag: "p", text: "B" },
      onDismiss,
    });
    const dialog = document.querySelector("dialog.plugin-modal");
    dialog.dispatchEvent(new Event("click", { bubbles: true }));
    assert(!dialog.hasAttribute("open"));
    assertEquals(onDismiss.calls.length, 1);
  });

  it("should invoke onDismiss when dismissed via cancel event", () => {
    clearDOM();
    const onDismiss = mock();
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
    assert(!dialog.hasAttribute("open"));
    assertEquals(onDismiss.calls.length, 1);
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
    assertEquals(dialogs.length, 2);
    hidePluginModal({ pluginId: "iso.plugin", modalId: modalIdA });
    hidePluginModal({ pluginId: "iso.plugin", modalId: modalIdB });
  });
});

t.describe("hidePluginModal", (it) => {
  it("should close the dialog without invoking onDismiss", () => {
    clearDOM();
    const onDismiss = mock();
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
    assertEquals(onDismiss.calls.length, 0);
  });

  it("should be a no-op when no modal exists for the key", () => {
    clearDOM();
    hidePluginModal({ pluginId: "missing.plugin", modalId: "missing-modal" });
    assert(document.querySelector("dialog") === null);
  });

  it("should be a no-op when the modal is already closed", () => {
    clearDOM();
    const onDismiss = mock();
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
    assertEquals(onDismiss.calls.length, 0);
  });
});

await t.run();
