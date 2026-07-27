import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import {
  showPluginModal as _showPluginModal,
  hidePluginModal,
} from "/js/plugins/pluginModal.js";
import { PluginRenderer } from "/js/plugins/pluginRendering.js";

function showPluginModal(opts) {
  const pluginRenderer = new PluginRenderer(null, opts.pluginId);
  return _showPluginModal({ pluginRenderer, ...opts });
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
    const paragraphs = document.querySelectorAll(".modal-dialog-content > p");
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
    const body = document.querySelector(".modal-dialog-content > p");
    assert(body !== null);
    assert.deepEqual(body.textContent, "Single body");
  });

  it("should reuse the existing dialog and replace its content on a second call", async () => {
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
    const body = document.querySelector(".modal-dialog-content > p");
    assert.deepEqual(body.textContent, "Second body");
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

  // Regression: plugin modals mount their <dialog> straight onto <body> (see
  // above), outside the main layout's <context-provider>. A plugin component
  // rendered inside modal content — e.g. profile-moderation-tools' relationship
  // modal using <plugin-profiles-list> — calls getContext() for
  // "plugin-component-context" from its connectedCallback. Before the
  // context-provider.js fallback fix, that threw as soon as the element was
  // inserted (jsdom swallows the throw from an appendChild-triggered
  // connectedCallback, so the modal just rendered visible-but-empty rather
  // than surfacing an error — exactly what was reported), since closest()
  // never finds a provider outside the dialog's own subtree.
  it("lets a real plugin-profiles-list inside the modal resolve plugin-component-context via a provider mounted elsewhere in the document", () => {
    clearDOM();

    // Stand-in for mainLayout.js's <context-provider>, mounted in the app
    // root rather than as an ancestor of the modal's dialog.
    const layoutProvider = document.createElement("context-provider");
    layoutProvider.setAttribute("context-id", "plugin-component-context");
    const componentContext = {
      dataLayer: {
        declarative: { ensureDetailedProfiles: async () => [] },
        derived: { $hydratedProfiles: { get: () => undefined } },
      },
    };
    layoutProvider.context = componentContext;
    document.body.appendChild(layoutProvider);

    showPluginModal({
      pluginId: "probe.plugin",
      modalId: uniqueModalId("probe"),
      title: { tag: "span", text: "T" },
      // Mirrors the real relationship modal: a wrapper div whose children
      // include the profiles list, not the list as the bare top-level node.
      content: {
        tag: "div",
        children: [{ tag: "plugin-profiles-list", attrs: { dids: "" } }],
      },
    });

    const list = document.querySelector("plugin-profiles-list");
    assert(list !== null);
    assert.equal(
      list.closest('context-provider[context-id="plugin-component-context"]'),
      null,
      "sanity check: the list has no ancestor provider, so this must go through the fallback",
    );
    // dataLayer is only assigned once getContext() resolves successfully —
    // it stays undefined if getContext() threw during connectedCallback.
    assert.equal(list.dataLayer, componentContext.dataLayer);
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
