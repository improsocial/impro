import { wait, Signal } from "/js/utils.js";

const POLLING_INTERVAL_SECONDS = 10;

export class NotificationService {
  constructor(api) {
    this.api = api;
    this.$numNotifications = new Signal.State(0);
    this.$numNotifications.__debugName = "$numNotifications";
  }

  snooze(timeoutMinutes = 120) {
    const snoozedUntil = new Date(Date.now() + timeoutMinutes * 60 * 1000);
    localStorage.setItem(
      "notifications-snoozed-until",
      snoozedUntil.toISOString(),
    );
  }

  get isSnoozed() {
    const snoozedUntil = localStorage.getItem("notifications-snoozed-until");
    return snoozedUntil ? new Date(snoozedUntil) > new Date() : false;
  }

  async startPolling() {
    const pollingInterval = POLLING_INTERVAL_SECONDS * 1000;
    while (true) {
      if (!this.isSnoozed) {
        await this.fetchNumNotifications();
      }
      await wait(pollingInterval);
    }
  }
  async fetchNumNotifications() {
    const numNotifications = await this.api.getNumNotifications();
    if (numNotifications !== this.$numNotifications.get()) {
      this.$numNotifications.set(numNotifications);
    }
  }
  async markNotificationsAsRead() {
    // optimistic update
    this.$numNotifications.set(0);
    let updated = false;
    let retries = 0;
    // Try this a few times, since the endpoint is pretty unstable
    while (!updated && retries < 5) {
      try {
        await this.api.markNotificationsAsRead();
        updated = true;
      } catch (error) {
        console.error(error);
        retries++;
        await wait(1000);
      }
    }
  }
}
