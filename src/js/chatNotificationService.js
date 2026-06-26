import { wait } from "/js/utils.js";
import { Signal } from "/js/signals.js";

const POLLING_INTERVAL_SECONDS = 10;

export class ChatNotificationService {
  constructor(api) {
    this.api = api;
    this.$numNotifications = new Signal.State(0);
    this._optimisticallyReadIds = new Set();
    this._lastServerTotal = 0;
  }

  async startPolling() {
    const pollingInterval = POLLING_INTERVAL_SECONDS * 1000;
    while (true) {
      await this.fetchNumNotifications();
      await wait(pollingInterval);
    }
  }

  async fetchNumNotifications() {
    const { unreadAcceptedConvos = 0, unreadRequestConvos = 0 } =
      await this.api.getChatUnreadCounts();
    const serverTotal = unreadAcceptedConvos + unreadRequestConvos;
    // The server total dropped by `delta` since the last poll — that many
    // optimistic reads have been confirmed, so stop subtracting them.
    const delta = Math.max(0, this._lastServerTotal - serverTotal);
    for (const id of [...this._optimisticallyReadIds].slice(0, delta)) {
      this._optimisticallyReadIds.delete(id);
    }
    this._lastServerTotal = serverTotal;
    const adjusted = Math.max(
      0,
      serverTotal - this._optimisticallyReadIds.size,
    );
    this.$numNotifications.set(adjusted);
  }

  markNotificationsAsReadForConvo(convoId) {
    if (this._optimisticallyReadIds.has(convoId)) return;
    this._optimisticallyReadIds.add(convoId);
    const count = this.$numNotifications.get();
    if (count > 0) {
      this.$numNotifications.set(count - 1);
    }
  }
}
