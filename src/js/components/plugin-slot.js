import { Component } from "/js/components/component.js";
import { effect } from "/js/signals.js";

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
    this._subscribe();
  }

  _subscribe() {
    this._disposeEffect?.();
    const slotName = this.getAttribute("name");
    if (!slotName) return;
    this._disposeEffect = effect(() => {
      this.pluginService.$slots.get(slotName);
      this._reconcile();
    }, `plugin-slot[${slotName}]`);
  }

  disconnectedCallback() {
    if (!this.initialized) return;
    this._disposeEffect?.();
    this._disposeEffect = null;
    this._currentRequest = null;
    this._pluginRoots.clear();
  }

  // TODO - automatic?
  static get observedAttributes() {
    return ["name", "context-uri", "context-did"];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (!this.initialized || oldValue === newValue) return;
    if (name === "name") {
      this._subscribe();
    } else {
      this._reconcile();
    }
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
    const contextKey = JSON.stringify(context);
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

    // Only re-invoke a plugin when its entry version changed
    // or the context changed - otherwise use cached response
    const results = await Promise.all(
      entries.map(async (entry) => {
        const cached = this._pluginRoots.get(entry.pluginId);
        if (
          cached &&
          cached.version === entry.version &&
          cached.contextKey === contextKey
        ) {
          return { entry, node: null, reuseCached: true };
        }
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
    for (const { entry, node, reuseCached } of results) {
      let state = this._pluginRoots.get(entry.pluginId);
      if (reuseCached) {
        if (state.element) nextChildren.push(state.element);
        continue;
      }
      if (!state) {
        const renderer = this.pluginService.getRenderer(entry.pluginId);
        state = {
          root: renderer.createRoot(),
        };
        this._pluginRoots.set(entry.pluginId, state);
      }
      state.version = entry.version;
      state.contextKey = contextKey;
      state.element = node ? state.root.render(node) : null;
      if (state.element) nextChildren.push(state.element);
    }
    this.replaceChildren(...nextChildren);
  }
}

PluginSlot.register();
