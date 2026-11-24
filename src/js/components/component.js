export class Component extends HTMLElement {
  static register() {
    try {
      customElements.define(this.tagName, this);
    } catch (e) {
      console.error(`Could not register component ${this.tagName}`, e);
      throw e;
    }
  }
}

export function getChildrenFragment(node) {
  const fragment = document.createDocumentFragment();
  const children = [...node.childNodes];
  children.forEach((child) => {
    fragment.appendChild(child);
  });
  return fragment;
}
