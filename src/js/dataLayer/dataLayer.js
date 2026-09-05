import { DataStore } from "/js/dataLayer/dataStore.js";
import { createSessionState } from "/js/dataLayer/sessionState.js";
import { PatchStore } from "/js/dataLayer/patchStore.js";
import { Mutations } from "/js/dataLayer/mutations.js";
import { Requests } from "/js/dataLayer/requests.js";
import { Declarative } from "/js/dataLayer/declarative.js";
import { Derived } from "/js/dataLayer/derived.js";
import { EventEmitter } from "/js/eventEmitter.js";

export class DataLayer extends EventEmitter {
  constructor(
    api,
    preferencesProvider,
    identityResolver,
    draftMediaStore,
    hiddenFeedItemsStore,
    constellation,
  ) {
    super();
    this.api = api;
    this.identityResolver = identityResolver;
    this.draftMediaStore = draftMediaStore;
    this.isAuthenticated = api.isAuthenticated;
    this.sessionState = createSessionState(
      api.isAuthenticated ? api.session : null,
    );
    this.dataStore = new DataStore(this.sessionState);
    this.patchStore = new PatchStore();
    this.preferencesProvider = preferencesProvider;
    this.hiddenFeedItemsStore = hiddenFeedItemsStore;
    this.requests = new Requests(
      this.api,
      this.dataStore,
      this.preferencesProvider,
      this.draftMediaStore,
      this,
      constellation,
    );
    this.mutations = new Mutations(
      this.api,
      this.dataStore,
      this.sessionState,
      this.patchStore,
      this.preferencesProvider,
      this.identityResolver,
      this.draftMediaStore,
    );
    this.derived = new Derived(
      this.dataStore,
      this.sessionState,
      this.patchStore,
      this.preferencesProvider,
      this.hiddenFeedItemsStore,
      this.isAuthenticated,
      this.draftMediaStore,
    );
    this.declarative = new Declarative(this.derived, this.requests);
    this.subscribers = [];
  }

  hasCachedFeed(feedURI) {
    return this.dataStore.$feeds.get(feedURI) !== null;
  }

  hasCachedAuthorFeed(profileDid, feedType) {
    const feedURI = `${profileDid}-${feedType}`;
    return this.dataStore.$authorFeeds.get(feedURI) !== null;
  }
}
