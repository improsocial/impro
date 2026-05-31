import { Capacitor } from "/js/lib/capacitor.js";

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
    scrollContainer = null,
    disableWhenKeyboardOpen = true,
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
    canDismiss: true,
    keyboardOpen: false,
  };

  // Detect keyboard open on mobile
  const KEYBOARD_THRESHOLD = 150;
  const viewport = window.visualViewport;
  let handleViewportResize = null;
  if (disableWhenKeyboardOpen && viewport) {
    handleViewportResize = () => {
      dragState.keyboardOpen =
        window.innerHeight - viewport.height > KEYBOARD_THRESHOLD;
    };
    viewport.addEventListener("resize", handleViewportResize);
    handleViewportResize();
  }

  const handleTouchStart = (e) => {
    if (dragState.keyboardOpen) return;
    if (ignoreTouchTarget(e.target)) return;

    dragState.startY = e.touches[0].clientY;
    dragState.currentY = dragState.startY;
    dragState.isDragging = true;
    dragState.initialHeight = target.getBoundingClientRect().height;
    // Only allow a downward drag to dismiss when the scrollable body is already
    // at the top; otherwise this gesture belongs to the scroll area.
    dragState.canDismiss = !scrollContainer || scrollContainer.scrollTop <= 0;

    target.style.transition = "none";
  };

  const handleTouchMove = (e) => {
    if (!dragState.isDragging) return;

    dragState.currentY = e.touches[0].clientY;
    const deltaY = dragState.currentY - dragState.startY;

    if (deltaY > 0 && dragState.canDismiss) {
      e.preventDefault();
      const adjustedDelta = deltaY * RESISTANCE_FACTOR;
      target.style.transform = `translateY(${adjustedDelta}px)`;
    } else if (deltaY < 0 && allowUpwardStretch) {
      e.preventDefault();
      const adjustedDelta = Math.abs(deltaY) * (RESISTANCE_FACTOR * 0.5);
      target.style.height = `${dragState.initialHeight + adjustedDelta}px`;
    } else if (scrollContainer && deltaY !== 0) {
      dragState.isDragging = false;
      target.style.transform = "";
    } else {
      e.preventDefault();
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
    if (handleViewportResize) {
      viewport.removeEventListener("resize", handleViewportResize);
    }
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
