import { effect } from "/js/signals.js";

const STORAGE_KEY = "system-notifications-enabled";
const ICON_URL = "/img/impro-logo-192.png";
const SW_URL = "/sw.js";

export class SystemNotificationService {
  constructor(
    notificationService,
    chatNotificationService,
    router,
    pushSubscriptionService = null,
  ) {
    this.notificationService = notificationService;
    this.chatNotificationService = chatNotificationService;
    this.router = router;
    this.pushSubscriptionService = pushSubscriptionService;
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
      // Pre-warm the service worker so it's already active by the time a
      // notification actually needs to be shown.
      this._getServiceWorkerRegistration();
    }
    return result;
  }

  disable() {
    localStorage.removeItem(STORAGE_KEY);
  }

  // Chrome on Android (and most other mobile browsers) throw when calling
  // `new Notification()` directly from page context -- they only support
  // notifications shown via a service worker's registration. Desktop
  // browsers support both, so route through the service worker everywhere
  // it's available and only fall back to the page-context constructor when
  // it isn't.
  async _getServiceWorkerRegistration() {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return null;
    }
    try {
      await navigator.serviceWorker.register(SW_URL);
      return await navigator.serviceWorker.ready;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  async notify({ title, body, tag, url }) {
    if (
      !this.isSupported ||
      !this.isEnabled ||
      Notification.permission !== "granted" ||
      this.notificationService.isSnoozed
    ) {
      return;
    }
    const options = {
      body,
      icon: ICON_URL,
      badge: ICON_URL,
      tag,
      data: { url },
    };

    const registration = await this._getServiceWorkerRegistration();
    if (registration) {
      await registration.showNotification(title, options);
    } else {
      const notification = new Notification(title, options);
      notification.onclick = () => {
        window.focus();
        this.router.go(url);
        notification.close();
      };
    }

    if (this.pushSubscriptionService?.isEnabled) {
      this.pushSubscriptionService.relay();
    }
  }
}
