import { Preferences } from "/js/preferences.js";

export class PreferencesProvider {
  constructor(api) {
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
      this._preferences = Preferences.createLoggedOutPreferences();
      return;
    }
    const preferencesObj = await this.api.getPreferences();
    const labelerDids =
      Preferences.getLabelerDidsFromPreferences(preferencesObj);
    const labelerDefs = await this.api.getLabelers(labelerDids);
    this._preferences = new Preferences(preferencesObj, labelerDefs);
  }

  async updatePreferences(preferences) {
    await this.api.updatePreferences(preferences.obj);
    this._preferences = preferences;
  }
}
