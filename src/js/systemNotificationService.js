const STORAGE_KEY = "system-notifications-enabled";
const ICON_URL = "/img/impro-logo-192.png";

export class SystemNotificationService {
  constructor(
    notificationService,
    chatNotificationService,
    pushSubscriptionService = null,
  ) {
    this.notificationService = notificationService;
    this.chatNotificationService = chatNotificationService;
    this.pushSubscriptionService = pushSubscriptionService;
    this._lastSeenActivityCount =
      notificationService.$numNotifications.get() ?? 0;
    this._lastSeenChatCount =
      chatNotificationService.$numNotifications.get() ?? 0;
  }

  get isSupported() {
    return typeof Notification !== "undefined";
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
      window.location.href = url;
      notification.close();
    };
    if (this.pushSubscriptionService?.isEnabled) {
      this.pushSubscriptionService.relay();
    }
  }

  checkForUpdates() {
    const activityCount = this.notificationService.$numNotifications.get() ?? 0;
    const chatCount = this.chatNotificationService.$numNotifications.get() ?? 0;

    if (activityCount > this._lastSeenActivityCount) {
      this.notify({
        title: "New activity on Impro",
        body:
          activityCount === 1
            ? "You have 1 new notification"
            : `You have ${activityCount} new notifications`,
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
  }
}
