import { lightningBoltIconTemplate } from "/js/templates/icons/lightningBoltIcon.template.js";
import "/js/components/toggle-switch.js";

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
];

function isAllowedAttr(name) {
  return (
    ALLOWED_ATTRS.includes(name) ||
    name.startsWith("data-") ||
    name.startsWith("aria-")
  );
}

const PLUGIN_ICON_TEMPLATES = {
  "lightning-bolt": lightningBoltIconTemplate,
};

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

// Render a serialized VirtualEl node ({ tag, attrs, text, children }) into a
// real element. Text and children are mutually exclusive on
// the worker side (setText() clears children).
export class PluginRenderer {
  constructor(pluginBridge) {
    this.pluginBridge = pluginBridge;
  }
  renderNode(node, pluginId) {
    let tag = typeof node.tag === "string" ? node.tag.toLowerCase() : "div";
    if (!isAllowedTag(tag)) {
      console.warn(
        `[plugins] "${pluginId}" tried to render disallowed tag <${tag}>`,
      );
      tag = "span";
    }
    const aliasedAsToggle = tag === "input" && node.attrs?.type === "checkbox";
    if (aliasedAsToggle) {
      tag = "toggle-switch";
    }
    const element = document.createElement(tag);
    if (aliasedAsToggle) {
      // toggle-switch is controlled — flip its state here since the plugin
      // worker can't observe events synchronously to re-render.
      element.addEventListener("change", (e) => {
        element.checked = e.detail?.checked ?? !element.checked;
      });
    }
    if (node.attrs) {
      for (const [name, value] of Object.entries(node.attrs)) {
        if (!isAllowedAttr(name)) {
          console.warn(
            `[plugins] "${pluginId}" tried to set disallowed attribute "${name}" on <${tag}>`,
          );
          continue;
        }
        element.setAttribute(name, String(value));
      }
    }
    if (node.events && typeof node.events === "object") {
      for (const [name, handlerId] of Object.entries(node.events)) {
        if (!ALLOWED_EVENTS.includes(name)) {
          console.warn(
            `[plugins] "${pluginId}" tried to bind disallowed event "${name}"`,
          );
          continue;
        }
        element.addEventListener(name, (e) => {
          this.pluginBridge.handleNodeEvent(
            pluginId,
            handlerId,
            createVirtualEvent(e),
          );
        });
      }
    }
    if (node.text != null) {
      element.textContent = node.text;
    } else if (Array.isArray(node.children)) {
      for (const child of node.children) {
        element.appendChild(this.renderNode(child, pluginId));
      }
    }
    return element;
  }

  isEmptyNode(node) {
    if (!node) return true;
    if (node.text != null && node.text !== "") return false;
    if (Array.isArray(node.children) && node.children.length > 0) return false;
    return true;
  }
}

export function getPluginIconTemplate(icon) {
  const template = PLUGIN_ICON_TEMPLATES[icon];
  if (!template) {
    console.warn(`[plugins] requested unknown icon "${icon}"`);
    return null;
  }
  return template;
}
