import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { closeWithAnimation, resetScrollOnBlur } from "/js/dialogHelpers.js";

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
