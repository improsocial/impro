import { Component } from "/js/components/component.js";
import { effect } from "/js/signals.js";
import { isPromise } from "/js/utils.js";

const CONTEXT_PREFIX = "context-";

function kebabToCamel(name) {
  return name.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

class PluginSlot extends Component {
  connectedCallback() {
    if (!this.initialized) {
      this.initialized = true;
      if (!this.pluginService) {
        throw new Error("pluginService is required");
      }
      // pluginId -> { root, element, version, contextKey }
      this._pluginRenderState = new Map();
      this._currentRequest = null;
    }
    this._subscribe();
  }

  _subscribe() {
    this._disposeEffect?.();
    const slotName = this.getAttribute("name");
    if (!slotName) return;
    this._disposeEffect = effect(() => {
      this.pluginService.$slots.get(slotName);
      this._reconcile();
    });
  }

  disconnectedCallback() {
    if (!this.initialized) return;
    this._disposeEffect?.();
    this._disposeEffect = null;
    this._currentRequest = null;
    this._pluginRenderState.clear();
  }

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

  _reconcile() {
    const slotName = this.getAttribute("name");
    if (!slotName) return;
    const context = this._getContext();
    const registrations = this.pluginService.getSlotRegistrations(slotName);

    const requestToken = Symbol();
    this._currentRequest = requestToken;

    // Drop render state for plugins no longer registered for this slot.
    const currentIds = new Set(
      registrations.map((registration) => registration.pluginId),
    );
    for (const pluginId of [...this._pluginRenderState.keys()]) {
      if (!currentIds.has(pluginId)) this._pluginRenderState.delete(pluginId);
    }

    if (registrations.length === 0) {
      this.replaceChildren();
      return;
    }

    // Contribution: `{ registration, contextKey, node | unchanged }`
    // If we need to make request for content, return a Promise
    const awaitableContributions = registrations.map((registration) => {
      const version = registration.versionFor(context);
      // Each registration is only sensitive to part of the context, so a
      // change outside that part leaves its rendered content untouched
      const contextKey = registration.contextKeyFor(context);
      const renderState = this._pluginRenderState.get(registration.pluginId);
      if (
        renderState &&
        renderState.version === version &&
        renderState.contextKey === contextKey
      ) {
        return { registration, version, contextKey, unchanged: true };
      }
      const onError = (error) => {
        console.error(
          `Plugin "${registration.pluginId}" slot "${slotName}" failed:`,
          error,
        );
        return { registration, version, contextKey, node: null };
      };
      let content = null;
      try {
        content = registration.request(context);
      } catch (error) {
        return onError(error);
      }
      if (!isPromise(content)) {
        return { registration, version, contextKey, node: content };
      }
      return content.then(
        (node) => ({ registration, version, contextKey, node }),
        onError,
      );
    });

    // If no contributions need to be awaited, render synchronously
    if (!awaitableContributions.some(isPromise)) {
      this._render(awaitableContributions);
      return;
    }
    Promise.all(awaitableContributions).then((contributions) => {
      if (this._currentRequest !== requestToken) return;
      this._render(contributions);
    });
  }

  _render(contributions) {
    const nextChildren = [];
    for (const {
      registration,
      version,
      contextKey,
      node,
      unchanged,
    } of contributions) {
      let renderState = this._pluginRenderState.get(registration.pluginId);
      if (unchanged) {
        if (renderState?.element) nextChildren.push(renderState.element);
        continue;
      }
      if (!renderState) {
        const renderer = this.pluginService.getRenderer(registration.pluginId);
        renderState = {
          root: renderer.createRoot(),
        };
        this._pluginRenderState.set(registration.pluginId, renderState);
      }
      renderState.version = version;
      renderState.contextKey = contextKey;
      renderState.element = node ? renderState.root.render(node) : null;
      if (renderState.element) nextChildren.push(renderState.element);
    }
    this.replaceChildren(...nextChildren);
  }
}

PluginSlot.register();
