import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { haptics } from "/js/haptics.js";
import { deviceState } from "/js/deviceState.js";

describe("haptics", () => {
  beforeEach(() => {
    window.navigator.vibrate = mock.fn(() => true);
  });

  afterEach(() => {
    delete window.navigator.vibrate;
    delete window.navigator.standalone;
    deviceState.$hapticsDisabled.set(false);
  });

  describe("in a browser tab", () => {
    it("is not supported", () => {
      assert.equal(haptics.isSupported(), false);
    });

    it("does not vibrate", async () => {
      await haptics.impactMedium();
      assert.equal(window.navigator.vibrate.mock.callCount(), 0);
    });
  });

  describe("in a standalone PWA", () => {
    beforeEach(() => {
      window.navigator.standalone = true;
    });

    it("is supported", () => {
      assert.equal(haptics.isSupported(), true);
    });

    it("vibrates", async () => {
      await haptics.impactLight();
      await haptics.impactMedium();
      await haptics.impactHeavy();
      assert.equal(window.navigator.vibrate.mock.callCount(), 3);
    });

    it("does not vibrate when haptics are disabled in settings", async () => {
      deviceState.$hapticsDisabled.set(true);
      await haptics.impactMedium();
      assert.equal(window.navigator.vibrate.mock.callCount(), 0);
    });

    it("is not supported without navigator.vibrate", () => {
      delete window.navigator.vibrate;
      assert.equal(haptics.isSupported(), false);
    });
  });
});
