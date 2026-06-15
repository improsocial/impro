import { wait } from "/js/utils.js";
import { Signal } from "/js/signals.js";

const POLLING_INTERVAL_SECONDS = 10;

export class ChatNotificationService {
  constructor(api) {
    this.api = api;
    this.$unreadConvoIds = new Signal.State(new Set());
    this.$numNotifications = new Signal.Computed(
      () => this.$unreadConvoIds.get().size,
    );
    // Store read convo IDs locally to override unread count until the server catches up
    this._locallyReadConvoIds = new Set();
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
    const incomingIds = new Set(unreadConvos.convos.map((convo) => convo.id));
    // Drop overrides for convos the server no longer reports as unread.
    for (const id of this._locallyReadConvoIds) {
      if (!incomingIds.has(id)) this._locallyReadConvoIds.delete(id);
    }
    this.$unreadConvoIds.set(incomingIds.difference(this._locallyReadConvoIds));
  }
  async markNotificationsAsReadForConvo(convoId) {
    this._locallyReadConvoIds.add(convoId);
    const unreadConvos = this.$unreadConvoIds.get();
    this.$unreadConvoIds.set(
      unreadConvos.difference(this._locallyReadConvoIds),
    );
    this.fetchNumNotifications();
  }
}
