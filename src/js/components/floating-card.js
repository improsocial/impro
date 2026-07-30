import { Component } from "/js/components/component.js";

// Position the card against an anchor rect: prefer below the anchor, flip
// above when it doesn't fit, clamp horizontally into the viewport, and
// return a max-height that keeps the card fully on-screen.
function computeAnchoredPosition(
  anchorRect,
  cardSize,
  viewportSize,
  { offset = 4, padding = 16 } = {},
) {
  const { width: viewportWidth, height: viewportHeight } = viewportSize;
  const { width: rawCardWidth, height: rawCardHeight } = cardSize;

  const maxWidth = Math.max(0, viewportWidth - padding * 2);
  const cardWidth = Math.min(rawCardWidth, maxWidth);

  const spaceBelow = viewportHeight - anchorRect.bottom - offset - padding;
  const spaceAbove = anchorRect.top - offset - padding;
  let placement;
  let maxHeight;
  if (rawCardHeight <= spaceBelow || spaceBelow >= spaceAbove) {
    placement = "bottom";
    maxHeight = Math.max(0, spaceBelow);
  } else {
    placement = "top";
    maxHeight = Math.max(0, spaceAbove);
  }
  const cardHeight = Math.min(rawCardHeight, maxHeight);

  let x = anchorRect.left;
  if (x + cardWidth > viewportWidth - padding) {
    x = viewportWidth - padding - cardWidth;
  }
  if (x < padding) x = padding;

  const y =
    placement === "bottom"
      ? anchorRect.bottom + offset
      : anchorRect.top - offset - cardHeight;

  return { x, y, maxWidth, maxHeight, placement };
}

export class FloatingCard extends Component {
  #anchorRect = null;
  #observer = null;
  #rafId = 0;

  connectedCallback() {
    if (this._initialized) return;
    this._initialized = true;
    this.setAttribute("popover", "manual");
    const s = this.style;
    s.position = "fixed";
    s.top = "0";
    s.left = "0";
    s.right = "auto";
    s.bottom = "auto";
    s.margin = "0";
    s.padding = "0";
    s.border = "none";
    s.background = "transparent";
    s.overflow = "visible";
    if (!s.width) s.width = "300px";
    s.height = "auto";
    this.dataset.state = "closed";
  }

  disconnectedCallback() {
    this.#stopObserving();
    if (this.#rafId) cancelAnimationFrame(this.#rafId);
    this.#rafId = 0;
  }

  get isOpen() {
    return this.matches(":popover-open");
  }

  open(anchorRect) {
    if (anchorRect) this.#anchorRect = anchorRect;
    if (!this.isOpen) {
      this.style.visibility = "hidden";
      this.showPopover();
      this.dataset.state = "open";
    }
    this.#startObserving();
    this.#scheduleReposition();
  }

  reposition(anchorRect) {
    if (anchorRect) this.#anchorRect = anchorRect;
    this.#scheduleReposition();
  }

  close() {
    this.#stopObserving();
    if (this.isOpen) this.hidePopover();
    this.dataset.state = "closed";
  }

  #scheduleReposition() {
    if (this.#rafId) return;
    this.#rafId = requestAnimationFrame(() => {
      this.#rafId = 0;
      if (!this.isOpen || !this.#anchorRect) return;
      const rect = this.getBoundingClientRect();
      const { x, y, maxWidth, maxHeight, placement } = computeAnchoredPosition(
        this.#anchorRect,
        {
          width: rect.width || parseFloat(this.style.width) || 300,
          height: rect.height || 200,
        },
        { width: window.innerWidth, height: window.innerHeight },
      );
      this.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      this.style.maxWidth = `${maxWidth}px`;
      this.style.maxHeight = `${maxHeight}px`;
      this.dataset.placement = placement;
      this.style.visibility = "";
    });
  }

  #startObserving() {
    if (this.#observer) return;
    this.#observer = new MutationObserver(() => this.#scheduleReposition());
    this.#observer.observe(this, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  #stopObserving() {
    this.#observer?.disconnect();
    this.#observer = null;
  }
}

FloatingCard.register();
