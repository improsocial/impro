import { canHover } from "/js/utils.js";

// Delegated hover detection for any element inside `rootEl` that matches
// `selector`. Fires `onEnter(target)` when the pointer enters a matching
// element, `onLeave(target)` when it leaves.
export class HoverObserver {
  constructor(rootEl, { selector, onEnter, onLeave, ignore } = {}) {
    if (!rootEl || !selector) {
      throw new Error("HoverObserver requires rootEl and selector");
    }
    this.rootEl = rootEl;
    this.selector = selector;
    this.onEnter = onEnter;
    this.onLeave = onLeave;
    this.ignore = ignore ?? (() => false);
    this.currentTarget = null;

    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerOut = this._onPointerOut.bind(this);
    rootEl.addEventListener("pointermove", this._onPointerMove);
    rootEl.addEventListener("pointerout", this._onPointerOut);
  }

  dispose() {
    this.rootEl.removeEventListener("pointermove", this._onPointerMove);
    this.rootEl.removeEventListener("pointerout", this._onPointerOut);
    this._leaveCurrent();
  }

  // Force a leave. Consumers use this after their own external dismiss
  // signals (mouseup, route change) so a subsequent pointer move onto the
  // same target still fires a fresh enter.
  clear() {
    this._leaveCurrent();
  }

  _onPointerMove(event) {
    if (!canHover()) return;
    const target = event.target?.closest?.(this.selector);
    if (target && target === this.currentTarget) return;
    if (!target || this.ignore(target)) {
      if (this.currentTarget && !this.currentTarget.contains(event.target)) {
        this._leaveCurrent();
      }
      return;
    }
    if (this.currentTarget) this._leaveCurrent();
    this.currentTarget = target;
    this.onEnter?.(target);
  }

  _onPointerOut(event) {
    if (!this.currentTarget) return;
    const related = event.relatedTarget;
    if (related && this.currentTarget.contains(related)) return;
    this._leaveCurrent();
  }

  _leaveCurrent() {
    if (!this.currentTarget) return;
    const target = this.currentTarget;
    this.currentTarget = null;
    this.onLeave?.(target);
  }
}
