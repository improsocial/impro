import { html, render } from "/js/lib/lit-html.js";
import { Component, getChildrenFragment } from "./component.js";
import { infoIconTemplate } from "/js/templates/icons/infoIcon.template.js";
import { eyeSlashIconTemplate } from "/js/templates/icons/eyeSlashIcon.template.js";

class ModerationWarning extends Component {
  connectedCallback() {
    if (this._initialized) {
      return;
    }
    this.label = this.getAttribute("label");
    this.labelerLink = this.getAttribute("labelerLink");
    this.labelerName = this.getAttribute("labelerName");
    this.iconStyle = this.getAttribute("icon-style") ?? "info";
    this.expanded = false;
    this._children = getChildrenFragment(this);
    this.innerHTML = "";
    this.render();
    this._initialized = true;
  }

  render() {
    const iconTemplate =
      this.iconStyle === "closed-eye" ? eyeSlashIconTemplate : infoIconTemplate;
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
          <span class="moderation-warning-label">
            ${iconTemplate()}
            <span>${this.label}</span>
          </span>
          <label class="show-hide-label">
            ${this.expanded ? "Hide" : "Show"}
          </label>
        </div>
        <div class="toggle-content" ?hidden=${!this.expanded}></div>
        ${this.labelerName
          ? html`<div
              class="post-moderation-warning-description"
              ?hidden=${this.expanded}
            >
              Labeled by
              ${this.labelerLink
                ? html`<a href="${this.labelerLink}">${this.labelerName}</a>`
                : this.labelerName}
            </div>`
          : ""}
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
