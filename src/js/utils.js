import { Capacitor } from "/js/lib/capacitor.js";
import { EventEmitter } from "/js/eventEmitter.js";

export function noop() {}

export function unique(array, { by: keyOrFn } = {}) {
  let getKey = (i) => i;
  if (keyOrFn) {
    getKey = typeof keyOrFn === "function" ? keyOrFn : (item) => item[keyOrFn];
  }
  // Preserve order
  const uniqueArray = [];
  const seen = new Set();
  array.forEach((item) => {
    const key = getKey(item);
    if (!seen.has(key)) {
      uniqueArray.push(item);
      seen.add(key);
    }
  });
  return uniqueArray;
}

export function groupBy(array, keyOrFn) {
  const getKey =
    typeof keyOrFn === "function" ? keyOrFn : (item) => item[keyOrFn];
  const groups = new Map();
  array.forEach((item) => {
    const key = getKey(item);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(item);
  });
  return groups;
}

export const isDev = () => window.location.hostname === "localhost";
export const isNative = () => Capacitor.isNativePlatform();
export const isSafari = () =>
  /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

export function sortBy(array, fnOrKey, { direction = "asc" } = {}) {
  let fn = fnOrKey;
  if (typeof fnOrKey === "string") {
    fn = (item) => item[fnOrKey];
  }
  if (direction !== "asc" && direction !== "desc") {
    throw new Error(`Invalid direction: ${direction}`);
  }
  const sign = direction === "desc" ? -1 : 1;
  const sorted = array.sort((a, b) => {
    const aValue = fn(a);
    const bValue = fn(b);
    if (aValue < bValue) return -1 * sign;
    if (aValue > bValue) return 1 * sign;
    return 0;
  });
  return sorted;
}

// Temporary (?) hack to avoid render flash
let relativeTimeBase = new Date();

window.addEventListener("page-transition", () => {
  relativeTimeBase = new Date();
});

window.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    relativeTimeBase = new Date();
  }
});

export function displayRelativeTime(timestamp) {
  // e.g. "2025-09-11T15:08:11.414Z" -> "7h"
  const now = relativeTimeBase;
  const then = new Date(timestamp);
  const diff = now.getTime() - then.getTime();
  const diffYears = Math.floor(diff / (1000 * 60 * 60 * 24 * 365));
  if (diffYears > 0) {
    return `${diffYears}y`;
  }
  const diffMonths = Math.floor(diff / (1000 * 60 * 60 * 24 * 30));
  if (diffMonths > 0) {
    return `${diffMonths}mo`;
  }
  const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (diffDays > 0) {
    return `${diffDays}d`;
  }
  const diffHours = Math.floor(diff / (1000 * 60 * 60));
  if (diffHours > 0) {
    return `${diffHours}h`;
  }
  const diffMinutes = Math.floor(diff / (1000 * 60));
  if (diffMinutes > 0) {
    return `${diffMinutes}m`;
  }
  const diffSeconds = Math.floor(diff / 1000);
  if (diffSeconds > 0) {
    return `${diffSeconds}s`;
  }
  return "1m";
}

// Slices a string by byte indices, handling multibyte characters (UTF-8)
export function sliceByByte(text, start, end) {
  // Encode the string as UTF-8 bytes
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const bytes = encoder.encode(text);
  // Get the slice of bytes
  const slicedBytes = bytes.slice(start, end);
  // Decode back to string
  return decoder.decode(slicedBytes);
}

// Returns the byte index, given a character index
export function getByteIndex(text, index) {
  const encoder = new TextEncoder();
  const slicedText = text.slice(0, index);
  const bytes = encoder.encode(slicedText);
  return bytes.length;
}

export function getByteLength(text) {
  const encoder = new TextEncoder();
  return encoder.encode(text).length;
}

export function getIndexFromByteIndex(text, byteIndex) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const bytes = encoder.encode(text);
  const slicedBytes = bytes.slice(0, byteIndex);
  return decoder.decode(slicedBytes).length;
}

const graphemeSegmenter =
  typeof Intl !== "undefined" && Intl.Segmenter
    ? new Intl.Segmenter("en", { granularity: "grapheme" })
    : null;

export function graphemeCount(str) {
  if (graphemeSegmenter) {
    return [...graphemeSegmenter.segment(str)].length;
  }
  return [...str].length;
}

export function formatLargeNumber(number) {
  if (number >= 1000) {
    const stringified = String(number / 1000);
    const [integer, decimal] = stringified.split(".");
    let formatted = integer;
    if (decimal) {
      const truncatedDecimal = decimal.slice(0, 1);
      if (truncatedDecimal !== "0") {
        formatted += "." + truncatedDecimal;
      }
    }
    return formatted + "K";
  }
  return number;
}

// E.g. September 29, 2025 at 3:44 PM
export function formatFullTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  });
}

export function classnames(...defs) {
  let classname = "";
  for (const def of defs) {
    if (typeof def === "string") {
      if (def.length > 0) {
        classname += def + " ";
      }
    } else if (typeof def === "object") {
      classname +=
        Object.entries(def)
          .filter(([_, value]) => value)
          .map(([key]) => key)
          .join(" ") + " ";
    } else if (def === null || def === undefined) {
      continue;
    } else {
      throw new Error("Invalid classname definition");
    }
  }
  return classname.trim();
}

export function deepClone(value) {
  if (Array.isArray(value)) {
    return value.map((item) => deepClone(item));
  } else if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, value]) => [key, deepClone(value)]),
    );
  }
  return value;
}

export function debounce(fn, delay = 250) {
  let timeoutId = null;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

export function throttle(fn, delay = 250) {
  let lastCall = 0;
  return (...args) => {
    const now = Date.now();
    if (now - lastCall < delay) {
      return;
    }
    lastCall = now;
    fn(...args);
  };
}

export function formatNumNotifications(numNotifications) {
  if (numNotifications >= 30) {
    return "30+";
  }
  return numNotifications;
}

export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function raf() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

export function buildQueryString(obj) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      value.forEach((entry) => query.append(key, entry));
    } else {
      query.append(key, value);
    }
  }
  return query.toString();
}

export function batch(items, batchSize) {
  const batches = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}

export function differenceInMinutes(a, b) {
  const date1 = typeof a === "string" ? new Date(a) : a;
  const date2 = typeof b === "string" ? new Date(b) : b;
  const diff = Math.abs(date1.getTime() - date2.getTime());
  return Math.floor(diff / (1000 * 60));
}

export function differenceInHours(date1, date2) {
  const diffMs = date1 - date2;
  const oneHourMs = 60 * 60 * 1000;
  return Math.ceil(diffMs / oneHourMs);
}

export function differenceInDays(date1, date2) {
  const diffMs = date1 - date2;
  const oneDayMs = 24 * 60 * 60 * 1000;
  return Math.ceil(diffMs / oneDayMs);
}

export function getCurrentTimestamp() {
  return new Date().toISOString();
}

export function getBrowserLanguages() {
  if (navigator.languages && navigator.languages.length) {
    return [...navigator.languages];
  }
  if (navigator.language) {
    return [navigator.language];
  }
  return [];
}

export function getBrowserLanguageCodes() {
  return unique(
    getBrowserLanguages()
      .map((tag) => tag.split("-")[0].toLowerCase())
      .filter(Boolean),
  );
}

export function getPostLangs() {
  const codes = getBrowserLanguageCodes();
  return codes.length ? codes.slice(0, 3) : ["en"];
}

export function sanitizeUri(uri) {
  let parsedUri = null;
  try {
    parsedUri = new URL(uri);
  } catch (error) {
    return "";
  }
  if (["http:", "https:"].includes(parsedUri.protocol)) {
    return parsedUri.toString();
  }
  return "";
}

// Claude wrote this
export function enableDragToDismiss(
  target,
  {
    eventSource = target,
    confirmDismiss = () => true,
    onClose,
    allowUpwardStretch = false,
    ignoreTouchTarget = () => false,
  } = {},
) {
  if (window.matchMedia("(min-width: 800px)").matches) return null;

  if (target.__dragToDismiss) {
    target.__dragToDismiss.cleanup();
  }

  const DISMISS_THRESHOLD = 75;
  const RESISTANCE_FACTOR = 0.6;

  const dragState = {
    startY: 0,
    currentY: 0,
    isDragging: false,
    initialHeight: 0,
  };

  const handleTouchStart = (e) => {
    if (ignoreTouchTarget(e.target)) return;

    dragState.startY = e.touches[0].clientY;
    dragState.currentY = dragState.startY;
    dragState.isDragging = true;
    dragState.initialHeight = target.getBoundingClientRect().height;

    target.style.transition = "none";
  };

  const handleTouchMove = (e) => {
    if (!dragState.isDragging) return;

    dragState.currentY = e.touches[0].clientY;
    const deltaY = dragState.currentY - dragState.startY;

    e.preventDefault();

    if (deltaY > 0) {
      const adjustedDelta = deltaY * RESISTANCE_FACTOR;
      target.style.transform = `translateY(${adjustedDelta}px)`;
    } else if (allowUpwardStretch) {
      const adjustedDelta = Math.abs(deltaY) * (RESISTANCE_FACTOR * 0.5);
      target.style.height = `${dragState.initialHeight + adjustedDelta}px`;
    }
  };

  const handleTouchEnd = async () => {
    if (!dragState.isDragging) return;

    const deltaY = dragState.currentY - dragState.startY;
    target.style.transition = allowUpwardStretch
      ? "transform 0.15s ease-out, height 0.15s ease-out"
      : "transform 0.15s ease-out";

    if (deltaY > DISMISS_THRESHOLD && (await confirmDismiss())) {
      target.style.transform = "translateY(100%)";
      onClose();
    } else {
      target.style.transform = "";
      if (allowUpwardStretch) target.style.height = "";
    }

    dragState.isDragging = false;
  };

  eventSource.addEventListener("touchstart", handleTouchStart, {
    passive: false,
  });
  eventSource.addEventListener("touchmove", handleTouchMove, {
    passive: false,
  });
  eventSource.addEventListener("touchend", handleTouchEnd);

  dragState.cleanup = () => {
    delete target.__dragToDismiss;
    eventSource.removeEventListener("touchstart", handleTouchStart);
    eventSource.removeEventListener("touchmove", handleTouchMove);
    eventSource.removeEventListener("touchend", handleTouchEnd);
    target.style.transform = "";
    target.style.transition = "";
    target.style.height = "";
  };

  target.__dragToDismiss = dragState;

  return dragState;
}

// iOS Safari: dismissing the keyboard via the "Done" button leaves the
// dialog's inner scroll area offset, which makes buttons unclickable
// until the dialog is swiped or re-tapped. Reset scroll on blur.
export function resetScrollOnBlur(dialog, scrollArea) {
  dialog.addEventListener(
    "blur",
    () => {
      if (scrollArea) scrollArea.scrollTop = 0;
      window.scrollTo(0, 0);
    },
    true,
  );
}

export class ImageLoader {
  constructor() {
    this._loaded = new Set();
    this._failed = new Set();
    this._loading = new Map();
  }

  isLoaded(src) {
    return this._loaded.has(src);
  }

  hasFailed(src) {
    return this._failed.has(src);
  }

  load(src) {
    if (this._loaded.has(src)) {
      return Promise.resolve();
    }
    if (this._failed.has(src)) {
      return Promise.reject(
        new Error(`Image previously failed to load: ${src}`),
      );
    }
    const inFlight = this._loading.get(src);
    if (inFlight) {
      return inFlight.promise;
    }
    const image = new window.Image();
    let rejectFn;
    let resolveFn;
    const promise = new Promise((resolve, reject) => {
      resolveFn = resolve;
      rejectFn = reject;
    });
    image.onload = () => {
      this._loaded.add(src);
      this._loading.delete(src);
      resolveFn();
    };
    image.onerror = () => {
      this._failed.add(src);
      this._loading.delete(src);
      rejectFn(new Error(`Image failed to load: ${src}`));
    };
    this._loading.set(src, { image, reject: rejectFn, promise });
    image.src = src;
    return promise;
  }

  abort() {
    for (const { image, reject } of this._loading.values()) {
      image.onload = null;
      image.onerror = null;
      reject(new Error("Image load aborted"));
    }
    this._loading.clear();
  }
}

export class SimpleUUID {
  constructor() {
    this._id = 0;
  }

  create() {
    return this._id++;
  }
}

function parseVersion(version) {
  const base = String(version ?? "").split("-")[0];
  const parts = base.split(".").map((part) => {
    const num = parseInt(part, 10);
    return Number.isFinite(num) && num >= 0 ? num : 0;
  });
  while (parts.length < 3) parts.push(0);
  return parts.slice(0, 3);
}

// Compares two semver strings. Returns -1 / 0 / 1.
export function compareVersions(versionA, versionB) {
  const partsA = parseVersion(versionA);
  const partsB = parseVersion(versionB);
  for (let index = 0; index < 3; index++) {
    if (partsA[index] > partsB[index]) return 1;
    if (partsA[index] < partsB[index]) return -1;
  }
  return 0;
}

export class TimeoutError extends Error {
  constructor(message = "Timed out") {
    super(message);
    this.name = "TimeoutError";
  }
}

export async function withTimeout(fn, timeoutMs) {
  const controller = new AbortController();
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new TimeoutError());
    }, timeoutMs);
  });
  try {
    return await Promise.race([fn(controller.signal), timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
}

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

function logEffectTrigger(effectComputed, debugName, lastRunTick) {
  const lines = [`[T${globalTick}] effect(${debugName}) firing, caused by:`];
  const seen = new Set();
  // ancestorBars: for each ancestor level, true if that level still has siblings below
  const walk = (node, ancestorBars, isLast) => {
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

export const effect = (cb, debugName) => {
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
      logEffectTrigger(computed, debugName, lastRunTick);
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
