import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { makeTestPluginService } from "../../testHelpers.js";
import { CustomContent } from "/js/plugins/pluginService.js";
import "/js/components/plugin-custom-content.js";

describe("plugin-custom-content", () => {
  // Loads await the display promise, and signal-driven effect re-runs are
  // scheduled via requestAnimationFrame (polyfilled to setTimeout in the test
  // env). Flush a few times so the awaited continuations run before
  // assertions.
  async function flush() {
    for (let i = 0; i < 4; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  // Minimal stub renderer that builds a <div> reflecting node.text and tags
  // it with the owning plugin id, so tests can tell which registration's
  // renderer produced the visible output.
  function makePluginService({ createdRoots, resets } = {}) {
    return makeTestPluginService({
      getRenderer(pluginId) {
        return {
          createRoot() {
            createdRoots?.push(pluginId);
            let element = null;
            return {
              render(node) {
                if (!element) element = document.createElement("div");
                element.dataset.plugin = pluginId;
                element.textContent = node?.text ?? "";
                return element;
              },
              reset() {
                resets?.push(pluginId);
                element = null;
              },
            };
          },
        };
      },
    });
  }

  function mount({ pluginService, customContent }) {
    const element = document.createElement("plugin-custom-content");
    element.pluginService = pluginService;
    element.customContent = customContent;
    document.body.appendChild(element);
    return element;
  }

  function renderedNode(element) {
    return element.querySelector("[data-plugin]");
  }

  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("shows a spinner while display is pending, then the content", async () => {
    let resolveDisplay;
    const customContent = new CustomContent("alpha", {
      display: () =>
        new Promise((resolve) => {
          resolveDisplay = resolve;
        }),
    });
    const element = mount({
      pluginService: makePluginService(),
      customContent,
    });
    await flush();
    assert(element.querySelector(".plugins-loading-state") !== null);

    resolveDisplay({ text: "Hello" });
    await flush();
    assert(element.querySelector(".plugins-loading-state") === null);
    assert.deepEqual(renderedNode(element).textContent, "Hello");
  });

  it("shows the error message when display rejects", async () => {
    const customContent = new CustomContent("alpha", {
      display: () => Promise.reject(new Error("display failed")),
    });
    const element = mount({
      pluginService: makePluginService(),
      customContent,
    });
    await flush();
    const error = element.querySelector('[data-testid="plugin-content-error"]');
    assert(error !== null);
    assert.deepEqual(error.textContent.trim(), "display failed");
  });

  it("recovers from an error when a refresh succeeds", async () => {
    let shouldFail = true;
    const customContent = new CustomContent("alpha", {
      display: () =>
        shouldFail
          ? Promise.reject(new Error("display failed"))
          : Promise.resolve({ text: "Recovered" }),
    });
    const element = mount({
      pluginService: makePluginService(),
      customContent,
    });
    await flush();
    assert(
      element.querySelector('[data-testid="plugin-content-error"]') !== null,
    );

    shouldFail = false;
    customContent.refresh();
    await flush();
    assert(
      element.querySelector('[data-testid="plugin-content-error"]') === null,
    );
    assert.deepEqual(renderedNode(element).textContent, "Recovered");
  });

  it("re-invokes display on refresh, resetting the root only when asked", async () => {
    let displays = 0;
    const resets = [];
    const customContent = new CustomContent("alpha", {
      display: () => {
        displays += 1;
        return Promise.resolve({ text: `Render ${displays}` });
      },
    });
    const element = mount({
      pluginService: makePluginService({ resets }),
      customContent,
    });
    await flush();
    assert.deepEqual(displays, 1);

    customContent.refresh();
    await flush();
    assert.deepEqual(displays, 2);
    assert.deepEqual(resets, []);
    assert.deepEqual(renderedNode(element).textContent, "Render 2");

    customContent.refresh({ reset: true });
    await flush();
    assert.deepEqual(displays, 3);
    assert.deepEqual(resets, ["alpha"]);
    assert.deepEqual(renderedNode(element).textContent, "Render 3");
  });

  // Swapping registrations must drop an in-flight load from the old one,
  // even when its display promise resolves before the new load starts —
  // otherwise the stale result briefly renders and resurrects the discarded
  // render root.
  it("ignores an in-flight load from a replaced registration", async () => {
    const createdRoots = [];
    let resolveOldDisplay;
    const oldContent = new CustomContent("old-plugin", {
      display: () =>
        new Promise((resolve) => {
          resolveOldDisplay = resolve;
        }),
    });
    const newContent = new CustomContent("new-plugin", {
      display: () => Promise.resolve({ text: "New" }),
    });
    const element = mount({
      pluginService: makePluginService({ createdRoots }),
      customContent: oldContent,
    });
    await flush();

    // Replace while the old display is still pending, then let it resolve
    // before effects have had a chance to start the new load
    element.customContent = newContent;
    resolveOldDisplay({ text: "Old" });
    await flush();

    assert.deepEqual(createdRoots, ["new-plugin"]);
    assert.deepEqual(renderedNode(element).dataset.plugin, "new-plugin");
    assert.deepEqual(renderedNode(element).textContent, "New");
  });
});
