import { Signal } from "/js/signals.js";
import { showToast } from "/js/toasts.js";

export class LabelerDefsProvider {
  constructor(api, preferencesProvider) {
    this.api = api;
    this.preferencesProvider = preferencesProvider;
    this._labelerDefs = null;
    this._pendingFetch = null;
    this.$labelerDefs = new Signal.State(null);
  }

  async requireLabelerDefs() {
    if (this._labelerDefs) return this._labelerDefs;
    this._pendingFetch ??= this.fetchLabelerDefs().finally(() => {
      this._pendingFetch = null;
    });
    await this._pendingFetch;
    return this._labelerDefs;
  }

  async fetchLabelerDefs() {
    if (!this.api.isAuthenticated) {
      this._setLabelerDefs([]);
      return;
    }
    const preferences = await this.preferencesProvider.requirePreferences();
    // A labeler service outage shouldn't prevent the app from starting: without
    // definitions, labels from those labelers simply don't render.
    let labelerDefs = [];
    try {
      labelerDefs = await this.api.getLabelers(preferences.getLabelerDids());
    } catch (error) {
      console.warn("Could not load labeler definitions:", error);
      showToast(
        "Failed to fetch moderation labels. Unmoderated content may be visible.",
        { style: "warning", timeout: 6000 },
      );
    }
    this._setLabelerDefs(labelerDefs);
  }

  async addLabelerDef(labelerDef) {
    const labelerDefs = await this.requireLabelerDefs();
    if (labelerDefs.some((def) => def.creator.did === labelerDef.creator.did)) {
      return;
    }
    this._setLabelerDefs([...labelerDefs, labelerDef]);
  }

  async removeLabelerDef(did) {
    const labelerDefs = await this.requireLabelerDefs();
    this._setLabelerDefs(labelerDefs.filter((def) => def.creator.did !== did));
  }

  _setLabelerDefs(labelerDefs) {
    this._labelerDefs = labelerDefs;
    this.$labelerDefs.set(labelerDefs);
  }
}
