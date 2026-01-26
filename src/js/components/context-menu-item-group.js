import { Component, getChildrenFragment } from "./component.js";
import { html, render } from "/js/lib/lit-html.js";

class ContextMenuItemGroup extends Component {
  connectedCallback() {
    if (this._initialized) {
      return;
    }
    this._children = getChildrenFragment(this);
    this.innerHTML = "";
    this.render();
    this._initialized = true;
  }

  render() {
    render(html`<div class="context-menu-item-group"></div>`, this);
    const el = this.querySelector(".context-menu-item-group");
    el.appendChild(this._children);
  }
}

ContextMenuItemGroup.register();
