import { EventEmitter } from "/js/eventEmitter.js";

let trackedReads = null;

function track(signal) {
  if (trackedReads) trackedReads.add(signal);
}

function withTracking(set, fn) {
  const previous = trackedReads;
  trackedReads = set;
  try {
    return fn();
  } finally {
    trackedReads = previous;
  }
}

export function untrack(fn) {
  return withTracking(null, fn);
}

let globalTick = 0;

class State {
  __debugName = "<State>";
  __lastChangedTick = 0;
  #value;
  #watchers = new Set();
  #dependents = new Set();
  #equals;

  constructor(initialValue, { equals = Object.is } = {}) {
    this.#value = initialValue;
    this.#equals = equals;
  }

  get() {
    track(this);
    return this.#value;
  }

  set(newValue) {
    if (this.#equals(newValue, this.#value)) return;
    this.#value = newValue;
    this.__lastChangedTick = ++globalTick;

    for (const dependent of [...this.#dependents]) dependent._markDirty(this);
    for (const watcher of [...this.#watchers]) watcher._notify(this);
  }

  _addDependent(computed) {
    this.#dependents.add(computed);
  }
  _removeDependent(computed) {
    this.#dependents.delete(computed);
  }
  _addWatcher(watcher) {
    this.#watchers.add(watcher);
  }
  _removeWatcher(watcher) {
    this.#watchers.delete(watcher);
  }
}

class Computed {
  __debugName = "<Computed>";
  __quiet = false;
  #cb;
  #value;
  #dirty = true;
  #deps = new Set();
  #dependents = new Set();
  #watchers = new Set();
  #dirtyFrom = new Set();

  constructor(cb) {
    this.#cb = cb;
  }

  get() {
    track(this);
    if (this.#dirty) this.#recompute();
    return this.#value;
  }

  #recompute() {
    for (const dep of this.#deps) dep._removeDependent(this);
    const tracked = new Set();
    this.#value = withTracking(tracked, () => this.#cb.call(this));
    this.#deps = tracked;
    for (const dep of this.#deps) dep._addDependent(this);
    this.#dirty = false;
    this.#dirtyFrom = new Set();
  }

  _markDirty(marker) {
    this.#dirtyFrom.add(marker);
    const wasDirty = this.#dirty;
    this.#dirty = true;
    if (wasDirty) return;
    for (const dependent of [...this.#dependents]) dependent._markDirty(this);
    for (const watcher of [...this.#watchers]) watcher._notify(this);
  }

  _getDirtyFrom() {
    return this.#dirtyFrom;
  }

  dispose() {
    for (const dep of this.#deps) dep._removeDependent(this);
    this.#deps = new Set();
    this.#dirty = true;
  }

  _addDependent(computed) {
    this.#dependents.add(computed);
  }
  _removeDependent(computed) {
    this.#dependents.delete(computed);
  }
  _addWatcher(watcher) {
    this.#watchers.add(watcher);
  }
  _removeWatcher(watcher) {
    this.#watchers.delete(watcher);
  }
}

class Watcher {
  #notify;
  #watched = new Set();
  #pending = new Set();
  #notified = false;

  constructor(notify) {
    this.#notify = notify;
  }

  watch(...signals) {
    this.#notified = false;
    for (const sig of signals) {
      this.#watched.add(sig);
      sig._addWatcher(this);
    }
  }

  unwatch(...signals) {
    for (const sig of signals) {
      this.#watched.delete(sig);
      this.#pending.delete(sig);
      sig._removeWatcher(this);
    }
  }

  getPending() {
    const result = [...this.#pending];
    this.#pending.clear();
    return result;
  }

  _notify(signal) {
    this.#pending.add(signal);
    if (this.#notified) return;
    this.#notified = true;
    this.#notify();
  }
}

export const Signal = { State, Computed, subtle: { Watcher } };

function logEffectTrigger(effectComputed, debugName, debugDepth, lastRunTick) {
  const lines = [`[T${globalTick}] effect(${debugName}) firing, caused by:`];
  const seen = new Set();
  // ancestorBars: for each ancestor level, true if that level still has siblings below
  const walk = (node, ancestorBars, isLast) => {
    if (debugDepth != null && ancestorBars.length >= debugDepth) return;
    const prefix =
      ancestorBars.map((bar) => (bar ? "│  " : "   ")).join("") +
      (isLast ? "└─ " : "├─ ");
    if (seen.has(node)) {
      lines.push(`${prefix}↺ ${node.__debugName ?? "?"}`);
      return;
    }
    seen.add(node);
    const isState = node instanceof State;
    const quiet = node.__quiet;
    if (!quiet) {
      const kind = isState ? "state" : "computed";
      const tickInfo =
        isState && node.__lastChangedTick > lastRunTick
          ? ` @T${node.__lastChangedTick}`
          : "";
      lines.push(`${prefix}${kind} ${node.__debugName ?? "?"}${tickInfo}`);
    }
    if (!isState) {
      const children = [...node._getDirtyFrom()];
      const childBars = quiet ? ancestorBars : [...ancestorBars, !isLast];
      children.forEach((child, i) => {
        walk(child, childBars, i === children.length - 1);
      });
    }
  };
  const rootMarkers = [...effectComputed._getDirtyFrom()];
  rootMarkers.forEach((marker, i) => {
    walk(marker, [], i === rootMarkers.length - 1);
  });
  if (lines.length > 1) console.log(lines.join("\n"));
}

export const effect = (cb, { debugName, debugDepth } = {}) => {
  let cleanup;
  let lastRunTick = 0;
  let hasRun = false;
  const computed = new Computed(() => {
    if (typeof cleanup === "function") cleanup();
    cleanup = cb();
  });
  computed.__debugName = "effect(" + (debugName ?? "unknown") + ")";

  let pendingFlush = false;
  const run = () => {
    if (hasRun && debugName) {
      logEffectTrigger(computed, debugName, debugDepth, lastRunTick);
    }
    lastRunTick = globalTick;
    hasRun = true;
    computed.get();
    watcher.watch(); // re-arm
  };

  const watcher = new Watcher(() => {
    if (pendingFlush) return;
    pendingFlush = true;
    requestAnimationFrame(() => {
      pendingFlush = false;
      run();
    });
  });
  watcher.watch(computed);
  run();

  return () => {
    if (typeof cleanup === "function") cleanup();
    watcher.unwatch(computed);
    computed.dispose();
  };
};

// https://github.com/proposal-signals/signal-utils#Map
export class SignalMap {
  __debugName = "<SignalMap>";

  #collection = new Signal.State(null, { equals: () => false });
  #storages = new Map();
  #map;

  constructor(entries) {
    this.#map = new Map(entries);
  }

  #storageFor(key) {
    let storage = this.#storages.get(key);
    if (!storage) {
      storage = new Signal.State(null, { equals: () => false });
      storage.__debugName = `${this.__debugName}[${String(key)}]`;
      this.#storages.set(key, storage);
    }
    return storage;
  }

  #dirtyStorageFor(key) {
    this.#storages.get(key)?.set(null);
  }

  get(key) {
    this.#storageFor(key).get();
    return this.#map.get(key) ?? null;
  }

  has(key) {
    this.#storageFor(key).get();
    return this.#map.has(key);
  }

  set(key, value) {
    this.#map.set(key, value);
    this.#dirtyStorageFor(key);
    this.#collection.set(null);
  }

  delete(key) {
    this.#dirtyStorageFor(key);
    this.#collection.set(null);
    return this.#map.delete(key);
  }

  clear() {
    for (const storage of this.#storages.values()) storage.set(null);
    this.#collection.set(null);
    this.#map.clear();
  }

  get size() {
    this.#collection.get();
    return this.#map.size;
  }

  keys() {
    this.#collection.get();
    return this.#map.keys();
  }

  values() {
    this.#collection.get();
    return this.#map.values();
  }

  entries() {
    this.#collection.get();
    return this.#map.entries();
  }

  forEach(callback, thisArg) {
    this.#collection.get();
    this.#map.forEach(callback, thisArg);
  }

  [Symbol.iterator]() {
    this.#collection.get();
    return this.#map[Symbol.iterator]();
  }
}

// https://github.com/proposal-signals/signal-utils#Set
export class SignalSet {
  __debugName = "<SignalSet>";

  #collection = new Signal.State(null, { equals: () => false });
  #storages = new Map();
  #set;

  constructor(values) {
    this.#set = new Set(values);
  }

  #storageFor(value) {
    let storage = this.#storages.get(value);
    if (!storage) {
      storage = new Signal.State(null, { equals: () => false });
      storage.__debugName = `${this.__debugName}[${String(value)}]`;
      this.#storages.set(value, storage);
    }
    return storage;
  }

  #dirtyStorageFor(value) {
    this.#storages.get(value)?.set(null);
  }

  has(value) {
    this.#storageFor(value).get();
    return this.#set.has(value);
  }

  add(value) {
    this.#dirtyStorageFor(value);
    this.#collection.set(null);
    this.#set.add(value);
    return this;
  }

  delete(value) {
    this.#dirtyStorageFor(value);
    this.#collection.set(null);
    return this.#set.delete(value);
  }

  clear() {
    for (const storage of this.#storages.values()) storage.set(null);
    this.#collection.set(null);
    this.#set.clear();
  }

  get size() {
    this.#collection.get();
    return this.#set.size;
  }

  keys() {
    this.#collection.get();
    return this.#set.keys();
  }

  values() {
    this.#collection.get();
    return this.#set.values();
  }

  entries() {
    this.#collection.get();
    return this.#set.entries();
  }

  forEach(callback, thisArg) {
    this.#collection.get();
    this.#set.forEach(callback, thisArg);
  }

  [Symbol.iterator]() {
    this.#collection.get();
    return this.#set[Symbol.iterator]();
  }
}

export class ComputedMap {
  __debugName = "<ComputedMap>";

  constructor(computeFn) {
    this.map = new Map();
    this.computeFn = computeFn;
  }

  get(key) {
    let signal = this.map.get(key);
    if (!signal) {
      signal = new Signal.Computed(() => this.computeFn(key));
      signal.__debugName = `${this.__debugName}[${String(key)}]`;
      this.map.set(key, signal);
    }
    return signal.get();
  }
}

export class ReactiveStore extends EventEmitter {
  constructor(id) {
    super();
    return new Proxy(this, {
      set(target, prop, value) {
        if (prop.startsWith("$")) {
          value.__debugName = `${id}.${prop}`;
        }
        target[prop] = value;
        return true;
      },
    });
  }
}
