import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { HoverObserver } from "/js/hoverObserver.js";

// The observer bails when window.matchMedia("(hover: hover)").matches is false;
// JSDOM's matchMedia returns { matches: false } by default. Force true here.
let originalMatchMedia;
function stubHoverEnabled(enabled) {
  window.matchMedia = () => ({
    matches: enabled,
    media: "",
    addListener() {},
    removeListener() {},
  });
}

function dispatchMove(target, { relatedTarget } = {}) {
  target.dispatchEvent(
    new window.MouseEvent("pointermove", { bubbles: true, relatedTarget }),
  );
}
function dispatchOut(target, { relatedTarget } = {}) {
  target.dispatchEvent(
    new window.MouseEvent("pointerout", { bubbles: true, relatedTarget }),
  );
}

describe("HoverObserver", () => {
  let root;
  let a, b, other, inner;
  let onEnter, onLeave;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    stubHoverEnabled(true);
    document.body.innerHTML = "";
    root = document.createElement("div");
    a = document.createElement("a");
    a.className = "target";
    a.setAttribute("data-hover", "a");
    b = document.createElement("a");
    b.className = "target";
    b.setAttribute("data-hover", "b");
    other = document.createElement("div"); // non-target
    inner = document.createElement("span"); // child of a
    a.appendChild(inner);
    root.append(a, b, other);
    document.body.appendChild(root);
    onEnter = mock.fn();
    onLeave = mock.fn();
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  function makeObserver(overrides = {}) {
    return new HoverObserver(root, {
      selector: ".target",
      onEnter,
      onLeave,
      ...overrides,
    });
  }

  it("fires onEnter when pointer moves onto a matching target", () => {
    makeObserver();
    dispatchMove(a);
    assert.equal(onEnter.mock.callCount(), 1);
    assert.equal(onEnter.mock.calls[0].arguments[0], a);
  });

  it("matches the closest ancestor so child hovers count", () => {
    makeObserver();
    dispatchMove(inner);
    assert.equal(onEnter.mock.callCount(), 1);
    assert.equal(onEnter.mock.calls[0].arguments[0], a);
  });

  it("does not fire again while pointer stays inside the same target", () => {
    makeObserver();
    dispatchMove(a);
    dispatchMove(inner);
    dispatchMove(a);
    assert.equal(onEnter.mock.callCount(), 1);
    assert.equal(onLeave.mock.callCount(), 0);
  });

  it("fires leave(A) then enter(B) when moving directly A → B", () => {
    makeObserver();
    dispatchMove(a);
    dispatchMove(b);
    assert.deepEqual(
      onEnter.mock.calls.map((c) => c.arguments[0]),
      [a, b],
    );
    assert.deepEqual(
      onLeave.mock.calls.map((c) => c.arguments[0]),
      [a],
    );
  });

  it("fires onLeave when the pointer moves onto a non-target sibling", () => {
    makeObserver();
    dispatchMove(a);
    dispatchMove(other);
    assert.equal(onLeave.mock.callCount(), 1);
    assert.equal(onLeave.mock.calls[0].arguments[0], a);
  });

  it("fires onLeave on pointerout when relatedTarget is outside the target", () => {
    makeObserver();
    dispatchMove(a);
    dispatchOut(a, { relatedTarget: other });
    assert.equal(onLeave.mock.callCount(), 1);
  });

  it("ignores pointerout when relatedTarget is a child of the current target", () => {
    makeObserver();
    dispatchMove(a);
    dispatchOut(a, { relatedTarget: inner });
    assert.equal(onLeave.mock.callCount(), 0);
  });

  it("does nothing when canHover() reports false", () => {
    stubHoverEnabled(false);
    makeObserver();
    dispatchMove(a);
    assert.equal(onEnter.mock.callCount(), 0);
  });

  it("respects the ignore predicate", () => {
    const ignore = mock.fn((target) => target === b);
    makeObserver({ ignore });
    dispatchMove(a);
    dispatchMove(b);
    // Move to b was ignored → leave A fires, but no enter B.
    assert.deepEqual(
      onEnter.mock.calls.map((c) => c.arguments[0]),
      [a],
    );
    assert.equal(onLeave.mock.callCount(), 1);
  });

  it("dispose() removes listeners and fires leave for the current target", () => {
    const obs = makeObserver();
    dispatchMove(a);
    obs.dispose();
    assert.equal(onLeave.mock.callCount(), 1);
    // Further events do nothing.
    dispatchMove(b);
    assert.equal(onEnter.mock.callCount(), 1);
  });

  it("clear() fires leave without removing listeners", () => {
    const obs = makeObserver();
    dispatchMove(a);
    obs.clear();
    assert.equal(onLeave.mock.callCount(), 1);
    // A subsequent enter on the same target still fires.
    dispatchMove(a);
    assert.equal(onEnter.mock.callCount(), 2);
  });
});
