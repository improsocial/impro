import { wait } from "/js/utils.js";
import { Signal } from "/js/signals.js";

const POLLING_INTERVAL_SECONDS = 10;

export class ChatNotificationService {
  constructor(api) {
    this.api = api;
    this.$numNotifications = new Signal.State(0);
    this._cursor = "";
  }

  async startPolling() {
    const pollingInterval = POLLING_INTERVAL_SECONDS * 1000;
    while (true) {
      await this.fetchNumNotifications();
      await wait(pollingInterval);
    }
  }
  async fetchNumNotifications() {
    const unreadConvos = await this.api.listConvos({ readState: "unread" });
    const numNotifications = unreadConvos.convos.length;
    if (numNotifications !== this.$numNotifications.get()) {
      this.$numNotifications.set(numNotifications);
    }
  }
  async markNotificationsAsReadForConvo() {
    // The views should update the unread count for each convo,
    // so just trigger a fetch
    this.fetchNumNotifications();
  }
}
