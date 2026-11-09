import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import "/js/components/animated-button.js";
import "/js/components/animated-count.js";

describe("animated-count", () => {
  let animations;
  let originalAnimate;
  let originalMatchMedia;

  function createFakeAnimation(element, keyframes) {
    const listeners = [];
    return {
      element,
      keyframes,
      cancel: mock.fn(),
      addEventListener: (name, listener) => {
        if (name === "finish") {
          listeners.push(listener);
        }
      },
      finish: () => {
        for (const listener of listeners) {
          listener();
        }
      },
    };
  }

  beforeEach(() => {
    document.body.innerHTML = "";
    animations = [];
    originalAnimate = window.HTMLElement.prototype.animate;
    window.HTMLElement.prototype.animate = function (keyframes) {
      const animation = createFakeAnimation(this, keyframes);
      animations.push(animation);
      return animation;
    };
    originalMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    window.HTMLElement.prototype.animate = originalAnimate;
    window.matchMedia = originalMatchMedia;
    document.body.innerHTML = "";
  });

  async function flush() {
    await Promise.resolve();
  }

  async function createCount({ count, isActive }) {
    const button = document.createElement("animated-button");
    const element = document.createElement("animated-count");
    element.setAttribute("count", String(count));
    element.toggleAttribute("is-active", isActive);
    button.appendChild(element);
    document.body.appendChild(button);
    await flush();
    return element;
  }

  async function setState(element, { count, isActive }) {
    element.setAttribute("count", String(count));
    element.toggleAttribute("is-active", isActive);
    await flush();
  }

  async function clickAndSetState(element, state) {
    element.closest("button").click();
    await setState(element, state);
  }

  function currentText(element) {
    return element.querySelector(".animated-count-current").textContent;
  }

  function previousEl(element) {
    return element.querySelector(".animated-count-previous");
  }

  it("renders the formatted count without animating", async () => {
    const element = await createCount({ count: 1234, isActive: false });
    assert.equal(currentText(element), "1.2K");
    assert.equal(previousEl(element), null);
    assert.equal(animations.length, 0);
  });

  it("is empty when the count is zero", async () => {
    const element = await createCount({ count: 0, isActive: false });
    assert.equal(currentText(element), "");
    assert(element.classList.contains("is-empty"));
  });

  it("rolls up when toggled on", async () => {
    const element = await createCount({ count: 5, isActive: false });
    await clickAndSetState(element, { count: 6, isActive: true });
    assert.equal(currentText(element), "6");
    assert.equal(previousEl(element).textContent, "5");
    assert.equal(previousEl(element).getAttribute("aria-hidden"), "true");
    assert.equal(animations.length, 2);
    const entering = animations.find(
      (animation) => animation.element === element.firstChild,
    );
    assert.equal(entering.keyframes[0].transform, "translateY(18px)");
  });

  it("rolls down when toggled off", async () => {
    const element = await createCount({ count: 6, isActive: true });
    await clickAndSetState(element, { count: 5, isActive: false });
    assert.equal(currentText(element), "5");
    assert.equal(previousEl(element).textContent, "6");
    const entering = animations.find(
      (animation) => animation.element === element.firstChild,
    );
    assert.equal(entering.keyframes[0].transform, "translateY(-18px)");
  });

  it("removes the previous count when the exit animation finishes", async () => {
    const element = await createCount({ count: 5, isActive: false });
    await clickAndSetState(element, { count: 6, isActive: true });
    const exiting = animations.find(
      (animation) => animation.element === previousEl(element),
    );
    exiting.finish();
    assert.equal(previousEl(element), null);
  });

  it("stays visible while rolling from 1 to 0, then empties", async () => {
    const element = await createCount({ count: 1, isActive: true });
    await clickAndSetState(element, { count: 0, isActive: false });
    assert.equal(currentText(element), "");
    assert.equal(previousEl(element).textContent, "1");
    assert(!element.classList.contains("is-empty"));
    assert.equal(animations.length, 1);
    animations[0].finish();
    assert(element.classList.contains("is-empty"));
  });

  it("only animates the entering count when rolling from 0 to 1", async () => {
    const element = await createCount({ count: 0, isActive: false });
    await clickAndSetState(element, { count: 1, isActive: true });
    assert.equal(currentText(element), "1");
    assert.equal(previousEl(element), null);
    assert.equal(animations.length, 1);
    assert(!element.classList.contains("is-empty"));
  });

  it("does not animate count changes without a toggle", async () => {
    const element = await createCount({ count: 5, isActive: false });
    await clickAndSetState(element, { count: 9, isActive: false });
    assert.equal(currentText(element), "9");
    assert.equal(animations.length, 0);
  });

  it("does not roll when toggled without a recent click", async () => {
    const element = await createCount({ count: 5, isActive: false });
    await setState(element, { count: 6, isActive: true });
    assert.equal(currentText(element), "6");
    assert.equal(previousEl(element), null);
    assert.equal(animations.length, 0);
  });

  it("warns and does not roll without a parent animated-button", async (t) => {
    const warn = t.mock.method(console, "warn", () => {});
    const element = document.createElement("animated-count");
    element.setAttribute("count", "5");
    document.body.appendChild(element);
    await flush();
    assert.equal(warn.mock.callCount(), 1);
    await setState(element, { count: 6, isActive: true });
    assert.equal(currentText(element), "6");
    assert.equal(animations.length, 0);
  });

  it("does not warn inside an animated-button", async (t) => {
    const warn = t.mock.method(console, "warn", () => {});
    await createCount({ count: 5, isActive: false });
    assert.equal(warn.mock.callCount(), 0);
  });

  it("does not roll when the formatted count is unchanged", async () => {
    const element = await createCount({ count: 1234, isActive: false });
    await clickAndSetState(element, { count: 1235, isActive: true });
    assert.equal(currentText(element), "1.2K");
    assert.equal(animations.length, 0);
  });

  it("does not roll when reduced motion is preferred", async () => {
    window.matchMedia = () => ({ matches: true });
    const element = await createCount({ count: 5, isActive: false });
    await clickAndSetState(element, { count: 6, isActive: true });
    assert.equal(currentText(element), "6");
    assert.equal(animations.length, 0);
  });

  it("cancels an in-flight roll when toggled again", async () => {
    const element = await createCount({ count: 5, isActive: false });
    await clickAndSetState(element, { count: 6, isActive: true });
    const firstAnimations = [...animations];
    await clickAndSetState(element, { count: 5, isActive: false });
    for (const animation of firstAnimations) {
      assert.equal(animation.cancel.mock.callCount(), 1);
    }
    assert.equal(
      element.querySelectorAll(".animated-count-previous").length,
      1,
    );
    assert.equal(previousEl(element).textContent, "6");
  });

  it("batches count and is-active changes into one update", async () => {
    const element = await createCount({ count: 5, isActive: false });
    element.closest("button").click();
    element.setAttribute("count", "6");
    element.toggleAttribute("is-active", true);
    await flush();
    assert.equal(animations.length, 2);
  });

  it("cancels animations when disconnected", async () => {
    const element = await createCount({ count: 5, isActive: false });
    await clickAndSetState(element, { count: 6, isActive: true });
    element.closest("animated-button").remove();
    for (const animation of animations) {
      assert.equal(animation.cancel.mock.callCount(), 1);
    }
  });
});
