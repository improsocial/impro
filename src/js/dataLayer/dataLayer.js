import { DataStore } from "/js/dataLayer/dataStore.js";
import { QueryStore } from "/js/dataLayer/queryStore.js";
import {
  Resources,
  authorFeedQueryKey,
  feedQueryKey,
  parseFeedQueryKey,
} from "/js/dataLayer/queryKeys.js";
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
    this.queryStore = new QueryStore();
    this.dataStore = new DataStore(this.sessionState, this.queryStore);
    this.patchStore = new PatchStore(this.dataStore);
    this.preferencesProvider = preferencesProvider;
    this.hiddenFeedItemsStore = hiddenFeedItemsStore;
    this.requests = new Requests(
      this.api,
      this.dataStore,
      this.preferencesProvider,
      this.draftMediaStore,
      this,
      constellation,
      this.queryStore,
    );
    this.mutations = new Mutations(
      this.api,
      this.dataStore,
      this.patchStore,
      this.preferencesProvider,
      this.identityResolver,
      this.draftMediaStore,
      this.queryStore,
    );
    this.derived = new Derived(
      this.dataStore,
      this.patchStore,
      this.preferencesProvider,
      this.hiddenFeedItemsStore,
      this.isAuthenticated,
      this.draftMediaStore,
      this.requests.statusStore,
      this.queryStore,
    );
    this.declarative = new Declarative(this.derived, this.requests);
    this.subscribers = [];
  }

  hasCachedFeed(feedURI) {
    return this.queryStore.get(feedQueryKey({ uri: feedURI })) !== null;
  }

  getCachedFeed(feedURI) {
    const items = this.queryStore.getItems(feedQueryKey({ uri: feedURI }));
    return items ? { feed: items } : null;
  }

  getCachedFeeds() {
    return this.queryStore.keysForResource(Resources.FEED).map((queryKey) => ({
      uri: parseFeedQueryKey(queryKey),
      feed: { feed: this.queryStore.getItems(queryKey) ?? [] },
    }));
  }

  hasCachedAuthorFeed(profileDid, feedType) {
    const queryKey = authorFeedQueryKey({ did: profileDid, feedType });
    return this.queryStore.get(queryKey) !== null;
  }
}
