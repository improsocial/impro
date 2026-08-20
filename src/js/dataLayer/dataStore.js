import { Signal, SignalMap, ReactiveStore } from "/js/signals.js";
import { getQuotedPost, embedViewRecordToPostView } from "/js/dataHelpers.js";
import { pinnedItemsQueryKey, Resources } from "/js/dataLayer/queryKeys.js";

// The store saves canonical data from the server. Patches are layered on top of this.
export class DataStore extends ReactiveStore {
  constructor(sessionState, queryStore) {
    super("dataStore");
    this.sessionState = sessionState;
    this.queryStore = queryStore;
    // Single-value signals
    this.$currentUser = new Signal.State(null);
    this.$notificationsLastSeenAt = new Signal.State(null);
    this.$selectedFeedUri = this.sessionState.$selectedFeedUri;
    // Keyed signals
    this.$showLessInteractions = new SignalMap();
    this.$showMoreInteractions = new SignalMap();
    this.$posts = new SignalMap();
    this.$embeddedPosts = new SignalMap();
    this.$profiles = new SignalMap();
    this.$detailedProfiles = new SignalMap();
    this.$unavailablePosts = new SignalMap();
    this.$reposts = new SignalMap();
    this.$convos = new SignalMap();
    this.$messages = new SignalMap();
    this.$feedGenerators = new SignalMap();
    this.$lists = new SignalMap();
    this.$starterPacks = new SignalMap();
    this.$listItemUris = new SignalMap();
    this.$profileChatStatus = new SignalMap();
    this.$labelerInfo = new SignalMap();
    this.$joinLinkPreviewsByCode = new SignalMap();
  }

  setPosts(posts) {
    const seenQuotedPostUris = new Set();
    const setQuotedPost = (quotedPost) => {
      if (
        quotedPost?.$type !== "app.bsky.embed.record#viewRecord" ||
        seenQuotedPostUris.has(quotedPost.uri)
      ) {
        return;
      }
      seenQuotedPostUris.add(quotedPost.uri);

      const normalizedQuotedPost = embedViewRecordToPostView(quotedPost);
      if (!this.$posts.has(quotedPost.uri)) {
        this.$embeddedPosts.set(quotedPost.uri, normalizedQuotedPost);
      }
      setQuotedPost(getQuotedPost(normalizedQuotedPost));
    };

    for (const post of posts) {
      this.$posts.set(post.uri, post);
      // Delete matching embedded post, since they're only used as previews
      this.$embeddedPosts.delete(post.uri);
      setQuotedPost(getQuotedPost(post));
    }
  }

  // map of dids -> listitem uris per list
  setListItemUris(listUri, items) {
    const map = new Map(this.$listItemUris.get(listUri));
    for (const item of items) {
      map.set(item.subject.did, item.uri);
    }
    this.$listItemUris.set(listUri, map);
  }

  setListItemUri(listUri, did, uri) {
    const map = new Map(this.$listItemUris.get(listUri));
    map.set(did, uri);
    this.$listItemUris.set(listUri, map);
  }

  deleteListItemUri(listUri, did) {
    const existing = this.$listItemUris.get(listUri);
    if (!existing) return;
    const map = new Map(existing);
    map.delete(did);
    this.$listItemUris.set(listUri, map);
  }

  setProfiles(profiles) {
    for (const profile of profiles) {
      this.$profiles.set(profile.did, profile);
    }
  }

  // Save the convo and sync convo lists if necessary
  setConvo(convo) {
    this.$convos.set(convo.id, convo);
    const isRequest = convo.status === "request";
    if (isRequest) {
      this.queryStore.prependToResource(Resources.CONVO_REQUEST_LIST, convo.id);
      return;
    }
    this.queryStore.prependToResource(Resources.CONVO_LIST, convo.id);
    // Remove accepted convo from the request list if it's there
    this.queryStore.removeFromResource(Resources.CONVO_REQUEST_LIST, convo.id);
  }

  // All pinned item writes go through here so the selected feed can't dangle:
  // a selection that's no longer pinned falls back to the first pinned item.
  setPinnedItems(pinnedItems) {
    this.queryStore.replacePages(pinnedItemsQueryKey(), {
      items: pinnedItems,
      cursor: null,
    });
    const selectedFeedUri = this.$selectedFeedUri.get();
    if (!selectedFeedUri) {
      return;
    }
    const isPinned = pinnedItems.some(
      (item) => item.data.uri === selectedFeedUri,
    );
    if (!isPinned) {
      this.$selectedFeedUri.set(pinnedItems[0]?.data.uri ?? null);
    }
  }
}
