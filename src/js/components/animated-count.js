import { Component } from "/js/components/component.js";
import { formatLargeNumber, prefersReducedMotion } from "/js/utils.js";

const ROLL_DISTANCE = "18px";

const ROLL_ANIMATION_OPTIONS = {
  duration: 300,
  easing: "ease-out",
  fill: "forwards",
};

function enteringKeyframes(direction) {
  const offset = direction === "up" ? ROLL_DISTANCE : `-${ROLL_DISTANCE}`;
  return [
    { opacity: 0, transform: `translateY(${offset})` },
    { opacity: 1, transform: "translateY(0)" },
  ];
}

function exitingKeyframes(direction) {
  const offset = direction === "up" ? `-${ROLL_DISTANCE}` : ROLL_DISTANCE;
  return [
    { opacity: 1, transform: "translateY(0)" },
    { opacity: 0, transform: `translateY(${offset})` },
  ];
}

class AnimatedCount extends Component {
  static get observedAttributes() {
    return ["count", "is-active"];
  }

  constructor() {
    super();
    this._count = null;
    this._isActive = null;
    this._updateQueued = false;
    this._currentEl = null;
    this._previousEl = null;
    this._animations = [];
  }

  connectedCallback() {
    this.queueUpdate();
  }

  disconnectedCallback() {
    this.cancelAnimations();
  }

  attributeChangedCallback() {
    this.queueUpdate();
  }

  queueUpdate() {
    if (this._updateQueued) {
      return;
    }
    this._updateQueued = true;
    queueMicrotask(() => {
      this._updateQueued = false;
      this.update();
    });
  }

  update() {
    const count = Number(this.getAttribute("count")) || 0;
    const isActive = this.hasAttribute("is-active");
    const previousCount = this._count;
    const wasActive = this._isActive;
    this._count = count;
    this._isActive = isActive;

    if (!this._currentEl) {
      this._currentEl = document.createElement("span");
      this._currentEl.className = "animated-count-current";
      this.appendChild(this._currentEl);
    }

    const shouldRoll =
      previousCount !== null &&
      wasActive !== isActive &&
      formatLargeNumber(previousCount) !== formatLargeNumber(count) &&
      !prefersReducedMotion() &&
      typeof this._currentEl.animate === "function";

    this.cancelAnimations();
    this._currentEl.textContent = count > 0 ? formatLargeNumber(count) : "";

    if (shouldRoll) {
      this.roll(previousCount, count);
    }
    this.updateVisibility();
  }

  roll(previousCount, count) {
    const direction = count > previousCount ? "up" : "down";
    if (count > 0) {
      this._animations.push(
        this._currentEl.animate(
          enteringKeyframes(direction),
          ROLL_ANIMATION_OPTIONS,
        ),
      );
    }
    if (previousCount > 0) {
      this._previousEl = document.createElement("span");
      this._previousEl.className = "animated-count-previous";
      this._previousEl.setAttribute("aria-hidden", "true");
      this._previousEl.textContent = formatLargeNumber(previousCount);
      this.appendChild(this._previousEl);
      const exitAnimation = this._previousEl.animate(
        exitingKeyframes(direction),
        ROLL_ANIMATION_OPTIONS,
      );
      exitAnimation.addEventListener("finish", () => {
        this.removePreviousEl();
        this.updateVisibility();
      });
      this._animations.push(exitAnimation);
    }
  }

  cancelAnimations() {
    for (const animation of this._animations) {
      animation.cancel();
    }
    this._animations = [];
    this.removePreviousEl();
  }

  removePreviousEl() {
    this._previousEl?.remove();
    this._previousEl = null;
  }

  updateVisibility() {
    this.classList.toggle("is-empty", this._count === 0 && !this._previousEl);
  }
}

AnimatedCount.register();
