import { EventEmitter } from "/js/eventEmitter.js";
import { wait } from "/js/utils.js";

const POLLING_INTERVAL_SECONDS = 10;

export class ChatNotificationService extends EventEmitter {
  constructor(api) {
    super();
    this.api = api;
    this._numNotifications = 0;
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
    if (numNotifications !== this._numNotifications) {
      this._numNotifications = numNotifications;
      this.emit("update");
    }
  }
  getNumNotifications() {
    return this._numNotifications;
  }
  async markNotificationsAsReadForConvo() {
    // The views should update the unread count for each convo,
    // so just trigger a fetch
    this.fetchNumNotifications();
  }
}
