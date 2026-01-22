import { html, render } from "/js/lib/lit-html.js";
import { Component } from "./component.js";
import { classnames, formatLargeNumber } from "/js/utils.js";
import { heartIconTemplate } from "/js/templates/icons/heartIcon.template.js";

// Should match the CSS animation durations
const LIKE_ANIMATION_DURATION = 600;
const COUNT_INCREASING_ANIMATION_DURATION = 275; // note- this needs to be slightly less than the duration of the animation to avoid a flash of the previous count
const COUNT_DECREASING_ANIMATION_DURATION = 280;

// Animated!
class LikeButton extends Component {
  static get observedAttributes() {
    return ["is-liked", "count"];
  }

  connectedCallback() {
    if (this._initialized) {
      // Still render if the button is already initialized.
      // This fixes a weird bug where the button wasn't updating when navigating back from a post detail page.
      this.render();
      return;
    }
    this.isLiked = this.hasAttribute("is-liked");
    this.count = Number(this.getAttribute("count") || "0");
    this.prevCount = this.count;
    this._isRippleAnimating = false;
    this._isCountAnimating = false;
    this._isCountIncreasing = true;
    this._rippleTimeout = null;
    this._countTimeout = null;
    this._batchedAttributes = null;
    this._recentlyClicked = false;
    this.render();
    this._initialized = true;
  }

  batchedAttributeChangedCallback() {
    this.prevCount = this.count;
    this.count = Number(this.getAttribute("count") || "0");
    this.wasLiked = this.isLiked;
    this.isLiked = this.hasAttribute("is-liked");
    if (this.isLiked && !this.wasLiked && this._recentlyClicked) {
      this.triggerRippleAnimation();
    }
    // if (this.count !== this.prevCount) {
    //   this._isCountIncreasing = this.count > this.prevCount;
    //   this.triggerCountAnimation();
    // }
    this.render();
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
    this.render();

    this._rippleTimeout = setTimeout(() => {
      this._isRippleAnimating = false;
      this.render();
      this._rippleTimeout = null;
    }, LIKE_ANIMATION_DURATION);
  }

  triggerCountAnimation() {
    if (this._countTimeout) {
      clearTimeout(this._countTimeout);
    }

    this._isCountAnimating = true;
    this.render();

    this._countTimeout = setTimeout(
      () => {
        this._isCountAnimating = false;
        this.render();
        this._countTimeout = null;
      },
      this._isCountIncreasing
        ? COUNT_INCREASING_ANIMATION_DURATION
        : COUNT_DECREASING_ANIMATION_DURATION,
    );
  }

  disconnectedCallback() {
    if (this._rippleTimeout) {
      clearTimeout(this._rippleTimeout);
    }
    if (this._countTimeout) {
      clearTimeout(this._countTimeout);
    }
  }

  handleClick() {
    this._recentlyClicked = true;
    this.dispatchEvent(
      new CustomEvent("click-like", {
        bubbles: true,
        composed: true,
      }),
    );
    setTimeout(() => {
      this._recentlyClicked = false;
    }, 1000);
  }

  render() {
    render(
      html`
        <button
          class=${classnames("post-action-button like-button", {
            liked: this.isLiked,
            animating: this._isRippleAnimating,
          })}
          @click=${() => this.handleClick()}
        >
          <div class="post-action-icon">${heartIconTemplate()}</div>
          ${this.count > 0
            ? html`<span
                class=${classnames("post-action-count", {
                  "count-animating": this._isCountAnimating,
                  "count-increasing": this._isCountIncreasing,
                  "count-decreasing": !this._isCountIncreasing,
                })}
              >
                <span class="count-current"
                  >${formatLargeNumber(this.count)}</span
                >
                ${this._isCountAnimating && this.prevCount > 0
                  ? html`<span class="count-previous"
                      >${formatLargeNumber(this.prevCount)}</span
                    >`
                  : null}
              </span>`
            : null}
        </button>
      `,
      this,
    );
  }
}

LikeButton.register();
