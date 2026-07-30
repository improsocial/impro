import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { enableDragToDismiss } from "/js/dragHelpers.js";
import { wait } from "/js/utils.js";
function touchEvent(type, { clientX = 0, clientY = 0 } = {}) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  event.touches = [{ clientX, clientY }];
  return event;
}
describe("enableDragToDismiss", () => {
  let el;
  let closeCount;
  let handle;
  let originalMatchMedia;
  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    window.matchMedia = (query) => ({
      matches: query === "(max-width: 799px)",
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    });
    el = document.createElement("div");
    document.body.appendChild(el);
    closeCount = 0;
    handle = null;
  });
  afterEach(() => {
    handle?.cleanup();
    el.remove();
    window.matchMedia = originalMatchMedia;
  });
  const dragTouch = async (path) => {
    const [start, ...rest] = path;
    el.dispatchEvent(touchEvent("touchstart", start));
    for (const point of rest) {
      el.dispatchEvent(touchEvent("touchmove", point));
      if (point.pause) await wait(point.pause);
    }
    el.dispatchEvent(touchEvent("touchend"));
    await wait(0);
  };
  describe("direction: up (toast-like)", () => {
    beforeEach(() => {
      handle = enableDragToDismiss(el, {
        direction: "up",
        onDismiss: () => closeCount++,
      });
    });
    it("dismisses on an upward drag past the threshold", async () => {
      await dragTouch([{ clientY: 200 }, { clientY: 50 }]);
      assert.equal(closeCount, 1);
    });
    it("ignores a downward drag", async () => {
      await dragTouch([{ clientY: 100 }, { clientY: 250 }]);
      assert.equal(closeCount, 0);
    });
    it("exits with an upward translate", async () => {
      await dragTouch([{ clientY: 200 }, { clientY: 50 }]);
      assert.match(el.style.transform, /translateY\(-100%\)/);
    });
  });
  describe("allowOppositeTranslate", () => {
    it("translates in the opposite direction without changing height", () => {
      handle = enableDragToDismiss(el, {
        direction: "up",
        onDismiss: () => closeCount++,
        allowOppositeTranslate: true,
      });
      el.dispatchEvent(touchEvent("touchstart", { clientY: 100 }));
      el.dispatchEvent(touchEvent("touchmove", { clientY: 160 }));
      // direction "up" + 60px down finger movement → opposite translate 18px down
      assert.match(el.style.transform, /translateY\(18px\)/);
      assert.equal(el.style.height, "");
    });
    it("still dismisses on a drag in the dismiss direction", async () => {
      handle = enableDragToDismiss(el, {
        direction: "up",
        onDismiss: () => closeCount++,
        allowOppositeTranslate: true,
      });
      await dragTouch([{ clientY: 200 }, { clientY: 50 }]);
      assert.equal(closeCount, 1);
    });
    it("snaps back to the origin on release", async () => {
      handle = enableDragToDismiss(el, {
        direction: "up",
        onDismiss: () => closeCount++,
        allowOppositeTranslate: true,
      });
      await dragTouch([{ clientY: 100 }, { clientY: 160 }]);
      assert.equal(el.style.transform, "");
    });
  });
  describe("direction: left (sidebar-like)", () => {
    beforeEach(() => {
      handle = enableDragToDismiss(el, {
        direction: "left",
        onDismiss: () => closeCount++,
      });
    });
    it("dismisses on a leftward drag past the threshold", async () => {
      await dragTouch([{ clientX: 200 }, { clientX: 50 }]);
      assert.equal(closeCount, 1);
    });
    it("ignores a rightward drag", async () => {
      await dragTouch([{ clientX: 50 }, { clientX: 200 }]);
      assert.equal(closeCount, 0);
    });
    it("exits with a leftward translate", async () => {
      await dragTouch([{ clientX: 200 }, { clientX: 50 }]);
      assert.match(el.style.transform, /translateX\(-100%\)/);
    });
    it("does not lock onto a mostly-vertical drag", async () => {
      // 5px left, 40px down — vertical dominates
      await dragTouch([
        { clientX: 100, clientY: 100 },
        { clientX: 95, clientY: 140 },
      ]);
      assert.equal(closeCount, 0);
      // Never locked → no inline transform ever applied
      assert.equal(el.style.transform, "");
    });
  });
  describe("flick velocity", () => {
    it("dismisses on a fast flick shorter than the distance threshold", async () => {
      handle = enableDragToDismiss(el, {
        direction: "down",
        onDismiss: () => closeCount++,
      });
      // 40px in ~20ms → 2 px/ms, well above the 0.5 px/ms flick threshold.
      el.dispatchEvent(touchEvent("touchstart", { clientY: 0 }));
      el.dispatchEvent(touchEvent("touchmove", { clientY: 20 }));
      await wait(25);
      el.dispatchEvent(touchEvent("touchmove", { clientY: 40 }));
      el.dispatchEvent(touchEvent("touchend"));
      await wait(0);
      assert.equal(closeCount, 1);
    });
    it("does not dismiss when the flick moves in the opposite direction", async () => {
      handle = enableDragToDismiss(el, {
        direction: "down",
        onDismiss: () => closeCount++,
      });
      // Fast upward flick when dismiss direction is down.
      el.dispatchEvent(touchEvent("touchstart", { clientY: 100 }));
      el.dispatchEvent(touchEvent("touchmove", { clientY: 80 }));
      await wait(25);
      el.dispatchEvent(touchEvent("touchmove", { clientY: 60 }));
      el.dispatchEvent(touchEvent("touchend"));
      await wait(0);
      assert.equal(closeCount, 0);
    });
  });
  it("releases the gesture to native scroll on opposite-direction drags with a scroll container", async () => {
    const scrollContainer = document.createElement("div");
    el.appendChild(scrollContainer);
    const events = [];
    const recordDefault = (e) => events.push(e.defaultPrevented);
    el.addEventListener("touchmove", recordDefault);
    handle = enableDragToDismiss(el, {
      direction: "down",
      onDismiss: () => closeCount++,
      scrollContainer,
    });
    el.dispatchEvent(touchEvent("touchstart", { clientY: 100 }));
    el.dispatchEvent(touchEvent("touchmove", { clientY: 80 }));
    el.dispatchEvent(touchEvent("touchend"));
    await wait(0);
    el.removeEventListener("touchmove", recordDefault);
    assert.equal(closeCount, 0);
    assert.deepEqual(events, [false]);
    assert.equal(el.style.transform, "");
  });
  it("does not dismiss when a drag starts inside a scrolled container", async () => {
    const scrollContainer = document.createElement("div");
    scrollContainer.scrollTop = 100;
    el.appendChild(scrollContainer);
    handle = enableDragToDismiss(el, {
      direction: "down",
      onDismiss: () => closeCount++,
      scrollContainer,
    });
    scrollContainer.dispatchEvent(touchEvent("touchstart", { clientY: 100 }));
    el.dispatchEvent(touchEvent("touchmove", { clientY: 250 }));
    el.dispatchEvent(touchEvent("touchend"));
    await wait(0);
    assert.equal(closeCount, 0);
  });
  it("allows dismissing from outside a scrolled container", async () => {
    const scrollContainer = document.createElement("div");
    scrollContainer.scrollTop = 100;
    el.appendChild(scrollContainer);
    handle = enableDragToDismiss(el, {
      direction: "down",
      onDismiss: () => closeCount++,
      scrollContainer,
    });
    await dragTouch([{ clientY: 100 }, { clientY: 250 }]);
    assert.equal(closeCount, 1);
  });
  describe("default direction (down)", () => {
    let originalVisualViewport;
    const setKeyboardOpen = (open) => {
      window.visualViewport = {
        height: open ? window.innerHeight - 300 : window.innerHeight,
      };
    };
    const drag = async (deltaY) => {
      el.dispatchEvent(touchEvent("touchstart", { clientY: 100 }));
      el.dispatchEvent(touchEvent("touchmove", { clientY: 100 + deltaY }));
      el.dispatchEvent(touchEvent("touchend"));
      await wait(0);
    };
    beforeEach(() => {
      originalVisualViewport = window.visualViewport;
      setKeyboardOpen(false);
    });
    afterEach(() => {
      window.visualViewport = originalVisualViewport;
    });
    it("returns null on non-mobile viewports", () => {
      window.matchMedia = originalMatchMedia;
      handle = enableDragToDismiss(el, { onDismiss: () => closeCount++ });
      assert.deepEqual(handle, null);
    });
    it("dismisses on a downward drag past the threshold", async () => {
      handle = enableDragToDismiss(el, { onDismiss: () => closeCount++ });
      await drag(150);
      assert.deepEqual(closeCount, 1);
    });
    it("does not dismiss on a drag below the threshold", async () => {
      handle = enableDragToDismiss(el, { onDismiss: () => closeCount++ });
      await drag(50);
      assert.deepEqual(closeCount, 0);
    });
    it("dismisses while the keyboard is open by default", async () => {
      setKeyboardOpen(true);
      handle = enableDragToDismiss(el, { onDismiss: () => closeCount++ });
      await drag(150);
      assert.deepEqual(closeCount, 1);
    });
    it("ignores drags while the keyboard is open when disableWhenKeyboardOpen is true", async () => {
      setKeyboardOpen(true);
      handle = enableDragToDismiss(el, {
        onDismiss: () => closeCount++,
        disableWhenKeyboardOpen: true,
      });
      await drag(150);
      assert.deepEqual(closeCount, 0);
      assert.deepEqual(el.style.transform, "");
    });
    it("hides the caret while the sheet is displaced", () => {
      handle = enableDragToDismiss(el, { onDismiss: () => closeCount++ });
      el.dispatchEvent(touchEvent("touchstart", { clientY: 100 }));
      el.dispatchEvent(touchEvent("touchmove", { clientY: 150 }));
      assert.deepEqual(el.style.caretColor, "transparent");
    });
    it("restores the caret only after the snap-back transition lands", (t) => {
      t.mock.timers.enable({ apis: ["setTimeout"] });
      handle = enableDragToDismiss(el, { onDismiss: () => closeCount++ });
      el.dispatchEvent(touchEvent("touchstart", { clientY: 100 }));
      el.dispatchEvent(touchEvent("touchmove", { clientY: 150 }));
      el.dispatchEvent(touchEvent("touchend"));
      assert.deepEqual(el.style.caretColor, "transparent");
      t.mock.timers.tick(300);
      assert.deepEqual(el.style.caretColor, "");
    });
    it("keeps the caret hidden through a dismiss", async () => {
      handle = enableDragToDismiss(el, { onDismiss: () => closeCount++ });
      await drag(150);
      assert.deepEqual(el.style.caretColor, "transparent");
    });
    it("restores the caret on cleanup", async () => {
      handle = enableDragToDismiss(el, { onDismiss: () => closeCount++ });
      await drag(150);
      handle.cleanup();
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
        handle = enableDragToDismiss(el, { onDismiss: () => closeCount++ });
        await drag(150);
        assert.deepEqual(closeCount, 0);
        assert.deepEqual(el.style.transform, "");
      });
      it("abandons a drag when a selection appears mid-gesture", async () => {
        handle = enableDragToDismiss(el, { onDismiss: () => closeCount++ });
        document.getSelection().removeAllRanges();
        el.dispatchEvent(touchEvent("touchstart", { clientY: 100 }));
        const range = document.createRange();
        range.selectNodeContents(el);
        document.getSelection().addRange(range);
        el.dispatchEvent(touchEvent("touchmove", { clientY: 250 }));
        el.dispatchEvent(touchEvent("touchend"));
        await wait(0);
        assert.deepEqual(closeCount, 0);
        assert.deepEqual(el.style.transform, "");
      });
    });
  });
});
