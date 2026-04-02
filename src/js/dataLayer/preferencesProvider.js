import { Preferences } from "/js/preferences.js";
import { EventEmitter } from "/js/eventEmitter.js";

export class PreferencesProvider extends EventEmitter {
  constructor(api) {
    super();
    this.api = api;
    this._preferences = null;
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
    const labelerDefs = await this.api.getLabelers(labelerDids);
    this._setPreferences(new Preferences(preferencesObj, labelerDefs));
  }

  async updatePreferences(preferences) {
    await this.api.updatePreferences(preferences.obj);
    this._setPreferences(preferences);
  }

  _setPreferences(preferences) {
    this._preferences = preferences;
    this.emit("setPreferences", preferences);
  }
}
