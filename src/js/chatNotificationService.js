import { Poller } from "/js/utils.js";
import { Signal } from "/js/signals.js";

const POLLING_INTERVAL_SECONDS = 10;

export class ChatNotificationService {
  constructor(api) {
    this.api = api;
    this.$numNotifications = new Signal.State(0);
    this.$numUnreadRequestConvos = new Signal.State(0);
    this._optimisticallyReadIds = new Set();
    this._lastServerTotal = 0;
    this.poller = new Poller(
      () => this.fetchNumNotifications(),
      POLLING_INTERVAL_SECONDS * 1000,
    );
  }

  start() {
    this.poller.start();
    // Restart the poller on page visible to fetch notifications immediately
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") this.poller.restart();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      this.poller.stop();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }

  async fetchNumNotifications() {
    const { unreadAcceptedConvos = 0, unreadRequestConvos = 0 } =
      await this.api.getChatUnreadCounts();
    this.$numUnreadRequestConvos.set(unreadRequestConvos);
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

  markNotificationsAsReadForConvo(convoId, { isRequest = false } = {}) {
    if (this._optimisticallyReadIds.has(convoId)) return;
    this._optimisticallyReadIds.add(convoId);
    const count = this.$numNotifications.get();
    if (count > 0) {
      this.$numNotifications.set(count - 1);
    }
    if (isRequest) {
      const requestCount = this.$numUnreadRequestConvos.get();
      if (requestCount > 0) {
        this.$numUnreadRequestConvos.set(requestCount - 1);
      }
    }
  }
}
