import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { classnames } from "/js/utils.js";

class ToggleSwitch extends Component {
  // formAssociated makes the element labelable, so a wrapping <label> (or
  // for/id) forwards clicks to it like a native checkbox.
  static formAssociated = true;

  static get observedAttributes() {
    return ["checked", "disabled", "label"];
  }

  connectedCallback() {
    if (this.initialized) {
      return;
    }
    this.setAttribute("role", "switch");
    this.addEventListener("click", () => {
      if (this.disabled) return;
      this.dispatchEvent(
        new CustomEvent("change", {
          detail: { checked: !this.checked },
          bubbles: true,
        }),
      );
    });
    this.addEventListener("keydown", (event) => {
      if (this.disabled) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        this.click();
      }
    });
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
    this.tabIndex = this.disabled ? -1 : 0;
    this.setAttribute("aria-checked", String(this.checked));
    this.setAttribute("aria-disabled", String(this.disabled));
    this.setAttribute("aria-label", this.getAttribute("label") ?? "");
    render(
      html`
        <div
          class=${classnames("toggle-switch-track", {
            checked: this.checked,
            disabled: this.disabled,
          })}
        >
          <div class="toggle-switch-knob"></div>
        </div>
      `,
      this,
    );
  }
}

ToggleSwitch.register();
