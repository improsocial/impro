import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  closeWithAnimation,
  enableDragToDismiss,
  resetScrollOnBlur,
} from "/js/dialogHelpers.js";
import { wait } from "/js/utils.js";

function pressEvent(
  type,
  { clientX = 0, clientY = 0, touch = false, button = 0 } = {},
) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  if (touch) {
    event.touches = [{ clientX, clientY }];
  } else {
    event.clientX = clientX;
    event.clientY = clientY;
    event.button = button;
  }
  return event;
}

describe("closeWithAnimation", () => {
  let dialog;

  beforeEach(() => {
    dialog = document.createElement("dialog");
    document.body.appendChild(dialog);
    dialog.showModal();
  });

  afterEach(() => {
    dialog.remove();
  });

  const stubExitAnimation = () => {
    const originalGetComputedStyle = globalThis.getComputedStyle;
    globalThis.getComputedStyle = () => ({
      animationDuration: "0.15s",
      transitionDuration: "0s",
    });
    Object.defineProperty(dialog, "getAnimations", { value: () => [] });
    return () => {
      globalThis.getComputedStyle = originalGetComputedStyle;
    };
  };

  it("returns a promise and closes when no exit animation runs", async () => {
    const closing = closeWithAnimation(dialog);

    assert(closing instanceof Promise);
    await closing;
    assert(!dialog.open);
    assert(!dialog.hasAttribute("data-closing"));
  });

  it("keeps a dialog open until its exit animation ends", async () => {
    const restore = stubExitAnimation();

    try {
      const closing = closeWithAnimation(dialog);
      assert(dialog.open);
      assert(dialog.hasAttribute("data-closing"));

      dialog.dispatchEvent(new Event("animationend"));
      await closing;
      assert(!dialog.open);
      assert(!dialog.hasAttribute("data-closing"));
    } finally {
      restore();
    }
  });

  it("fires the native close event (teardown hook)", async () => {
    let closeCount = 0;
    dialog.addEventListener("close", () => closeCount++);

    await closeWithAnimation(dialog);
    assert.deepEqual(closeCount, 1);
  });

  it("holds the close event until the exit animation ends", async () => {
    const restore = stubExitAnimation();
    let closeCount = 0;
    dialog.addEventListener("close", () => closeCount++);

    try {
      const closing = closeWithAnimation(dialog);
      assert.deepEqual(closeCount, 0);
      dialog.dispatchEvent(new Event("animationend"));
      await closing;
      assert.deepEqual(closeCount, 1);
    } finally {
      restore();
    }
  });

  it("leaves an in-flight dismissal alone on a repeat call", async () => {
    const restore = stubExitAnimation();

    try {
      const closing = closeWithAnimation(dialog);
      assert(dialog.hasAttribute("data-closing"));

      // A second call while data-closing is set must not close early or
      // start a second animation.
      await closeWithAnimation(dialog);
      assert(dialog.open);
      assert(dialog.hasAttribute("data-closing"));

      dialog.dispatchEvent(new Event("animationend"));
      await closing;
      assert(!dialog.open);
    } finally {
      restore();
    }
  });

  it("is a no-op on a dialog that is not open", async () => {
    dialog.close();
    let closeCount = 0;
    dialog.addEventListener("close", () => closeCount++);

    await closeWithAnimation(dialog);
    assert.deepEqual(closeCount, 0);
    assert(!dialog.hasAttribute("data-closing"));
  });

  it("does not touch the cancel event", () => {
    const cancelEvent = new Event("cancel", { cancelable: true });
    dialog.dispatchEvent(cancelEvent);

    assert(!cancelEvent.defaultPrevented);
    assert(dialog.open);
  });
});

describe("enableDragToDismiss", () => {
  let el;
  let closeCount;
  let dragState;
  let originalMatchMedia;
  let originalVisualViewport;

  const setKeyboardOpen = (open) => {
    window.visualViewport = {
      height: open ? window.innerHeight - 300 : window.innerHeight,
    };
  };

  const drag = async (deltaY) => {
    el.dispatchEvent(pressEvent("touchstart", { touch: true, clientY: 100 }));
    el.dispatchEvent(
      pressEvent("touchmove", { touch: true, clientY: 100 + deltaY }),
    );
    el.dispatchEvent(pressEvent("touchend", { touch: true }));
    await wait(0);
  };

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    window.matchMedia = (query) => ({
      matches: query === "(max-width: 799px)",
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    });
    originalVisualViewport = window.visualViewport;
    setKeyboardOpen(false);
    el = document.createElement("div");
    document.body.appendChild(el);
    closeCount = 0;
    dragState = null;
  });

  afterEach(() => {
    dragState?.cleanup();
    el.remove();
    window.matchMedia = originalMatchMedia;
    window.visualViewport = originalVisualViewport;
  });

  it("returns null on non-mobile viewports", () => {
    window.matchMedia = originalMatchMedia;
    dragState = enableDragToDismiss(el, { onClose: () => closeCount++ });
    assert.deepEqual(dragState, null);
  });

  it("dismisses on a downward drag past the threshold", async () => {
    dragState = enableDragToDismiss(el, { onClose: () => closeCount++ });
    await drag(150);
    assert.deepEqual(closeCount, 1);
  });

  it("does not dismiss on a drag below the threshold", async () => {
    dragState = enableDragToDismiss(el, { onClose: () => closeCount++ });
    await drag(50);
    assert.deepEqual(closeCount, 0);
  });

  it("dismisses while the keyboard is open by default", async () => {
    setKeyboardOpen(true);
    dragState = enableDragToDismiss(el, { onClose: () => closeCount++ });
    await drag(150);
    assert.deepEqual(closeCount, 1);
  });

  it("ignores drags while the keyboard is open when disableWhenKeyboardOpen is true", async () => {
    setKeyboardOpen(true);
    dragState = enableDragToDismiss(el, {
      onClose: () => closeCount++,
      disableWhenKeyboardOpen: true,
    });
    await drag(150);
    assert.deepEqual(closeCount, 0);
    assert.deepEqual(el.style.transform, "");
  });

  it("hides the caret while the sheet is displaced", () => {
    dragState = enableDragToDismiss(el, { onClose: () => closeCount++ });
    el.dispatchEvent(pressEvent("touchstart", { touch: true, clientY: 100 }));
    el.dispatchEvent(pressEvent("touchmove", { touch: true, clientY: 150 }));
    assert.deepEqual(el.style.caretColor, "transparent");
  });

  it("restores the caret only after the snap-back transition lands", async () => {
    dragState = enableDragToDismiss(el, { onClose: () => closeCount++ });
    await drag(50);
    assert.deepEqual(el.style.caretColor, "transparent");
    await wait(200);
    assert.deepEqual(el.style.caretColor, "");
  });

  it("keeps the caret hidden through a dismiss", async () => {
    dragState = enableDragToDismiss(el, { onClose: () => closeCount++ });
    await drag(150);
    assert.deepEqual(el.style.caretColor, "transparent");
  });

  it("restores the caret on cleanup", async () => {
    dragState = enableDragToDismiss(el, { onClose: () => closeCount++ });
    await drag(150);
    dragState.cleanup();
    assert.deepEqual(el.style.caretColor, "");
  });

  describe("with text selected", () => {
    beforeEach(() => {
      el.textContent = "some selectable text";
      const range = document.createRange();
      range.selectNodeContents(el);
      const selection = document.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    });

    afterEach(() => {
      document.getSelection().removeAllRanges();
    });

    it("ignores drags that start while text is selected", async () => {
      dragState = enableDragToDismiss(el, { onClose: () => closeCount++ });
      await drag(150);
      assert.deepEqual(closeCount, 0);
      assert.deepEqual(el.style.transform, "");
    });

    it("abandons a drag when a selection appears mid-gesture", async () => {
      dragState = enableDragToDismiss(el, { onClose: () => closeCount++ });
      document.getSelection().removeAllRanges();
      el.dispatchEvent(pressEvent("touchstart", { touch: true, clientY: 100 }));
      const range = document.createRange();
      range.selectNodeContents(el);
      document.getSelection().addRange(range);
      el.dispatchEvent(pressEvent("touchmove", { touch: true, clientY: 250 }));
      el.dispatchEvent(pressEvent("touchend", { touch: true }));
      await wait(0);
      assert.deepEqual(closeCount, 0);
      assert.deepEqual(el.style.transform, "");
    });
  });
});

describe("resetScrollOnBlur", () => {
  let dialog;
  let scrollArea;

  const blurFrom = (element) => {
    element.dispatchEvent(new window.FocusEvent("blur"));
  };

  beforeEach(() => {
    dialog = document.createElement("dialog");
    scrollArea = document.createElement("div");
    dialog.appendChild(scrollArea);
    document.body.appendChild(dialog);
    resetScrollOnBlur(dialog, scrollArea);
    scrollArea.scrollTop = 42;
  });

  afterEach(() => {
    dialog.remove();
  });

  it("resets the scroll area when a textarea blurs", () => {
    const textarea = document.createElement("textarea");
    scrollArea.appendChild(textarea);
    blurFrom(textarea);
    assert.deepEqual(scrollArea.scrollTop, 0);
  });

  it("resets the scroll area when an input blurs", () => {
    const input = document.createElement("input");
    scrollArea.appendChild(input);
    blurFrom(input);
    assert.deepEqual(scrollArea.scrollTop, 0);
  });

  it("resets the scroll area when a contenteditable element blurs", () => {
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    scrollArea.appendChild(editable);
    blurFrom(editable);
    assert.deepEqual(scrollArea.scrollTop, 0);
  });

  it("does not reset scroll when a button blurs", () => {
    const button = document.createElement("button");
    scrollArea.appendChild(button);
    blurFrom(button);
    assert.deepEqual(scrollArea.scrollTop, 42);
  });
});
