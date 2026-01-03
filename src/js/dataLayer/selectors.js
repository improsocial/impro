import {
  filterFollowingFeed,
  filterAlgorithmicFeed,
  filterAuthorFeed,
} from "/js/feedFilters.js";
import {
  createUnavailablePost,
  getPostUriFromRepost,
  getBlockedQuote,
  isBlockingUser,
  replaceBlockedQuote,
  createEmbedFromPost,
  isBlockedPost,
  isPostView,
  getQuotedPost,
  getLastInteractionTimestamp,
  markBlockedQuoteNotFound,
} from "/js/dataHelpers.js";
import { sortBy } from "/js/utils.js";

// Selectors are used to get data from the store.
// They combine the canonical data from the store with the patch data.
export class Selectors {
  constructor(dataStore, patchStore, preferencesProvider, isAuthenticated) {
    this.dataStore = dataStore;
    this.patchStore = patchStore;
    this.preferencesProvider = preferencesProvider;
    this.isAuthenticated = isAuthenticated;
  }

  getCurrentUser() {
    return this.dataStore.getCurrentUser();
  }

  getPreferences() {
    const preferences = this.preferencesProvider.requirePreferences();
    return this.patchStore.applyPreferencePatches(preferences);
  }

  getFeed(feedURI) {
    let feed = this.dataStore.getFeed(feedURI);
    if (!feed) {
      return null;
    }
    // Hydrate
    const hydratedFeedItems = [];
    for (const feedItem of feed.feed) {
      const hydratedFeedItem = {
        feedContext: feedItem.feedContext,
        post: this.getPost(feedItem.post.uri, { required: true }),
      };
      if (feedItem.reason) {
        hydratedFeedItem.reason = feedItem.reason;
      }
      const reply = feedItem.reply;
      if (reply) {
        let root = reply.root;
        if (isPostView(root)) {
          root = this.getPost(root.uri, { required: true });
        }
        let parent = reply.parent;
        if (isPostView(parent)) {
          parent = this.getPost(parent.uri, { required: true });
        }
        const hydratedReply = {
          root,
          parent,
        };
        if (reply.grandparentAuthor) {
          hydratedReply.grandparentAuthor = reply.grandparentAuthor;
        }
        hydratedFeedItem.reply = hydratedReply;
      }
      hydratedFeedItems.push(hydratedFeedItem);
    }
    const hydratedFeed = {
      feed: hydratedFeedItems,
      cursor: feed.cursor,
    };
    if (feedURI === "following") {
      const currentUser = this.getCurrentUser();
      const preferences = this.getPreferences();
      return filterFollowingFeed(hydratedFeed, currentUser, preferences);
    } else {
      return filterAlgorithmicFeed(hydratedFeed);
    }
  }

  getPostThread(postURI) {
    // Load post thread from store, then hydrate it with posts from store
    const postThread = this.dataStore.getPostThread(postURI);
    if (!postThread) {
      return null;
    }
    if (isBlockedPost(postThread) && isBlockingUser(postThread)) {
      return postThread;
    }
    // Hydrate
    const hydratedPostThread = this.hydratePostThread(postThread);
    const parent = postThread.parent;
    if (parent) {
      hydratedPostThread.parent = this.hydratePostThreadParent(parent);
    }
    return hydratedPostThread;
  }

  hydratePostThread(postThread) {
    if (isBlockedPost(postThread) && isBlockingUser(postThread)) {
      return postThread;
    }
    const hydratedPostThread = {
      post: this.getPost(postThread.post.uri, { required: true }),
    };
    if (postThread.replies) {
      hydratedPostThread.replies = postThread.replies.map((reply) => {
        if (reply.$type === "app.bsky.feed.defs#threadViewPost") {
          return this.hydratePostThread(reply);
        }
        return reply;
      });
    }
    return hydratedPostThread;
  }

  hydratePostThreadParent(parent) {
    if (this.dataStore.hasUnavailablePost(parent.uri)) {
      return createUnavailablePost(parent.uri);
    }
    if (isBlockedPost(parent) && isBlockingUser(parent)) {
      return parent;
    }
    if (parent.$type !== "app.bsky.feed.defs#threadViewPost") {
      // not sure how to handle this
      return parent;
    }
    const post = this.getPost(parent.post.uri);
    const hydratedParent = {
      $type: "app.bsky.feed.defs#threadViewPost",
      post: post,
    };
    // keep going up the chain
    if (parent.parent) {
      hydratedParent.parent = this.hydratePostThreadParent(parent.parent);
    }
    return hydratedParent;
  }

  getPost(postURI, { required = false } = {}) {
    // Check for post in store
    let post = this.dataStore.getPost(postURI);
    if (!post) {
      if (required) {
        throw new Error(`Post not found: ${postURI}`);
      }
      return null;
    }
    // Replace blocked quote with full blocked post if necessary
    const blockedQuote = getBlockedQuote(post);
    if (blockedQuote && !isBlockingUser(blockedQuote)) {
      const fullBlockedPost = this.getPost(blockedQuote.uri);
      if (fullBlockedPost) {
        const blockedQuoteEmbed = createEmbedFromPost(fullBlockedPost);
        post = replaceBlockedQuote(post, blockedQuoteEmbed);
      } else {
        post = markBlockedQuoteNotFound(post, blockedQuote.uri);
      }
    }
    post = this._markMutedWords(post);
    return this.patchStore.applyPostPatches(post);
  }

  getProfile(did) {
    const profile = this.dataStore.getProfile(did);
    if (!profile) {
      return null;
    }
    const patchedProfile = this.patchStore.applyProfilePatches(profile);
    return patchedProfile;
  }

  getProfileSearchResults() {
    return this.dataStore.getProfileSearchResults();
  }

  getPostSearchResults() {
    const searchResults = this.dataStore.getPostSearchResults();
    if (!searchResults) {
      return null;
    }
    return searchResults.map((post) => this.getPost(post.uri));
  }

  getAuthorFeed(did, feedType) {
    const feedURI = `${did}-${feedType}`;
    const feed = this.dataStore.getAuthorFeed(feedURI);
    if (!feed) {
      return null;
    }
    // Hydrate
    const hydratedFeedItems = [];
    for (const feedItem of feed.feed) {
      ``;
      const hydratedFeedItem = {
        post: this.getPost(feedItem.post.uri),
      };
      if (feedItem.reason) {
        hydratedFeedItem.reason = feedItem.reason;
      }
      // app.bsky.feed.defs#reasonPin
      // app.bsky.feed.defs#reasonRepost
      if (feedItem.reply) {
        hydratedFeedItem.reply = {
          root: this.getPost(feedItem.reply.root.uri),
          parent: this.getPost(feedItem.reply.parent.uri),
        };
      }
      hydratedFeedItems.push(hydratedFeedItem);
    }
    let hydratedFeed = {
      feed: hydratedFeedItems,
      cursor: feed.cursor,
    };
    if (feedType === "replies") {
      hydratedFeed = this.filterAuthorRepliesFeed(hydratedFeed);
    }
    return filterAuthorFeed(hydratedFeed);
  }

  filterAuthorRepliesFeed(feed) {
    // Filter the feed items to only show replies
    const filteredFeedItems = [];
    for (const feedItem of feed.feed) {
      if (feedItem.reply) {
        filteredFeedItems.push(feedItem);
      }
    }
    return {
      feed: filteredFeedItems,
      cursor: feed.cursor,
    };
  }

  getShowLessInteractions() {
    return this.dataStore.getShowLessInteractions();
  }

  getNotifications() {
    const notifications = this.dataStore.getNotifications();
    if (!notifications) {
      return null;
    }

    return notifications.map((notification) => {
      if (notification.reason === "like" || notification.reason === "repost") {
        let subject = this.getPost(notification.reasonSubject);
        // If it was not found, create an unavailable post.
        if (!subject) {
          subject = createUnavailablePost(notification.reasonSubject);
        }
        return {
          ...notification,
          subject,
        };
      }
      if (
        notification.reason === "like-via-repost" ||
        notification.reason === "repost-via-repost"
      ) {
        const repost = this.dataStore.getRepost(notification.reasonSubject);
        // If it was not found, create an unavailable post.
        const subject = repost
          ? this.getPost(getPostUriFromRepost(repost))
          : createUnavailablePost("no-uri");
        return {
          ...notification,
          subject,
        };
      }
      if (
        notification.reason === "reply" ||
        notification.reason === "mention" ||
        notification.reason === "quote"
      ) {
        const replyPost = this.getPost(notification.uri);
        const parentPostUri = notification.record?.reply?.parent?.uri;
        const parentPost = parentPostUri ? this.getPost(parentPostUri) : null;
        return {
          ...notification,
          post: replyPost,
          parentPost,
        };
      }
      return notification;
    });
  }

  getNotificationCursor() {
    return this.dataStore.getNotificationCursor();
  }

  getConvoList() {
    const convoList = this.dataStore.getConvoList();
    if (!convoList) {
      return null;
    }
    // Hydrate with individual convos
    const hydratedConvos = [];
    for (const convo of convoList) {
      hydratedConvos.push(this.getConvo(convo.id));
    }
    // Sort by last message/reaction timestamp
    // The API response is already sorted, but we need to sort again to account for in-memory patches to the messages.
    const sortedConvos = sortBy(
      hydratedConvos,
      (convo) => new Date(getLastInteractionTimestamp(convo)),
      {
        direction: "desc",
      }
    );
    return sortedConvos;
  }

  getConvoListCursor() {
    return this.dataStore.getConvoListCursor();
  }

  getConvo(convoId) {
    return this.dataStore.getConvo(convoId);
  }

  getConvoForProfile(profileDid) {
    const allConvos = this.dataStore.getAllConvos();
    for (const convo of allConvos) {
      if (
        convo.members.length === 2 &&
        convo.members.some((member) => member.did === profileDid)
      ) {
        return convo;
      }
    }
    return null;
  }

  getMessage(messageId) {
    const message = this.dataStore.getMessage(messageId);
    if (!message) {
      return null;
    }
    return this.patchStore.applyMessagePatches(message);
  }

  getConvoMessages(convoId) {
    const messages = this.dataStore.getConvoMessages(convoId);
    if (!messages) {
      return null;
    }
    const hydratedMessages = messages.messages.map((message) =>
      this.getMessage(message.id)
    );
    return {
      messages: hydratedMessages,
      cursor: messages.cursor,
    };
  }

  getPostLikes(postUri) {
    return this.dataStore.getPostLikes(postUri);
  }

  getPostQuotes(postUri) {
    const quotes = this.dataStore.getPostQuotes(postUri);
    if (!quotes) {
      return null;
    }
    // Hydrate the posts
    const hydratedPosts = quotes.posts.map((post) =>
      this.getPost(post.uri, { required: true })
    );
    return {
      posts: hydratedPosts,
      cursor: quotes.cursor,
    };
  }

  getPostReposts(postUri) {
    return this.dataStore.getPostReposts(postUri);
  }

  getFeedGenerator(feedUri) {
    return this.dataStore.getFeedGenerator(feedUri);
  }

  getHashtagFeed(hashtag, sort) {
    const hashtagKey = `${hashtag}-${sort}`;
    const feed = this.dataStore.getHashtagFeed(hashtagKey);
    if (!feed) {
      return null;
    }
    // Hydrate
    const hydratedFeedItems = [];
    for (const feedItem of feed.feed) {
      const hydratedFeedItem = {
        post: this.getPost(feedItem.post.uri, { required: true }),
      };
      hydratedFeedItems.push(hydratedFeedItem);
    }
    return {
      feed: hydratedFeedItems,
      cursor: feed.cursor,
    };
  }

  getPinnedFeedGenerators() {
    const pinnedFeedGenerators = this.dataStore.getPinnedFeedGenerators();
    if (!pinnedFeedGenerators) {
      return null;
    }
    const hydratedPinnedFeedGenerators = [];
    // Add following feed generator for logged in users
    if (this.isAuthenticated) {
      hydratedPinnedFeedGenerators.push({
        uri: "following",
        displayName: "Following",
      });
    }
    for (const pinnedFeedGenerator of pinnedFeedGenerators) {
      hydratedPinnedFeedGenerators.push(
        this.getFeedGenerator(pinnedFeedGenerator.uri)
      );
    }
    return hydratedPinnedFeedGenerators;
  }

  getBookmarks() {
    const bookmarks = this.dataStore.getBookmarks();
    if (!bookmarks) {
      return null;
    }
    const hydratedBookmarksFeed = [];
    for (const bookmark of bookmarks.feed) {
      hydratedBookmarksFeed.push({
        post: this.getPost(bookmark.post.uri),
      });
    }
    return {
      feed: hydratedBookmarksFeed,
      cursor: bookmarks.cursor,
    };
  }

  getProfileFollowers(profileDid) {
    return this.dataStore.getProfileFollowers(profileDid);
  }

  getProfileFollows(profileDid) {
    return this.dataStore.getProfileFollows(profileDid);
  }

  getProfileChatStatus(profileDid) {
    return this.dataStore.getProfileChatStatus(profileDid);
  }

  _markMutedWords(post) {
    // Add attributes to the post to indicate if it has a muted word.
    // Modifies the post in place.
    const preferences = this.preferencesProvider.requirePreferences();
    const hasMutedWord = preferences.postHasMutedWord(post);
    // It's safe to assume that the viewer object exists since these are based on preferences.
    if (hasMutedWord) {
      // NOTE: LEXICON DEVIATION
      post.viewer.hasMutedWord = true;
    }
    const displayLabels = preferences.getPostLabels(post);
    if (displayLabels.length > 0) {
      // NOTE: LEXICON DEVIATION
      post.viewer.displayLabels = displayLabels;
    }
    // Also check for muted words in quote posts.
    const quotedPost = getQuotedPost(post);
    if (quotedPost) {
      const quotedPostHasMutedWord =
        preferences.quotedPostHasMutedWord(quotedPost);
      if (quotedPostHasMutedWord) {
        // NOTE: LEXICON DEVIATION
        quotedPost.hasMutedWord = true;
      }
      // Check for nested quoted posts.
      const nestedQuotedPost = getQuotedPost(quotedPost);
      if (nestedQuotedPost) {
        const nestedQuotedPostHasMutedWord =
          preferences.quotedPostHasMutedWord(nestedQuotedPost);
        if (nestedQuotedPostHasMutedWord) {
          // NOTE: LEXICON DEVIATION
          nestedQuotedPost.hasMutedWord = true;
        }
      }
    }
    return post;
  }
}
