import { NotificationService } from "/js/notificationService.js";
import { ChatNotificationService } from "/js/chatNotificationService.js";
import { DesktopNotificationService } from "/js/desktopNotificationService.js";
import { AppBadgeService } from "/js/appBadgeService.js";
import { startActiveTabMonitor } from "/js/activeTabMonitor.js";
import { PushNotificationService } from "/js/push/pushNotificationService.js";

export class NotificationServiceManager {
  constructor({ session, api, auth, router }) {
    this.notificationService = session ? new NotificationService(api) : null;
    this.chatNotificationService = session
      ? new ChatNotificationService(api)
      : null;
    this.pushNotificationService = session
      ? new PushNotificationService(api, auth)
      : null;
    this.activeTabMonitor = startActiveTabMonitor();
    this.desktopNotificationService =
      this.notificationService && this.chatNotificationService
        ? new DesktopNotificationService(
            this.notificationService,
            this.chatNotificationService,
            router,
            this.activeTabMonitor,
          )
        : null;
    this.appBadgeService =
      this.notificationService && this.chatNotificationService
        ? new AppBadgeService(
            this.notificationService,
            this.chatNotificationService,
            this.pushNotificationService,
          )
        : null;
  }

  startAll() {
    const cleanups = [
      this._listenForPushMessages(),
      this.notificationService?.start(),
      this.chatNotificationService?.start(),
      this.desktopNotificationService?.start(),
      this.appBadgeService?.start(),
    ].filter(Boolean);

    this.pushNotificationService?.reassertIfEnabled().catch((error) => {
      console.error("Failed to re-assert push registration", error);
    });

    return () => {
      for (const cleanup of cleanups) {
        cleanup();
      }
      this.activeTabMonitor.stop();
    };
  }

  // The service worker skips the notification when a focused window exists
  // and sends a message instead, so refresh the counts immediately.
  _listenForPushMessages() {
    if (!("serviceWorker" in navigator)) return null;
    const handleMessage = (event) => {
      if (event.data?.type === "push-received") {
        this.notificationService?.fetchNumNotifications().catch(console.error);
        this.chatNotificationService
          ?.fetchNumNotifications()
          .catch(console.error);
      }
    };
    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () =>
      navigator.serviceWorker.removeEventListener("message", handleMessage);
  }
}
