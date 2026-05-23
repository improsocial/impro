import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";

// PluginBridge reads window.env.playwright during loadFromSource; provide it
// so the import resolves cleanly. Individual tests avoid the real load path.
globalThis.window.env = globalThis.window.env ?? { playwright: true };

const {
  PluginBridge,
  PluginInstance,
  SandboxedWorker,
  Logger,
  wrapWorkerSource,
} = await import("/js/plugins/pluginBridge.js");

class FakeWorker {
  constructor() {
    this.listeners = {};
    this.posted = [];
    this.terminated = false;
  }
  addEventListener(event, listener) {
    (this.listeners[event] ??= []).push(listener);
  }
  removeEventListener(event, listener) {
    this.listeners[event] = (this.listeners[event] ?? []).filter(
      (entry) => entry !== listener,
    );
  }
  postMessage(message) {
    this.posted.push(message);
  }
  terminate() {
    this.terminated = true;
  }
  emit(event, payload) {
    (this.listeners[event] ?? []).forEach((listener) => listener(payload));
  }
}

function makeRealInstance({ onRegister, onHostCall, manifest } = {}) {
  const worker = new FakeWorker();
  const registrations = [];
  const hostCalls = [];
  const instance = new PluginInstance(
    "demo",
    manifest ?? { id: "demo", version: "1.0.0" },
    worker,
    {
      onRegister:
        onRegister ??
        ((inst, message) => {
          registrations.push({ inst, message });
          return null;
        }),
      onHostCall:
        onHostCall ??
        ((inst, message) => {
          hostCalls.push({ inst, message });
        }),
    },
  );
  return { instance, worker, registrations, hostCalls };
}

function captureConsole(method, fn) {
  const captured = [];
  const original = console[method];
  console[method] = (...args) => captured.push(args);
  try {
    fn();
  } finally {
    console[method] = original;
  }
  return captured;
}

// Inject a fake "PluginInstance"-shaped object into the bridge's loaded map
// so we can test methods that operate on a loaded plugin without going
// through PluginInstance.loadFromSource (which requires a real worker).
function makeFakeInstance(pluginId = "demo") {
  const worker = new FakeWorker();
  const calls = [];
  const instance = {
    pluginId,
    worker,
    unloaded: false,
    unload() {
      this.unloaded = true;
    },
    call(handlerId, ...args) {
      calls.push({ handlerId, args });
      return Promise.resolve();
    },
    _calls: calls,
  };
  return instance;
}

function makeStylesLoader() {
  const mounts = [];
  const unmounts = [];
  return {
    mounts,
    unmounts,
    mount(pluginId, css) {
      mounts.push({ pluginId, css });
    },
    unmount(pluginId) {
      unmounts.push(pluginId);
    },
  };
}

function makeProvider({ manifest, source, styles } = {}) {
  return {
    async getManifest(id) {
      if (manifest instanceof Error) throw manifest;
      return manifest ?? { id, version: "1.0.0" };
    },
    async getSource() {
      if (source instanceof Error) throw source;
      return source ?? "";
    },
    async getStyles() {
      if (styles instanceof Error) throw styles;
      return styles ?? null;
    },
  };
}

function makeBridge(overrides = {}) {
  const provider = overrides.provider ?? makeProvider();
  const stylesLoader = overrides.stylesLoader ?? makeStylesLoader();
  const loadPluginInstance = overrides.loadPluginInstance;
  return {
    bridge: new PluginBridge(provider, stylesLoader, loadPluginInstance),
    stylesLoader,
    provider,
  };
}

async function expectError(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("expected promise to reject");
}

const t = new TestSuite("pluginBridge");

t.describe("PluginBridge:wrapWorkerSource", (it) => {
  it("prepends a prelude that removes BroadcastChannel/SharedWorker", () => {
    const wrapped = wrapWorkerSource("console.info('hi')");
    assert(wrapped.includes("delete self.BroadcastChannel"));
    assert(wrapped.includes("delete self.SharedWorker"));
    assert(wrapped.includes("console.info('hi')"));
  });
});

t.describe("PluginBridge:isLoaded / getInstance", (it) => {
  it("returns false/null when no plugin is loaded", () => {
    const { bridge } = makeBridge();
    assertEquals(bridge.isLoaded("missing"), false);
    assertEquals(bridge.getInstance("missing"), null);
  });

  it("returns true and the instance once stored", () => {
    const { bridge } = makeBridge();
    const instance = makeFakeInstance("demo");
    bridge._loadedPlugins.set("demo", instance);
    assertEquals(bridge.isLoaded("demo"), true);
    assert(bridge.getInstance("demo") === instance);
  });
});

t.describe("PluginBridge:registration targets", (it) => {
  it("dispatches to a registered target handler with instance and message", () => {
    const { bridge } = makeBridge();
    const calls = [];
    const dispose = () => {};
    bridge.addRegistrationTarget("sidebarItem", (instance, message) => {
      calls.push({ pluginId: instance.pluginId, message });
      return dispose;
    });
    const instance = makeFakeInstance("p1");
    const result = bridge._handleRegistration(instance, {
      target: "sidebarItem",
      handlerId: 7,
    });
    assertEquals(calls.length, 1);
    assertEquals(calls[0].pluginId, "p1");
    assertEquals(calls[0].message.handlerId, 7);
    assert(result === dispose);
  });

  it("returns null when target is unknown", () => {
    const { bridge } = makeBridge();
    const result = bridge._handleRegistration(makeFakeInstance(), {
      target: "nope",
    });
    assertEquals(result, null);
  });
});

t.describe("PluginBridge:host calls", (it) => {
  it("invokes the handler and posts a hostResult with the value", async () => {
    const { bridge } = makeBridge();
    bridge.addHostMethod("ping", (instance, ...args) => {
      assertEquals(instance.pluginId, "p1");
      assertEquals(args, [1, 2]);
      return "pong";
    });
    const instance = makeFakeInstance("p1");
    bridge._handleHostCall(instance, {
      method: "ping",
      hostCallId: 42,
      args: [1, 2],
    });
    // handler is invoked through Promise.resolve().then(...), need to flush.
    await Promise.resolve();
    await Promise.resolve();
    const message = instance.worker.posted.find(
      (entry) => entry.type === "hostResult",
    );
    assertEquals(message.hostCallId, 42);
    assertEquals(message.value, "pong");
  });

  it("forwards thrown errors as hostResult.error", async () => {
    const { bridge } = makeBridge();
    bridge.addHostMethod("explode", () => {
      throw new Error("nope");
    });
    const instance = makeFakeInstance("p1");
    const originalError = console.error;
    console.error = () => {};
    try {
      bridge._handleHostCall(instance, {
        method: "explode",
        hostCallId: 1,
        args: [],
      });
      await Promise.resolve();
      await Promise.resolve();
    } finally {
      console.error = originalError;
    }
    const message = instance.worker.posted.find(
      (entry) => entry.type === "hostResult",
    );
    assertEquals(message.error, "nope");
  });

  it("responds with an error message for unknown host methods", () => {
    const { bridge } = makeBridge();
    const instance = makeFakeInstance("p1");
    const originalWarn = console.warn;
    console.warn = () => {};
    try {
      bridge._handleHostCall(instance, {
        method: "mystery",
        hostCallId: 9,
        args: [],
      });
    } finally {
      console.warn = originalWarn;
    }
    const message = instance.worker.posted.find(
      (entry) => entry.type === "hostResult",
    );
    assertEquals(message.hostCallId, 9);
    assert(/unknown host method/.test(message.error));
  });

  it("does not post a hostResult when hostCallId is missing", async () => {
    const { bridge } = makeBridge();
    bridge.addHostMethod("fire", () => "value");
    const instance = makeFakeInstance("p1");
    bridge._handleHostCall(instance, { method: "fire", args: [] });
    await Promise.resolve();
    await Promise.resolve();
    assertEquals(instance.worker.posted.length, 0);
  });
});

t.describe("PluginBridge:handleNodeEvent", (it) => {
  it("forwards the event to instance.call with handlerId and virtualEvent", () => {
    const { bridge } = makeBridge();
    const instance = makeFakeInstance("p1");
    bridge._loadedPlugins.set("p1", instance);
    bridge.handleNodeEvent("p1", 12, { kind: "click" });
    assertEquals(instance._calls.length, 1);
    assertEquals(instance._calls[0].handlerId, 12);
    assertEquals(instance._calls[0].args, [{ kind: "click" }]);
  });

  it("warns and skips when plugin is not loaded", () => {
    const { bridge } = makeBridge();
    const originalWarn = console.warn;
    let warned = false;
    console.warn = () => {
      warned = true;
    };
    try {
      bridge.handleNodeEvent("missing", 1, {});
    } finally {
      console.warn = originalWarn;
    }
    assert(warned);
  });
});

t.describe("PluginBridge:unloadPlugin", (it) => {
  it("unloads the instance, removes it, and unmounts styles", () => {
    const { bridge, stylesLoader } = makeBridge();
    const instance = makeFakeInstance("demo");
    bridge._loadedPlugins.set("demo", instance);
    bridge.unloadPlugin("demo");
    assertEquals(instance.unloaded, true);
    assertEquals(bridge.isLoaded("demo"), false);
    assertEquals(stylesLoader.unmounts, ["demo"]);
  });

  it("is a no-op when the plugin is not loaded", () => {
    const { bridge, stylesLoader } = makeBridge();
    bridge.unloadPlugin("missing");
    assertEquals(stylesLoader.unmounts, []);
  });
});

t.describe("PluginBridge:loadPlugin error paths", (it) => {
  it("throws a manifest error when getManifest rejects", async () => {
    const provider = makeProvider({ manifest: new Error("bad json") });
    const { bridge } = makeBridge({ provider });
    const originalWarn = console.warn;
    console.warn = () => {};
    try {
      const error = await expectError(bridge.loadPlugin("p1", "1.0.0"));
      assertEquals(error.message, "Failed to load plugin manifest");
    } finally {
      console.warn = originalWarn;
    }
  });

  it("throws a source error when getSource rejects", async () => {
    const provider = makeProvider({ source: new Error("404") });
    const { bridge } = makeBridge({ provider });
    const originalError = console.error;
    console.error = () => {};
    try {
      const error = await expectError(bridge.loadPlugin("p1", "1.0.0"));
      assertEquals(error.message, "Failed to load plugin source");
    } finally {
      console.error = originalError;
    }
  });

  it("throws a styles fetch error when getStyles rejects", async () => {
    const provider = makeProvider({ styles: new Error("net") });
    const { bridge } = makeBridge({ provider });
    const originalError = console.error;
    console.error = () => {};
    try {
      const error = await expectError(bridge.loadPlugin("p1", "1.0.0"));
      assertEquals(error.message, "Failed to load plugin styles");
    } finally {
      console.error = originalError;
    }
  });

  it("throws a styles validation error when mount fails", async () => {
    const provider = makeProvider({ styles: ".x { color: red; }" });
    const stylesLoader = makeStylesLoader();
    stylesLoader.mount = () => {
      throw new Error("bad css");
    };
    const { bridge } = makeBridge({ provider, stylesLoader });
    const originalError = console.error;
    console.error = () => {};
    try {
      const error = await expectError(bridge.loadPlugin("p1", "1.0.0"));
      assertEquals(error.message, "Plugin styles failed validation");
    } finally {
      console.error = originalError;
    }
  });

  it("returns early without loading when the plugin is already loaded", async () => {
    let getManifestCalled = false;
    const provider = makeProvider();
    const originalGetManifest = provider.getManifest;
    provider.getManifest = async (...args) => {
      getManifestCalled = true;
      return originalGetManifest(...args);
    };
    const { bridge } = makeBridge({ provider });
    bridge._loadedPlugins.set("p1", makeFakeInstance("p1"));
    const result = await bridge.loadPlugin("p1", "1.0.0");
    assertEquals(result, undefined);
    assertEquals(getManifestCalled, false);
  });
});

t.describe("PluginBridge:loadPlugin success path", (it) => {
  it("mounts styles, stores the instance, and returns it", async () => {
    const provider = makeProvider({
      source: "// js",
      styles: ".x {}",
      manifest: { id: "p1", version: "1.2.3" },
    });
    const stylesLoader = makeStylesLoader();
    const fakeInstance = makeFakeInstance("p1");
    const loadCalls = [];
    const loadPluginInstance = async (
      pluginId,
      manifest,
      source,
      callbacks,
    ) => {
      loadCalls.push({ pluginId, manifest, source, callbacks });
      return fakeInstance;
    };
    const { bridge } = makeBridge({
      provider,
      stylesLoader,
      loadPluginInstance,
    });
    const originalInfo = console.info;
    console.info = () => {};
    let result;
    try {
      result = await bridge.loadPlugin("p1", "1.2.3");
    } finally {
      console.info = originalInfo;
    }
    assert(result === fakeInstance);
    assertEquals(bridge.isLoaded("p1"), true);
    assertEquals(stylesLoader.mounts, [{ pluginId: "p1", css: ".x {}" }]);
    assertEquals(loadCalls.length, 1);
    assertEquals(loadCalls[0].pluginId, "p1");
    assertEquals(loadCalls[0].manifest.id, "p1");
    assertEquals(loadCalls[0].manifest.version, "1.2.3");
    assertEquals(loadCalls[0].source, "// js");
    assert(typeof loadCalls[0].callbacks.onRegister === "function");
    assert(typeof loadCalls[0].callbacks.onHostCall === "function");
  });

  it("skips style mounting when getStyles returns null", async () => {
    const provider = makeProvider({ source: "// js", styles: null });
    const stylesLoader = makeStylesLoader();
    const loadPluginInstance = async () => makeFakeInstance("p1");
    const { bridge } = makeBridge({
      provider,
      stylesLoader,
      loadPluginInstance,
    });
    const originalInfo = console.info;
    console.info = () => {};
    try {
      await bridge.loadPlugin("p1", "1.0.0");
    } finally {
      console.info = originalInfo;
    }
    assertEquals(stylesLoader.mounts, []);
  });

  it("forwards the manifest to loadPluginInstance", async () => {
    const manifest = {
      id: "p1",
      version: "1.0.0",
      permissions: { fetch: ["https://api.example.com/*"] },
    };
    const provider = makeProvider({ manifest, source: "// js" });
    const loadCalls = [];
    const loadPluginInstance = async (pluginId, mft, source, callbacks) => {
      loadCalls.push({ pluginId, manifest: mft, source, callbacks });
      return makeFakeInstance("p1");
    };
    const { bridge } = makeBridge({ provider, loadPluginInstance });
    const originalInfo = console.info;
    console.info = () => {};
    try {
      await bridge.loadPlugin("p1", "1.0.0");
    } finally {
      console.info = originalInfo;
    }
    assertEquals(loadCalls.length, 1);
    assert(loadCalls[0].manifest === manifest);
  });

  it("unmounts styles and throws an init error when instance loading fails", async () => {
    const provider = makeProvider({ source: "// js", styles: ".x {}" });
    const stylesLoader = makeStylesLoader();
    const loadPluginInstance = async () => {
      throw new Error("worker rejected");
    };
    const { bridge } = makeBridge({
      provider,
      stylesLoader,
      loadPluginInstance,
    });
    const originalError = console.error;
    console.error = () => {};
    let error;
    try {
      error = await expectError(bridge.loadPlugin("p1", "1.0.0"));
    } finally {
      console.error = originalError;
    }
    assertEquals(error.message, "Plugin failed during initialization");
    assertEquals(stylesLoader.unmounts, ["p1"]);
    assertEquals(bridge.isLoaded("p1"), false);
  });

  it("routes onRegister and onHostCall callbacks back through the bridge", async () => {
    const provider = makeProvider({ source: "// js" });
    let capturedCallbacks;
    const fakeInstance = makeFakeInstance("p1");
    const loadPluginInstance = async (
      pluginId,
      manifest,
      source,
      callbacks,
    ) => {
      capturedCallbacks = callbacks;
      return fakeInstance;
    };
    const { bridge } = makeBridge({ provider, loadPluginInstance });
    const registrations = [];
    bridge.addRegistrationTarget("sidebarItem", (instance, message) => {
      registrations.push({ pluginId: instance.pluginId, message });
      return () => {};
    });
    bridge.addHostMethod("ping", (instance) => `hi-${instance.pluginId}`);
    const originalInfo = console.info;
    console.info = () => {};
    try {
      await bridge.loadPlugin("p1", "1.0.0");
    } finally {
      console.info = originalInfo;
    }
    capturedCallbacks.onRegister(fakeInstance, {
      target: "sidebarItem",
      handlerId: 1,
    });
    assertEquals(registrations.length, 1);
    capturedCallbacks.onHostCall(fakeInstance, {
      method: "ping",
      hostCallId: 5,
      args: [],
    });
    await Promise.resolve();
    await Promise.resolve();
    const message = fakeInstance.worker.posted.find(
      (entry) => entry.type === "hostResult",
    );
    assertEquals(message.value, "hi-p1");
  });
});

t.describe("PluginBridge:loadPlugins", (it) => {
  it("aggregates loaded and errored plugins", async () => {
    const { bridge } = makeBridge();
    const fakeInstance = makeFakeInstance("good");
    bridge.loadPlugin = async (id) => {
      if (id === "bad") throw new Error("boom");
      return fakeInstance;
    };
    const result = await bridge.loadPlugins([
      { id: "good", version: "1.0.0" },
      { id: "bad", version: "2.0.0" },
    ]);
    assertEquals(result.loadedPlugins.length, 1);
    assert(result.loadedPlugins[0] === fakeInstance);
    assertEquals(result.erroredPlugins.length, 1);
    assertEquals(result.erroredPlugins[0].pluginId, "bad");
    assertEquals(result.erroredPlugins[0].version, "2.0.0");
    assertEquals(result.erroredPlugins[0].error.message, "boom");
  });
});

t.describe("PluginBridge:reloadPlugin", (it) => {
  it("unloads the existing instance before calling loadPlugin", async () => {
    const { bridge } = makeBridge();
    const instance = makeFakeInstance("demo");
    bridge._loadedPlugins.set("demo", instance);
    const loadCalls = [];
    bridge.loadPlugin = async (id, version, repo) => {
      loadCalls.push({ id, version, repo });
    };
    await bridge.reloadPlugin("demo", "2.0.0", "owner/repo");
    assertEquals(instance.unloaded, true);
    assertEquals(loadCalls, [
      { id: "demo", version: "2.0.0", repo: "owner/repo" },
    ]);
  });
});

t.describe("PluginInstance:manifest & permissions", (it) => {
  it("stores the manifest and parses an empty permissions set by default", () => {
    const { instance } = makeRealInstance({
      manifest: { id: "demo", version: "1.0.0" },
    });
    assertEquals(instance.manifest.version, "1.0.0");
    assertEquals(instance.permissions, {});
  });

  it("parses fetch permissions declared in the manifest", () => {
    const { instance } = makeRealInstance({
      manifest: {
        id: "demo",
        version: "1.0.0",
        permissions: { fetch: ["https://api.example.com/*"] },
      },
    });
    assertEquals(instance.permissions.fetch, ["https://api.example.com/*"]);
  });

  it("tolerates a manifest with no permissions field", () => {
    const { instance } = makeRealInstance({
      manifest: { id: "demo", version: "1.0.0" },
    });
    assertEquals(instance.permissions, {});
  });
});

t.describe("PluginInstance:waitForReady", (it) => {
  it("resolves when a ready message arrives without an error", async () => {
    const { instance, worker } = makeRealInstance();
    const promise = instance.waitForReady(1000);
    worker.emit("message", { data: { type: "ready" } });
    const result = await promise;
    assert(result === instance);
  });

  it("rejects when the ready message contains an error", async () => {
    const { instance, worker } = makeRealInstance();
    const promise = instance.waitForReady(1000);
    worker.emit("message", { data: { type: "ready", error: "init failed" } });
    let caught;
    try {
      await promise;
    } catch (error) {
      caught = error;
    }
    assertEquals(caught, "init failed");
  });

  it("rejects with 'Timed out' when no ready message arrives in time", async () => {
    const { instance } = makeRealInstance();
    let caught;
    try {
      await instance.waitForReady(10);
    } catch (error) {
      caught = error;
    }
    assert(caught instanceof Error);
    assertEquals(caught.message, "Timed out");
  });
});

t.describe("PluginInstance:worker message dispatch", (it) => {
  it("forwards register messages to onRegister and stores returned disposers", () => {
    const disposed = [];
    const dispose = () => disposed.push("yes");
    const { instance, worker } = makeRealInstance({
      onRegister: () => dispose,
    });
    worker.emit("message", {
      data: { type: "register", target: "sidebarItem", handlerId: 3 },
    });
    assertEquals(instance.disposers.length, 1);
    instance.disposers[0]();
    assertEquals(disposed, ["yes"]);
  });

  it("does not push a disposer when onRegister returns falsy", () => {
    const { instance, worker } = makeRealInstance({ onRegister: () => null });
    worker.emit("message", {
      data: { type: "register", target: "x", handlerId: 1 },
    });
    assertEquals(instance.disposers.length, 0);
  });

  it("forwards hostCall messages to onHostCall", () => {
    const { instance, worker, hostCalls } = makeRealInstance();
    worker.emit("message", {
      data: { type: "hostCall", method: "showToast", hostCallId: 1, args: [] },
    });
    assertEquals(hostCalls.length, 1);
    assertEquals(hostCalls[0].message.method, "showToast");
    assert(hostCalls[0].inst === instance);
  });

  it("ignores non-object messages", () => {
    const { instance, worker } = makeRealInstance();
    worker.emit("message", { data: null });
    worker.emit("message", { data: "string" });
    worker.emit("message", { data: 42 });
    assertEquals(instance.disposers.length, 0);
  });

  it("ignores unknown message types", () => {
    const { instance, worker } = makeRealInstance();
    worker.emit("message", { data: { type: "garbage" } });
    assertEquals(instance.disposers.length, 0);
  });

  it("logs but does not throw on worker error events", () => {
    const { worker } = makeRealInstance();
    const originalError = console.error;
    let logged = false;
    console.error = () => {
      logged = true;
    };
    try {
      worker.emit("error", { message: "boom" });
    } finally {
      console.error = originalError;
    }
    assert(logged);
  });
});

t.describe("PluginInstance:call()", (it) => {
  it("posts a call message and resolves with the result value", async () => {
    const { instance, worker } = makeRealInstance();
    const promise = instance.call(7, "arg1", "arg2");
    const sent = worker.posted[0];
    assertEquals(sent.type, "call");
    assertEquals(sent.handlerId, 7);
    assertEquals(sent.args, ["arg1", "arg2"]);
    assert(typeof sent.callId === "number");
    worker.emit("message", {
      data: { type: "result", callId: sent.callId, value: "ok" },
    });
    assertEquals(await promise, "ok");
  });

  it("rejects with an Error when the result carries an error", async () => {
    const { instance, worker } = makeRealInstance();
    const promise = instance.call(1);
    const sent = worker.posted[0];
    worker.emit("message", {
      data: { type: "result", callId: sent.callId, error: "nope" },
    });
    let caught;
    try {
      await promise;
    } catch (error) {
      caught = error;
    }
    assert(caught instanceof Error);
    assertEquals(caught.message, "nope");
  });

  it("assigns unique callIds to concurrent calls", async () => {
    const { instance, worker } = makeRealInstance();
    const promise1 = instance.call(1);
    const promise2 = instance.call(2);
    const first = worker.posted[0];
    const second = worker.posted[1];
    assert(first.callId !== second.callId);
    worker.emit("message", {
      data: { type: "result", callId: second.callId, value: "B" },
    });
    worker.emit("message", {
      data: { type: "result", callId: first.callId, value: "A" },
    });
    assertEquals(await promise1, "A");
    assertEquals(await promise2, "B");
  });

  it("ignores result messages for unknown callIds", () => {
    const { instance, worker } = makeRealInstance();
    worker.emit("message", {
      data: { type: "result", callId: 9999, value: "x" },
    });
    assertEquals(instance._pendingCalls.size, 0);
  });
});

t.describe("PluginInstance:sendEvent", (it) => {
  it("posts an event message verbatim", () => {
    const { instance, worker } = makeRealInstance();
    instance.sendEvent("modalDismissed", { modalId: "m1" });
    assertEquals(worker.posted[0], {
      type: "event",
      event: "modalDismissed",
      data: { modalId: "m1" },
    });
  });
});

t.describe("PluginInstance:unload", (it) => {
  it("runs each disposer once and terminates the worker", () => {
    const { instance, worker } = makeRealInstance();
    const calls = [];
    instance.disposers.push(() => calls.push("a"));
    instance.disposers.push(() => calls.push("b"));
    instance.unload();
    assertEquals(calls, ["a", "b"]);
    assertEquals(worker.terminated, true);
  });
});

t.describe("internals:Logger", (it) => {
  it("prefixes each log line with the configured prefix", () => {
    const logger = new Logger("[test]", "info");
    const calls = captureConsole("info", () => logger.info("hello", 1));
    assertEquals(calls.length, 1);
    assertEquals(calls[0][0], "[test]");
    assertEquals(calls[0][1], "hello");
    assertEquals(calls[0][2], 1);
  });

  it("suppresses info when level is warn", () => {
    const logger = new Logger("[test]", "warn");
    const infoCalls = captureConsole("info", () => logger.info("hidden"));
    const warnCalls = captureConsole("warn", () => logger.warn("shown"));
    assertEquals(infoCalls.length, 0);
    assertEquals(warnCalls.length, 1);
  });

  it("suppresses info and warn when level is error", () => {
    const logger = new Logger("[test]", "error");
    const infoCalls = captureConsole("info", () => logger.info("x"));
    const warnCalls = captureConsole("warn", () => logger.warn("y"));
    const errorCalls = captureConsole("error", () => logger.error("z"));
    assertEquals(infoCalls.length, 0);
    assertEquals(warnCalls.length, 0);
    assertEquals(errorCalls.length, 1);
  });

  it("suppresses everything at silent level", () => {
    const logger = new Logger("[test]", "silent");
    const infoCalls = captureConsole("info", () => logger.info("x"));
    const warnCalls = captureConsole("warn", () => logger.warn("y"));
    const errorCalls = captureConsole("error", () => logger.error("z"));
    assertEquals(infoCalls.length, 0);
    assertEquals(warnCalls.length, 0);
    assertEquals(errorCalls.length, 0);
  });

  it("defaults to warn level when none is provided", () => {
    const logger = new Logger("[test]");
    const infoCalls = captureConsole("info", () => logger.info("x"));
    const warnCalls = captureConsole("warn", () => logger.warn("y"));
    assertEquals(infoCalls.length, 0);
    assertEquals(warnCalls.length, 1);
  });
});

t.describe("internals:wrapWorkerSource ordering", (it) => {
  it("places the prelude before the user source so it runs first", () => {
    const wrapped = wrapWorkerSource("user();");
    const preludeIndex = wrapped.indexOf("delete self.BroadcastChannel");
    const sourceIndex = wrapped.indexOf("user();");
    assert(preludeIndex >= 0 && sourceIndex >= 0);
    assert(preludeIndex < sourceIndex);
  });
});

t.describe("internals:SandboxedWorker", (it) => {
  it("appends a sandboxed iframe to document.body and posts init on load", () => {
    const before = document.body.querySelectorAll("iframe").length;
    const worker = new SandboxedWorker("// source");
    const after = document.body.querySelectorAll("iframe").length;
    assertEquals(after, before + 1);
    assertEquals(worker.frame.getAttribute("sandbox"), "allow-scripts");
    assertEquals(worker.frame.getAttribute("aria-hidden"), "true");
    assertEquals(worker.frame.style.display, "none");

    const posted = [];
    Object.defineProperty(worker.frame, "contentWindow", {
      configurable: true,
      value: { postMessage: (message) => posted.push(message) },
    });
    worker._messageTarget = worker.frame.contentWindow;
    worker.frame.dispatchEvent(new Event("load"));
    assertEquals(posted.length, 1);
    assertEquals(posted[0].type, "init");
    assert(typeof posted[0].workerSource === "string");
    assert(posted[0].workerSource.includes("// source"));
    worker.terminate();
  });

  it("postMessage forwards a 'send' envelope to the iframe", () => {
    const worker = new SandboxedWorker("// source");
    const posted = [];
    Object.defineProperty(worker.frame, "contentWindow", {
      configurable: true,
      value: { postMessage: (message) => posted.push(message) },
    });
    worker.postMessage({ hello: 1 });
    assertEquals(posted, [{ type: "send", payload: { hello: 1 } }]);
    worker.terminate();
  });

  it("dispatches message events for fromWorker payloads", () => {
    const worker = new SandboxedWorker("// source");
    const received = [];
    worker.addEventListener("message", (event) => received.push(event));
    const fakeContentWindow = {};
    Object.defineProperty(worker.frame, "contentWindow", {
      configurable: true,
      value: fakeContentWindow,
    });
    worker._handleWindowMessage({
      source: fakeContentWindow,
      data: { type: "fromWorker", payload: { value: 42 } },
    });
    assertEquals(received.length, 1);
    assertEquals(received[0].data, { value: 42 });
    worker.terminate();
  });

  it("dispatches error events for workerError payloads", () => {
    const worker = new SandboxedWorker("// source");
    const received = [];
    worker.addEventListener("error", (event) => received.push(event));
    const fakeContentWindow = {};
    Object.defineProperty(worker.frame, "contentWindow", {
      configurable: true,
      value: fakeContentWindow,
    });
    worker._handleWindowMessage({
      source: fakeContentWindow,
      data: { type: "workerError", error: "boom" },
    });
    assertEquals(received.length, 1);
    assertEquals(received[0].message, "boom");
    worker.terminate();
  });

  it("ignores messages from other window sources", () => {
    const worker = new SandboxedWorker("// source");
    const received = [];
    worker.addEventListener("message", (event) => received.push(event));
    worker._handleWindowMessage({
      source: {},
      data: { type: "fromWorker", payload: 1 },
    });
    assertEquals(received.length, 0);
    worker.terminate();
  });

  it("terminate removes the iframe and dispatches a terminate event", () => {
    const worker = new SandboxedWorker("// source");
    let terminated = false;
    worker.addEventListener("terminate", () => {
      terminated = true;
    });
    const frame = worker.frame;
    assert(document.body.contains(frame));
    worker.terminate();
    assert(!document.body.contains(frame));
    assert(terminated);
  });
});

await t.run();
