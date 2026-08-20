import { Preferences } from "/js/preferences.js";
import { Signal } from "/js/signals.js";
import { showToast } from "/js/toasts.js";
import { wait } from "/js/utils.js";

const RETRY_DELAY_MS = 1000;

export class PreferencesProvider {
  constructor(api) {
    this.api = api;
    this._preferences = null;
    this._pendingFetch = null;
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
    const labelerDids =
      Preferences.getLabelerDidsFromPreferences(preferencesObj);
    // A labeler service outage shouldn't prevent the app from starting: without
    // definitions, labels from those labelers simply don't render.
    let labelerDefs = [];
    try {
      labelerDefs = await this.api.getLabelers(labelerDids);
    } catch (error) {
      console.warn("Could not load labeler definitions:", error);
      showToast(
        "Failed to fetch moderation labels - unmoderated content may be visible",
        { style: "warning", timeout: 6000 },
      );
    }
    this._setPreferences(new Preferences(preferencesObj, labelerDefs));
  }

  async updatePreferences(preferences) {
    if (preferences.persist) {
      await this.api.updatePreferences(preferences.obj);
    }
    this._setPreferences(preferences);
  }

  _setPreferences(preferences) {
    this._preferences = preferences;
    this.$preferences.set(preferences);
  }
}
