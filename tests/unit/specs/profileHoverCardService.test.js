import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import {
  ProfileHoverCardService,
  SHOW_DELAY,
  HIDE_DELAY,
} from "/js/profileHoverCardService.js";

function makeService() {
  const dataLayer = {
    derived: {
      $hydratedDetailedProfiles: { get: () => null },
      $hydratedProfiles: { get: () => null },
      $currentUser: { get: () => null },
    },
    declarative: { ensureDetailedProfile: () => Promise.resolve() },
    patchStore: { $profilePatches: { get: () => [] } },
  };
  const service = new ProfileHoverCardService(dataLayer, {});
  return service;
}

function makeTarget(did = "did:plc:test") {
  const el = document.createElement("a");
  el.setAttribute("data-hover-did", did);
  el.getBoundingClientRect = () => ({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    width: 0,
    height: 0,
  });
  return el;
}

describe("ProfileHoverCardService state", () => {
  let target;
  beforeEach(() => {
    mock.timers.enable({ apis: ["setTimeout"] });
    target = makeTarget();
  });
  afterEach(() => {
    mock.timers.reset();
  });

  it("starts hidden", () => {
    const svc = makeService();
    assert.equal(svc.$viewState.get(), "hidden");
  });

  it("target hover moves hidden → might-show → showing after dwell", () => {
    const svc = makeService();
    svc.onHoverTargetEnter(target);
    assert.equal(svc.$viewState.get(), "might-show");
    mock.timers.tick(SHOW_DELAY);
    assert.equal(svc.$viewState.get(), "showing");
  });

  it("target leave during might-show cancels the timer and hides", () => {
    const svc = makeService();
    svc.onHoverTargetEnter(target);
    svc.onHoverTargetLeave();
    assert.equal(svc.$viewState.get(), "hidden");
    // Timer must not fire after cancellation.
    mock.timers.tick(SHOW_DELAY);
    assert.equal(svc.$viewState.get(), "hidden");
  });

  it("target leave from showing enters grace, then hides after delay", () => {
    const svc = makeService();
    svc.onHoverTargetEnter(target);
    mock.timers.tick(SHOW_DELAY);
    svc.onHoverTargetLeave();
    assert.equal(svc.$viewState.get(), "might-hide");
    mock.timers.tick(HIDE_DELAY);
    assert.equal(svc.$viewState.get(), "hidden");
  });

  it("card hover during grace returns to showing", () => {
    const svc = makeService();
    svc.onHoverTargetEnter(target);
    mock.timers.tick(SHOW_DELAY);
    svc.onHoverTargetLeave();
    svc.onCardPointerEnter();
    assert.equal(svc.$viewState.get(), "showing");
    // Grace timer was cleared — even after HIDE_DELAY we're still showing.
    mock.timers.tick(HIDE_DELAY);
    assert.equal(svc.$viewState.get(), "showing");
  });

  it("card leave from showing enters grace", () => {
    const svc = makeService();
    svc.onHoverTargetEnter(target);
    mock.timers.tick(SHOW_DELAY);
    svc.onCardPointerLeave();
    assert.equal(svc.$viewState.get(), "might-hide");
  });

  it("repeated target enter does not restart the dwell timer", () => {
    const svc = makeService();
    svc.onHoverTargetEnter(target);
    mock.timers.tick(SHOW_DELAY - 10);
    svc.onHoverTargetEnter(target); // must not reset the 500ms clock
    mock.timers.tick(10);
    assert.equal(svc.$viewState.get(), "showing");
  });

  it("re-entering the same target during hide grace keeps the card open", () => {
    const svc = makeService();
    svc.onHoverTargetEnter(target);
    mock.timers.tick(SHOW_DELAY);
    svc.onHoverTargetLeave();
    svc.onHoverTargetEnter(target);
    assert.equal(svc.$viewState.get(), "showing");
  });

  it("entering a different target for the same profile starts a fresh dwell", () => {
    const svc = makeService();
    svc.onHoverTargetEnter(target);
    mock.timers.tick(SHOW_DELAY);
    svc.onHoverTargetLeave();

    svc.onHoverTargetEnter(makeTarget(target.dataset.hoverDid));
    assert.equal(svc.$viewState.get(), "might-show");

    mock.timers.tick(SHOW_DELAY - 1);
    assert.equal(svc.$viewState.get(), "might-show");
    mock.timers.tick(1);
    assert.equal(svc.$viewState.get(), "showing");
  });

  it("entering a different profile closes and starts a fresh dwell", () => {
    const svc = makeService();
    svc.onHoverTargetEnter(target);
    mock.timers.tick(SHOW_DELAY);
    svc.onHoverTargetLeave();

    const nextTarget = makeTarget("did:plc:next");
    svc.onHoverTargetEnter(nextTarget);
    assert.equal(svc.$viewState.get(), "might-show");
    assert.equal(svc.$currentDid.get(), "did:plc:next");

    mock.timers.tick(SHOW_DELAY - 1);
    assert.equal(svc.$viewState.get(), "might-show");
    mock.timers.tick(1);
    assert.equal(svc.$viewState.get(), "showing");
  });

  it("repeated target leave during grace does not restart the timer", () => {
    const svc = makeService();
    svc.onHoverTargetEnter(target);
    mock.timers.tick(SHOW_DELAY);
    svc.onHoverTargetLeave();
    mock.timers.tick(HIDE_DELAY - 10);
    svc.onHoverTargetLeave(); // no-op
    mock.timers.tick(10);
    assert.equal(svc.$viewState.get(), "hidden");
  });

  it("dismiss() jumps straight to hidden and clears currentTarget", () => {
    const svc = makeService();
    svc.onHoverTargetEnter(target);
    mock.timers.tick(SHOW_DELAY);
    svc.dismiss();
    assert.equal(svc.$viewState.get(), "hidden");
    assert.equal(svc.$currentTarget.get(), null);
    assert.equal(svc.$currentDid.get(), null);
  });
});
