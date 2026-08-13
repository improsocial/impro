import { effect } from "/js/signals.js";
import { isTouchOnlyDevice } from "/js/utils.js";

const STORAGE_KEY = "system-notifications-enabled";
const ICON_URL = "/img/impro-logo-192.png";

export class SystemNotificationService {
  constructor(notificationService, chatNotificationService, router) {
    this.notificationService = notificationService;
    this.chatNotificationService = chatNotificationService;
    this.router = router;
    this._lastSeenActivityCount =
      notificationService.$numNotifications.get() ?? 0;
    this._lastSeenChatCount =
      chatNotificationService.$numNotifications.get() ?? 0;
  }

  start() {
    return effect(() => {
      const activityCount =
        this.notificationService.$numNotifications.get() ?? 0;
      const chatCount =
        this.chatNotificationService.$numNotifications.get() ?? 0;

      if (activityCount > this._lastSeenActivityCount) {
        this.notify({
          title: "New activity on Impro",
          body:
            activityCount === 1
              ? "You have 1 unread notification"
              : `You have ${activityCount} unread notifications`,
          tag: "impro-activity",
          url: "/notifications",
        });
      }

      if (chatCount > this._lastSeenChatCount) {
        this.notify({
          title: "New message on Impro",
          body:
            chatCount === 1
              ? "You have 1 unread conversation"
              : `You have ${chatCount} unread conversations`,
          tag: "impro-chat",
          url: "/messages",
        });
      }

      this._lastSeenActivityCount = activityCount;
      this._lastSeenChatCount = chatCount;
    });
  }

  get isSupported() {
    // "touch-only device" is a proxy for mobile / tablets where background notifications are unreliable
    return typeof Notification !== "undefined" && !isTouchOnlyDevice();
  }

  get isEnabled() {
    return localStorage.getItem(STORAGE_KEY) === "true";
  }

  get permissionState() {
    return this.isSupported ? Notification.permission : "unsupported";
  }

  async requestPermission() {
    if (!this.isSupported) return "unsupported";
    const result = await Notification.requestPermission();
    if (result === "granted") {
      localStorage.setItem(STORAGE_KEY, "true");
    }
    return result;
  }

  disable() {
    localStorage.removeItem(STORAGE_KEY);
  }

  notify({ title, body, tag, url }) {
    if (
      !this.isSupported ||
      !this.isEnabled ||
      Notification.permission !== "granted" ||
      this.notificationService.isSnoozed
    ) {
      return;
    }
    const notification = new Notification(title, {
      body,
      icon: ICON_URL,
      badge: ICON_URL,
      tag,
    });
    notification.onclick = () => {
      window.focus();
      this.router.go(url);
      notification.close();
    };
  }
}
