import { prefersReducedMotion } from "/js/utils.js";

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
      if (event.target === event.currentTarget) finish();
    };
    const timeoutId = setTimeout(finish, 400);

    dialog.addEventListener("animationend", onMotionEnd);
    dialog.addEventListener("transitionend", onMotionEnd);
  });
}

function shouldAnimate(dialog) {
  return !prefersReducedMotion() && hasExitMotion(dialog);
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
