import { Signal, SignalMap, ReactiveStore } from "/js/signals.js";
import { getQuotedPost, embedViewRecordToPostView } from "/js/dataHelpers.js";

// The store saves canonical data from the server. Patches are layered on top of this.
export class DataStore extends ReactiveStore {
  constructor() {
    super("dataStore");
    // Single-value signals
    this.$currentUser = new Signal.State(null);
    this.$profileSearchResults = new Signal.State(null);
    this.$chatRecipientSearchResults = new Signal.State(null);
    this.$searchTypeaheadResults = new Signal.State(null);
    this.$sidebarSearchTypeaheadResults = new Signal.State(null);
    this.$feedSearchResults = new Signal.State(null);
    this.$notifications = new Signal.State(null);
    this.$mentionNotifications = new Signal.State(null);
    this.$notificationsLastSeenAt = new Signal.State(null);
    this.$pinnedItems = new Signal.State(null);
    this.$bookmarks = new Signal.State(null);
    this.$drafts = new Signal.State(null);
    this.$convoList = new Signal.State(null);
    this.$convoRequestList = new Signal.State(null);
    this.$blockedProfiles = new Signal.State(null);
    this.$mutedProfiles = new Signal.State(null);
    this.$latestProfileSearchRequestTime = new Signal.State(null);
    this.$latestChatRecipientSearchRequestTime = new Signal.State(null);
    this.$latestSearchTypeaheadRequestTime = new Signal.State(null);
    this.$latestSidebarSearchTypeaheadRequestTime = new Signal.State(null);
    this.$latestFeedSearchRequestTime = new Signal.State(null);
    this.$trends = new Signal.State(null);
    this.$postSearchResultsTop = new Signal.State(null);
    this.$postSearchResultsLatest = new Signal.State(null);
    this.$latestPostSearchRequestTimeTop = new Signal.State(null);
    this.$latestPostSearchRequestTimeLatest = new Signal.State(null);
    // Keyed signals
    this.$showLessInteractions = new SignalMap();
    this.$showMoreInteractions = new SignalMap();
    this.$feeds = new SignalMap();
    this.$posts = new SignalMap();
    this.$embeddedPosts = new SignalMap();
    this.$postThreads = new SignalMap();
    this.$postThreadOthers = new SignalMap();
    this.$profiles = new SignalMap();
    this.$detailedProfiles = new SignalMap();
    this.$authorFeeds = new SignalMap();
    this.$unavailablePosts = new SignalMap();
    this.$reposts = new SignalMap();
    this.$convos = new SignalMap();
    this.$convoMemberLists = new SignalMap();
    this.$convoMessages = new SignalMap();
    this.$messages = new SignalMap();
    this.$postLikes = new SignalMap();
    this.$postQuotes = new SignalMap();
    this.$postReposts = new SignalMap();
    this.$feedGenerators = new SignalMap();
    this.$lists = new SignalMap();
    this.$starterPacks = new SignalMap();
    this.$listMembers = new SignalMap();
    this.$actorFeeds = new SignalMap();
    this.$actorLists = new SignalMap();
    this.$listsWithMembershipByActor = new SignalMap();
    this.$hashtagFeeds = new SignalMap();
    this.$profileFollowers = new SignalMap();
    this.$profileFollows = new SignalMap();
    this.$knownFollowers = new SignalMap();
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

  setProfiles(profiles) {
    for (const profile of profiles) {
      this.$profiles.set(profile.did, profile);
    }
  }

  // Save the convo and sync convo lists if necessary
  setConvo(convo) {
    this.$convos.set(convo.id, convo);
    const isRequest = convo.status === "request";
    const destinationSignal = isRequest
      ? this.$convoRequestList
      : this.$convoList;
    const destinationList = destinationSignal.get();
    if (destinationList) {
      const inList = destinationList.convos.some(
        (listConvo) => listConvo.id === convo.id,
      );
      destinationSignal.set({
        convos: inList
          ? destinationList.convos.map((listConvo) =>
              listConvo.id === convo.id ? convo : listConvo,
            )
          : [convo, ...destinationList.convos],
        cursor: destinationList.cursor,
      });
    }
    // Remove accepted convo from the request list if it's there
    if (!isRequest) {
      const requestList = this.$convoRequestList.get();
      if (
        requestList &&
        requestList.convos.some((listConvo) => listConvo.id === convo.id)
      ) {
        this.$convoRequestList.set({
          convos: requestList.convos.filter(
            (listConvo) => listConvo.id !== convo.id,
          ),
          cursor: requestList.cursor,
        });
      }
    }
  }
}
