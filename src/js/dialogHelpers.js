import { isMobileViewport } from "/js/utils.js";

function hasExitMotion(element) {
  if (typeof element.getAnimations !== "function") return false;
  const styles = getComputedStyle(element);
  return [styles.animationDuration, styles.transitionDuration].some((value) =>
    (value ?? "")
      .split(",")
      .some((duration) => Number.parseFloat(duration) > 0),
  );
}

function waitForExitMotion(dialog) {
  if (!shouldAnimate(dialog)) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      dialog.removeEventListener("animationend", onMotionEnd);
      dialog.removeEventListener("transitionend", onMotionEnd);
      resolve();
    };
    const onMotionEnd = (event) => {
      if (event.target === dialog) finish();
    };
    const timeoutId = setTimeout(finish, 500);

    dialog.addEventListener("animationend", onMotionEnd);
    dialog.addEventListener("transitionend", onMotionEnd);
  });
}

function shouldAnimate(dialog) {
  return (
    !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches &&
    hasExitMotion(dialog)
  );
}

// Closes a dialog through its CSS exit animation: keeps it in the top layer
// until the animation finishes, then calls dialog.close()
export function closeWithAnimation(dialog) {
  if (!dialog.open || dialog.hasAttribute("data-closing")) {
    return Promise.resolve();
  }

  dialog.dataset.closing = "";
  dialog.inert = true;
  const finish = () => {
    if (dialog.open) dialog.close();
    dialog.removeAttribute("data-closing");
    dialog.inert = false;
  };
  if (!shouldAnimate(dialog)) {
    finish();
    return Promise.resolve();
  }
  return waitForExitMotion(dialog).then(finish);
}

export function enableDragToDismiss(
  target,
  {
    eventSource = target,
    confirmDismiss = () => true,
    onClose,
    allowUpwardStretch = false,
    ignoreTouchTarget = () => false,
    scrollContainer = null,
    disableWhenKeyboardOpen = false,
  } = {},
) {
  if (!isMobileViewport()) return null;

  if (target.__dragToDismiss) {
    target.__dragToDismiss.cleanup();
  }

  const DISMISS_THRESHOLD = 75;
  const RESISTANCE_FACTOR = 0.6;
  const SNAP_BACK_MS = 150;
  let caretRestoreTimer = null;

  const dragState = {
    startY: 0,
    currentY: 0,
    isDragging: false,
    initialHeight: 0,
    canDismiss: true,
  };

  // Detect keyboard open on mobile
  const KEYBOARD_THRESHOLD = 150;
  const viewport = window.visualViewport;
  const isKeyboardOpen = () =>
    disableWhenKeyboardOpen &&
    viewport &&
    window.innerHeight - viewport.height > KEYBOARD_THRESHOLD;

  const hasTextSelection = () => {
    const selection = document.getSelection();
    return selection !== null && !selection.isCollapsed;
  };

  const handleTouchStart = (e) => {
    if (isKeyboardOpen()) return;
    if (ignoreTouchTarget(e.target)) return;
    if (hasTextSelection()) return;

    clearTimeout(caretRestoreTimer);
    dragState.startY = e.touches[0].clientY;
    dragState.currentY = dragState.startY;
    dragState.isDragging = true;
    dragState.initialHeight = target.getBoundingClientRect().height;
    // Only allow a downward drag to dismiss when the scrollable body is already
    // at the top; otherwise this gesture belongs to the scroll area.
    dragState.canDismiss = !scrollContainer || scrollContainer.scrollTop <= 0;
    dragState.canStretch =
      allowUpwardStretch &&
      (!scrollContainer ||
        scrollContainer.scrollHeight <= scrollContainer.clientHeight);

    target.style.transition = "none";
  };

  const handleTouchMove = (e) => {
    if (!dragState.isDragging) return;

    // A selection that appears mid-gesture (long-press) switches to text selection.
    if (hasTextSelection()) {
      dragState.isDragging = false;
      target.style.transform = "";
      target.style.caretColor = "";
      return;
    }

    dragState.currentY = e.touches[0].clientY;
    const deltaY = dragState.currentY - dragState.startY;

    if (deltaY > 0 && dragState.canDismiss) {
      e.preventDefault();
      const adjustedDelta = deltaY * RESISTANCE_FACTOR;
      // Hide caret while dragging
      target.style.caretColor = "transparent";
      target.style.transform = `translateY(${adjustedDelta}px)`;
    } else if (deltaY < 0 && dragState.canStretch) {
      e.preventDefault();
      const adjustedDelta = Math.abs(deltaY) * (RESISTANCE_FACTOR * 0.5);
      target.style.height = `${dragState.initialHeight + adjustedDelta}px`;
    } else if (scrollContainer && deltaY !== 0) {
      dragState.isDragging = false;
      target.style.transform = "";
      target.style.caretColor = "";
    } else {
      e.preventDefault();
    }
  };

  const handleTouchEnd = async () => {
    if (!dragState.isDragging) return;

    const deltaY = dragState.currentY - dragState.startY;
    target.style.transition = allowUpwardStretch
      ? `transform ${SNAP_BACK_MS}ms ease-out, height ${SNAP_BACK_MS}ms ease-out`
      : `transform ${SNAP_BACK_MS}ms ease-out`;

    if (deltaY > DISMISS_THRESHOLD && (await confirmDismiss())) {
      target.style.transform = "translateY(100%)";
      onClose();
    } else {
      target.style.transform = "";
      if (dragState.canStretch) target.style.height = "";
      caretRestoreTimer = setTimeout(() => {
        target.style.caretColor = "";
      }, SNAP_BACK_MS);
    }

    dragState.isDragging = false;
  };

  eventSource.addEventListener("touchstart", handleTouchStart, {
    passive: false,
  });
  eventSource.addEventListener("touchmove", handleTouchMove, {
    passive: false,
  });
  eventSource.addEventListener("touchend", handleTouchEnd);

  dragState.cleanup = () => {
    clearTimeout(caretRestoreTimer);
    delete target.__dragToDismiss;
    eventSource.removeEventListener("touchstart", handleTouchStart);
    eventSource.removeEventListener("touchmove", handleTouchMove);
    eventSource.removeEventListener("touchend", handleTouchEnd);
    target.style.transform = "";
    target.style.transition = "";
    target.style.height = "";
    target.style.caretColor = "";
  };

  target.__dragToDismiss = dragState;

  return dragState;
}

// iOS Safari: dismissing the keyboard via the "Done" button leaves the
// dialog's inner scroll area offset, which makes buttons unclickable
// until the dialog is swiped or re-tapped. Reset scroll on text input blur.
export function resetScrollOnBlur(dialog, scrollArea) {
  dialog.addEventListener(
    "blur",
    (event) => {
      if (
        !event.target.matches?.('input, textarea, [contenteditable="true"]')
      ) {
        return;
      }
      if (scrollArea) scrollArea.scrollTop = 0;
      window.scrollTo(0, 0);
    },
    true,
  );
}
