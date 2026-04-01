import { html, render } from "/js/lib/lit-html.js";
import { Component } from "./component.js";
import { classnames } from "/js/utils.js";

class ToggleSwitch extends Component {
  static get observedAttributes() {
    return ["checked", "disabled"];
  }

  connectedCallback() {
    if (this.initialized) {
      return;
    }
    this.render();
    this.initialized = true;
  }

  attributeChangedCallback() {
    if (this.initialized) {
      this.render();
    }
  }

  get checked() {
    return this.hasAttribute("checked");
  }

  set checked(value) {
    if (value) {
      this.setAttribute("checked", "");
    } else {
      this.removeAttribute("checked");
    }
  }

  get disabled() {
    return this.hasAttribute("disabled");
  }

  set disabled(value) {
    if (value) {
      this.setAttribute("disabled", "");
    } else {
      this.removeAttribute("disabled");
    }
  }

  render() {
    const label = this.getAttribute("label") ?? "";

    render(
      html`
        <div
          class=${classnames("toggle-switch-track", {
            checked: this.checked,
            disabled: this.disabled,
          })}
          role="switch"
          tabindex=${this.disabled ? "-1" : "0"}
          aria-checked=${this.checked}
          aria-disabled=${this.disabled}
          aria-label=${label}
          @click=${() => {
            if (this.disabled) return;
            this.checked = !this.checked;
            this.dispatchEvent(
              new CustomEvent("change", {
                detail: { checked: this.checked },
                bubbles: true,
              }),
            );
          }}
          @keydown=${(event) => {
            if (this.disabled) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              event.target.click();
            }
          }}
        >
          <div class="toggle-switch-knob"></div>
        </div>
      `,
      this,
    );
  }
}

ToggleSwitch.register();
