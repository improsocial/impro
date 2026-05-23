import { showExternalLinkWarningModal } from "/js/modals.js";
import "/js/components/toggle-switch.js";
import "/js/components/plugin-profiles-list.js";
import "/js/components/plugin-posts-feed.js";
import "/js/components/plugin-icon.js";
import { PostInteractionHandler } from "/js/postInteractionHandler.js";

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

// Render a serialized VirtualEl node ({ tag, attrs, text, children }) into a DOM element.
export class PluginRenderer {
  constructor(pluginBridge, pluginId, renderContext) {
    this.pluginBridge = pluginBridge;
    this.pluginId = pluginId;
    this.renderContext = renderContext;
  }

  createRoot({ handlerRenderFunc = null } = {}) {
    const renderer = this;
    const pluginId = this.pluginId;
    let postInteractionHandler = null;
    const getPostInteractionHandler = () => {
      if (!postInteractionHandler) {
        postInteractionHandler = new PostInteractionHandler(
          renderer.renderContext.dataLayer,
          renderer.renderContext.postComposerService,
          renderer.renderContext.reportService,
          { renderFunc: handlerRenderFunc },
        );
      }
      return postInteractionHandler;
    };
    return {
      tree: null,
      el: null,
      render(node) {
        if (this.el && renderer._sameType(this.tree, node)) {
          renderer._patch(
            this.el,
            this.tree,
            node,
            pluginId,
            getPostInteractionHandler,
          );
        } else {
          this.el = renderer._create(node, pluginId, getPostInteractionHandler);
        }
        this.tree = node;
        return this.el;
      },
    };
  }

  _sameType(oldNode, newNode) {
    if (!oldNode || !newNode) return false;
    return resolveTag(oldNode) === resolveTag(newNode);
  }

  _create(node, pluginId, getPostInteractionHandler = () => null) {
    const tag = resolveTag(node, pluginId);
    const element = document.createElement(tag);
    if (tag === "a") {
      element.setAttribute("target", "_blank");
      element.setAttribute("rel", "noopener noreferrer");
      element.addEventListener("click", (event) => {
        const href = element.getAttribute("href");
        if (!href || !isExternalHref(href)) return;
        event.preventDefault();
        showExternalLinkWarningModal({ href });
      });
    }
    if (tag === "plugin-profiles-list") {
      const { dataLayer } = this.renderContext;
      if (!dataLayer) {
        throw new Error("Datalayer is required");
      }
      element.dataLayer = dataLayer;
    }
    if (tag === "plugin-posts-feed") {
      const { dataLayer, isAuthenticated, pluginService } = this.renderContext;
      if (!dataLayer) {
        throw new Error("Datalayer is required");
      }
      element.dataLayer = dataLayer;
      element.isAuthenticated = isAuthenticated;
      element.pluginService = pluginService;
      element.postInteractionHandler = getPostInteractionHandler();
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
    this._patchEvents(element, null, node.events, pluginId);
    const children = Array.isArray(node.children) ? node.children : [];
    const hasText = node.text != null && node.text !== "";
    if (hasText && children.length === 0) {
      element.textContent = node.text;
    } else {
      if (hasText) {
        element.appendChild(document.createTextNode(node.text));
      }
      for (const child of children) {
        element.appendChild(
          this._create(child, pluginId, getPostInteractionHandler),
        );
      }
    }
    return element;
  }

  _patch(
    element,
    oldNode,
    newNode,
    pluginId,
    getPostInteractionHandler = () => null,
  ) {
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

    this._patchEvents(element, oldNode.events, newNode.events, pluginId);

    // Custom elements may have internal state derived from selectors (e.g.
    // optimistic like state). Give them a chance to re-render now that the
    // top-down patch has propagated.
    if (tag.includes("-") && typeof element.refresh === "function") {
      element.refresh();
    }

    const oldChildren = Array.isArray(oldNode.children) ? oldNode.children : [];
    const newChildren = Array.isArray(newNode.children) ? newNode.children : [];
    const oldHasText = oldNode.text != null && oldNode.text !== "";
    const newHasText = newNode.text != null && newNode.text !== "";

    // Fast path: text-only on both sides.
    if (oldChildren.length === 0 && newChildren.length === 0) {
      if (newHasText) {
        if (newNode.text !== oldNode.text) element.textContent = newNode.text;
      } else if (oldHasText) {
        element.textContent = "";
      }
      return;
    }

    // If the children-vs-text shape changed dramatically, rebuild content.
    const oldHadOnlyText = oldChildren.length === 0 && oldHasText;
    const newHasOnlyText = newChildren.length === 0 && newHasText;
    if (oldHadOnlyText || newHasOnlyText) {
      element.textContent = "";
      if (newHasText) {
        element.appendChild(document.createTextNode(newNode.text));
      }
      for (const child of newChildren) {
        element.appendChild(
          this._create(child, pluginId, getPostInteractionHandler),
        );
      }
      return;
    }

    // Both sides have element children — manage the optional leading text node.
    let textOffset = 0;
    const firstIsTextNode =
      element.firstChild && element.firstChild.nodeType === Node.TEXT_NODE;
    if (newHasText) {
      if (firstIsTextNode) {
        if (element.firstChild.textContent !== newNode.text) {
          element.firstChild.textContent = newNode.text;
        }
      } else {
        element.insertBefore(
          document.createTextNode(newNode.text),
          element.firstChild,
        );
      }
      textOffset = 1;
    } else if (oldHasText && firstIsTextNode) {
      element.removeChild(element.firstChild);
    }

    const domChildren = Array.from(element.childNodes);
    const max = Math.max(oldChildren.length, newChildren.length);
    for (let index = 0; index < max; index++) {
      const oldChild = oldChildren[index];
      const newChild = newChildren[index];
      const domChild = domChildren[index + textOffset];
      if (!oldChild && newChild) {
        element.appendChild(
          this._create(newChild, pluginId, getPostInteractionHandler),
        );
      } else if (oldChild && !newChild) {
        if (domChild) element.removeChild(domChild);
      } else if (this._sameType(oldChild, newChild)) {
        this._patch(
          domChild,
          oldChild,
          newChild,
          pluginId,
          getPostInteractionHandler,
        );
      } else {
        element.replaceChild(
          this._create(newChild, pluginId, getPostInteractionHandler),
          domChild,
        );
      }
    }
  }

  _patchEvents(element, oldEvents, newEvents, pluginId) {
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
          `[plugins] "${pluginId}" tried to bind disallowed event "${name}"`,
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
            pluginId,
            currentId,
            createVirtualEvent(event),
          );
        });
      }
    }
  }

  isEmptyNode(node) {
    if (!node) return true;
    if (node.text != null && node.text !== "") return false;
    if (Array.isArray(node.children) && node.children.length > 0) return false;
    return true;
  }
}
