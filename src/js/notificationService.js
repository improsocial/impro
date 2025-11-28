import { EventEmitter } from "/js/eventEmitter.js";
import { wait } from "/js/utils.js";

const POLLING_INTERVAL_SECONDS = 10;

export class NotificationService extends EventEmitter {
  constructor(api) {
    super();
    this.api = api;
    this._numNotifications = 0;
  }

  snooze(timeoutMinutes = 120) {
    const snoozedUntil = new Date(Date.now() + timeoutMinutes * 60 * 1000);
    localStorage.setItem(
      "notifications-snoozed-until",
      snoozedUntil.toISOString()
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
    if (numNotifications !== this._numNotifications) {
      this._numNotifications = numNotifications;
      this.emit("update");
    }
  }
  getNumNotifications() {
    return this._numNotifications;
  }
  async markNotificationsAsRead() {
    // optimistic update
    this._numNotifications = 0;
    this.emit("update");
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
