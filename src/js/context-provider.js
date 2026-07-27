// Content mounted outside a <context-provider>'s subtree can't reach it via
// closest() — e.g. plugin modals (pluginModal.js) mount their <dialog>
// directly on <body>, as a sibling of the main layout, rather than nested
// inside it. Track the most recently connected provider per context-id as a
// fallback for exactly that case, so such content can still resolve context
// instead of throwing.
const fallbackProviders = new Map();

class ContextProvider extends HTMLElement {
  set context(value) {
    this._context = value;
  }
  get context() {
    return this._context;
  }

  connectedCallback() {
    const contextId = this.getAttribute("context-id");
    if (contextId) fallbackProviders.set(contextId, this);
  }

  disconnectedCallback() {
    const contextId = this.getAttribute("context-id");
    if (contextId && fallbackProviders.get(contextId) === this) {
      fallbackProviders.delete(contextId);
    }
  }
}
customElements.define("context-provider", ContextProvider);

export function getContext(node, contextId) {
  const selector = contextId
    ? `context-provider[context-id="${contextId}"]`
    : "context-provider";
  const provider =
    node.closest(selector) ??
    (contextId ? fallbackProviders.get(contextId) : null);
  if (!provider) {
    throw new Error(
      contextId
        ? `getContext: no <context-provider context-id="${contextId}"> ancestor`
        : "getContext: no <context-provider> ancestor",
    );
  }
  return provider.context;
}
