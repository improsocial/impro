import { Component } from "/js/components/component.js";
import { html, render } from "/js/lib/lit-html.js";

export class AppIcon extends Component {
  static observedAttributes = ["icon"];

  attributeChangedCallback() {
    this.render();
  }

  render() {
    const icon = this.getAttribute("icon");
    if (!icon) {
      render(html``, this);
      return;
    }
    render(html`<svg><use href="/img/icons.svg#${icon}" /></svg>`, this);
  }
}

AppIcon.register();
