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
