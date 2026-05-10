import { Component } from "/js/components/component.js";
import { classnames } from "/js/utils.js";

// Should match the CSS animation duration
const RIPPLE_ANIMATION_DURATION = 600;

class AnimatedButton extends Component {
  static get observedAttributes() {
    return ["is-active"];
  }

  connectedCallback() {
    if (this._initialized) {
      this.updateClasses();
      return;
    }
    this.isActive = this.hasAttribute("is-active");
    this._isRippleAnimating = false;
    this._rippleTimeout = null;
    this._recentlyClickedTimeout = null;
    this._batchedAttributes = null;
    this._recentlyClicked = false;

    const projectedChildren = Array.from(this.childNodes);
    this._button = document.createElement("button");
    this._buttonClass = this.getAttribute("button-class") || "";
    const testid = this.getAttribute("testid");
    if (testid) {
      this._button.setAttribute("data-testid", testid);
    }
    this._button.addEventListener("click", () => this.handleClick());
    for (const node of projectedChildren) {
      this._button.appendChild(node);
    }
    this.appendChild(this._button);

    this.updateClasses();
    this._initialized = true;
  }

  batchedAttributeChangedCallback() {
    this.wasActive = this.isActive;
    this.isActive = this.hasAttribute("is-active");
    if (this.isActive && !this.wasActive && this._recentlyClicked) {
      this.triggerRippleAnimation();
    }
    this.updateClasses();
  }

  attributeChangedCallback(name) {
    if (!this._initialized) {
      return;
    }
    if (this._batchedAttributes) {
      this._batchedAttributes.push(name);
    } else {
      this._batchedAttributes = [name];
      requestAnimationFrame(() => {
        this.batchedAttributeChangedCallback(this._batchedAttributes);
        this._batchedAttributes = null;
      });
    }
  }

  triggerRippleAnimation() {
    if (this._rippleTimeout) {
      clearTimeout(this._rippleTimeout);
    }

    this._isRippleAnimating = true;
    this.updateClasses();

    this._rippleTimeout = setTimeout(() => {
      this._isRippleAnimating = false;
      this.updateClasses();
      this._rippleTimeout = null;
    }, RIPPLE_ANIMATION_DURATION);
  }

  disconnectedCallback() {
    if (this._rippleTimeout) {
      clearTimeout(this._rippleTimeout);
      this._rippleTimeout = null;
    }
    if (this._recentlyClickedTimeout) {
      clearTimeout(this._recentlyClickedTimeout);
      this._recentlyClickedTimeout = null;
    }
    this._isRippleAnimating = false;
  }

  handleClick() {
    this._recentlyClicked = true;
    if (this._recentlyClickedTimeout) {
      clearTimeout(this._recentlyClickedTimeout);
    }
    this._recentlyClickedTimeout = setTimeout(() => {
      this._recentlyClicked = false;
      this._recentlyClickedTimeout = null;
    }, 1000);
  }

  updateClasses() {
    if (!this._button) return;
    this._button.className = classnames(this._buttonClass, "animated-button", {
      active: this.isActive,
      animating: this._isRippleAnimating,
    });
  }
}

AnimatedButton.register();
