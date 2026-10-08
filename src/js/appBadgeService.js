import { effect } from "/js/signals.js";
import { isTouchOnlyDevice } from "/js/utils.js";

export class AppBadgeService {
  constructor(
    notificationService,
    chatNotificationService,
    pushNotificationService,
  ) {
    this.notificationService = notificationService;
    this.chatNotificationService = chatNotificationService;
    this.pushNotificationService = pushNotificationService;
  }

  start() {
    return effect(() => {
      const activityCount = this.notificationService.$numNotifications.get();
      const chatCount = this.chatNotificationService.$numNotifications.get();
      const pushEnabled = this.pushNotificationService?.isEnabled ?? false;

      if (activityCount === 0 && chatCount === 0) {
        closeDisplayedNotifications();
      }

      if (!("setAppBadge" in navigator)) return;
      const badgeEnabled = !isTouchOnlyDevice() || pushEnabled;
      const total = badgeEnabled ? (activityCount ?? 0) + (chatCount ?? 0) : 0;
      const applied =
        total > 0 ? navigator.setAppBadge(total) : navigator.clearAppBadge();
      applied?.catch?.(() => {});
    });
  }
}

async function closeDisplayedNotifications() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const notifications = (await registration?.getNotifications()) ?? [];
    for (const notification of notifications) {
      notification.close();
    }
  } catch (error) {
    console.warn("Failed to close displayed notifications", error);
  }
}
