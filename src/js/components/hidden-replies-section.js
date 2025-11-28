import { html, render } from "/js/lib/lit-html.js";
import { Component, getChildrenFragment } from "./component.js";
import { eyeSlashIconTemplate } from "/js/templates/icons/eyeSlashIcon.template.js";
import { classnames } from "/js/utils.js";

class HiddenRepliesSection extends Component {
  connectedCallback() {
    if (this.initialized) {
      return;
    }
    this.expanded = false;
    this._children = getChildrenFragment(this);
    this.innerHTML = "";
    this.render();
    this.initialized = true;
  }

  render() {
    render(
      html`
        <div
          class=${classnames("hidden-replies-section", {
            expanded: this.expanded,
          })}
          aria-expanded=${this.expanded}
        >
          <div
            class="hidden-replies-button"
            tabindex="0"
            role="button"
            ?hidden=${this.expanded}
            @click=${() => this.toggle()}
            @keydown=${(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                this.toggle();
              }
            }}
          >
            <div class="hidden-replies-button-icon">
              ${eyeSlashIconTemplate()}
            </div>
            <span>Show more replies</span>
          </div>
          <div class="toggle-content" ?hidden=${!this.expanded}></div>
        </div>
      `,
      this
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

HiddenRepliesSection.register();
