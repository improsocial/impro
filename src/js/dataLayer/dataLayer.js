import { DataStore } from "./dataStore.js";
import { PatchStore } from "./patchStore.js";
import { PreferencesProvider } from "./preferencesProvider.js";
import { Mutations } from "./mutations.js";
import { Requests } from "./requests.js";
import { Selectors } from "./selectors.js";
import { Declarative } from "./declarative.js";

export class DataLayer {
  constructor(api) {
    this.api = api;
    this.isAuthenticated = api.isAuthenticated;
    this.dataStore = new DataStore();
    this.patchStore = new PatchStore();
    this.preferencesProvider = new PreferencesProvider(this.api);
    this.requests = new Requests(
      this.api,
      this.dataStore,
      this.preferencesProvider
    );
    this.mutations = new Mutations(
      this.api,
      this.dataStore,
      this.patchStore,
      this.preferencesProvider
    );
    this.selectors = new Selectors(
      this.dataStore,
      this.patchStore,
      this.preferencesProvider,
      this.isAuthenticated
    );
    this.declarative = new Declarative(this.selectors, this.requests);
    this.subscribers = [];
  }

  async initializePreferences() {
    return this.preferencesProvider.fetchPreferences();
  }

  hasCachedFeed(feedURI) {
    return this.dataStore.hasFeed(feedURI);
  }

  hasCachedAuthorFeed(profileDid, feedType) {
    const feedURI = `${profileDid}-${feedType}`;
    return this.dataStore.hasAuthorFeed(feedURI);
  }
}
