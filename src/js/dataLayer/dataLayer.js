import { DataStore } from "/js/dataLayer/dataStore.js";
import { PatchStore } from "/js/dataLayer/patchStore.js";
import { PreferencesProvider } from "/js/dataLayer/preferencesProvider.js";
import { Mutations } from "/js/dataLayer/mutations.js";
import { Requests } from "/js/dataLayer/requests.js";
import { Selectors } from "/js/dataLayer/selectors.js";
import { Declarative } from "/js/dataLayer/declarative.js";

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
      this.preferencesProvider,
    );
    this.mutations = new Mutations(
      this.api,
      this.dataStore,
      this.patchStore,
      this.preferencesProvider,
    );
    this.selectors = new Selectors(
      this.dataStore,
      this.patchStore,
      this.preferencesProvider,
      this.isAuthenticated,
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
