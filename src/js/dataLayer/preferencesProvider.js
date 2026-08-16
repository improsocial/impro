import { Preferences } from "/js/preferences.js";
import { Signal } from "/js/signals.js";

export class PreferencesProvider {
  constructor(api) {
    this.api = api;
    this._preferences = null;
    this.$preferences = new Signal.State(null);
    this.$labelerDefsUnavailable = new Signal.State(false);
  }

  requirePreferences() {
    if (!this._preferences) {
      throw new Error("Preferences not loaded");
    }
    return this._preferences;
  }

  async fetchPreferences() {
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
      this.$labelerDefsUnavailable.set(false);
    } catch (error) {
      console.warn("Could not load labeler definitions:", error);
      this.$labelerDefsUnavailable.set(true);
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
