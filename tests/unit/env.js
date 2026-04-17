import { JSDOM } from "jsdom";

import { register } from "node:module";

// Register the loader so we can use the / prefix to load files from the src directory
register(new URL("./loader.js", import.meta.url));

// Enable JSDOM
const dom = new JSDOM();
globalThis.window = dom.window;
globalThis.window.scrollTo = () => {};
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.customElements = dom.window.customElements;
globalThis.CustomEvent = dom.window.CustomEvent;
globalThis.Node = dom.window.Node;
globalThis.DocumentFragment = dom.window.DocumentFragment;
globalThis.Event = dom.window.Event;
globalThis.KeyboardEvent = dom.window.KeyboardEvent;

// Mock requestAnimationFrame
globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
globalThis.window.requestAnimationFrame = globalThis.requestAnimationFrame;

// Mock matchMedia
globalThis.window.matchMedia = (query) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => {},
});

class IntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.IntersectionObserver = IntersectionObserver;

// Mock HTMLDialogElement methods (not implemented in JSDOM)
globalThis.window.HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute("open", "");
};
globalThis.window.HTMLDialogElement.prototype.close = function () {
  this.removeAttribute("open");
};

// Fail loudly on any unmocked network call. Tests that need fetch should
// assign their own stub to globalThis.fetch.
globalThis.fetch = async (url) => {
  throw new Error(`Unmocked fetch call in test: ${url}`);
};

// JSDOM's window.crypto lacks subtle; swap in node's webcrypto.
if (!globalThis.window.crypto?.subtle) {
  Object.defineProperty(globalThis.window, "crypto", {
    value: globalThis.crypto,
    configurable: true,
    writable: true,
  });
}

class LocalStorageStub {
  constructor() {
    this._store = {};
  }
  getItem(key) {
    return key in this._store ? this._store[key] : null;
  }
  setItem(key, value) {
    this._store[key] = String(value);
  }
  removeItem(key) {
    delete this._store[key];
  }
  get length() {
    return Object.keys(this._store).length;
  }
  key(index) {
    return Object.keys(this._store)[index] ?? null;
  }
  clear() {
    this._store = {};
  }
}

globalThis.localStorage = new LocalStorageStub();
