import { Component } from "/js/components/component.js";
import { html, render } from "/js/lib/lit-html.js";

export class AppIcon extends Component {
  static observedAttributes = ["icon"];

  connectedCallback() {
    if (this.getAttribute("icon")) {
      this.render();
    }
  }

  attributeChangedCallback() {
    if (this.isConnected) {
      this.render();
    }
  }

  render() {
    const icon = this.getAttribute("icon");
    if (!icon) {
      render(html``, this);
      return;
    }
    render(html`<svg><use href="#${icon}" /></svg>`, this);
  }
}

AppIcon.register();
