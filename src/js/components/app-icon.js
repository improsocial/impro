import { Component } from "/js/components/component.js";
import { html, render } from "/js/lib/lit-html.js";
import usedIcons from "/js/iconData.js";

let sprite = null;
const spriteIds = new Set();
let allIconsPromise = null;

function getSprite() {
  if (!sprite) {
    sprite = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    sprite.setAttribute("aria-hidden", "true");
    sprite.style.display = "none";
  }
  if (!sprite.isConnected) {
    document.body.prepend(sprite);
  }
  return sprite;
}

function addSymbol(id, symbol) {
  const target = getSprite();
  if (spriteIds.has(id)) return;
  target.insertAdjacentHTML("beforeend", symbol);
  spriteIds.add(id);
}

function loadAllIcons() {
  allIconsPromise ??= import("/js/iconDataAll.js").then(
    (module) => module.default,
  );
  return allIconsPromise;
}

export class AppIcon extends Component {
  static tagName = "app-icon";
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
    if (usedIcons[icon]) {
      addSymbol(icon, usedIcons[icon]);
      render(html`<svg><use href="#${icon}" /></svg>`, this);
      return;
    }
    render(html`<svg></svg>`, this);
    loadAllIcons().then((allIcons) => {
      if (!allIcons[icon] || this.getAttribute("icon") !== icon) return;
      addSymbol(icon, allIcons[icon]);
      render(html`<svg><use href="#${icon}" /></svg>`, this);
    });
  }
}

AppIcon.register();
