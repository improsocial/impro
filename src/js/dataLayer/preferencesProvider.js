import { Preferences } from "/js/preferences.js";
import { Signal } from "/js/signals.js";
import { wait } from "/js/utils.js";

const RETRY_DELAY_MS = 1000;

export class PreferencesProvider {
  constructor(api) {
    this.api = api;
    this._preferences = null;
    this._pendingFetch = null;
    this._writeQueue = Promise.resolve();
    this.$preferences = new Signal.State(null);
  }

  async requirePreferences() {
    if (this._preferences) return this._preferences;
    this._pendingFetch ??= this.fetchPreferences().finally(() => {
      this._pendingFetch = null;
    });
    await this._pendingFetch;
    return this._preferences;
  }

  // Fetching preferences sometimes fails, so try it twice.
  async fetchPreferences() {
    try {
      await this._fetchPreferences();
    } catch (error) {
      console.warn("Error fetching preferences, retrying:", error);
      await wait(RETRY_DELAY_MS);
      await this._fetchPreferences();
    }
  }

  async _fetchPreferences() {
    if (!this.api.isAuthenticated) {
      this._setPreferences(Preferences.createLoggedOutPreferences());
      return;
    }
    const preferencesObj = await this.api.getPreferences();
    this._setPreferences(new Preferences(preferencesObj));
  }

  updatePreferences(update) {
    const write = this._writeQueue.then(() => this._writePreferences(update));
    this._writeQueue = write.catch(() => {});
    return write;
  }

  async _writePreferences(update) {
    const cached = await this.requirePreferences();
    const base = cached.persist
      ? new Preferences(await this.api.getPreferences())
      : cached;
    const next = update(base);
    if (next !== base && next.persist) {
      await this.api.updatePreferences(next.obj);
    }
    this._setPreferences(next);
    return next;
  }

  _setPreferences(preferences) {
    this._preferences = preferences;
    this.$preferences.set(preferences);
  }
}
