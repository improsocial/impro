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
      const activityCount =
        this.notificationService.$numNotifications.get() ?? 0;
      const chatCount =
        this.chatNotificationService.$numNotifications.get() ?? 0;
      const pushEnabled = this.pushNotificationService?.isEnabled ?? false;

      if (!("setAppBadge" in navigator)) return;
      const badgeEnabled = !isTouchOnlyDevice() || pushEnabled;
      const total = badgeEnabled ? activityCount + chatCount : 0;
      const applied =
        total > 0 ? navigator.setAppBadge(total) : navigator.clearAppBadge();
      applied?.catch?.(() => {});
    });
  }
}
