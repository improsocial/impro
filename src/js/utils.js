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
export const isMobileViewport = () =>
  window.matchMedia("(max-width: 799px)").matches;
export const isTouchDevice = () => navigator.maxTouchPoints > 0;
export const canHover = () => window.matchMedia("(hover: hover)").matches;
export const hasKeyboardInput = () =>
  window.matchMedia("(hover: hover) and (pointer: fine)").matches;
export const isSafari = () =>
  /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
export const isAndroid = () => /android/i.test(navigator.userAgent);
export const isFirefox = () => /firefox/i.test(navigator.userAgent);

export function sortBy(array, fnOrKey, { direction = "asc" } = {}) {
  let fn = fnOrKey;
  if (typeof fnOrKey === "string") {
    fn = (item) => item[fnOrKey];
  }
  if (direction !== "asc" && direction !== "desc") {
    throw new Error(`Invalid direction: ${direction}`);
  }
  const sign = direction === "desc" ? -1 : 1;
  const sorted = [...array].sort((a, b) => {
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
  if (number >= 1_000_000) {
    return formatWithSuffix(number / 1_000_000, "M");
  }
  if (number >= 1000) {
    return formatWithSuffix(number / 1000, "K");
  }
  return number;
}

function formatWithSuffix(value, suffix) {
  const [integer, decimal] = String(value).split(".");
  let formatted = integer;
  if (decimal) {
    const truncatedDecimal = decimal.slice(0, 1);
    if (truncatedDecimal !== "0") {
      formatted += "." + truncatedDecimal;
    }
  }
  return formatted + suffix;
}

// E.g. September 29, 2025
export function formatFullDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
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

export function shallowEquals(obj1, obj2) {
  if (obj1 === obj2) return true;
  if (!obj1 || !obj2) return false;
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  if (keys1.length !== keys2.length) return false;
  return keys1.every((key) => obj1[key] === obj2[key]);
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
  const debounced = (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
  debounced.cancel = () => {
    clearTimeout(timeoutId);
  };
  return debounced;
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

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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
    disableWhenKeyboardOpen = false,
  } = {},
) {
  if (!isMobileViewport()) return null;

  if (target.__dragToDismiss) {
    target.__dragToDismiss.cleanup();
  }

  const DISMISS_THRESHOLD = 75;
  const RESISTANCE_FACTOR = 0.6;
  const SNAP_BACK_MS = 150;
  let caretRestoreTimer = null;

  const dragState = {
    startY: 0,
    currentY: 0,
    isDragging: false,
    initialHeight: 0,
    canDismiss: true,
  };

  // Detect keyboard open on mobile
  const KEYBOARD_THRESHOLD = 150;
  const viewport = window.visualViewport;
  const isKeyboardOpen = () =>
    disableWhenKeyboardOpen &&
    viewport &&
    window.innerHeight - viewport.height > KEYBOARD_THRESHOLD;

  const hasTextSelection = () => {
    const selection = document.getSelection();
    return selection !== null && !selection.isCollapsed;
  };

  const handleTouchStart = (e) => {
    if (isKeyboardOpen()) return;
    if (ignoreTouchTarget(e.target)) return;
    if (hasTextSelection()) return;

    clearTimeout(caretRestoreTimer);
    dragState.startY = e.touches[0].clientY;
    dragState.currentY = dragState.startY;
    dragState.isDragging = true;
    dragState.initialHeight = target.getBoundingClientRect().height;
    // Only allow a downward drag to dismiss when the scrollable body is already
    // at the top; otherwise this gesture belongs to the scroll area.
    dragState.canDismiss = !scrollContainer || scrollContainer.scrollTop <= 0;
    dragState.canStretch =
      allowUpwardStretch &&
      (!scrollContainer ||
        scrollContainer.scrollHeight <= scrollContainer.clientHeight);

    target.style.transition = "none";
  };

  const handleTouchMove = (e) => {
    if (!dragState.isDragging) return;

    // A selection that appears mid-gesture (long-press) switches to text selection.
    if (hasTextSelection()) {
      dragState.isDragging = false;
      target.style.transform = "";
      target.style.caretColor = "";
      return;
    }

    dragState.currentY = e.touches[0].clientY;
    const deltaY = dragState.currentY - dragState.startY;

    if (deltaY > 0 && dragState.canDismiss) {
      e.preventDefault();
      const adjustedDelta = deltaY * RESISTANCE_FACTOR;
      // Hide caret while dragging
      target.style.caretColor = "transparent";
      target.style.transform = `translateY(${adjustedDelta}px)`;
    } else if (deltaY < 0 && dragState.canStretch) {
      e.preventDefault();
      const adjustedDelta = Math.abs(deltaY) * (RESISTANCE_FACTOR * 0.5);
      target.style.height = `${dragState.initialHeight + adjustedDelta}px`;
    } else if (scrollContainer && deltaY !== 0) {
      dragState.isDragging = false;
      target.style.transform = "";
      target.style.caretColor = "";
    } else {
      e.preventDefault();
    }
  };

  const handleTouchEnd = async () => {
    if (!dragState.isDragging) return;

    const deltaY = dragState.currentY - dragState.startY;
    target.style.transition = allowUpwardStretch
      ? `transform ${SNAP_BACK_MS}ms ease-out, height ${SNAP_BACK_MS}ms ease-out`
      : `transform ${SNAP_BACK_MS}ms ease-out`;

    if (deltaY > DISMISS_THRESHOLD && (await confirmDismiss())) {
      target.style.transform = "translateY(100%)";
      onClose();
    } else {
      target.style.transform = "";
      if (dragState.canStretch) target.style.height = "";
      caretRestoreTimer = setTimeout(() => {
        target.style.caretColor = "";
      }, SNAP_BACK_MS);
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
    clearTimeout(caretRestoreTimer);
    delete target.__dragToDismiss;
    eventSource.removeEventListener("touchstart", handleTouchStart);
    eventSource.removeEventListener("touchmove", handleTouchMove);
    eventSource.removeEventListener("touchend", handleTouchEnd);
    target.style.transform = "";
    target.style.transition = "";
    target.style.height = "";
    target.style.caretColor = "";
  };

  target.__dragToDismiss = dragState;

  return dragState;
}

// iOS Safari: dismissing the keyboard via the "Done" button leaves the
// dialog's inner scroll area offset, which makes buttons unclickable
// until the dialog is swiped or re-tapped. Reset scroll on text input blur.
export function resetScrollOnBlur(dialog, scrollArea) {
  dialog.addEventListener(
    "blur",
    (event) => {
      if (
        !event.target.matches?.('input, textarea, [contenteditable="true"]')
      ) {
        return;
      }
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

export function pinScrollPosition({
  targetY,
  durationMs = 1000,
  scroller = null,
  shouldStop = null,
} = {}) {
  const listenTarget = scroller ?? window;
  const readScrollY = () => (scroller ? scroller.scrollTop : window.scrollY);
  const writeScrollY = (y) => {
    if (scroller) {
      scroller.scrollTop = y;
    } else {
      window.scrollTo(window.scrollX, y);
    }
  };
  let stopped = false;
  let lastPinnedY = null;
  const stop = () => {
    stopped = true;
    listenTarget.removeEventListener("touchmove", stop);
    listenTarget.removeEventListener("wheel", stop);
    window.removeEventListener("keydown", stop);
    window.removeEventListener("page-transition", stop);
  };
  const startTime = performance.now();
  const step = () => {
    if (stopped) {
      return;
    }
    if (shouldStop && shouldStop(readScrollY(), lastPinnedY)) {
      stop();
      return;
    }
    const currentTargetY = typeof targetY === "function" ? targetY() : targetY;
    if (currentTargetY === null) {
      stop();
      return;
    }
    if (Math.abs(readScrollY() - currentTargetY) >= 1) {
      writeScrollY(currentTargetY);
    }
    lastPinnedY = readScrollY();
    if (performance.now() - startTime < durationMs) {
      requestAnimationFrame(step);
    } else {
      stop();
    }
  };
  listenTarget.addEventListener("touchmove", stop, { passive: true });
  listenTarget.addEventListener("wheel", stop, { passive: true });
  window.addEventListener("keydown", stop);
  window.addEventListener("page-transition", stop);
  step();
  return stop;
}

const LONG_PRESS_TIMEOUT_MS = 500;
const LONG_PRESS_MOVE_CANCEL_THRESHOLD_PX = 10;
const LONG_PRESS_GHOST_CLICK_WINDOW_MS = 400;

export function enableLongPress(el, timeout = LONG_PRESS_TIMEOUT_MS) {
  if (el.__longPressEnabled) {
    return;
  }
  let pressTimeout = null;
  let pressStartX = 0;
  let pressStartY = 0;
  let removeClickSuppressor = null;

  // The click that trails a long-press may not land on `el`: the long-press
  // fires while the pointer is still down and can open UI (e.g. a modal
  // sheet) on top of it, so the release's click hits whatever is topmost.
  // Swallow the next click document-wide, in the capture phase, so nothing
  // ghost-activates.
  const suppressNextClick = () => {
    removeClickSuppressor?.();
    const onClick = (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      removeSuppressor();
    };
    const removeSuppressor = () => {
      document.removeEventListener("click", onClick, true);
      removeClickSuppressor = null;
    };
    document.addEventListener("click", onClick, true);
    removeClickSuppressor = removeSuppressor;
  };

  const startPress = (event) => {
    // Only a primary-button press can begin a long-press; right/middle
    // clicks have their own meanings (context menu, open in new tab).
    if (event.button > 0) {
      return;
    }
    const point = event.touches?.[0] ?? event;
    pressStartX = point.clientX;
    pressStartY = point.clientY;
    clearTimeout(pressTimeout);
    pressTimeout = setTimeout(() => {
      suppressNextClick();
      el.dispatchEvent(new CustomEvent("long-press"));
    }, timeout);
  };
  const endPress = () => {
    clearTimeout(pressTimeout);
    if (removeClickSuppressor !== null) {
      // If no click trails the release (e.g. the gesture was canceled), stop
      // suppressing so later clicks behave normally.
      const scheduledRemover = removeClickSuppressor;
      setTimeout(() => {
        if (removeClickSuppressor === scheduledRemover) {
          scheduledRemover();
        }
      }, LONG_PRESS_GHOST_CLICK_WINDOW_MS);
    }
  };
  const movePress = (event) => {
    const point = event.touches?.[0] ?? event;
    const deltaX = Math.abs(point.clientX - pressStartX);
    const deltaY = Math.abs(point.clientY - pressStartY);
    if (
      deltaX > LONG_PRESS_MOVE_CANCEL_THRESHOLD_PX ||
      deltaY > LONG_PRESS_MOVE_CANCEL_THRESHOLD_PX
    ) {
      clearTimeout(pressTimeout);
    }
  };
  // On touch devices the native context menu is triggered by long-press and
  // competes with the custom gesture. Desktop right-click is left alone.
  const suppressContextMenu = (event) => {
    if (isTouchDevice()) {
      event.preventDefault();
    }
  };
  el.addEventListener("touchstart", startPress);
  el.addEventListener("touchend", endPress);
  el.addEventListener("touchcancel", endPress);
  el.addEventListener("touchmove", movePress);
  el.addEventListener("mousedown", startPress);
  el.addEventListener("mouseup", endPress);
  el.addEventListener("contextmenu", suppressContextMenu);
  el.__longPressEnabled = true;
}

// Enables drag-to-reorder inside `container`. On pointerdown on any element
// matching `handleSelector`, the containing `itemSelector` element becomes
// draggable; siblings slide out of the way as the pointer crosses their
// midpoints. On pointerup, `onReorder(orderedItemElements)` fires with the new
// element order.
export function enableReorder(
  container,
  { itemSelector, handleSelector, onReorder },
) {
  if (container.__reorderEnabled) {
    container.__reorderEnabled.cleanup();
  }

  let draggedItem = null;
  let pointerId = null;
  let startPointerY = 0;
  let currentDeltaY = 0;
  let currentTargetIndex = 0;
  let itemRects = [];
  let items = [];
  let removeClickSuppressor = null;

  const suppressNextClick = () => {
    removeClickSuppressor?.();
    const onClick = (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      removeSuppressor();
    };
    const removeSuppressor = () => {
      document.removeEventListener("click", onClick, true);
      removeClickSuppressor = null;
    };
    document.addEventListener("click", onClick, true);
    removeClickSuppressor = removeSuppressor;
  };

  const onPointerDown = (event) => {
    if (event.button > 0) return;
    const handle = event.target.closest(handleSelector);
    if (!handle || !container.contains(handle)) return;
    const item = handle.closest(itemSelector);
    if (!item || item.parentElement !== container) return;

    draggedItem = item;
    pointerId = event.pointerId;
    startPointerY = event.clientY;
    currentDeltaY = 0;
    items = Array.from(container.querySelectorAll(`:scope > ${itemSelector}`));
    itemRects = items.map((el) => el.getBoundingClientRect());
    currentTargetIndex = items.indexOf(draggedItem);

    handle.setPointerCapture(event.pointerId);
    draggedItem.classList.add("is-dragging");
    for (const el of items) {
      if (el !== draggedItem) el.classList.add("is-shifting");
    }
    event.preventDefault();
  };

  const onPointerMove = (event) => {
    if (!draggedItem || event.pointerId !== pointerId) return;
    currentDeltaY = event.clientY - startPointerY;

    const draggedIndex = items.indexOf(draggedItem);
    const draggedRect = itemRects[draggedIndex];
    const pointerY = draggedRect.top + draggedRect.height / 2 + currentDeltaY;

    let newIndex = draggedIndex;
    for (let i = 0; i < itemRects.length; i++) {
      if (i === draggedIndex) continue;
      const rect = itemRects[i];
      const mid = rect.top + rect.height / 2;
      if (i < draggedIndex && pointerY < mid) {
        newIndex = Math.min(newIndex, i);
      } else if (i > draggedIndex && pointerY > mid) {
        newIndex = Math.max(newIndex, i);
      }
    }
    currentTargetIndex = newIndex;

    draggedItem.style.transform = `translateY(${currentDeltaY}px)`;

    for (let i = 0; i < items.length; i++) {
      if (i === draggedIndex) continue;
      const el = items[i];
      const height = draggedRect.height;
      if (i > draggedIndex && i <= currentTargetIndex) {
        el.style.transform = `translateY(${-height}px)`;
      } else if (i < draggedIndex && i >= currentTargetIndex) {
        el.style.transform = `translateY(${height}px)`;
      } else {
        el.style.transform = "";
      }
    }
  };

  const finish = (event, { commit }) => {
    if (!draggedItem || event.pointerId !== pointerId) return;
    const handle = event.target.closest(handleSelector);
    handle?.releasePointerCapture?.(pointerId);

    const draggedIndex = items.indexOf(draggedItem);
    const shouldReorder = commit && currentTargetIndex !== draggedIndex;

    for (const el of items) {
      el.style.transform = "";
      el.classList.remove("is-shifting");
    }
    draggedItem.classList.remove("is-dragging");

    if (shouldReorder) {
      const reordered = [...items];
      const [moved] = reordered.splice(draggedIndex, 1);
      reordered.splice(currentTargetIndex, 0, moved);
      suppressNextClick();
      onReorder(reordered);
    }

    draggedItem = null;
    pointerId = null;
    items = [];
    itemRects = [];
  };

  const onPointerUp = (event) => finish(event, { commit: true });
  const onPointerCancel = (event) => finish(event, { commit: false });

  container.addEventListener("pointerdown", onPointerDown);
  container.addEventListener("pointermove", onPointerMove);
  container.addEventListener("pointerup", onPointerUp);
  container.addEventListener("pointercancel", onPointerCancel);

  const cleanup = () => {
    container.removeEventListener("pointerdown", onPointerDown);
    container.removeEventListener("pointermove", onPointerMove);
    container.removeEventListener("pointerup", onPointerUp);
    container.removeEventListener("pointercancel", onPointerCancel);
    removeClickSuppressor?.();
    delete container.__reorderEnabled;
  };
  container.__reorderEnabled = { cleanup };
  return { cleanup };
}
