function kebabCase(str) {
  return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

export class Component extends HTMLElement {
  static register() {
    const tagName = kebabCase(this.name);
    customElements.define(tagName, this);
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
