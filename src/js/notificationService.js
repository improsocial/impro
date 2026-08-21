import { Poller, wait } from "/js/utils.js";
import { Signal } from "/js/signals.js";

const POLLING_INTERVAL_SECONDS = 10;
const VERIFY_MAX_TRIES = 3;
const VERIFY_RETRY_MS = 1000;

export class NotificationService {
  constructor(api) {
    this.api = api;
    this.$numNotifications = new Signal.State(0);
    this.$numNotifications.__debugName = "$numNotifications";
    this._lastVerifiedTopUri = null;
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
    const numNotifications = await this.api.getNumNotifications();
    const currentCount = this.$numNotifications.get();
    if (numNotifications === currentCount) return;
    // The count endpoint updates before listNotifications, so wait for
    // the endpoint to return new notifications before updating
    if (numNotifications > currentCount) {
      if (!(await this._verifyListHasNewItems())) return;
    }
    this.$numNotifications.set(numNotifications);
  }

  async _verifyListHasNewItems() {
    for (let attempt = 0; attempt < VERIFY_MAX_TRIES; attempt++) {
      try {
        const res = await this.api.getNotifications({ limit: 1 });
        const topUri = res.notifications[0]?.uri ?? null;
        if (topUri && topUri !== this._lastVerifiedTopUri) {
          this._lastVerifiedTopUri = topUri;
          return true;
        }
      } catch (error) {
        console.warn(error);
      }
      if (attempt < VERIFY_MAX_TRIES - 1) await wait(VERIFY_RETRY_MS);
    }
    return false;
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
