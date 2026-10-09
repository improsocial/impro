import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { Signal } from "/js/signals.js";
import { AppBadgeService } from "/js/appBadgeService.js";

function createMockNotificationService({ numNotifications = 0 } = {}) {
  return {
    $numNotifications: new Signal.State(numNotifications),
  };
}

function createMockPushNotificationService({ enabled = false } = {}) {
  return {
    $enabled: new Signal.State(enabled),
    get isEnabled() {
      return this.$enabled.get();
    },
  };
}

function flushEffects() {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve)),
  );
}

describe("AppBadgeService", () => {
  let badgeCalls;
  let displayedNotifications;
  let originalMatchMedia;
  let disposers;

  function simulateTouchOnlyDevice() {
    window.matchMedia = (query) => ({
      matches: query === "(hover: none) and (pointer: coarse)",
      addEventListener: () => {},
      removeEventListener: () => {},
    });
  }

  function startSync(
    notificationService,
    chatNotificationService,
    pushNotificationService = createMockPushNotificationService(),
  ) {
    const service = new AppBadgeService(
      notificationService,
      chatNotificationService,
      pushNotificationService,
    );
    const dispose = service.start();
    disposers.push(dispose);
    return dispose;
  }

  beforeEach(() => {
    badgeCalls = [];
    displayedNotifications = [];
    disposers = [];
    navigator.serviceWorker = {
      getRegistration: async () => ({
        getNotifications: async () => displayedNotifications,
      }),
    };
    originalMatchMedia = window.matchMedia;
    navigator.setAppBadge = async (count) => {
      badgeCalls.push(count);
    };
    navigator.clearAppBadge = async () => {
      badgeCalls.push(null);
    };
  });

  afterEach(() => {
    for (const dispose of disposers) {
      dispose();
    }
    delete navigator.setAppBadge;
    delete navigator.clearAppBadge;
    delete navigator.serviceWorker;
    window.matchMedia = originalMatchMedia;
  });

  it("sets the badge to the combined unread count", async () => {
    const notificationService = createMockNotificationService({
      numNotifications: 5,
    });
    const chatNotificationService = createMockNotificationService({
      numNotifications: 2,
    });
    startSync(notificationService, chatNotificationService);
    await flushEffects();

    assert.deepEqual(badgeCalls, [7]);
  });

  // The push handler sets the badge while the app is closed and cannot know
  // when the user has caught up, so this is the only thing that clears it.
  it("clears the badge once everything is read", async () => {
    const notificationService = createMockNotificationService({
      numNotifications: 3,
    });
    const chatNotificationService = createMockNotificationService();
    startSync(notificationService, chatNotificationService);
    await flushEffects();

    notificationService.$numNotifications.set(0);
    await flushEffects();

    assert.deepEqual(badgeCalls, [3, null]);
  });

  it("stops syncing after disposal", async () => {
    const notificationService = createMockNotificationService({
      numNotifications: 3,
    });
    const chatNotificationService = createMockNotificationService();
    const dispose = startSync(notificationService, chatNotificationService);
    await flushEffects();

    dispose();
    notificationService.$numNotifications.set(5);
    await flushEffects();

    assert.deepEqual(badgeCalls, [3]);
  });

  // Unlike the desktop Notification popups, badging is not desktop-only: an
  // installed PWA is exactly where the badge is visible. On touch-only
  // devices it follows the push-notifications toggle.
  it("badges on touch-only devices when push is enabled", async () => {
    simulateTouchOnlyDevice();
    const notificationService = createMockNotificationService({
      numNotifications: 4,
    });
    const chatNotificationService = createMockNotificationService();
    startSync(
      notificationService,
      chatNotificationService,
      createMockPushNotificationService({ enabled: true }),
    );
    await flushEffects();

    assert.deepEqual(badgeCalls, [4]);
  });

  it("clears instead of badging on touch-only devices when push is disabled", async () => {
    simulateTouchOnlyDevice();
    const notificationService = createMockNotificationService({
      numNotifications: 4,
    });
    const chatNotificationService = createMockNotificationService();
    startSync(
      notificationService,
      chatNotificationService,
      createMockPushNotificationService({ enabled: false }),
    );
    await flushEffects();

    assert.deepEqual(badgeCalls, [null]);
  });

  it("clears the badge when push is toggled off on a touch-only device", async () => {
    simulateTouchOnlyDevice();
    const notificationService = createMockNotificationService({
      numNotifications: 4,
    });
    const chatNotificationService = createMockNotificationService();
    const pushNotificationService = createMockPushNotificationService({
      enabled: true,
    });
    startSync(
      notificationService,
      chatNotificationService,
      pushNotificationService,
    );
    await flushEffects();

    pushNotificationService.$enabled.set(false);
    await flushEffects();

    assert.deepEqual(badgeCalls, [4, null]);
  });

  it("badges on desktop regardless of the push toggle", async () => {
    const notificationService = createMockNotificationService({
      numNotifications: 4,
    });
    const chatNotificationService = createMockNotificationService();
    startSync(
      notificationService,
      chatNotificationService,
      createMockPushNotificationService({ enabled: false }),
    );
    await flushEffects();

    assert.deepEqual(badgeCalls, [4]);
  });

  describe("displayed notifications", () => {
    function displayNotification() {
      const notification = { closed: false };
      notification.close = () => {
        notification.closed = true;
      };
      displayedNotifications.push(notification);
      return notification;
    }

    it("closes displayed notifications once everything is read", async () => {
      const notification = displayNotification();
      const notificationService = createMockNotificationService({
        numNotifications: 2,
      });
      const chatNotificationService = createMockNotificationService({
        numNotifications: 1,
      });
      startSync(notificationService, chatNotificationService);
      await flushEffects();
      assert.equal(notification.closed, false);

      notificationService.$numNotifications.set(0);
      await flushEffects();
      assert.equal(notification.closed, false);

      chatNotificationService.$numNotifications.set(0);
      await flushEffects();
      assert.equal(notification.closed, true);
    });

    it("closes displayed notifications on start when nothing is unread", async () => {
      const notification = displayNotification();
      startSync(
        createMockNotificationService(),
        createMockNotificationService(),
      );
      await flushEffects();

      assert.equal(notification.closed, true);
    });

    it("waits for both counts to load before closing", async () => {
      const notification = displayNotification();
      const notificationService = createMockNotificationService({
        numNotifications: null,
      });
      const chatNotificationService = createMockNotificationService({
        numNotifications: null,
      });
      startSync(notificationService, chatNotificationService);
      await flushEffects();

      notificationService.$numNotifications.set(0);
      await flushEffects();
      assert.equal(notification.closed, false);

      chatNotificationService.$numNotifications.set(0);
      await flushEffects();
      assert.equal(notification.closed, true);
    });

    it("closes notifications on touch-only devices even when push is disabled", async () => {
      simulateTouchOnlyDevice();
      const notification = displayNotification();
      startSync(
        createMockNotificationService(),
        createMockNotificationService(),
        createMockPushNotificationService({ enabled: false }),
      );
      await flushEffects();

      assert.equal(notification.closed, true);
    });
  });
});
