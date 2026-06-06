import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import { SignalMap } from "/js/signals.js";
import "/js/components/plugin-slot.js";

const t = new TestSuite("PluginSlot");

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

function makeSlot({ pluginService, name, context = {}, interactionHandlers }) {
  const element = document.createElement("plugin-slot");
  element.pluginService = pluginService;
  element.interactionHandlers = interactionHandlers ?? {};
  element.setAttribute("name", name);
  for (const [key, value] of Object.entries(context)) {
    element.setAttribute(`context-${key}`, value);
  }
  return element;
}

t.beforeEach(() => {
  document.body.innerHTML = "";
});

t.describe("PluginSlot - empty", (it) => {
  it("renders nothing when no plugins are registered", async () => {
    const slot = makeSlot({
      pluginService: makePluginService(),
      name: "x",
    });
    document.body.appendChild(slot);
    await flushMicrotasks();
    assertEquals(slot.children.length, 0);
  });
});

t.describe("PluginSlot - rendering", (it) => {
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
    assertEquals(calls, [
      {
        pluginId: "alpha",
        context: { uri: "at://test", authorDid: "did:test" },
      },
    ]);
    assertEquals(slot.children.length, 1);
    assertEquals(slot.children[0].dataset.plugin, "alpha");
    assertEquals(slot.children[0].textContent, "ALPHA");
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
    assertEquals(slot.children.length, 2);
    assertEquals(slot.children[0].dataset.plugin, "alpha");
    assertEquals(slot.children[1].dataset.plugin, "beta");
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
    assertEquals(slot.children.length, 1);
    assertEquals(slot.children[0].dataset.plugin, "beta");
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
    assertEquals(slot.children.length, 1);
    assertEquals(slot.children[0].dataset.plugin, "beta");
  });
});

t.describe("PluginSlot - dynamic updates", (it) => {
  it("re-renders when a new plugin registers for this slot", async () => {
    const pluginService = makePluginService({ entries: { x: [] } });
    const slot = makeSlot({ pluginService, name: "x" });
    document.body.appendChild(slot);
    await flushMicrotasks();
    assertEquals(slot.children.length, 0);

    pluginService.setSlotEntries("x", [
      { pluginId: "alpha", invoke: async () => ({ tag: "div", text: "A" }) },
    ]);
    await flushMicrotasks();
    assertEquals(slot.children.length, 1);
    assertEquals(slot.children[0].dataset.plugin, "alpha");
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
    assertEquals(invoked, false);
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
    assertEquals(captured, ["at://one"]);

    slot.setAttribute("context-uri", "at://two");
    await flushMicrotasks();
    assertEquals(captured, ["at://one", "at://two"]);
    assertEquals(slot.children[0].textContent, "at://two");
  });
});

t.describe("PluginSlot - interactionHandlers", (it) => {
  it("throws when interactionHandlers is not set", () => {
    const element = document.createElement("plugin-slot");
    element.pluginService = makePluginService();
    element.setAttribute("name", "x");
    let caught = null;
    try {
      element.connectedCallback();
    } catch (error) {
      caught = error;
    }
    assert(caught instanceof Error);
    assertEquals(caught.message, "interactionHandlers is required");
  });
});

t.describe("PluginSlot - cleanup", (it) => {
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
    assertEquals(invoked, false);
  });
});

await t.run();
