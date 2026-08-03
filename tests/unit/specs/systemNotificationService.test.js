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

function enable() {
  localStorage.setItem("system-notifications-enabled", "true");
}

describe("SystemNotificationService", () => {
  let instances;
  let originalNotification;

  beforeEach(() => {
    instances = [];
    originalNotification = globalThis.Notification;
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
    globalThis.Notification = originalNotification;
    localStorage.clear();
  });

  describe("constructor", () => {
    it("seeds last-seen counts without firing", () => {
      const notificationService = createMockNotificationService({
        numNotifications: 5,
      });
      const chatNotificationService = createMockChatNotificationService({
        numNotifications: 2,
      });
      const service = new SystemNotificationService(
        notificationService,
        chatNotificationService,
      );
      enable();

      service.checkForUpdates();

      assert.deepEqual(instances.length, 0);
    });
  });

  describe("checkForUpdates", () => {
    it("notifies when the activity count increases", () => {
      const notificationService = createMockNotificationService();
      const chatNotificationService = createMockChatNotificationService();
      const service = new SystemNotificationService(
        notificationService,
        chatNotificationService,
      );
      enable();

      notificationService.$numNotifications.set(3);
      service.checkForUpdates();

      assert.deepEqual(instances.length, 1);
      assert.deepEqual(instances[0].options.tag, "impro-activity");
    });

    it("does not notify again for an unchanged count", () => {
      const notificationService = createMockNotificationService();
      const chatNotificationService = createMockChatNotificationService();
      const service = new SystemNotificationService(
        notificationService,
        chatNotificationService,
      );
      enable();

      notificationService.$numNotifications.set(3);
      service.checkForUpdates();
      service.checkForUpdates();

      assert.deepEqual(instances.length, 1);
    });

    it("notifies again when the count increases further", () => {
      const notificationService = createMockNotificationService();
      const chatNotificationService = createMockChatNotificationService();
      const service = new SystemNotificationService(
        notificationService,
        chatNotificationService,
      );
      enable();

      notificationService.$numNotifications.set(3);
      service.checkForUpdates();
      notificationService.$numNotifications.set(5);
      service.checkForUpdates();

      assert.deepEqual(instances.length, 2);
    });

    it("does not notify when the count decreases", () => {
      const notificationService = createMockNotificationService({
        numNotifications: 5,
      });
      const chatNotificationService = createMockChatNotificationService();
      const service = new SystemNotificationService(
        notificationService,
        chatNotificationService,
      );
      enable();

      notificationService.$numNotifications.set(0);
      service.checkForUpdates();

      assert.deepEqual(instances.length, 0);
    });

    it("notifies when the chat count increases", () => {
      const notificationService = createMockNotificationService();
      const chatNotificationService = createMockChatNotificationService();
      const service = new SystemNotificationService(
        notificationService,
        chatNotificationService,
      );
      enable();

      chatNotificationService.$numNotifications.set(2);
      service.checkForUpdates();

      assert.deepEqual(instances.length, 1);
      assert.deepEqual(instances[0].options.tag, "impro-chat");
    });
  });

  describe("notify gating", () => {
    it("does not notify when disabled", () => {
      const notificationService = createMockNotificationService();
      const chatNotificationService = createMockChatNotificationService();
      const service = new SystemNotificationService(
        notificationService,
        chatNotificationService,
      );

      notificationService.$numNotifications.set(3);
      service.checkForUpdates();

      assert.deepEqual(instances.length, 0);
    });

    it("does not notify when permission is not granted", () => {
      const notificationService = createMockNotificationService();
      const chatNotificationService = createMockChatNotificationService();
      const service = new SystemNotificationService(
        notificationService,
        chatNotificationService,
      );
      enable();
      globalThis.Notification.permission = "default";

      notificationService.$numNotifications.set(3);
      service.checkForUpdates();

      assert.deepEqual(instances.length, 0);
    });

    it("does not notify when snoozed", () => {
      const notificationService = createMockNotificationService({
        isSnoozed: true,
      });
      const chatNotificationService = createMockChatNotificationService();
      const service = new SystemNotificationService(
        notificationService,
        chatNotificationService,
      );
      enable();

      notificationService.$numNotifications.set(3);
      service.checkForUpdates();

      assert.deepEqual(instances.length, 0);
    });
  });

  describe("requestPermission", () => {
    it("sets the storage flag when granted", async () => {
      const notificationService = createMockNotificationService();
      const chatNotificationService = createMockChatNotificationService();
      const service = new SystemNotificationService(
        notificationService,
        chatNotificationService,
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
      );
      enable();
      assert.deepEqual(service.isEnabled, true);

      service.disable();

      assert.deepEqual(service.isEnabled, false);
    });
  });
});
