import { Component, getChildrenFragment } from "/js/components/component.js";
import { html, render } from "/js/lib/lit-html.js";
import "/js/components/app-icon.js";

class ContextMenuItem extends Component {
  static get observedAttributes() {
    return ["disabled", "icon", "item-style"];
  }

  connectedCallback() {
    if (this._initialized) {
      return;
    }
    this._children = getChildrenFragment(this);
    this.innerHTML = "";
    this.disabled = this.getAttribute("disabled") !== null;
    this.icon = this.getAttribute("icon");
    this.itemStyle = this.getAttribute("item-style");
    this.render();
    this._initialized = true;
  }

  attributeChangedCallback(name) {
    if (!this._initialized) {
      return;
    }
    if (name === "disabled") {
      this.disabled = this.getAttribute("disabled") !== null;
    } else if (name === "icon") {
      this.icon = this.getAttribute("icon");
    } else if (name === "item-style") {
      this.itemStyle = this.getAttribute("item-style");
    }
    this.render();
  }

  set iconElement(el) {
    this._iconElement = el;
    if (el && !el.classList.contains("context-menu-item-icon")) {
      el.classList.add("context-menu-item-icon");
    }
    if (this._initialized) this.render();
  }

  render() {
    const buttonClass = this.itemStyle
      ? `context-menu-item-style-${this.itemStyle}`
      : "";
    render(
      html`<button class=${buttonClass} ?disabled=${this.disabled}>
        ${this._children}
        ${this._iconElement
          ? this._iconElement
          : this.icon
            ? html`<app-icon
                class="context-menu-item-icon"
                icon=${this.icon}
              ></app-icon>`
            : null}
      </button>`,
      this,
    );
  }
}

ContextMenuItem.register();
