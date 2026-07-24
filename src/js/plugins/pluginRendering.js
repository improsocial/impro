import { ExternalLinkWarningModal } from "/js/modals/externalLinkWarning.modal.js";
import {
  assertSafeInlineStyleValue,
  assertSafeSvgValue,
} from "/js/plugins/pluginStylesLoader.js";
import "/js/components/toggle-switch.js";
import "/js/components/plugin-profiles-list.js";
import "/js/components/plugin-posts-feed.js";
import "/js/components/app-icon.js";
import "/js/components/plugin-blob-image.js";

function isExternalHref(href) {
  try {
    return new URL(href).origin !== window.location.origin;
  } catch {
    return false;
  }
}

const ALLOWED_TAGS = [
  "div",
  "span",
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "ul",
  "ol",
  "li",
  "strong",
  "em",
  "b",
  "i",
  "code",
  "pre",
  "br",
  "hr",
  "button",
  "input",
  "select",
  "option",
  "label",
  "textarea",
  "a",
  "plugin-profiles-list",
  "plugin-posts-feed",
  "plugin-icon",
  "plugin-blob-image",
  "toggle-switch",
];

const ALLOWED_EVENTS = ["click", "change", "input"];

const HTML_NS = "http://www.w3.org/1999/xhtml";
const SVG_NS = "http://www.w3.org/2000/svg";

// Case-sensitive
const SVG_ALLOWED_TAGS = new Set([
  "svg",
  "g",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "title",
  "desc",
]);

const SVG_ALLOWED_ATTRS = new Set([
  "viewBox",
  "preserveAspectRatio",
  "width",
  "height",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "d",
  "points",
  "transform",
  "class",
  "role",
  "fill",
  "fill-rule",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-dasharray",
  "stroke-opacity",
  "opacity",
  "color",
]);

const SVG_MAX_PATH_LENGTH = 32 * 1024;

function isAllowedTag(tag) {
  return ALLOWED_TAGS.includes(tag);
}

function isAllowedSvgAttr(name) {
  if (SVG_ALLOWED_ATTRS.has(name)) return true;
  if (name.startsWith("data-") || name.startsWith("aria-")) return true;
  return false;
}

const ALLOWED_ATTRS = [
  "class",
  "title",
  "role",
  "lang",
  "dir",
  "type",
  "value",
  "placeholder",
  "checked",
  "selected",
  "disabled",
  "name",
  "for",
  "id",
  "href",
];

function isSafeHref(value) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function isAllowedAttr(name, tag) {
  if (ALLOWED_ATTRS.includes(name)) return true;
  if (name.startsWith("data-") || name.startsWith("aria-")) return true;
  if (tag && tag.includes("-")) {
    // Allow custom elements observed attributes
    const ctor = customElements.get(tag);
    if (ctor?.observedAttributes?.includes(name)) return true;
  }
  return false;
}

function createVirtualEvent(e) {
  const target = e.target ?? {};
  const virtualTarget = {};
  if (typeof target.value === "string") virtualTarget.value = target.value;
  if (typeof target.checked === "boolean") {
    virtualTarget.checked = target.checked;
  }
  return {
    type: e.type,
    target: virtualTarget,
  };
}

const HANDLER_MAP = Symbol("pluginHandlerMap");

const TREE_LIMITS = {
  maxDepth: 64,
  maxNodes: 5000,
  maxTextLength: 16 * 1024,
  maxTotalText: 256 * 1024,
  maxAttrs: 32,
  maxChildren: 1000,
  maxStyles: 64,
  maxStyleValueLength: 128,
};

class NormalizerState {
  static MAX_ISSUE_REASONS = 20;

  constructor() {
    this.nodeCount = 0;
    this.totalText = 0;
    this.issueCount = 0;
    this.issueReasons = new Map();
  }

  recordIssue(reason) {
    this.issueCount += 1;
    if (this.issueReasons.has(reason)) {
      this.issueReasons.set(reason, this.issueReasons.get(reason) + 1);
    } else if (this.issueReasons.size < NormalizerState.MAX_ISSUE_REASONS) {
      this.issueReasons.set(reason, 1);
    }
  }

  getIssueSummary() {
    if (this.issueCount === 0) return null;
    const detail = [...this.issueReasons.entries()]
      .map(([reason, count]) => (count > 1 ? `${reason} ×${count}` : reason))
      .join(", ");
    return `${this.issueCount} issue(s) during render: ${detail}`;
  }
}

function createTextNode(value, state) {
  if (value.length > TREE_LIMITS.maxTextLength) {
    state.recordIssue("text node exceeds max length");
    return null;
  }
  if (state.totalText + value.length > TREE_LIMITS.maxTotalText) {
    state.recordIssue("total text budget exceeded");
    return null;
  }
  state.totalText += value.length;
  state.nodeCount += 1;
  return { type: "text", value };
}

function normalizeAttrs(rawAttrs, state) {
  if (!rawAttrs || typeof rawAttrs !== "object") return {};
  const entries = Object.entries(rawAttrs);
  if (entries.length > TREE_LIMITS.maxAttrs) {
    state.recordIssue("element exceeds max attributes; extras ignored");
  }
  const attrs = {};
  for (const [name, value] of entries.slice(0, TREE_LIMITS.maxAttrs)) {
    attrs[name] = value;
  }
  return attrs;
}

const IMPORTANT_SUFFIX_RE = /\s*!\s*important\s*$/i;

function applyStyle(element, name, value) {
  const match = IMPORTANT_SUFFIX_RE.exec(value);
  if (match) {
    element.style.setProperty(name, value.slice(0, match.index), "important");
  } else {
    element.style.setProperty(name, value);
  }
}

function normalizeStyles(rawStyles, state) {
  if (!rawStyles || typeof rawStyles !== "object") return {};
  const entries = Object.entries(rawStyles);
  if (entries.length > TREE_LIMITS.maxStyles) {
    state.recordIssue("element exceeds max style declarations; extras ignored");
  }
  const styles = {};
  for (const [name, rawValue] of entries.slice(0, TREE_LIMITS.maxStyles)) {
    if (typeof name !== "string" || name === "") {
      state.recordIssue("style property name is not a non-empty string");
      continue;
    }
    if (typeof rawValue !== "string" && typeof rawValue !== "number") {
      state.recordIssue("style value is not a string or number");
      continue;
    }
    const value = String(rawValue);
    if (value.length > TREE_LIMITS.maxStyleValueLength) {
      state.recordIssue("style value exceeds max length");
      continue;
    }
    try {
      assertSafeInlineStyleValue(name, value);
    } catch {
      state.recordIssue("disallowed resource function in style value");
      continue;
    }
    styles[name] = value;
  }
  return styles;
}

// Normalize any serialized node into `{ type: "text" | "element", ... }`,
// converting from legacy `{ tag, attrs, text, children }` format if needed.
// Returns null if invalid or over limits, recording the reason on `state`.
function normalizeNode(raw, depth, state) {
  if (!raw || typeof raw !== "object") {
    state.recordIssue("not an object");
    return null;
  }
  if (depth > TREE_LIMITS.maxDepth) {
    state.recordIssue("tree exceeds max depth");
    return null;
  }
  if (state.nodeCount >= TREE_LIMITS.maxNodes) {
    state.recordIssue("tree exceeds max node count");
    return null;
  }

  if (raw.type === "text") {
    if (typeof raw.value !== "string") {
      state.recordIssue("text node value is not a string");
      return null;
    }
    return createTextNode(raw.value, state);
  }

  const isLegacy = raw.type === undefined;
  if (raw.type !== "element" && !isLegacy) {
    state.recordIssue(`unknown node type "${raw.type}"`);
    return null;
  }

  state.nodeCount += 1;
  const children = [];

  // Legacy leading text becomes an explicit leading text child.
  if (isLegacy && raw.text != null && raw.text !== "") {
    const textNode = createTextNode(String(raw.text), state);
    if (textNode) children.push(textNode);
  }

  const rawChildren = Array.isArray(raw.children) ? raw.children : [];
  if (rawChildren.length > TREE_LIMITS.maxChildren) {
    state.recordIssue("element exceeds max children; extras ignored");
  }
  for (const rawChild of rawChildren.slice(0, TREE_LIMITS.maxChildren)) {
    const child = normalizeNode(rawChild, depth + 1, state);
    if (child) children.push(child);
  }

  return {
    type: "element",
    tag: typeof raw.tag === "string" ? raw.tag : "div",
    attrs: normalizeAttrs(raw.attrs, state),
    styles: normalizeStyles(raw.styles, state),
    events: raw.events && typeof raw.events === "object" ? raw.events : {},
    children,
  };
}

function resolveTag(node, pluginId) {
  let tag = typeof node.tag === "string" ? node.tag.toLowerCase() : "div";
  if (!isAllowedTag(tag)) {
    if (pluginId !== undefined) {
      console.warn(
        `[plugins] "${pluginId}" tried to render disallowed tag <${tag}>`,
      );
    }
    tag = "span";
  }
  return tag;
}

function resolveSvgTag(node, pluginId) {
  const tag = typeof node.tag === "string" ? node.tag : "";
  if (SVG_ALLOWED_TAGS.has(tag)) return tag;
  if (pluginId !== undefined) {
    console.warn(
      `[plugins] "${pluginId}" tried to render disallowed SVG tag <${tag}>`,
    );
  }
  return "g";
}

// Namespace is HTML by default, SVG once we enter an <svg>
function resolveChildNamespace(parentNs, node) {
  if (parentNs === SVG_NS) return SVG_NS;
  if (typeof node.tag === "string" && node.tag.toLowerCase() === "svg") {
    return SVG_NS;
  }
  return HTML_NS;
}

// Render a serialized VirtualNode (text or element) into a DOM node.
export class PluginRenderer {
  constructor(pluginBridge, pluginId, renderContext) {
    this.pluginBridge = pluginBridge;
    this.pluginId = pluginId;
    this.renderContext = renderContext;
  }

  createRoot() {
    const renderer = this;
    return {
      tree: null,
      el: null,
      render(rawNode) {
        const node = renderer._normalize(rawNode);
        if (this.el && renderer._sameKind(this.tree, node, HTML_NS)) {
          renderer._patch(this.el, this.tree, node, HTML_NS);
        } else {
          this.el = renderer._create(node, HTML_NS);
        }
        this.tree = node;
        return this.el;
      },
      reset() {
        this.el = null;
        this.tree = null;
      },
    };
  }

  _normalize(rawNode) {
    const state = new NormalizerState();
    const node = normalizeNode(rawNode, 0, state);
    this._reportIssues(state);
    return (
      node ?? {
        type: "element",
        tag: "span",
        attrs: {},
        styles: {},
        events: {},
        children: [],
      }
    );
  }

  _reportIssues(state) {
    const summary = state.getIssueSummary();
    if (!summary || this.pluginId === undefined) return;
    console.warn(`[plugins] "${this.pluginId}" had ${summary}`);
  }

  _sameKind(oldNode, newNode, parentNs = HTML_NS) {
    if (!oldNode || !newNode) return false;
    if (oldNode.type === "text" && newNode.type === "text") return true;
    if (oldNode.type === "element" && newNode.type === "element") {
      const oldNs = resolveChildNamespace(parentNs, oldNode);
      const newNs = resolveChildNamespace(parentNs, newNode);
      if (oldNs !== newNs) return false;
      if (oldNs === SVG_NS) {
        return resolveSvgTag(oldNode) === resolveSvgTag(newNode);
      }
      return resolveTag(oldNode) === resolveTag(newNode);
    }
    return false;
  }

  _create(node, parentNs = HTML_NS) {
    if (node.type === "text") {
      return document.createTextNode(node.value);
    }
    const ns = resolveChildNamespace(parentNs, node);
    if (ns === SVG_NS) return this._createSvg(node);
    let tag = resolveTag(node, this.pluginId);
    if (tag === "plugin-icon") tag = "app-icon";
    const element = document.createElement(tag);
    if (tag === "a") {
      element.setAttribute("target", "_blank");
      element.setAttribute("rel", "noopener noreferrer");
      element.addEventListener("click", (event) => {
        const href = element.getAttribute("href");
        if (!href || !isExternalHref(href)) return;
        event.preventDefault();
        ExternalLinkWarningModal.open({ href });
      });
    }
    if (tag === "plugin-profiles-list") {
      const { dataLayer } = this.renderContext;
      element.dataLayer = dataLayer;
    }
    if (tag === "plugin-posts-feed") {
      const {
        dataLayer,
        isAuthenticated,
        pluginService,
        interactionHandlers: { postInteractionHandler },
      } = this.renderContext;
      element.dataLayer = dataLayer;
      element.isAuthenticated = isAuthenticated;
      element.pluginService = pluginService;
      element.postInteractionHandler = postInteractionHandler;
    }
    if (tag === "toggle-switch") {
      // toggle-switch is controlled — flip its state here since the plugin
      // worker can't observe events synchronously to re-render.
      element.addEventListener("change", (event) => {
        element.checked = event.detail?.checked ?? !element.checked;
      });
    }
    if (node.attrs) {
      for (const [name, value] of Object.entries(node.attrs)) {
        if (!isAllowedAttr(name, tag)) {
          console.warn(
            `[plugins] "${this.pluginId}" tried to set disallowed attribute "${name}" on <${tag}>`,
          );
          continue;
        }
        if (name === "href" && !isSafeHref(value)) {
          console.warn(
            `[plugins] "${this.pluginId}" tried to set unsafe href "${value}"`,
          );
          continue;
        }
        element.setAttribute(name, String(value));
      }
    }
    if (node.styles) {
      for (const [name, value] of Object.entries(node.styles)) {
        applyStyle(element, name, value);
      }
    }
    this._patchEvents(element, null, node.events);
    for (const child of node.children) {
      element.appendChild(this._create(child, HTML_NS));
    }
    return element;
  }

  _createSvg(node) {
    const tag = resolveSvgTag(node, this.pluginId);
    const element = document.createElementNS(SVG_NS, tag);
    if (node.attrs) {
      for (const [name, value] of Object.entries(node.attrs)) {
        this._setSvgAttr(element, tag, name, value);
      }
    }
    if (node.styles) {
      for (const [name, value] of Object.entries(node.styles)) {
        applyStyle(element, name, value);
      }
    }
    for (const child of node.children) {
      if (child.type === "text") {
        element.appendChild(document.createTextNode(child.value));
        continue;
      }
      element.appendChild(this._create(child, SVG_NS));
    }
    return element;
  }

  _setSvgAttr(element, tag, name, value) {
    const pluginId = this.pluginId;
    if (!isAllowedSvgAttr(name)) {
      if (pluginId !== undefined) {
        console.warn(
          `[plugins] "${pluginId}" tried to set disallowed SVG attribute "${name}" on <${tag}>`,
        );
      }
      return;
    }
    const stringValue = String(value);
    if (
      (name === "d" || name === "points") &&
      stringValue.length > SVG_MAX_PATH_LENGTH
    ) {
      if (pluginId !== undefined) {
        console.warn(
          `[plugins] "${pluginId}" SVG "${name}" attribute exceeds max length; dropped`,
        );
      }
      return;
    }
    try {
      assertSafeSvgValue(name, stringValue);
    } catch {
      if (pluginId !== undefined) {
        console.warn(
          `[plugins] "${pluginId}" tried to set unsafe SVG "${name}" value`,
        );
      }
      return;
    }
    element.setAttribute(name, stringValue);
  }

  _patch(node, oldNode, newNode, parentNs = HTML_NS) {
    if (newNode.type === "text") {
      if (node.nodeValue !== newNode.value) node.nodeValue = newNode.value;
      return;
    }
    const ns = resolveChildNamespace(parentNs, newNode);
    if (ns === SVG_NS) {
      this._patchSvg(node, oldNode, newNode);
      return;
    }
    const element = node;
    const oldAttrs = oldNode.attrs ?? {};
    const newAttrs = newNode.attrs ?? {};
    const isFocused = document.activeElement === element;
    const tag = element.localName;

    for (const name of Object.keys(oldAttrs)) {
      if (!(name in newAttrs)) element.removeAttribute(name);
    }
    for (const [name, value] of Object.entries(newAttrs)) {
      if (!isAllowedAttr(name, tag)) {
        console.warn(
          `[plugins] "${this.pluginId}" tried to set disallowed attribute "${name}"`,
        );
        continue;
      }
      // Don't clobber what the user is currently editing.
      if (isFocused && (name === "value" || name === "checked")) continue;
      if (name === "href" && !isSafeHref(value)) {
        console.warn(
          `[plugins] "${this.pluginId}" tried to set unsafe href "${value}"`,
        );
        element.removeAttribute("href");
        continue;
      }
      if (oldAttrs[name] !== value) element.setAttribute(name, String(value));
    }

    const oldStyles = oldNode.styles ?? {};
    const newStyles = newNode.styles ?? {};
    for (const name of Object.keys(oldStyles)) {
      if (!(name in newStyles)) element.style.removeProperty(name);
    }
    for (const [name, value] of Object.entries(newStyles)) {
      if (oldStyles[name] !== value) applyStyle(element, name, value);
    }

    this._patchEvents(element, oldNode.events, newNode.events);

    // Custom elements may have internal state derived from selectors (e.g.
    // optimistic like state). Give them a chance to re-render now that the
    // top-down patch has propagated.
    if (tag.includes("-") && typeof element.refresh === "function") {
      element.refresh();
    }

    this._patchChildren(
      element,
      oldNode.children ?? [],
      newNode.children ?? [],
      HTML_NS,
    );
  }

  _patchChildren(element, oldChildren, newChildren, parentNs) {
    const domChildren = Array.from(element.childNodes);
    const max = Math.max(oldChildren.length, newChildren.length);
    for (let index = 0; index < max; index++) {
      const oldChild = oldChildren[index];
      const newChild = newChildren[index];
      const domChild = domChildren[index];
      if (!oldChild && newChild) {
        element.appendChild(this._create(newChild, parentNs));
      } else if (oldChild && !newChild) {
        if (domChild) element.removeChild(domChild);
      } else if (this._sameKind(oldChild, newChild, parentNs)) {
        this._patch(domChild, oldChild, newChild, parentNs);
      } else {
        element.replaceChild(this._create(newChild, parentNs), domChild);
      }
    }
  }

  _patchSvg(element, oldNode, newNode) {
    const tag = element.localName;
    const oldAttrs = oldNode.attrs ?? {};
    const newAttrs = newNode.attrs ?? {};
    for (const name of Object.keys(oldAttrs)) {
      if (!(name in newAttrs)) element.removeAttribute(name);
    }
    for (const [name, value] of Object.entries(newAttrs)) {
      if (oldAttrs[name] === value) continue;
      this._setSvgAttr(element, tag, name, value);
    }
    const oldStyles = oldNode.styles ?? {};
    const newStyles = newNode.styles ?? {};
    for (const name of Object.keys(oldStyles)) {
      if (!(name in newStyles)) element.style.removeProperty(name);
    }
    for (const [name, value] of Object.entries(newStyles)) {
      if (oldStyles[name] !== value) applyStyle(element, name, value);
    }
    this._patchChildren(
      element,
      oldNode.children ?? [],
      newNode.children ?? [],
      SVG_NS,
    );
  }

  _patchEvents(element, oldEvents, newEvents) {
    const map = (element[HANDLER_MAP] ??= {});
    const next = newEvents && typeof newEvents === "object" ? newEvents : {};
    if (oldEvents) {
      for (const name of Object.keys(oldEvents)) {
        if (!(name in next)) delete map[name];
      }
    }
    for (const [name, handlerId] of Object.entries(next)) {
      if (!ALLOWED_EVENTS.includes(name)) {
        console.warn(
          `[plugins] "${this.pluginId}" tried to bind disallowed event "${name}"`,
        );
        continue;
      }
      const isNew = !(name in map);
      map[name] = handlerId;
      if (isNew) {
        element.addEventListener(name, (event) => {
          const currentId = element[HANDLER_MAP]?.[name];
          if (currentId == null) return;
          this.pluginBridge.handleNodeEvent(
            this.pluginId,
            currentId,
            createVirtualEvent(event),
          );
        });
      }
    }
  }

  isEmptyNode(node) {
    if (!node || typeof node !== "object") return true;
    if (node.type === "text") return !node.value;
    // Legacy `text` field or new/legacy `children`.
    if (node.text != null && node.text !== "") return false;
    if (Array.isArray(node.children) && node.children.length > 0) return false;
    return true;
  }
}
