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
