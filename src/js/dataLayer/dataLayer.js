import { DataStore } from "/js/dataLayer/dataStore.js";
import { PatchStore } from "/js/dataLayer/patchStore.js";
import { Mutations } from "/js/dataLayer/mutations.js";
import { Requests } from "/js/dataLayer/requests.js";
import { Declarative } from "/js/dataLayer/declarative.js";
import { Derived } from "/js/dataLayer/derived.js";

export class DataLayer {
  constructor(api, pluginService, preferencesProvider) {
    this.api = api;
    this.pluginService = pluginService;
    this.isAuthenticated = api.isAuthenticated;
    this.dataStore = new DataStore();
    this.patchStore = new PatchStore(this.dataStore);
    this.preferencesProvider = preferencesProvider;
    this.requests = new Requests(
      this.api,
      this.dataStore,
      this.preferencesProvider,
      this.pluginService,
    );
    this.pluginService?.on("feedFiltersRefresh", async ({ feedURI }) => {
      const feedURIs = feedURI
        ? [feedURI]
        : Array.from(this.dataStore.$feeds.keys());
      await Promise.all(
        feedURIs.map((uri) => {
          const feed = this.dataStore.$feeds.get(uri).get();
          if (!feed) return;
          return this.pluginService.refreshFiltersForFeed(uri, feed, {
            reload: true,
          });
        }),
      );
    });
    this.mutations = new Mutations(
      this.api,
      this.dataStore,
      this.patchStore,
      this.preferencesProvider,
    );
    this.derived = new Derived(
      this.dataStore,
      this.patchStore,
      this.preferencesProvider,
      this.pluginService,
      this.isAuthenticated,
    );
    this.declarative = new Declarative(this.derived, this.requests);
    this.subscribers = [];
  }

  async initializePreferences() {
    return this.preferencesProvider.fetchPreferences();
  }

  hasCachedFeed(feedURI) {
    return this.dataStore.$feeds.get(feedURI).get() !== null;
  }

  hasCachedAuthorFeed(profileDid, feedType) {
    const feedURI = `${profileDid}-${feedType}`;
    return this.dataStore.$authorFeeds.get(feedURI).get() !== null;
  }
}
