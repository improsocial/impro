import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { haptics } from "/js/haptics.js";
import { deviceState } from "/js/deviceState.js";

describe("haptics", () => {
  const IPHONE_USER_AGENT =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1";

  function setUserAgent(userAgent) {
    Object.defineProperty(window.navigator, "userAgent", {
      value: userAgent,
      configurable: true,
    });
  }

  afterEach(() => {
    delete window.navigator.vibrate;
    delete window.navigator.standalone;
    delete window.navigator.userAgent;
  });

  function getHapticSwitches() {
    return document.querySelectorAll('label input[type="checkbox"][switch]');
  }

  function removeHapticSwitches() {
    getHapticSwitches().forEach((input) => input.closest("label").remove());
  }

  describe("in a browser tab", () => {
    it("does not use the switch without navigator.vibrate", async () => {
      removeHapticSwitches();
      await haptics.impactMedium();
      assert.equal(getHapticSwitches().length, 0);
    });

    it("does not vibrate with navigator.vibrate", async () => {
      window.navigator.vibrate = mock.fn(() => true);
      await haptics.impactMedium();
      assert.equal(window.navigator.vibrate.mock.callCount(), 0);
    });
  });

  describe("in a non-iOS standalone PWA without navigator.vibrate", () => {
    it("does not use the switch", async () => {
      removeHapticSwitches();
      window.navigator.standalone = true;
      setUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15",
      );
      await haptics.impactMedium();
      assert.equal(getHapticSwitches().length, 0);
    });
  });

  describe("in an iOS standalone PWA without navigator.vibrate", () => {
    beforeEach(() => {
      window.navigator.standalone = true;
      setUserAgent(IPHONE_USER_AGENT);
    });

    it("toggles a hidden switch input", async () => {
      await haptics.impactMedium();
      const switches = getHapticSwitches();
      assert.equal(switches.length, 1);
      const checkedAfterFirst = switches[0].checked;
      await haptics.impactLight();
      assert.equal(switches[0].checked, !checkedAfterFirst);
    });

    it("reuses a single switch across calls", async () => {
      await haptics.impactMedium();
      await haptics.impactMedium();
      await haptics.impactLight();
      assert.equal(getHapticSwitches().length, 1);
    });

    it("re-mounts the switch if it was removed from the document", async () => {
      await haptics.impactMedium();
      getHapticSwitches()[0].closest("label").remove();
      await haptics.impactMedium();
      assert.equal(getHapticSwitches().length, 1);
    });

    it("does nothing when haptics are disabled in settings", async () => {
      removeHapticSwitches();
      deviceState.$hapticsDisabled.set(true);
      try {
        await haptics.impactMedium();
      } finally {
        deviceState.$hapticsDisabled.set(false);
      }
      assert.equal(getHapticSwitches().length, 0);
    });

    it("does not let the synthetic click bubble to the document", async () => {
      const onClick = mock.fn();
      document.addEventListener("click", onClick);
      try {
        await haptics.impactMedium();
      } finally {
        document.removeEventListener("click", onClick);
      }
      assert.equal(onClick.mock.callCount(), 0);
    });
  });

  describe("with navigator.vibrate", () => {
    it("uses vibrate instead of the switch in an iOS standalone PWA", async () => {
      removeHapticSwitches();
      window.navigator.standalone = true;
      setUserAgent(IPHONE_USER_AGENT);
      window.navigator.vibrate = mock.fn(() => true);
      await haptics.impactMedium();
      assert.equal(window.navigator.vibrate.mock.callCount(), 1);
      assert.equal(getHapticSwitches().length, 0);
    });
  });
});
