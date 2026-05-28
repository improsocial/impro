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

export class SignalMap {
  __debugName = "<SignalMap>";

  constructor() {
    this.map = new Map();
    // Tracks keys that have been explicitly written via set(). Reading $keys
    // takes a dependency on collection membership so consumers re-run when
    // new entries are added.
    this._setKeys = new Set();
    this.$keys = new Signal.State([]);
    setTimeout(() => {
      this.$keys.__debugName = `${this.__debugName}.$keys`;
    }, 0);
  }

  get(key) {
    let signal = this.map.get(key);
    if (!signal) {
      signal = new Signal.State(null);
      signal.__debugName = `${this.__debugName}[${String(key)}]`;
      this.map.set(key, signal);
    }
    return signal;
  }

  set(key, value) {
    this.get(key).set(value);
    if (!this._setKeys.has(key)) {
      this._setKeys.add(key);
      this.$keys.set([...this._setKeys]);
    }
  }

  delete(key) {
    const signal = this.map.get(key);
    if (signal) signal.set(null);
    this.map.delete(key);
    if (this._setKeys.delete(key)) {
      this.$keys.set([...this._setKeys]);
    }
  }

  clear() {
    for (const signal of this.map.values()) {
      signal.set(null);
    }
  }

  keys() {
    return this.map.keys();
  }

  *values() {
    for (const signal of this.map.values()) {
      yield signal.get();
    }
  }

  *entries() {
    for (const [key, signal] of this.map.entries()) {
      yield [key, signal.get()];
    }
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
    return signal;
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
