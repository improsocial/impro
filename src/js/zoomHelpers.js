import { prefersReducedMotion } from "/js/utils.js";

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_WINDOW_MS = 300;
const DOUBLE_TAP_DISTANCE_PX = 30;
const TAP_MAX_DURATION_MS = 300;
const TAP_MAX_MOVEMENT_PX = 10;
const WHEEL_ZOOM_SENSITIVITY = 0.01;
const SNAP_MS = 200;
const SNAP_EASING = "cubic-bezier(0.32, 0.72, 0, 1)";

function distanceBetween(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Enables pinch-to-zoom, pan-when-zoomed, double-tap/double-click-to-zoom,
// and ctrl+wheel/trackpad-pinch zoom on `img`. Call once per element (e.g.
// when a lightbox opens); call the returned cleanup() when it closes.
export function enablePinchZoom(
  img,
  {
    container = img.parentElement,
    minScale = MIN_SCALE,
    maxScale = MAX_SCALE,
    doubleTapScale = DOUBLE_TAP_SCALE,
  } = {},
) {
  if (img.__pinchZoomEnabled) {
    img.__pinchZoomEnabled.cleanup();
  }

  let scale = minScale;
  let translateX = 0;
  let translateY = 0;

  const pointers = new Map(); // pointerId -> {x, y}
  let hadMultiTouch = false;

  let pinchStartDistance = 0;
  let pinchStartScale = minScale;

  let isPanning = false;
  let panStartX = 0;
  let panStartY = 0;
  let panStartTranslateX = 0;
  let panStartTranslateY = 0;

  // Tracks the single point that started the current gesture, to
  // distinguish a tap (short, little movement) from a drag/pan.
  let tapPointerId = null;
  let tapDownX = 0;
  let tapDownY = 0;
  let tapDownTime = 0;

  let lastTapTime = 0;
  let lastTapX = 0;
  let lastTapY = 0;

  function setTransition(animate) {
    img.style.transition =
      animate && !prefersReducedMotion()
        ? `transform ${SNAP_MS}ms ${SNAP_EASING}`
        : "none";
  }

  function applyTransform() {
    img.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
  }

  function clampTranslate(candidateX, candidateY, atScale) {
    const rect = img.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    // rect already reflects the currently-committed scale, so scale the
    // rect's size by the ratio to atScale rather than reading a separate
    // "unscaled size" - avoids ever touching offsetWidth/offsetHeight.
    const ratio = atScale / scale;
    const maxOffsetX = Math.max(
      0,
      (rect.width * ratio - containerRect.width) / 2,
    );
    const maxOffsetY = Math.max(
      0,
      (rect.height * ratio - containerRect.height) / 2,
    );
    return {
      x: Math.max(-maxOffsetX, Math.min(maxOffsetX, candidateX)),
      y: Math.max(-maxOffsetY, Math.min(maxOffsetY, candidateY)),
    };
  }

  // Zooms to `targetScale`, keeping the screen point (pointX, pointY)
  // visually stationary.
  function zoomTo(targetScale, pointX, pointY, { animate = false } = {}) {
    const newScale = Math.max(minScale, Math.min(maxScale, targetScale));
    const rect = img.getBoundingClientRect();
    const baseCenterX = rect.left + rect.width / 2 - translateX;
    const baseCenterY = rect.top + rect.height / 2 - translateY;
    const ratio = newScale / scale;
    const dx = pointX - baseCenterX;
    const dy = pointY - baseCenterY;
    const candidateX = dx * (1 - ratio) + translateX * ratio;
    const candidateY = dy * (1 - ratio) + translateY * ratio;
    const clamped = clampTranslate(candidateX, candidateY, newScale);

    scale = newScale;
    translateX = clamped.x;
    translateY = clamped.y;
    setTransition(animate);
    applyTransform();
  }

  function toggleZoom(x, y) {
    const target = scale > minScale + 0.001 ? minScale : doubleTapScale;
    zoomTo(target, x, y, { animate: true });
  }

  function maybeHandleTap(event) {
    if (
      hadMultiTouch ||
      event.pointerType === "mouse" ||
      event.pointerId !== tapPointerId
    ) {
      return;
    }
    const duration = performance.now() - tapDownTime;
    const moved = Math.hypot(
      event.clientX - tapDownX,
      event.clientY - tapDownY,
    );
    if (duration > TAP_MAX_DURATION_MS || moved > TAP_MAX_MOVEMENT_PX) {
      return;
    }

    const now = performance.now();
    const isDoubleTap =
      now - lastTapTime < DOUBLE_TAP_WINDOW_MS &&
      distanceBetween(
        { x: event.clientX, y: event.clientY },
        { x: lastTapX, y: lastTapY },
      ) < DOUBLE_TAP_DISTANCE_PX;

    if (isDoubleTap) {
      lastTapTime = 0;
      toggleZoom(event.clientX, event.clientY);
    } else {
      lastTapTime = now;
      lastTapX = event.clientX;
      lastTapY = event.clientY;
    }
  }

  function onPointerDown(event) {
    if (event.button > 0) return;
    // Tie pointer events to the img, if possible
    try {
      img.setPointerCapture?.(event.pointerId);
    } catch {
      // ignore
    }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    setTransition(false);

    if (pointers.size === 1) {
      tapPointerId = event.pointerId;
      tapDownX = event.clientX;
      tapDownY = event.clientY;
      tapDownTime = performance.now();
      isPanning = scale > minScale;
      panStartX = event.clientX;
      panStartY = event.clientY;
      panStartTranslateX = translateX;
      panStartTranslateY = translateY;
    } else if (pointers.size === 2) {
      hadMultiTouch = true;
      isPanning = false;
      const [p1, p2] = pointers.values();
      pinchStartDistance = distanceBetween(p1, p2);
      pinchStartScale = scale;
    }
    event.preventDefault();
  }

  function onPointerMove(event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size === 2) {
      const [p1, p2] = pointers.values();
      const distance = distanceBetween(p1, p2);
      if (pinchStartDistance === 0) return;
      const targetScale = pinchStartScale * (distance / pinchStartDistance);
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      zoomTo(targetScale, midX, midY, { animate: false });
      return;
    }

    if (pointers.size === 1 && isPanning) {
      const candidateX = panStartTranslateX + (event.clientX - panStartX);
      const candidateY = panStartTranslateY + (event.clientY - panStartY);
      const clamped = clampTranslate(candidateX, candidateY, scale);
      translateX = clamped.x;
      translateY = clamped.y;
      applyTransform();
    }
  }

  function endPointer(event) {
    if (!pointers.has(event.pointerId)) return;
    try {
      img.releasePointerCapture?.(event.pointerId);
    } catch {
      // ignore - see the matching try/catch in onPointerDown
    }
    pointers.delete(event.pointerId);
    maybeHandleTap(event);

    if (pointers.size === 1) {
      // One finger remains after a pinch or a multi-touch mis-tap - rebase
      // panning from here so it continues smoothly instead of jumping.
      const [remaining] = pointers.values();
      isPanning = scale > minScale;
      panStartX = remaining.x;
      panStartY = remaining.y;
      panStartTranslateX = translateX;
      panStartTranslateY = translateY;
    } else if (pointers.size === 0) {
      hadMultiTouch = false;
      isPanning = false;
      tapPointerId = null;
    }
  }

  function onWheel(event) {
    if (!event.ctrlKey) return;
    event.preventDefault();
    const factor = Math.exp(-event.deltaY * WHEEL_ZOOM_SENSITIVITY);
    setTransition(false);
    zoomTo(scale * factor, event.clientX, event.clientY, { animate: false });
  }

  function onDoubleClick(event) {
    setTransition(true);
    toggleZoom(event.clientX, event.clientY);
  }

  img.addEventListener("pointerdown", onPointerDown);
  img.addEventListener("pointermove", onPointerMove);
  img.addEventListener("pointerup", endPointer);
  img.addEventListener("pointercancel", endPointer);
  img.addEventListener("wheel", onWheel, { passive: false });
  img.addEventListener("dblclick", onDoubleClick);

  const control = {
    cleanup() {
      img.removeEventListener("pointerdown", onPointerDown);
      img.removeEventListener("pointermove", onPointerMove);
      img.removeEventListener("pointerup", endPointer);
      img.removeEventListener("pointercancel", endPointer);
      img.removeEventListener("wheel", onWheel);
      img.removeEventListener("dblclick", onDoubleClick);
      img.style.transform = "";
      img.style.transition = "";
      delete img.__pinchZoomEnabled;
    },
    reset({ animate = false } = {}) {
      scale = minScale;
      translateX = 0;
      translateY = 0;
      setTransition(animate);
      applyTransform();
    },
    getState() {
      return { scale, translateX, translateY };
    },
  };

  img.__pinchZoomEnabled = control;
  return control;
}
