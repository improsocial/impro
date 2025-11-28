import { html, render } from "/js/lib/lit-html.js";
import { Component, getChildrenFragment } from "./component.js";
import { eyeSlashIconTemplate } from "/js/templates/icons/eyeSlashIcon.template.js";
import { classnames } from "/js/utils.js";

class MutedReplyToggle extends Component {
  connectedCallback() {
    if (this.initialized) {
      return;
    }
    this.label = this.getAttribute("label") ?? "Muted reply";
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
          class=${classnames("muted-reply-toggle", {
            expanded: this.expanded,
          })}
          aria-expanded=${this.expanded}
        >
          <div
            class="muted-reply-toggle-button"
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
            <div class="muted-reply-toggle-button-icon">
              ${eyeSlashIconTemplate()}
            </div>
            <span>${this.label}</span>
            <div class="muted-account-show-more">Show</div>
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

MutedReplyToggle.register();
