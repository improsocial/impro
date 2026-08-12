import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { pollIntervalMs, interruptibleWait } from "/js/pollCadence.js";

// jsdom's visibilityState is a prototype getter, so it is shadowed with an own
// property here and deleted afterwards rather than reassigned.
function setVisibility(state) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
}

function restoreVisibility() {
  delete document.visibilityState;
}

describe("pollIntervalMs", () => {
  afterEach(restoreVisibility);

  // The badge is on screen; nothing else is covering it.
  it("stays fast for a visible tab even with push enabled", () => {
    setVisibility("visible");
    assert.equal(pollIntervalMs({ pushEnabled: true }), 10_000);
  });

  // Push is not enabled, so this poll is the only thing that will ever notice.
  it("stays fast for a hidden tab without push", () => {
    setVisibility("hidden");
    assert.equal(pollIntervalMs({ pushEnabled: false }), 10_000);
  });

  // The only case where backing off costs the user nothing.
  it("backs off for a hidden tab with push enabled", () => {
    setVisibility("hidden");
    assert.ok(pollIntervalMs({ pushEnabled: true }) > 10_000);
  });

  it("defaults to the fast cadence when asked for nothing", () => {
    setVisibility("visible");
    assert.equal(pollIntervalMs(), 10_000);
  });
});

describe("interruptibleWait", () => {
  afterEach(restoreVisibility);

  it("resolves when the timer elapses", async () => {
    const started = Date.now();
    await interruptibleWait(10);
    assert.ok(Date.now() - started >= 5);
  });

  // The point of the whole mechanism: a backed-off hidden tab must not make
  // the badge stale at the moment the user looks at it.
  it("resolves early when the tab becomes visible", async () => {
    setVisibility("hidden");
    const started = Date.now();
    const waited = interruptibleWait(60_000);

    setVisibility("visible");
    document.dispatchEvent(new Event("visibilitychange"));

    await waited;
    assert.ok(
      Date.now() - started < 1000,
      "should not have waited out the full interval",
    );
  });

  it("only resolves once, even if visibility flaps", async () => {
    setVisibility("visible");
    const waited = interruptibleWait(10);
    document.dispatchEvent(new Event("visibilitychange"));
    document.dispatchEvent(new Event("visibilitychange"));
    await waited;
  });
});
