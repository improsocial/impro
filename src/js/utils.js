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

export const isDev = () => window.location.hostname === "localhost";
export const isNative = () => Capacitor.isNativePlatform();

export function sortBy(array, fnOrKey, { direction = "asc" } = {}) {
  let fn = fnOrKey;
  if (typeof fnOrKey === "string") {
    fn = (item) => item[fnOrKey];
  }
  const sorted = array.sort((a, b) => {
    const aValue = fn(a);
    const bValue = fn(b);
    if (direction === "desc") {
      return bValue - aValue;
    } else if (direction === "asc") {
      return aValue - bValue;
    } else {
      throw new Error("Invalid direction", direction);
    }
  });
  return sorted;
}

// Temporary (?) hack to avoid render flash
let relativeTimeBase = new Date();

window.addEventListener("page-transition", () => {
  relativeTimeBase = new Date();
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
  // const diffSeconds = Math.floor(diff / 1000);
  // if (diffSeconds > 0) {
  //   return `${diffSeconds}s`;
  // }
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

export function formatLargeNumber(number) {
  if (number >= 1000) {
    let formatted = (number / 1000).toFixed(1);
    if (formatted.endsWith(".0")) {
      formatted = formatted.slice(0, -2);
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
      classname += def + " ";
    } else if (typeof def === "object") {
      classname +=
        Object.entries(def)
          .filter(([_, value]) => value)
          .map(([key]) => key)
          .join(" ") + " ";
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
      Object.entries(value).map(([key, value]) => [key, deepClone(value)])
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
  if (numNotifications > 30) {
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

export function batch(items, batchSize) {
  const batches = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}

export function getCurrentTimestamp() {
  return new Date().toISOString();
}
