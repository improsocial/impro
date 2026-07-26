import { isMobileViewport, prefersReducedMotion } from "/js/utils.js";

const VELOCITY_WINDOW_MS = 100;
const MIN_VELOCITY_SAMPLE_DT_MS = 15;
const ACTIVATION_THRESHOLD_PX = 8;

const KEYBOARD_HEIGHT_THRESHOLD_PX = 150;
function isKeyboardOpen() {
  const viewport = window.visualViewport;
  return (
    !!viewport &&
    window.innerHeight - viewport.height > KEYBOARD_HEIGHT_THRESHOLD_PX
  );
}

function hasTextSelection() {
  const selection = document.getSelection();
  return selection !== null && !selection.isCollapsed;
}

// Low-level touch drag tracker. Reports raw signed delta along the given axis.
function trackDrag(
  target,
  {
    axis = "y",
    eventSource = target,
    ignoreTouchTarget = () => false,
    scrollContainer = null,
    disableWhenKeyboardOpen = false,
    onStart = () => {},
    onMove = () => {},
    onEnd = () => {},
  } = {},
) {
  const primaryKey = axis === "y" ? "clientY" : "clientX";
  const otherKey = axis === "y" ? "clientX" : "clientY";

  const state = {
    tracking: false,
    locked: false,
    startPrimary: 0,
    startOther: 0,
    currentPrimary: 0,
    samples: [],
  };

  const primaryDelta = () => state.currentPrimary - state.startPrimary;

  const pushSample = (coord) => {
    const t = performance.now();
    state.samples.push({ coord, t });
    while (
      state.samples.length > 1 &&
      t - state.samples[0].t > VELOCITY_WINDOW_MS
    ) {
      state.samples.shift();
    }
  };

  const velocity = () => {
    if (state.samples.length < 2) return 0;
    const first = state.samples[0];
    const last = state.samples[state.samples.length - 1];
    const dt = last.t - first.t;
    if (dt < MIN_VELOCITY_SAMPLE_DT_MS) return 0;
    return (last.coord - first.coord) / dt;
  };

  const handleTouchStart = (e) => {
    if (disableWhenKeyboardOpen && isKeyboardOpen()) return;
    if (ignoreTouchTarget(e.target)) return;
    if (hasTextSelection()) return;
    if (scrollContainer && scrollContainer.scrollTop > 0) return;

    const touch = e.touches[0];
    state.tracking = true;
    state.locked = false;
    state.startPrimary = touch[primaryKey];
    state.startOther = touch[otherKey];
    state.currentPrimary = state.startPrimary;
    state.samples = [];
    pushSample(state.startPrimary);
  };

  const handleTouchMove = (e) => {
    if (!state.tracking) return;

    if (hasTextSelection()) {
      const wasLocked = state.locked;
      state.tracking = false;
      state.locked = false;
      if (wasLocked) onEnd({ deltaPx: 0, velocity: 0, cancelled: true });
      return;
    }

    const touch = e.touches[0];
    state.currentPrimary = touch[primaryKey];
    pushSample(state.currentPrimary);

    if (!state.locked) {
      const primary = primaryDelta();
      const other = touch[otherKey] - state.startOther;
      if (
        Math.abs(primary) < ACTIVATION_THRESHOLD_PX &&
        Math.abs(other) < ACTIVATION_THRESHOLD_PX
      ) {
        return;
      }
      if (Math.abs(primary) <= Math.abs(other)) {
        state.tracking = false;
        return;
      }
      state.locked = true;
      onStart();
    }

    const consumed = onMove(primaryDelta());
    // If the caller can't consume this move (e.g. dragging up on a
    // dismiss-down sheet with no stretch) and there's a scroll container,
    // release the gesture back to native scroll instead of preventing default.
    if (consumed === false && scrollContainer) {
      state.tracking = false;
      state.locked = false;
      onEnd({ deltaPx: 0, velocity: 0, cancelled: true });
      return;
    }
    e.preventDefault();
  };

  const handleTouchEnd = () => {
    if (!state.tracking) return;
    const wasLocked = state.locked;
    state.tracking = false;
    state.locked = false;
    if (!wasLocked) return;
    onEnd({
      deltaPx: primaryDelta(),
      velocity: velocity(),
      cancelled: false,
    });
  };

  eventSource.addEventListener("touchstart", handleTouchStart, {
    passive: false,
  });
  eventSource.addEventListener("touchmove", handleTouchMove, {
    passive: false,
  });
  eventSource.addEventListener("touchend", handleTouchEnd);
  eventSource.addEventListener("touchcancel", handleTouchEnd);

  return {
    cleanup() {
      eventSource.removeEventListener("touchstart", handleTouchStart);
      eventSource.removeEventListener("touchmove", handleTouchMove);
      eventSource.removeEventListener("touchend", handleTouchEnd);
      eventSource.removeEventListener("touchcancel", handleTouchEnd);
    },
  };
}

const DEFAULT_DISMISS_THRESHOLD_PX = 75;
const DEFAULT_FLICK_VELOCITY = 0.5;
const RESISTANCE_FACTOR = 0.6;
const SNAP_BACK_MS = 200;
const SNAP_BACK_EASING = "cubic-bezier(0.32, 0.72, 0, 1)";

const DIRECTION_TO_AXIS_SIGN = {
  down: { axis: "y", sign: 1 },
  up: { axis: "y", sign: -1 },
  right: { axis: "x", sign: 1 },
  left: { axis: "x", sign: -1 },
};

// Applies the standard swipe-to-dismiss policy on top of trackDrag: resistance
// during the drag, snap-back on release below threshold, exit translation past
// the distance threshold or on a flick.
export function enableDragToDismiss(
  target,
  {
    direction = "down",
    onDismiss,
    confirmDismiss = () => true,
    hideCaretDuringDrag = true,
    allowOppositeStretch = false,
    allowOppositeTranslate = false,
    scrollContainer = null,
    ignoreTouchTarget = () => false,
    disableWhenKeyboardOpen = false,
    eventSource = target,
    dismissThresholdPx = DEFAULT_DISMISS_THRESHOLD_PX,
    flickVelocity = DEFAULT_FLICK_VELOCITY,
    onDragStart = () => {},
    onDragEnd = () => {},
  } = {},
) {
  if (!isMobileViewport()) return null;

  if (target.__dragToDismiss) target.__dragToDismiss.cleanup();

  const { axis, sign } = DIRECTION_TO_AXIS_SIGN[direction];
  const transformFn = axis === "y" ? "translateY" : "translateX";
  const sizeProp = axis === "y" ? "height" : "width";
  const maxSizeProp = axis === "y" ? "maxHeight" : "maxWidth";
  let initialSize = 0;
  let caretRestoreTimer = null;

  const transitionDurationMs = () =>
    prefersReducedMotion() ? 0 : SNAP_BACK_MS;

  const snapBackTransition = () => {
    const ms = transitionDurationMs();
    const parts = [`transform ${ms}ms ${SNAP_BACK_EASING}`];
    if (allowOppositeStretch) {
      parts.push(`${sizeProp} ${ms}ms ${SNAP_BACK_EASING}`);
    }
    return parts.join(", ");
  };

  const clearInlineStyles = () => {
    target.style.transform = "";
    if (allowOppositeStretch) {
      target.style[sizeProp] = "";
      target.style[maxSizeProp] = "";
    }
  };

  const handle = trackDrag(target, {
    axis,
    eventSource,
    ignoreTouchTarget,
    scrollContainer,
    disableWhenKeyboardOpen,
    onStart: () => {
      clearTimeout(caretRestoreTimer);
      target.style.transition = "none";
      initialSize = target.getBoundingClientRect()[sizeProp];
      if (allowOppositeStretch) {
        // Pin the size inline before lifting the max, so the element doesn't
        // snap to its natural size for a frame when the CSS cap was clamping it.
        target.style[sizeProp] = `${initialSize}px`;
        target.style[maxSizeProp] = "none";
      }
      if (hideCaretDuringDrag) target.style.caretColor = "transparent";
      onDragStart();
    },
    onMove: (deltaPx) => {
      const progress = deltaPx * sign;
      if (progress >= 0) {
        target.style.transform = `${transformFn}(${deltaPx * RESISTANCE_FACTOR}px)`;
      } else if (allowOppositeStretch) {
        const stretched =
          initialSize + Math.abs(deltaPx) * RESISTANCE_FACTOR * 0.5;
        target.style[sizeProp] = `${stretched}px`;
      } else if (allowOppositeTranslate) {
        target.style.transform = `${transformFn}(${deltaPx * RESISTANCE_FACTOR * 0.5}px)`;
      } else {
        return false;
      }
    },
    onEnd: async ({ deltaPx, velocity, cancelled }) => {
      if (cancelled) {
        clearInlineStyles();
        if (hideCaretDuringDrag) target.style.caretColor = "";
        onDragEnd({ dismissed: false });
        return;
      }

      const progressPx = deltaPx * sign;
      const dismissVelocity = velocity * sign;
      const shouldDismiss =
        progressPx > 0 &&
        (progressPx > dismissThresholdPx || dismissVelocity > flickVelocity);

      if (shouldDismiss && (await confirmDismiss())) {
        // Use `all` so opacity/backdrop changes triggered by onDismiss
        // (e.g. a toast losing its .active class) fade in sync.
        target.style.transition = `all ${transitionDurationMs()}ms ${SNAP_BACK_EASING}`;
        target.style.transform = `${transformFn}(${sign * 100}%)`;
        onDragEnd({ dismissed: true });
        onDismiss();
      } else {
        target.style.transition = snapBackTransition();
        clearInlineStyles();
        if (hideCaretDuringDrag) {
          caretRestoreTimer = setTimeout(() => {
            target.style.caretColor = "";
          }, transitionDurationMs());
        }
        onDragEnd({ dismissed: false });
      }
    },
  });

  const cleanup = () => {
    clearTimeout(caretRestoreTimer);
    delete target.__dragToDismiss;
    handle.cleanup();
    target.style.transform = "";
    target.style.transition = "";
    target.style[sizeProp] = "";
    target.style[maxSizeProp] = "";
    target.style.caretColor = "";
  };

  target.__dragToDismiss = { cleanup };
  return { cleanup };
}
