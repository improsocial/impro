class ContextProvider extends HTMLElement {
  set context(value) {
    this._context = value;
  }
  get context() {
    return this._context;
  }
}
customElements.define("context-provider", ContextProvider);

export function getContext(node, contextId) {
  const selector = contextId
    ? `context-provider[context-id="${contextId}"]`
    : "context-provider";
  const provider = node.closest(selector);
  if (!provider) {
    throw new Error(
      contextId
        ? `getContext: no <context-provider context-id="${contextId}"> ancestor`
        : "getContext: no <context-provider> ancestor",
    );
  }
  return provider.context;
}
