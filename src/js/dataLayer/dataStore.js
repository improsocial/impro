import { Signal, SignalMap, ReactiveStore } from "/js/signals.js";
import { getQuotedPost, embedViewRecordToPostView } from "/js/dataHelpers.js";

// The store saves canonical data from the server. Patches are layered on top of this.
export class DataStore extends ReactiveStore {
  constructor() {
    super("dataStore");
    // Single-value signals
    this.$currentUser = new Signal.State(null);
    this.$profileSearchResults = new Signal.State(null);
    this.$postSearchResults = new Signal.State(null);
    this.$feedSearchResults = new Signal.State(null);
    this.$showLessInteractions = new Signal.State([]);
    this.$showMoreInteractions = new Signal.State([]);
    this.$notifications = new Signal.State(null);
    this.$notificationCursor = new Signal.State(null);
    this.$mentionNotifications = new Signal.State(null);
    this.$mentionNotificationCursor = new Signal.State(null);
    this.$pinnedItems = new Signal.State(null);
    this.$bookmarks = new Signal.State(null);
    this.$convoList = new Signal.State(null);
    this.$convoListCursor = new Signal.State(null);
    this.$blockedProfiles = new Signal.State(null);
    this.$mutedProfiles = new Signal.State(null);
    this.$currentUserListMemberships = new Signal.State(null);
    this.$latestProfileSearchRequestTime = new Signal.State(null);
    this.$latestPostSearchRequestTime = new Signal.State(null);
    this.$latestFeedSearchRequestTime = new Signal.State(null);
    // Keyed signals
    this.$feeds = new SignalMap();
    this.$posts = new SignalMap();
    this.$postThreads = new SignalMap();
    this.$postThreadOthers = new SignalMap();
    this.$profiles = new SignalMap();
    this.$authorFeeds = new SignalMap();
    this.$unavailablePosts = new SignalMap();
    this.$reposts = new SignalMap();
    this.$convos = new SignalMap();
    this.$convoMessages = new SignalMap();
    this.$messages = new SignalMap();
    this.$postLikes = new SignalMap();
    this.$postQuotes = new SignalMap();
    this.$postReposts = new SignalMap();
    this.$feedGenerators = new SignalMap();
    this.$lists = new SignalMap();
    this.$listMembers = new SignalMap();
    this.$actorFeeds = new SignalMap();
    this.$actorLists = new SignalMap();
    this.$hashtagFeeds = new SignalMap();
    this.$profileFollowers = new SignalMap();
    this.$profileFollows = new SignalMap();
    this.$profileChatStatus = new SignalMap();
    this.$labelerInfo = new SignalMap();
  }

  setPosts(posts) {
    for (const post of posts) {
      this.$posts.set(post.uri, post);
      const quotedPost = getQuotedPost(post);
      if (
        quotedPost?.$type === "app.bsky.embed.record#viewRecord" &&
        this.$posts.get(quotedPost.uri) == null
      ) {
        this.$posts.set(quotedPost.uri, embedViewRecordToPostView(quotedPost));
      }
    }
  }
}
