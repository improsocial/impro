import { ExternalLinkWarningModal } from "/js/modals/externalLinkWarning.modal.js";
import "/js/components/toggle-switch.js";
import "/js/components/plugin-profiles-list.js";
import "/js/components/plugin-posts-feed.js";
import "/js/components/plugin-icon.js";
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

function isAllowedTag(tag) {
  return ALLOWED_TAGS.includes(tag);
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
        if (this.el && renderer._sameKind(this.tree, node)) {
          renderer._patch(this.el, this.tree, node);
        } else {
          this.el = renderer._create(node);
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

  _sameKind(oldNode, newNode) {
    if (!oldNode || !newNode) return false;
    if (oldNode.type === "text" && newNode.type === "text") return true;
    if (oldNode.type === "element" && newNode.type === "element") {
      return resolveTag(oldNode) === resolveTag(newNode);
    }
    return false;
  }

  _create(node) {
    if (node.type === "text") {
      return document.createTextNode(node.value);
    }
    const pluginId = this.pluginId;
    const tag = resolveTag(node, pluginId);
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
            `[plugins] "${pluginId}" tried to set disallowed attribute "${name}" on <${tag}>`,
          );
          continue;
        }
        if (name === "href" && !isSafeHref(value)) {
          console.warn(
            `[plugins] "${pluginId}" tried to set unsafe href "${value}"`,
          );
          continue;
        }
        element.setAttribute(name, String(value));
      }
    }
    this._patchEvents(element, null, node.events);
    for (const child of node.children) {
      element.appendChild(this._create(child));
    }
    return element;
  }

  _patch(node, oldNode, newNode) {
    if (newNode.type === "text") {
      if (node.nodeValue !== newNode.value) node.nodeValue = newNode.value;
      return;
    }
    const pluginId = this.pluginId;
    const element = node;
    const oldAttrs = oldNode.attrs ?? {};
    const newAttrs = newNode.attrs ?? {};
    const isFocused = document.activeElement === element;
    const tag = element.localName;

    for (const name of Object.keys(oldAttrs)) {
      if (!(name in newAttrs) && isAllowedAttr(name, tag)) {
        element.removeAttribute(name);
      }
    }
    for (const [name, value] of Object.entries(newAttrs)) {
      if (!isAllowedAttr(name, tag)) {
        console.warn(
          `[plugins] "${pluginId}" tried to set disallowed attribute "${name}"`,
        );
        continue;
      }
      // Don't clobber what the user is currently editing.
      if (isFocused && (name === "value" || name === "checked")) continue;
      if (name === "href" && !isSafeHref(value)) {
        console.warn(
          `[plugins] "${pluginId}" tried to set unsafe href "${value}"`,
        );
        element.removeAttribute("href");
        continue;
      }
      if (oldAttrs[name] !== value) element.setAttribute(name, String(value));
    }

    this._patchEvents(element, oldNode.events, newNode.events);

    // Custom elements may have internal state derived from selectors (e.g.
    // optimistic like state). Give them a chance to re-render now that the
    // top-down patch has propagated.
    if (tag.includes("-") && typeof element.refresh === "function") {
      element.refresh();
    }

    const oldChildren = oldNode.children ?? [];
    const newChildren = newNode.children ?? [];
    const domChildren = Array.from(element.childNodes);
    const max = Math.max(oldChildren.length, newChildren.length);
    for (let index = 0; index < max; index++) {
      const oldChild = oldChildren[index];
      const newChild = newChildren[index];
      const domChild = domChildren[index];
      if (!oldChild && newChild) {
        element.appendChild(this._create(newChild));
      } else if (oldChild && !newChild) {
        if (domChild) element.removeChild(domChild);
      } else if (this._sameKind(oldChild, newChild)) {
        this._patch(domChild, oldChild, newChild);
      } else {
        element.replaceChild(this._create(newChild), domChild);
      }
    }
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
