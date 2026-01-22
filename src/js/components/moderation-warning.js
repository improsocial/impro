import { html, render } from "/js/lib/lit-html.js";
import { Component, getChildrenFragment } from "./component.js";

class ModerationWarning extends Component {
  connectedCallback() {
    if (this._initialized) {
      return;
    }
    this.label = this.getAttribute("label");
    this.expanded = false;
    this._children = getChildrenFragment(this);
    this.innerHTML = "";
    this.render();
    this._initialized = true;
  }

  render() {
    render(
      html`
        <div
          class="top-bar"
          aria-expanded=${this.expanded}
          tabindex="0"
          role="button"
          @click=${() => this.toggle()}
          @keydown=${(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              this.toggle();
            }
          }}
        >
          <span>${this.label}</span>
          <label class="show-hide-label">
            ${this.expanded ? "Hide" : "Show"}
          </label>
        </div>
        <div class="toggle-content" ?hidden=${!this.expanded}></div>
      `,
      this,
    );

    const toggleContent = this.querySelector(".toggle-content");
    if (toggleContent) {
      toggleContent.appendChild(this._children);
    }
  }

  toggle() {
    this.expanded = !this.expanded;
    this.render();
  }
}

ModerationWarning.register();
