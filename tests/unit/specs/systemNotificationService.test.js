import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { Signal } from "/js/signals.js";
import { SystemNotificationService } from "/js/systemNotificationService.js";

function createMockNotificationService({
  numNotifications = 0,
  isSnoozed = false,
} = {}) {
  return {
    $numNotifications: new Signal.State(numNotifications),
    isSnoozed,
  };
}

function createMockChatNotificationService({ numNotifications = 0 } = {}) {
  return {
    $numNotifications: new Signal.State(numNotifications),
  };
}

function flushEffects() {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve)),
  );
}

function enable() {
  localStorage.setItem("system-notifications-enabled", "true");
}

describe("SystemNotificationService", () => {
  let instances;
  let originalNotification;
  let originalMatchMedia;
  let disposers;
  let navigations;
  let router;

  function simulateTouchOnlyDevice() {
    window.matchMedia = (query) => ({
      matches: query === "(hover: none) and (pointer: coarse)",
      addEventListener: () => {},
      removeEventListener: () => {},
    });
  }

  function startService(notificationService, chatNotificationService) {
    const service = new SystemNotificationService(
      notificationService,
      chatNotificationService,
      router,
    );
    const dispose = service.start();
    disposers.push(dispose);
    return { service, dispose };
  }

  beforeEach(() => {
    instances = [];
    disposers = [];
    navigations = [];
    router = { go: (path) => navigations.push(path) };
    originalNotification = globalThis.Notification;
    originalMatchMedia = window.matchMedia;
    globalThis.Notification = class {
      static permission = "granted";
      static async requestPermission() {
        return globalThis.Notification.permission;
      }
      constructor(title, options) {
        this.title = title;
        this.options = options;
        instances.push(this);
      }
      close() {}
    };
    localStorage.clear();
  });

  afterEach(() => {
    for (const dispose of disposers) {
      dispose();
    }
    globalThis.Notification = originalNotification;
    window.matchMedia = originalMatchMedia;
    localStorage.clear();
  });

  describe("start", () => {
    it("seeds last-seen counts without firing", async () => {
      const notificationService = createMockNotificationService({
        numNotifications: 5,
      });
      const chatNotificationService = createMockChatNotificationService({
        numNotifications: 2,
      });
      enable();

      startService(notificationService, chatNotificationService);
      await flushEffects();

      assert.deepEqual(instances.length, 0);
    });

    it("notifies when the activity count increases", async () => {
      const notificationService = createMockNotificationService();
      const chatNotificationService = createMockChatNotificationService();
      enable();
      startService(notificationService, chatNotificationService);

      notificationService.$numNotifications.set(3);
      await flushEffects();

      assert.deepEqual(instances.length, 1);
      assert.deepEqual(instances[0].options.tag, "impro-activity");
    });

    it("does not notify again for an unchanged count", async () => {
      const notificationService = createMockNotificationService();
      const chatNotificationService = createMockChatNotificationService();
      enable();
      startService(notificationService, chatNotificationService);

      notificationService.$numNotifications.set(3);
      await flushEffects();
      chatNotificationService.$numNotifications.set(1);
      await flushEffects();

      assert.deepEqual(instances.length, 2);
      assert.deepEqual(instances[1].options.tag, "impro-chat");
    });

    it("notifies again when the count increases further", async () => {
      const notificationService = createMockNotificationService();
      const chatNotificationService = createMockChatNotificationService();
      enable();
      startService(notificationService, chatNotificationService);

      notificationService.$numNotifications.set(3);
      await flushEffects();
      notificationService.$numNotifications.set(5);
      await flushEffects();

      assert.deepEqual(instances.length, 2);
    });

    it("does not notify when the count decreases", async () => {
      const notificationService = createMockNotificationService({
        numNotifications: 5,
      });
      const chatNotificationService = createMockChatNotificationService();
      enable();
      startService(notificationService, chatNotificationService);

      notificationService.$numNotifications.set(0);
      await flushEffects();

      assert.deepEqual(instances.length, 0);
    });

    it("notifies when the chat count increases", async () => {
      const notificationService = createMockNotificationService();
      const chatNotificationService = createMockChatNotificationService();
      enable();
      startService(notificationService, chatNotificationService);

      chatNotificationService.$numNotifications.set(2);
      await flushEffects();

      assert.deepEqual(instances.length, 1);
      assert.deepEqual(instances[0].options.tag, "impro-chat");
    });

    it("stops notifying after the effect is disposed", async () => {
      const notificationService = createMockNotificationService();
      const chatNotificationService = createMockChatNotificationService();
      enable();
      const { dispose } = startService(
        notificationService,
        chatNotificationService,
      );

      notificationService.$numNotifications.set(1);
      await flushEffects();
      assert.deepEqual(instances.length, 1);

      dispose();
      chatNotificationService.$numNotifications.set(3);
      await flushEffects();

      assert.deepEqual(instances.length, 1);
    });
  });

  describe("notification clicks", () => {
    it("navigates to the notification's url", async () => {
      const notificationService = createMockNotificationService();
      const chatNotificationService = createMockChatNotificationService();
      enable();
      startService(notificationService, chatNotificationService);

      notificationService.$numNotifications.set(3);
      await flushEffects();
      instances[0].onclick();
      assert.deepEqual(navigations, ["/notifications"]);

      chatNotificationService.$numNotifications.set(1);
      await flushEffects();
      instances[1].onclick();
      assert.deepEqual(navigations, ["/notifications", "/messages"]);
    });
  });

  describe("notify gating", () => {
    it("does not notify when disabled", async () => {
      const notificationService = createMockNotificationService();
      const chatNotificationService = createMockChatNotificationService();
      startService(notificationService, chatNotificationService);

      notificationService.$numNotifications.set(3);
      await flushEffects();

      assert.deepEqual(instances.length, 0);
    });

    it("does not notify when permission is not granted", async () => {
      const notificationService = createMockNotificationService();
      const chatNotificationService = createMockChatNotificationService();
      enable();
      globalThis.Notification.permission = "default";
      startService(notificationService, chatNotificationService);

      notificationService.$numNotifications.set(3);
      await flushEffects();

      assert.deepEqual(instances.length, 0);
    });

    it("does not notify when snoozed", async () => {
      const notificationService = createMockNotificationService({
        isSnoozed: true,
      });
      const chatNotificationService = createMockChatNotificationService();
      enable();
      startService(notificationService, chatNotificationService);

      notificationService.$numNotifications.set(3);
      await flushEffects();

      assert.deepEqual(instances.length, 0);
    });
  });

  describe("touch-only devices", () => {
    it("reports as unsupported even though the Notification API exists", () => {
      simulateTouchOnlyDevice();
      const service = new SystemNotificationService(
        createMockNotificationService(),
        createMockChatNotificationService(),
        router,
      );

      assert.deepEqual(typeof globalThis.Notification !== "undefined", true);
      assert.deepEqual(service.isSupported, false);
    });

    it("reports as supported when hover and a fine pointer exist", () => {
      const service = new SystemNotificationService(
        createMockNotificationService(),
        createMockChatNotificationService(),
        router,
      );

      assert.deepEqual(service.isSupported, true);
    });

    it("does not notify even when enabled and permitted", async () => {
      simulateTouchOnlyDevice();
      const notificationService = createMockNotificationService();
      const chatNotificationService = createMockChatNotificationService();
      enable();
      startService(notificationService, chatNotificationService);

      notificationService.$numNotifications.set(3);
      await flushEffects();

      assert.deepEqual(instances.length, 0);
    });

    it("does not request permission or set the storage flag", async () => {
      simulateTouchOnlyDevice();
      const service = new SystemNotificationService(
        createMockNotificationService(),
        createMockChatNotificationService(),
        router,
      );

      const result = await service.requestPermission();

      assert.deepEqual(result, "unsupported");
      assert.deepEqual(service.isEnabled, false);
    });
  });

  describe("requestPermission", () => {
    it("sets the storage flag when granted", async () => {
      const notificationService = createMockNotificationService();
      const chatNotificationService = createMockChatNotificationService();
      const service = new SystemNotificationService(
        notificationService,
        chatNotificationService,
        router,
      );
      globalThis.Notification.permission = "granted";

      const result = await service.requestPermission();

      assert.deepEqual(result, "granted");
      assert.deepEqual(service.isEnabled, true);
    });

    it("does not set the storage flag when denied", async () => {
      const notificationService = createMockNotificationService();
      const chatNotificationService = createMockChatNotificationService();
      const service = new SystemNotificationService(
        notificationService,
        chatNotificationService,
        router,
      );
      globalThis.Notification.permission = "denied";

      const result = await service.requestPermission();

      assert.deepEqual(result, "denied");
      assert.deepEqual(service.isEnabled, false);
    });
  });

  describe("disable", () => {
    it("clears the storage flag", () => {
      const notificationService = createMockNotificationService();
      const chatNotificationService = createMockChatNotificationService();
      const service = new SystemNotificationService(
        notificationService,
        chatNotificationService,
        router,
      );
      enable();
      assert.deepEqual(service.isEnabled, true);

      service.disable();

      assert.deepEqual(service.isEnabled, false);
    });
  });
});
