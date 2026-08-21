import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { Signal } from "/js/signals.js";
import { DesktopNotificationService } from "/js/desktopNotificationService.js";
import { startActiveTabMonitor } from "/js/activeTabMonitor.js";

function createMockNotificationService({ numNotifications = 0 } = {}) {
  return {
    $numNotifications: new Signal.State(numNotifications),
  };
}

function createMockChatNotificationService({ numNotifications = 0 } = {}) {
  return {
    $numNotifications: new Signal.State(numNotifications),
  };
}

function macrotask() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// Effects render on rAF, then notify() awaits the cross-tab focus query before
// constructing the Notification.
async function flushEffects() {
  await new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve)),
  );
  await macrotask();
  await macrotask();
}

function enable() {
  localStorage.setItem("system-notifications-enabled", "true");
}

describe("DesktopNotificationService", () => {
  let instances;
  let originalNotification;
  let originalMatchMedia;
  let disposers;
  let navigations;
  let router;
  let originalHasFocus;
  let tabMonitors;

  function simulateTabState({ visible, focused }) {
    Object.defineProperty(document, "visibilityState", {
      value: visible ? "visible" : "hidden",
      configurable: true,
    });
    document.hasFocus = () => focused;
  }

  function simulateTouchOnlyDevice() {
    window.matchMedia = (query) => ({
      matches: query === "(hover: none) and (pointer: coarse)",
      addEventListener: () => {},
      removeEventListener: () => {},
    });
  }

  // A monitor with no peer tabs: its focus queries time out immediately, so
  // these tests exercise only this tab's own focus state.
  function createTabMonitor() {
    const monitor = startActiveTabMonitor({ replyTimeoutMs: 0 });
    tabMonitors.push(monitor);
    return monitor;
  }

  function startService(notificationService, chatNotificationService) {
    const activeTabMonitor = createTabMonitor();
    const service = new DesktopNotificationService(
      notificationService,
      chatNotificationService,
      router,
      activeTabMonitor,
    );
    const dispose = service.start();
    disposers.push(dispose);
    return { service, dispose };
  }

  beforeEach(() => {
    instances = [];
    disposers = [];
    tabMonitors = [];
    navigations = [];
    router = { go: (path) => navigations.push(path) };
    originalNotification = globalThis.Notification;
    originalMatchMedia = window.matchMedia;
    originalHasFocus = document.hasFocus;
    simulateTabState({ visible: true, focused: false });
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

  afterEach(async () => {
    for (const dispose of disposers) {
      dispose();
    }
    for (const monitor of tabMonitors) {
      monitor.stop();
    }
    // Let any notify() still awaiting a focus query settle while the mock
    // Notification is in place.
    await flushEffects();
    globalThis.Notification = originalNotification;
    window.matchMedia = originalMatchMedia;
    document.hasFocus = originalHasFocus;
    delete document.visibilityState;
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

    it("does not notify while the tab is visible and focused", async () => {
      const notificationService = createMockNotificationService();
      const chatNotificationService = createMockChatNotificationService();
      enable();
      simulateTabState({ visible: true, focused: true });
      startService(notificationService, chatNotificationService);

      notificationService.$numNotifications.set(3);
      await flushEffects();

      assert.deepEqual(instances.length, 0);
    });

    it("notifies when the window is focused but not visible", async () => {
      const notificationService = createMockNotificationService();
      const chatNotificationService = createMockChatNotificationService();
      enable();
      simulateTabState({ visible: false, focused: true });
      startService(notificationService, chatNotificationService);

      notificationService.$numNotifications.set(3);
      await flushEffects();

      assert.deepEqual(instances.length, 1);
    });

    it("notifies when the tab is visible but unfocused", async () => {
      const notificationService = createMockNotificationService();
      const chatNotificationService = createMockChatNotificationService();
      enable();
      simulateTabState({ visible: true, focused: false });
      startService(notificationService, chatNotificationService);

      notificationService.$numNotifications.set(3);
      await flushEffects();

      assert.deepEqual(instances.length, 1);
    });
  });

  describe("touch-only devices", () => {
    it("reports as unsupported even though the Notification API exists", () => {
      simulateTouchOnlyDevice();
      const service = new DesktopNotificationService(
        createMockNotificationService(),
        createMockChatNotificationService(),
        router,
        createTabMonitor(),
      );

      assert.deepEqual(typeof globalThis.Notification !== "undefined", true);
      assert.deepEqual(service.isSupported, false);
    });

    it("reports as supported when hover and a fine pointer exist", () => {
      const service = new DesktopNotificationService(
        createMockNotificationService(),
        createMockChatNotificationService(),
        router,
        createTabMonitor(),
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
      const service = new DesktopNotificationService(
        createMockNotificationService(),
        createMockChatNotificationService(),
        router,
        createTabMonitor(),
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
      const service = new DesktopNotificationService(
        notificationService,
        chatNotificationService,
        router,
        createTabMonitor(),
      );
      globalThis.Notification.permission = "granted";

      const result = await service.requestPermission();

      assert.deepEqual(result, "granted");
      assert.deepEqual(service.isEnabled, true);
    });

    it("does not set the storage flag when denied", async () => {
      const notificationService = createMockNotificationService();
      const chatNotificationService = createMockChatNotificationService();
      const service = new DesktopNotificationService(
        notificationService,
        chatNotificationService,
        router,
        createTabMonitor(),
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
      const service = new DesktopNotificationService(
        notificationService,
        chatNotificationService,
        router,
        createTabMonitor(),
      );
      enable();
      assert.deepEqual(service.isEnabled, true);

      service.disable();

      assert.deepEqual(service.isEnabled, false);
    });
  });
});
