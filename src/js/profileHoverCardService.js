import { Signal, effect } from "/js/signals.js";
import { HoverObserver } from "/js/hoverObserver.js";
import "/js/components/profile-hover-card.js";

export const SHOW_DELAY = 500;
export const HIDE_DELAY = 150;
export const HOVER_ELEMENT_SELECTOR = "[data-hover-did]";

export class ProfileHoverCardService {
  constructor(dataLayer, interactionHandlers) {
    this.dataLayer = dataLayer;
    this.interactionHandlers = interactionHandlers;

    // "hidden" | "might-show" | "showing" | "might-hide"
    this.$viewState = new Signal.State("hidden");
    this.$currentTarget = new Signal.State(null);
    this.$currentDid = new Signal.State(null);
    this.transitionTimerId = 0;
    this.cardEl = null;
    this.disposeRenderEffect = null;
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onPageTransition = this.onPageTransition.bind(this);
    this.hoverObserver = null;
    this.installed = false;
  }

  install(rootEl) {
    if (this.installed) return;
    this.installed = true;
    this.rootEl = rootEl;
    this.hoverObserver = new HoverObserver(rootEl, {
      selector: HOVER_ELEMENT_SELECTOR,
      ignore: (target) => !!target.closest("dialog, [popover]"),
      onEnter: (target) => this.onHoverTargetEnter(target),
      onLeave: () => this.onHoverTargetLeave(),
    });
    rootEl.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("page-transition", this.onPageTransition);

    this.disposeRenderEffect = effect(() => {
      const viewState = this.$viewState.get();
      const target = this.$currentTarget.get();
      const did = this.$currentDid.get();
      if (
        (viewState !== "showing" && viewState !== "might-hide") ||
        !target ||
        !did
      ) {
        this.cardEl?.close();
        return;
      }
      this.ensureCardEl();
      this.cardEl.did = did;
      this.cardEl.open(target.getBoundingClientRect());
    });
  }

  dispose() {
    if (!this.installed) return;
    this.installed = false;
    this.hoverObserver?.disconnect();
    this.hoverObserver = null;
    this.rootEl.removeEventListener("mouseup", this.onMouseUp);
    window.removeEventListener("page-transition", this.onPageTransition);
    this.setViewState("hidden");
    this.disposeRenderEffect?.();
    this.disposeRenderEffect = null;
    this.cardEl?.remove();
    this.cardEl = null;
  }

  // The only writer to $viewState. Clears any pending auto-advance timer and
  // schedules the next one when moving into a might-* state.
  setViewState(next) {
    if (this.$viewState.get() === next) return;
    if (this.transitionTimerId) {
      clearTimeout(this.transitionTimerId);
      this.transitionTimerId = 0;
    }
    this.$viewState.set(next);
    if (next === "might-show") {
      this.transitionTimerId = setTimeout(
        () => this.setViewState("showing"),
        SHOW_DELAY,
      );
    } else if (next === "might-hide") {
      this.transitionTimerId = setTimeout(() => {
        this.setViewState("hidden");
        this.$currentTarget.set(null);
        this.$currentDid.set(null);
      }, HIDE_DELAY);
    }
  }

  onHoverTargetEnter(target) {
    const did = target.getAttribute("data-hover-did");
    if (!did) return;
    const currentTarget = this.$currentTarget.get();
    const currentDid = this.$currentDid.get();
    const targetChanged = currentTarget !== target;
    const didChanged = currentDid !== did;
    if (targetChanged && currentTarget) {
      this.setViewState("hidden");
    }
    this.$currentTarget.set(target);
    if (didChanged) {
      this.$currentDid.set(did);
      this.prefetch(did);
    }
    const viewState = this.$viewState.get();
    if (viewState === "hidden") this.setViewState("might-show");
    else if (viewState === "might-hide") this.setViewState("showing");
  }

  onHoverTargetLeave() {
    const viewState = this.$viewState.get();
    if (viewState === "might-show") this.setViewState("hidden");
    else if (viewState === "showing") this.setViewState("might-hide");
    // In "might-hide" the grace timer is running — leaving again is a no-op.
    if (this.$viewState.get() === "hidden") {
      this.$currentTarget.set(null);
      this.$currentDid.set(null);
    }
  }

  onMouseUp(event) {
    if (event.target?.closest?.(HOVER_ELEMENT_SELECTOR)) {
      this.dismiss();
    }
  }

  onPageTransition() {
    this.dismiss();
  }

  onCardPointerEnter() {
    if (this.$viewState.get() === "might-hide") this.setViewState("showing");
  }

  onCardPointerLeave() {
    if (this.$viewState.get() === "showing") this.setViewState("might-hide");
  }

  dismiss() {
    this.setViewState("hidden");
    this.$currentTarget.set(null);
    this.$currentDid.set(null);
    this.hoverObserver?.clear();
  }

  prefetch(did) {
    if (this.dataLayer.derived.$hydratedDetailedProfiles.get(did)) return;
    this.dataLayer.declarative.ensureDetailedProfile(did).catch(() => {
      /* the card renders a degraded view or nothing */
    });
  }

  ensureCardEl() {
    if (this.cardEl) return;
    const cardEl = document.createElement("profile-hover-card");
    cardEl.dataLayer = this.dataLayer;
    cardEl.interactionHandlers = this.interactionHandlers;
    cardEl.addEventListener("pointerenter", () => this.onCardPointerEnter());
    cardEl.addEventListener("pointerleave", () => this.onCardPointerLeave());
    // Any click inside the card dismisses (follow button opts out via
    // stopPropagation on the button itself).
    cardEl.addEventListener("mouseup", () => this.dismiss());
    document.body.appendChild(cardEl);
    this.cardEl = cardEl;
  }
}
