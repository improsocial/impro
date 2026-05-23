import { Component } from "/js/components/component.js";

const CONTEXT_PREFIX = "context-";

function kebabToCamel(name) {
  return name.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

class PluginSlot extends Component {
  connectedCallback() {
    if (this.initialized) return;
    this.initialized = true;
    if (!this.pluginService) {
      throw new Error("pluginService is required");
    }
    this._pluginRoots = new Map();
    this._currentRequest = null;
    this._onSlotChange = ({ name }) => {
      if (name !== this.getAttribute("name")) return;
      this._reconcile();
    };
    this.pluginService.on("slotRegistered", this._onSlotChange);
    this.pluginService.on("slotUnregistered", this._onSlotChange);
    this._reconcile();
  }

  disconnectedCallback() {
    if (!this.initialized) return;
    this.pluginService.off("slotRegistered", this._onSlotChange);
    this.pluginService.off("slotUnregistered", this._onSlotChange);
    this._currentRequest = null;
    this._pluginRoots.clear();
  }

  // TODO - automatic?
  static get observedAttributes() {
    return ["name", "context-uri"];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (!this.initialized || oldValue === newValue) return;
    this._reconcile();
  }

  _getContext() {
    const context = {};
    for (const attr of this.attributes) {
      if (!attr.name.startsWith(CONTEXT_PREFIX)) continue;
      const key = kebabToCamel(attr.name.slice(CONTEXT_PREFIX.length));
      context[key] = attr.value;
    }
    return context;
  }

  async _reconcile() {
    const slotName = this.getAttribute("name");
    if (!slotName) return;
    const context = this._getContext();
    const entries = this.pluginService.getSlotEntries(slotName);

    const requestToken = Symbol();
    this._currentRequest = requestToken;

    // Drop cached roots for plugins no longer registered for this slot.
    const currentIds = new Set(entries.map((entry) => entry.pluginId));
    for (const pluginId of [...this._pluginRoots.keys()]) {
      if (!currentIds.has(pluginId)) this._pluginRoots.delete(pluginId);
    }

    if (entries.length === 0) {
      this.replaceChildren();
      return;
    }

    const results = await Promise.all(
      entries.map(async (entry) => {
        try {
          const node = await entry.invoke(context);
          return { entry, node };
        } catch (error) {
          console.error(
            `Plugin "${entry.pluginId}" slot "${slotName}" failed:`,
            error,
          );
          return { entry, node: null };
        }
      }),
    );

    if (this._currentRequest !== requestToken) return;

    const nextChildren = [];
    for (const { entry, node } of results) {
      if (!node) continue;
      let state = this._pluginRoots.get(entry.pluginId);
      if (!state) {
        const renderer = this.pluginService.getRenderer(entry.pluginId);
        state = { root: renderer.createRoot() };
        this._pluginRoots.set(entry.pluginId, state);
      }
      const element = state.root.render(node);
      nextChildren.push(element);
    }
    this.replaceChildren(...nextChildren);
  }
}

PluginSlot.register();
