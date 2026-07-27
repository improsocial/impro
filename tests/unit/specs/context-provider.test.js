import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { getContext } from "/js/context-provider.js";

function clearDOM() {
  document.body.innerHTML = "";
}

describe("getContext", () => {
  beforeEach(() => {
    clearDOM();
  });

  it("resolves context from an ancestor <context-provider>", () => {
    const provider = document.createElement("context-provider");
    provider.setAttribute("context-id", "test-context");
    provider.context = { value: "from-ancestor" };
    const child = document.createElement("div");
    provider.appendChild(child);
    document.body.appendChild(provider);

    assert.deepEqual(getContext(child, "test-context"), {
      value: "from-ancestor",
    });
  });

  it("throws when no provider exists anywhere", () => {
    const orphan = document.createElement("div");
    document.body.appendChild(orphan);
    assert.throws(
      () => getContext(orphan, "test-context"),
      /no <context-provider context-id="test-context"> ancestor/,
    );
  });

  // Regression: content mounted outside a provider's subtree (e.g. a plugin
  // modal's <dialog>, appended straight to <body> as a sibling of the main
  // layout's <context-provider>, per pluginModal.js) previously had no way
  // to resolve context at all, even though a provider for that id was live
  // elsewhere in the document.
  it("falls back to a provider connected elsewhere in the document when the node has no ancestor provider", () => {
    const provider = document.createElement("context-provider");
    provider.setAttribute("context-id", "test-context");
    provider.context = { value: "from-fallback" };
    document.body.appendChild(provider);

    const sibling = document.createElement("div");
    document.body.appendChild(sibling);

    assert.equal(
      sibling.closest('context-provider[context-id="test-context"]'),
      null,
    );
    assert.deepEqual(getContext(sibling, "test-context"), {
      value: "from-fallback",
    });
  });

  it("prefers an ancestor provider over an unrelated fallback provider", () => {
    const staleProvider = document.createElement("context-provider");
    staleProvider.setAttribute("context-id", "test-context");
    staleProvider.context = { value: "stale" };
    document.body.appendChild(staleProvider);

    const ownProvider = document.createElement("context-provider");
    ownProvider.setAttribute("context-id", "test-context");
    ownProvider.context = { value: "own-ancestor" };
    const child = document.createElement("div");
    ownProvider.appendChild(child);
    document.body.appendChild(ownProvider);

    assert.deepEqual(getContext(child, "test-context"), {
      value: "own-ancestor",
    });
  });

  it("stops falling back once the provider disconnects", () => {
    const provider = document.createElement("context-provider");
    provider.setAttribute("context-id", "test-context");
    provider.context = { value: "from-fallback" };
    document.body.appendChild(provider);

    const orphan = document.createElement("div");
    document.body.appendChild(orphan);
    assert.deepEqual(getContext(orphan, "test-context"), {
      value: "from-fallback",
    });

    provider.remove();
    assert.throws(() => getContext(orphan, "test-context"));
  });
});
