import { EventEmitter } from "/js/eventEmitter.js";
import { Signal as PolyfillSignal } from "/js/lib/signal-polyfill.js";

export function untrack(fn) {
  return PolyfillSignal.subtle.untrack(fn);
}

let globalTick = 0;

// Thin subclasses over the TC39 signal-polyfill to add debugging helpers
class State extends PolyfillSignal.State {
  __debugName = "<State>";
  __lastChangedTick = 0;
  #equalsFn;

  constructor(initialValue, { equals = Object.is } = {}) {
    super(initialValue, { equals });
    this.#equalsFn = equals;
  }

  set(newValue) {
    const changed = !this.#equalsFn(
      newValue,
      PolyfillSignal.subtle.untrack(() => super.get()),
    );
    super.set(newValue);
    if (changed) {
      this.__lastChangedTick = ++globalTick;
    }
  }
}

class Computed extends PolyfillSignal.Computed {
  __debugName = "<Computed>";
  __quiet = false;
}

export const Signal = {
  State,
  Computed,
  subtle: PolyfillSignal.subtle,
};

// Reconstructs the "caused by" tree for a firing effect by walking the
// effect's source graph and pruning to branches that contain a changed state
function logEffectTrigger(effectComputed, debugName, debugDepth, lastRunTick) {
  const isState = (node) => node instanceof PolyfillSignal.State;
  const relevanceCache = new Map();
  const isRelevant = (node) => {
    if (relevanceCache.has(node)) return relevanceCache.get(node);
    relevanceCache.set(node, false); // cycle guard
    let relevant;
    if (isState(node)) {
      relevant = node.__lastChangedTick > lastRunTick;
    } else {
      relevant = PolyfillSignal.subtle.introspectSources(node).some(isRelevant);
    }
    relevanceCache.set(node, relevant);
    return relevant;
  };

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
    const quiet = node.__quiet;
    if (!quiet) {
      const kind = isState(node) ? "state" : "computed";
      const tickInfo =
        isState(node) && node.__lastChangedTick > lastRunTick
          ? ` @T${node.__lastChangedTick}`
          : "";
      lines.push(`${prefix}${kind} ${node.__debugName ?? "?"}${tickInfo}`);
    }
    if (!isState(node)) {
      const children = PolyfillSignal.subtle
        .introspectSources(node)
        .filter(isRelevant);
      const childBars = quiet ? ancestorBars : [...ancestorBars, !isLast];
      children.forEach((child, i) => {
        walk(child, childBars, i === children.length - 1);
      });
    }
  };
  const rootMarkers = PolyfillSignal.subtle
    .introspectSources(effectComputed)
    .filter(isRelevant);
  rootMarkers.forEach((marker, i) => {
    walk(marker, [], i === rootMarkers.length - 1);
  });
  if (lines.length > 1) console.debug(lines.join("\n"));
}

export const effect = (cb, { debugName, debugDepth } = {}) => {
  let cleanup;
  let lastRunTick = 0;
  let hasRun = false;
  let ranThisFlush = false;
  const computed = new Computed(() => {
    ranThisFlush = true;
    if (typeof cleanup === "function") cleanup();
    cleanup = cb();
  });
  computed.__debugName = "effect(" + (debugName ?? "unknown") + ")";

  let pendingFlush = false;
  const run = () => {
    const prevRunTick = lastRunTick;
    ranThisFlush = false;
    computed.get();
    if (ranThisFlush) {
      if (hasRun && debugName) {
        logEffectTrigger(computed, debugName, debugDepth, prevRunTick);
      }
      lastRunTick = globalTick;
      hasRun = true;
    }
    watcher.watch(); // re-arm
  };

  const watcher = new PolyfillSignal.subtle.Watcher(() => {
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

export class SignalArray {
  __debugName = "<SignalArray>";

  #collection = new Signal.State(null, { equals: () => false });
  #array;

  constructor(values = []) {
    this.#array = [...values];
  }

  get length() {
    this.#collection.get();
    return this.#array.length;
  }

  at(index) {
    this.#collection.get();
    return this.#array.at(index);
  }

  indexOf(value, fromIndex) {
    this.#collection.get();
    return this.#array.indexOf(value, fromIndex);
  }

  includes(value, fromIndex) {
    this.#collection.get();
    return this.#array.includes(value, fromIndex);
  }

  slice(start, end) {
    this.#collection.get();
    return this.#array.slice(start, end);
  }

  map(fn, thisArg) {
    this.#collection.get();
    return this.#array.map(fn, thisArg);
  }

  filter(fn, thisArg) {
    this.#collection.get();
    return this.#array.filter(fn, thisArg);
  }

  forEach(callback, thisArg) {
    this.#collection.get();
    this.#array.forEach(callback, thisArg);
  }

  [Symbol.iterator]() {
    this.#collection.get();
    return this.#array[Symbol.iterator]();
  }

  set(index, value) {
    this.#array[index] = value;
    this.#collection.set(null);
  }

  push(...values) {
    this.#array.push(...values);
    this.#collection.set(null);
    return this.#array.length;
  }

  pop() {
    const value = this.#array.pop();
    this.#collection.set(null);
    return value;
  }

  splice(start, deleteCount, ...items) {
    const removed = this.#array.splice(start, deleteCount, ...items);
    this.#collection.set(null);
    return removed;
  }

  replace(values) {
    this.#array = [...values];
    this.#collection.set(null);
  }

  clear() {
    this.#array.length = 0;
    this.#collection.set(null);
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
  constructor(id = "ReactiveStore") {
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
