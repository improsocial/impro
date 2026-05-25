import { DataStore } from "/js/dataLayer/dataStore.js";
import { PatchStore } from "/js/dataLayer/patchStore.js";
import { Mutations } from "/js/dataLayer/mutations.js";
import { Requests } from "/js/dataLayer/requests.js";
import { Selectors } from "/js/dataLayer/selectors.js";
import { Declarative } from "/js/dataLayer/declarative.js";
import { EventEmitter } from "/js/eventEmitter.js";
import * as derived from "/js/dataLayer/derived.js";
import * as base from "/js/dataLayer/base.js";

export class DataLayer {
  constructor(api, pluginService, preferencesProvider) {
    this.api = api;
    this.pluginService = pluginService;
    this.isAuthenticated = api.isAuthenticated;
    // Shared bus for per-entity events that span dataStore + patchStore.
    // Consumers subscribe here for "post:${uri}" or "preferences:changed".
    this.events = new EventEmitter();
    this.dataStore = new DataStore(this.events);
    this.patchStore = new PatchStore(this.events);
    this.preferencesProvider = preferencesProvider;
    preferencesProvider.on("setPreferences", () => {
      this.events.emit("preferences:changed");
    });
    this.requests = new Requests(
      this.api,
      this.dataStore,
      this.preferencesProvider,
      this.pluginService,
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
    this.derived = derived;
    this.base = {
      getPost: (uri) => base.getPost(this.dataStore, this.patchStore, uri),
    };
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
