import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { isPromise } from "/js/utils.js";
import {
  PluginSlotDispatcher,
  SlotInvocationMonitor,
} from "/js/plugins/pluginSlotDispatcher.js";

const SLOT = "post:badges";

// Mirrors the SDK's batch wrapper: one call per flush, an array of
// { value } | { error } results in payload order. `calls` records the payload
// of every call so tests can assert on batching and dedupe.
function makeInvoke({ batch = true } = {}) {
  const calls = [];
  const invoke = (payload) => {
    calls.push(payload);
    if (!batch) {
      return Promise.resolve({ tag: "div", text: JSON.stringify(payload) });
    }
    return Promise.resolve(
      payload.map((context) => ({
        value: { tag: "div", text: JSON.stringify(context) },
      })),
    );
  };
  return { invoke, calls };
}

function register(
  dispatcher,
  { pluginId = "alpha", name = SLOT, ...rest } = {},
) {
  const { invoke, calls } = makeInvoke(rest);
  const dispose = dispatcher.register({
    pluginId,
    name,
    batch: true,
    invoke,
    ...rest,
  });
  const registration = dispatcher
    .getRegistrations(name)
    .find((candidate) => candidate.pluginId === pluginId);
  return { registration, dispose, calls };
}

describe("PluginSlotDispatcher - registry", () => {
  it("returns an empty list for unknown slots", () => {
    const dispatcher = new PluginSlotDispatcher();
    assert.deepEqual(dispatcher.getRegistrations("nope"), []);
  });

  it("records registrations in order", () => {
    const dispatcher = new PluginSlotDispatcher();
    register(dispatcher, { pluginId: "alpha", name: "x" });
    register(dispatcher, { pluginId: "beta", name: "x" });
    assert.deepEqual(
      dispatcher.getRegistrations("x").map((entry) => entry.pluginId),
      ["alpha", "beta"],
    );
  });

  it("keeps only the declared string fields of a cacheKey", () => {
    const dispatcher = new PluginSlotDispatcher();
    const { registration } = register(dispatcher, {
      cacheKey: ["did", 7, "uri"],
    });
    assert.deepEqual(registration.cacheKey, ["did", "uri"]);
  });

  it("treats an absent cacheKey as no cacheKey", () => {
    const dispatcher = new PluginSlotDispatcher();
    assert.deepEqual(register(dispatcher).registration.cacheKey, null);
  });

  it("keeps an empty cacheKey as a declaration of its own", () => {
    const dispatcher = new PluginSlotDispatcher();
    const { registration } = register(dispatcher, { cacheKey: [] });
    assert.deepEqual(registration.cacheKey, []);
  });

  it("keys a cacheKey registration's context on the declared fields only", () => {
    const dispatcher = new PluginSlotDispatcher();
    const { registration } = register(dispatcher, { cacheKey: ["did"] });
    const key = registration.contextKeyFor({ uri: "at://a", did: "did:one" });
    assert.equal(registration.contextKeyFor({ did: "did:one" }), key);
    assert.equal(
      registration.contextKeyFor({ uri: "at://b", did: "did:one" }),
      key,
    );
    assert.notEqual(registration.contextKeyFor({ did: "did:two" }), key);
  });

  it("keys a registration with no cacheKey on the whole context, field order aside", () => {
    const dispatcher = new PluginSlotDispatcher();
    const { registration } = register(dispatcher);
    const key = registration.contextKeyFor({ uri: "at://a", did: "did:one" });
    assert.equal(
      registration.contextKeyFor({ did: "did:one", uri: "at://a" }),
      key,
    );
    assert.notEqual(registration.contextKeyFor({ uri: "at://a" }), key);
  });

  it("never reuses a version number for a later registration", () => {
    const dispatcher = new PluginSlotDispatcher();
    const { registration, dispose } = register(dispatcher, { name: "x" });
    const firstVersion = registration.versionFor({ did: "did:one" });
    dispose();
    const { registration: second } = register(dispatcher, { name: "x" });
    assert.notEqual(second.versionFor({ did: "did:one" }), firstVersion);
  });

  it("warns and skips when a plugin registers the same slot twice", () => {
    const dispatcher = new PluginSlotDispatcher();
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(" "));
    try {
      register(dispatcher, { name: "x" });
      const { dispose } = register(dispatcher, { name: "x" });
      assert.deepEqual(dispose, null);
      assert.deepEqual(warnings.length, 1);
      assert(warnings[0].includes("alpha"));
      assert.deepEqual(dispatcher.getRegistrations("x").length, 1);
    } finally {
      console.warn = originalWarn;
    }
  });

  it("dispose removes the registration and prunes the slot when empty", () => {
    const dispatcher = new PluginSlotDispatcher();
    const { dispose } = register(dispatcher, { name: "x" });
    assert.deepEqual(dispatcher.getRegistrations("x").length, 1);
    dispose();
    assert.deepEqual(dispatcher.getRegistrations("x"), []);
    assert.deepEqual(dispatcher.$slots.get("x"), null);
  });

  it("updates the $slots signal on register and unregister", () => {
    const dispatcher = new PluginSlotDispatcher();
    assert.deepEqual(dispatcher.$slots.get("x"), null);
    const { dispose } = register(dispatcher, { name: "x" });
    assert.deepEqual(
      dispatcher.$slots.get("x").map((entry) => entry.pluginId),
      ["alpha"],
    );
    dispose();
    assert.deepEqual(dispatcher.$slots.get("x"), null);
  });
});

describe("PluginSlotDispatcher - refresh", () => {
  it("bumps only the calling plugin's versions and re-emits the list", () => {
    const dispatcher = new PluginSlotDispatcher();
    const alpha = register(dispatcher, { pluginId: "alpha" }).registration;
    const beta = register(dispatcher, { pluginId: "beta" }).registration;
    const context = { did: "did:one" };
    const before = dispatcher.$slots.get(SLOT);
    const alphaVersionBefore = alpha.versionFor(context);
    const betaVersionBefore = beta.versionFor(context);

    dispatcher.refresh("alpha", SLOT);

    // Slots re-reconcile off the signal; the versions decide who re-invokes
    assert.notEqual(dispatcher.$slots.get(SLOT), before);
    assert.deepEqual(
      dispatcher.$slots.get(SLOT).map((registration) => registration.pluginId),
      ["alpha", "beta"],
    );
    assert.notEqual(alpha.versionFor(context), alphaVersionBefore);
    assert.equal(beta.versionFor(context), betaVersionBefore);
  });

  it("bumps only the contexts a keyed refresh matches", async () => {
    const dispatcher = new PluginSlotDispatcher();
    const { registration } = register(dispatcher);
    const matching = { uri: "at://a", did: "did:one" };
    const other = { uri: "at://b", did: "did:two" };
    await registration.request(matching);
    await registration.request(other);
    const matchingBefore = registration.versionFor(matching);
    const otherBefore = registration.versionFor(other);

    dispatcher.refresh("alpha", SLOT, [{ did: "did:one" }]);

    assert.notEqual(registration.versionFor(matching), matchingBefore);
    assert.equal(registration.versionFor(other), otherBefore);
  });

  it("tracks a context the first time its version is read", () => {
    const dispatcher = new PluginSlotDispatcher();
    const { registration } = register(dispatcher);
    // Reading a version is how a slot element takes a context into use, so it
    // is enough to make that context targetable
    const context = { uri: "at://a" };
    const before = registration.versionFor(context);
    dispatcher.refresh("alpha", SLOT, [{ uri: "at://a" }]);
    assert.notEqual(registration.versionFor(context), before);
  });

  it("bumps nothing for a key no context has matched", () => {
    const dispatcher = new PluginSlotDispatcher();
    const { registration } = register(dispatcher);
    const context = { uri: "at://a" };
    const before = registration.versionFor(context);
    dispatcher.refresh("alpha", SLOT, [{ uri: "at://never-seen" }]);
    assert.equal(registration.versionFor(context), before);
  });

  it("bumps every context when a keyed refresh follows forgotten contexts", () => {
    const dispatcher = new PluginSlotDispatcher();
    const { registration } = register(dispatcher);
    const first = { uri: "at://0" };
    const firstBefore = registration.versionFor(first);
    // Overflow the tracked-context cap so `first` is forgotten
    for (let index = 0; index < 700; index++) {
      registration.versionFor({ uri: `at://x${index}` });
    }
    dispatcher.refresh("alpha", SLOT, [{ uri: "at://nothing-tracked" }]);
    // Targeting can't be trusted after an eviction, so everything re-invokes
    assert.notEqual(registration.versionFor(first), firstBefore);
  });

  it("dispose still removes the registration after a refresh replaced it", () => {
    const dispatcher = new PluginSlotDispatcher();
    const { dispose } = register(dispatcher);
    dispatcher.refresh("alpha", SLOT);
    dispose();
    assert.deepEqual(dispatcher.$slots.get(SLOT), null);
  });

  it("is a no-op for a slot name nobody has registered", () => {
    const dispatcher = new PluginSlotDispatcher();
    assert.doesNotThrow(() => dispatcher.refresh("alpha", "nope"));
    assert.deepEqual(dispatcher.$slots.get("nope"), null);
  });

  it("is a no-op when the calling plugin has no registration in the slot", () => {
    const dispatcher = new PluginSlotDispatcher();
    register(dispatcher, { pluginId: "alpha" });
    const before = dispatcher.$slots.get(SLOT);
    dispatcher.refresh("beta", SLOT);
    assert.equal(dispatcher.$slots.get(SLOT), before);
  });
});

describe("PluginSlotDispatcher - invocation and caching", () => {
  // The monitor is exercised separately; leaving it out keeps these tests from
  // tripping its dev warnings on the high-volume cases.
  function makeDispatcher() {
    return new PluginSlotDispatcher({ monitor: null });
  }

  it("batches a flush into one call per plugin", async () => {
    const dispatcher = makeDispatcher();
    const { registration, calls } = register(dispatcher);
    await Promise.all(
      [{ uri: "at://a" }, { uri: "at://b" }].map((context) =>
        registration.request(context),
      ),
    );
    assert.deepEqual(calls, [[{ uri: "at://a" }, { uri: "at://b" }]]);
  });

  it("falls back to per-item calls for plugins that don't advertise batching", async () => {
    const dispatcher = makeDispatcher();
    const { registration, calls } = register(dispatcher, { batch: false });
    const node = await registration.request({ uri: "at://a" });
    assert.deepEqual(calls, [{ uri: "at://a" }]);
    assert.deepEqual(node.text, JSON.stringify({ uri: "at://a" }));
  });

  it("passes the full context to registrations without a cacheKey", async () => {
    const dispatcher = makeDispatcher();
    const { registration, calls } = register(dispatcher);
    await registration.request({ uri: "at://a", did: "did:one" });
    await registration.request({ uri: "at://a", did: "did:one" });
    assert.deepEqual(calls, [
      [{ uri: "at://a", did: "did:one" }],
      [{ uri: "at://a", did: "did:one" }],
    ]);
  });

  it("invokes a cacheKey registration once per distinct projection", async () => {
    const dispatcher = makeDispatcher();
    const { registration, calls } = register(dispatcher, { cacheKey: ["did"] });
    const requests = [
      registration.request({ uri: "at://a", did: "did:one" }),
      registration.request({ uri: "at://b", did: "did:one" }),
      registration.request({ uri: "at://c", did: "did:two" }),
    ];
    assert.deepEqual(requests.map(isPromise), [true, true, true]);
    const nodes = await Promise.all(requests);
    assert.deepEqual(calls, [[{ did: "did:one" }, { did: "did:two" }]]);
    assert.equal(nodes[0], nodes[1]);
  });

  it("invokes an empty-cacheKey registration once for every context", async () => {
    const dispatcher = makeDispatcher();
    const { registration, calls } = register(dispatcher, { cacheKey: [] });
    const requests = [
      registration.request({ uri: "at://a", did: "did:one" }),
      registration.request({ uri: "at://b", did: "did:two" }),
    ];
    const nodes = await Promise.all(requests);
    // The callback is handed nothing, since its output may depend on nothing
    assert.deepEqual(calls, [[{}]]);
    assert.equal(nodes[0], nodes[1]);
    assert.deepEqual(
      isPromise(registration.request({ uri: "at://c", did: "did:three" })),
      false,
    );
  });

  it("re-invokes an empty-cacheKey registration after a keyless refresh", async () => {
    const dispatcher = makeDispatcher();
    const { registration, calls } = register(dispatcher, { cacheKey: [] });
    await registration.request({ did: "did:one" });
    dispatcher.refresh("alpha", SLOT);
    const second = registration.request({ did: "did:one" });
    assert(isPromise(second));
    await second;
    assert.deepEqual(calls.length, 2);
  });

  it("rejects keys for an empty-cacheKey registration", async () => {
    const dispatcher = makeDispatcher();
    const { registration } = register(dispatcher, { cacheKey: [] });
    await registration.request({ did: "did:one" });
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(" "));
    try {
      dispatcher.refresh("alpha", SLOT, [{ did: "did:one" }]);
      assert.deepEqual(warnings.length, 1);
      assert(warnings[0].includes("empty cacheKey"));
      assert.deepEqual(
        isPromise(registration.request({ did: "did:one" })),
        false,
      );
    } finally {
      console.warn = originalWarn;
    }
  });

  it("serves a later appearance of a known projection synchronously", async () => {
    const dispatcher = makeDispatcher();
    const { registration, calls } = register(dispatcher, { cacheKey: ["did"] });
    const node = await registration.request({ uri: "at://a", did: "did:one" });
    const second = registration.request({ uri: "at://z", did: "did:one" });
    assert.deepEqual(isPromise(second), false);
    assert.equal(second, node);
    assert.deepEqual(calls.length, 1);
  });

  it("keeps caches separate per plugin", async () => {
    const dispatcher = makeDispatcher();
    const alpha = register(dispatcher, {
      pluginId: "alpha",
      cacheKey: ["did"],
    });
    const beta = register(dispatcher, { pluginId: "beta", cacheKey: ["did"] });
    await alpha.registration.request({ did: "did:one" });
    await beta.registration.request({ did: "did:one" });
    dispatcher.refresh("alpha", SLOT);
    assert(isPromise(alpha.registration.request({ did: "did:one" })));
    assert.deepEqual(
      isPromise(beta.registration.request({ did: "did:one" })),
      false,
    );
  });

  it("drops the whole cache on a keyless refresh", async () => {
    const dispatcher = makeDispatcher();
    const { registration } = register(dispatcher, { cacheKey: ["did"] });
    await registration.request({ did: "did:one" });
    await registration.request({ did: "did:two" });
    dispatcher.refresh("alpha", SLOT);
    assert(isPromise(registration.request({ did: "did:one" })));
    assert(isPromise(registration.request({ did: "did:two" })));
  });

  it("drops the entries a keyed refresh matches, sharing and all", async () => {
    const dispatcher = makeDispatcher();
    const { registration } = register(dispatcher, { cacheKey: ["did"] });
    await registration.request({ uri: "at://a", did: "did:one" });
    await registration.request({ uri: "at://c", did: "did:two" });
    dispatcher.refresh("alpha", SLOT, [{ did: "did:one" }]);
    // The dropped entry was shared, so every post by that author re-invokes
    assert(isPromise(registration.request({ uri: "at://b", did: "did:one" })));
    assert.deepEqual(
      isPromise(registration.request({ uri: "at://c", did: "did:two" })),
      false,
    );
  });

  it("matches a keyed refresh on every field of a matcher", async () => {
    const dispatcher = makeDispatcher();
    const { registration } = register(dispatcher, {
      cacheKey: ["did", "surface"],
    });
    const context = { did: "did:one", surface: "feed" };
    await registration.request(context);
    dispatcher.refresh("alpha", SLOT, [{ did: "did:one", surface: "profile" }]);
    assert.deepEqual(isPromise(registration.request(context)), false);
    dispatcher.refresh("alpha", SLOT, [{ did: "did:one", surface: "feed" }]);
    assert(isPromise(registration.request(context)));
  });

  it("rejects keys naming fields outside the declared cacheKey", async () => {
    const dispatcher = makeDispatcher();
    const { registration } = register(dispatcher, { cacheKey: ["did"] });
    const context = { uri: "at://a", did: "did:one" };
    await registration.request(context);
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(" "));
    try {
      // The output can't depend on uri, so matching on it can't mean anything
      dispatcher.refresh("alpha", SLOT, [{ uri: "at://a" }]);
      assert.deepEqual(warnings.length, 1);
      assert(warnings[0].includes("cacheKey (did)"));
      assert.deepEqual(isPromise(registration.request(context)), false);
    } finally {
      console.warn = originalWarn;
    }
  });

  it("allows any context field for a registration with no cacheKey", async () => {
    const dispatcher = makeDispatcher();
    const { registration } = register(dispatcher);
    const context = { uri: "at://a", did: "did:one" };
    const before = registration.versionFor(context);
    dispatcher.refresh("alpha", SLOT, [{ uri: "at://a" }]);
    assert.notEqual(registration.versionFor(context), before);
  });

  it("matches nothing for a key no cached projection has seen", async () => {
    const dispatcher = makeDispatcher();
    const { registration } = register(dispatcher, { cacheKey: ["did"] });
    await registration.request({ uri: "at://a", did: "did:one" });
    dispatcher.refresh("alpha", SLOT, [{ did: "did:unknown" }]);
    assert.deepEqual(
      isPromise(registration.request({ uri: "at://a", did: "did:one" })),
      false,
    );
  });

  it("rejects malformed keys without touching the cache", async () => {
    const dispatcher = makeDispatcher();
    const { registration } = register(dispatcher, { cacheKey: ["did"] });
    await registration.request({ did: "did:one" });
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(" "));
    try {
      const versionBefore = registration.versionFor({ did: "did:one" });
      for (const keys of [[{}], [], [{ did: 7 }], ["did:one"], {}]) {
        dispatcher.refresh("alpha", SLOT, keys);
      }
      assert.deepEqual(warnings.length, 5);
      assert.deepEqual(
        isPromise(registration.request({ did: "did:one" })),
        false,
      );
      assert.deepEqual(
        registration.versionFor({ did: "did:one" }),
        versionBefore,
      );
    } finally {
      console.warn = originalWarn;
    }
  });

  it("discards an in-flight result that a refresh invalidated", async () => {
    const dispatcher = makeDispatcher();
    let resolveCall = null;
    const dispose = dispatcher.register({
      pluginId: "alpha",
      name: SLOT,
      cacheKey: ["did"],
      batch: true,
      invoke: () =>
        new Promise((resolve) => {
          resolveCall = resolve;
        }),
    });
    assert(dispose !== null);
    const [registration] = dispatcher.getRegistrations(SLOT);
    const pending = registration.request({ did: "did:one" });
    await Promise.resolve();
    dispatcher.refresh("alpha", SLOT);
    resolveCall([{ value: { tag: "div", text: "stale" } }]);
    await pending;
    assert(isPromise(registration.request({ did: "did:one" })));
  });

  it("rejects the caller when a batch item reports an error", async () => {
    const dispatcher = makeDispatcher();
    dispatcher.register({
      pluginId: "alpha",
      name: SLOT,
      cacheKey: ["did"],
      batch: true,
      invoke: () => Promise.resolve([{ error: "boom" }]),
    });
    const [registration] = dispatcher.getRegistrations(SLOT);
    await assert.rejects(registration.request({ did: "did:one" }), /boom/);
    // A failed call is not cached
    const retry = registration.request({ did: "did:one" });
    assert(isPromise(retry));
    await assert.rejects(retry, /boom/);
  });

  it("rejects every caller when a plugin returns a malformed batch", async () => {
    const dispatcher = makeDispatcher();
    dispatcher.register({
      pluginId: "alpha",
      name: SLOT,
      cacheKey: ["did"],
      batch: true,
      invoke: () => Promise.resolve("nope"),
    });
    const [registration] = dispatcher.getRegistrations(SLOT);
    await assert.rejects(
      registration.request({ did: "did:one" }),
      /malformed slot batch/,
    );
  });

  it("evicts least-recently-used values", async () => {
    const dispatcher = makeDispatcher();
    const { registration } = register(dispatcher, { cacheKey: ["did"] });
    const requests = [];
    for (let i = 0; i <= 200; i++) {
      requests.push(
        registration.request({ uri: `at://${i}`, did: `did:${i}` }),
      );
    }
    await Promise.all(requests);
    // The cap holds - the one invariant here with no observable behavior
    const cache = dispatcher._caches.get(JSON.stringify(["alpha", SLOT]));
    assert.deepEqual(cache._values.size, 200);
    assert(isPromise(registration.request({ did: "did:0" })));
    assert.deepEqual(
      isPromise(registration.request({ uri: "at://200", did: "did:200" })),
      false,
    );
  });

  it("drops a plugin's cache when its registration unregisters", async () => {
    const dispatcher = makeDispatcher();
    const first = register(dispatcher, { cacheKey: ["did"] });
    await first.registration.request({ did: "did:one" });
    first.dispose();
    const second = register(dispatcher, { cacheKey: ["did"] });
    assert(isPromise(second.registration.request({ did: "did:one" })));
    await second.registration.request({ did: "did:one" });
    assert.deepEqual(second.calls.length, 1);
  });
});

describe("PluginSlotDispatcher - invocation monitor", () => {
  function makeDispatcher() {
    return new PluginSlotDispatcher({ monitor: new SlotInvocationMonitor() });
  }

  const warnings = [];
  let now = 1_000_000;
  const originalWarn = console.warn;
  const originalNow = Date.now;

  beforeEach(() => {
    warnings.length = 0;
    now = 1_000_000;
    console.warn = (...args) => warnings.push(args.join(" "));
    Date.now = () => now;
  });

  afterEach(() => {
    console.warn = originalWarn;
    Date.now = originalNow;
  });

  // A slot can be mounted many times per page with the same context, so
  // repeats alone say nothing at this layer - only volume does.
  it("stays quiet when one context is re-invoked by many mounted slots", async () => {
    const { registration } = register(makeDispatcher());
    for (let i = 0; i < 20; i++) {
      await registration.request({ did: "did:one" });
    }
    assert.deepEqual(warnings, []);
  });

  it("stays quiet for high volume spread across separate windows", async () => {
    const { registration } = register(makeDispatcher());
    for (let i = 0; i < 300; i++) {
      await registration.request({ did: `did:${i}` });
      now += 5001;
    }
    assert.deepEqual(warnings, []);
  });

  it("stays quiet for a burst of distinct contexts under the volume limit", async () => {
    const { registration } = register(makeDispatcher());
    await Promise.all(
      Array.from({ length: 40 }, (_, index) =>
        registration.request({ did: `did:${index}` }),
      ),
    );
    assert.deepEqual(warnings, []);
  });

  it("suggests a cacheKey when volume is high across distinct contexts", async () => {
    const { registration } = register(makeDispatcher());
    await Promise.all(
      Array.from({ length: 100 }, (_, index) =>
        registration.request({ did: `did:${index}` }),
      ),
    );
    assert.deepEqual(warnings.length, 1);
    assert(warnings[0].includes("100 times in 5s across 100 contexts"));
    assert(warnings[0].includes("Declare a cacheKey"));
  });

  it("points at an over-specific cacheKey when one is already declared", async () => {
    const { registration } = register(makeDispatcher(), { cacheKey: ["uri"] });
    await Promise.all(
      Array.from({ length: 100 }, (_, index) =>
        registration.request({ uri: `at://${index}` }),
      ),
    );
    assert.deepEqual(warnings.length, 1);
    assert(warnings[0].includes("cacheKey (uri) may be too specific"));
  });

  it("counts cache hits as no invocation at all", async () => {
    const { registration } = register(makeDispatcher(), { cacheKey: ["did"] });
    // Past the volume limit, so a cache hit counted as an invocation would warn
    for (let i = 0; i < 150; i++) {
      const request = registration.request({
        uri: `at://${i}`,
        did: "did:one",
      });
      if (isPromise(request)) await request;
    }
    assert.deepEqual(warnings, []);
  });
});
