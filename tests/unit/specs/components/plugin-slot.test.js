import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { SignalMap } from "/js/signals.js";
import "/js/components/plugin-slot.js";

describe("plugin-slot", () => {
  // _reconcile awaits plugin invokes via Promise.all, and signal-driven
  // re-runs are scheduled via requestAnimationFrame (polyfilled to setTimeout
  // in the test env). Flush a few times so the awaited continuations run
  // before assertions.
  async function flushMicrotasks() {
    for (let i = 0; i < 4; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  // Minimal stub renderer that just builds a <div> reflecting node.text so
  // tests can assert on the rendered output without pulling in PluginRenderer.
  function makeRenderer(pluginId, { onCreateRoot } = {}) {
    return {
      createRoot(options = {}) {
        onCreateRoot?.(options);
        let element = null;
        return {
          render(node) {
            if (!element) element = document.createElement("div");
            element.dataset.plugin = pluginId;
            element.textContent = node?.text ?? "";
            return element;
          },
        };
      },
    };
  }

  function makePluginService({ entries = {}, onCreateRoot } = {}) {
    const $slots = new SignalMap();
    for (const [name, list] of Object.entries(entries)) {
      $slots.set(name, [...list]);
    }
    return {
      $slots,
      setSlotEntries(name, list) {
        $slots.set(name, list.length === 0 ? null : [...list]);
      },
      getSlotEntries(name) {
        return [...($slots.get(name) ?? [])];
      },
      getRenderer(pluginId) {
        return makeRenderer(pluginId, { onCreateRoot });
      },
    };
  }

  function makeSlot({
    pluginService,
    name,
    context = {},
    interactionHandlers,
  }) {
    const element = document.createElement("plugin-slot");
    element.pluginService = pluginService;
    element.interactionHandlers = interactionHandlers ?? {};
    element.setAttribute("name", name);
    for (const [key, value] of Object.entries(context)) {
      element.setAttribute(`context-${key}`, value);
    }
    return element;
  }

  beforeEach(() => {
    document.body.innerHTML = "";
  });

  describe("PluginSlot - empty", () => {
    it("renders nothing when no plugins are registered", async () => {
      const slot = makeSlot({
        pluginService: makePluginService(),
        name: "x",
      });
      document.body.appendChild(slot);
      await flushMicrotasks();
      assert.deepEqual(slot.children.length, 0);
    });
  });

  describe("PluginSlot - rendering", () => {
    it("calls each registered plugin with the parsed context", async () => {
      const calls = [];
      const pluginService = makePluginService({
        entries: {
          x: [
            {
              pluginId: "alpha",
              invoke: async (context) => {
                calls.push({ pluginId: "alpha", context });
                return { tag: "div", text: "ALPHA" };
              },
            },
          ],
        },
      });
      const slot = makeSlot({
        pluginService,
        name: "x",
        context: { uri: "at://test", "author-did": "did:test" },
      });
      document.body.appendChild(slot);
      await flushMicrotasks();
      assert.deepEqual(calls, [
        {
          pluginId: "alpha",
          context: { uri: "at://test", authorDid: "did:test" },
        },
      ]);
      assert.deepEqual(slot.children.length, 1);
      assert.deepEqual(slot.children[0].dataset.plugin, "alpha");
      assert.deepEqual(slot.children[0].textContent, "ALPHA");
    });

    it("renders multiple plugins in registration order", async () => {
      const pluginService = makePluginService({
        entries: {
          x: [
            {
              pluginId: "alpha",
              invoke: async () => ({ tag: "div", text: "A" }),
            },
            {
              pluginId: "beta",
              invoke: async () => ({ tag: "div", text: "B" }),
            },
          ],
        },
      });
      const slot = makeSlot({ pluginService, name: "x" });
      document.body.appendChild(slot);
      await flushMicrotasks();
      assert.deepEqual(slot.children.length, 2);
      assert.deepEqual(slot.children[0].dataset.plugin, "alpha");
      assert.deepEqual(slot.children[1].dataset.plugin, "beta");
    });

    it("skips plugins that return null", async () => {
      const pluginService = makePluginService({
        entries: {
          x: [
            { pluginId: "alpha", invoke: async () => null },
            {
              pluginId: "beta",
              invoke: async () => ({ tag: "div", text: "B" }),
            },
          ],
        },
      });
      const slot = makeSlot({ pluginService, name: "x" });
      document.body.appendChild(slot);
      await flushMicrotasks();
      assert.deepEqual(slot.children.length, 1);
      assert.deepEqual(slot.children[0].dataset.plugin, "beta");
    });

    it("isolates failing plugins from succeeding ones", async () => {
      const pluginService = makePluginService({
        entries: {
          x: [
            {
              pluginId: "alpha",
              invoke: async () => {
                throw new Error("boom");
              },
            },
            {
              pluginId: "beta",
              invoke: async () => ({ tag: "div", text: "B" }),
            },
          ],
        },
      });
      const slot = makeSlot({ pluginService, name: "x" });
      const originalError = console.error;
      console.error = () => {};
      document.body.appendChild(slot);
      try {
        await flushMicrotasks();
      } finally {
        console.error = originalError;
      }
      assert.deepEqual(slot.children.length, 1);
      assert.deepEqual(slot.children[0].dataset.plugin, "beta");
    });
  });

  describe("PluginSlot - dynamic updates", () => {
    it("re-renders when a new plugin registers for this slot", async () => {
      const pluginService = makePluginService({ entries: { x: [] } });
      const slot = makeSlot({ pluginService, name: "x" });
      document.body.appendChild(slot);
      await flushMicrotasks();
      assert.deepEqual(slot.children.length, 0);

      pluginService.setSlotEntries("x", [
        { pluginId: "alpha", invoke: async () => ({ tag: "div", text: "A" }) },
      ]);
      await flushMicrotasks();
      assert.deepEqual(slot.children.length, 1);
      assert.deepEqual(slot.children[0].dataset.plugin, "alpha");
    });

    it("ignores registrations for other slot names", async () => {
      const pluginService = makePluginService({ entries: { x: [] } });
      const slot = makeSlot({ pluginService, name: "x" });
      document.body.appendChild(slot);
      await flushMicrotasks();

      let invoked = false;
      pluginService.setSlotEntries("y", [
        {
          pluginId: "other",
          invoke: async () => {
            invoked = true;
            return null;
          },
        },
      ]);
      await flushMicrotasks();
      assert.deepEqual(invoked, false);
    });

    it("re-renders when the context changes", async () => {
      const captured = [];
      const pluginService = makePluginService({
        entries: {
          x: [
            {
              pluginId: "alpha",
              invoke: async (context) => {
                captured.push(context.uri);
                return { tag: "div", text: context.uri };
              },
            },
          ],
        },
      });
      const slot = makeSlot({
        pluginService,
        name: "x",
        context: { uri: "at://one" },
      });
      document.body.appendChild(slot);
      await flushMicrotasks();
      assert.deepEqual(captured, ["at://one"]);

      slot.setAttribute("context-uri", "at://two");
      await flushMicrotasks();
      assert.deepEqual(captured, ["at://one", "at://two"]);
      assert.deepEqual(slot.children[0].textContent, "at://two");
    });

    it("re-renders when context-did changes on an existing element", async () => {
      const captured = [];
      const pluginService = makePluginService({
        entries: {
          "author-badges": [
            {
              pluginId: "alpha",
              invoke: async (context) => {
                captured.push(context.did);
                return { tag: "div", text: context.did };
              },
            },
          ],
        },
      });
      const slot = makeSlot({
        pluginService,
        name: "author-badges",
        context: { did: "did:plc:one" },
      });
      document.body.appendChild(slot);
      await flushMicrotasks();
      assert.deepEqual(captured, ["did:plc:one"]);

      slot.setAttribute("context-did", "did:plc:two");
      await flushMicrotasks();
      assert.deepEqual(captured, ["did:plc:one", "did:plc:two"]);
      assert.deepEqual(slot.children[0].textContent, "did:plc:two");
    });

    it("supports multiple simultaneous instances of the same slot name, each with its own context", async () => {
      const captured = [];
      const pluginService = makePluginService({
        entries: {
          "author-badges": [
            {
              pluginId: "alpha",
              invoke: async (context) => {
                captured.push(context.did);
                return { tag: "div", text: context.did };
              },
            },
          ],
        },
      });
      const slotOne = makeSlot({
        pluginService,
        name: "author-badges",
        context: { did: "did:plc:one" },
      });
      const slotTwo = makeSlot({
        pluginService,
        name: "author-badges",
        context: { did: "did:plc:two" },
      });
      document.body.appendChild(slotOne);
      document.body.appendChild(slotTwo);
      await flushMicrotasks();
      assert.deepEqual(
        new Set(captured),
        new Set(["did:plc:one", "did:plc:two"]),
      );
      assert.deepEqual(slotOne.children[0].textContent, "did:plc:one");
      assert.deepEqual(slotTwo.children[0].textContent, "did:plc:two");
    });
  });

  describe("PluginSlot - interactionHandlers", () => {
    it("defaults to an empty object when not set, rather than throwing", () => {
      const element = document.createElement("plugin-slot");
      element.pluginService = makePluginService();
      element.setAttribute("name", "x");
      element.connectedCallback();
      assert.deepEqual(element.interactionHandlers, {});
    });

    it("throws when pluginService is not set", () => {
      const element = document.createElement("plugin-slot");
      element.setAttribute("name", "x");
      let caught = null;
      try {
        element.connectedCallback();
      } catch (error) {
        caught = error;
      }
      assert(caught instanceof Error);
      assert.deepEqual(caught.message, "pluginService is required");
    });
  });

  describe("PluginSlot - cleanup", () => {
    it("unsubscribes from the slot signal on disconnect", async () => {
      const pluginService = makePluginService({ entries: { x: [] } });
      const slot = makeSlot({ pluginService, name: "x" });
      document.body.appendChild(slot);
      await flushMicrotasks();
      slot.remove();

      // After removal, signal updates should not trigger reconcile.
      let invoked = false;
      pluginService.setSlotEntries("x", [
        {
          pluginId: "alpha",
          invoke: async () => {
            invoked = true;
            return null;
          },
        },
      ]);
      await flushMicrotasks();
      assert.deepEqual(invoked, false);
    });
  });
});
