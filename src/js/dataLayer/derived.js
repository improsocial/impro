import {
  filterFollowingFeed,
  filterAlgorithmicFeed,
  filterAuthorFeed,
  filterBookmarksFeed,
} from "/js/feedFilters.js";
import {
  createUnavailablePost,
  createEmbedFromPost,
  getBlockedQuote,
  getPostUriFromRepost,
  getQuotedPost,
  isBlockedPost,
  isBlockingUser,
  isEmptyPost,
  isPostView,
  getLastInteractionTimestamp,
  markBlockedQuoteNotFound,
  replaceBlockedQuote,
} from "/js/dataHelpers.js";
import { sortBy, deepClone } from "/js/utils.js";
import {
  effect,
  Signal,
  SignalMap,
  ComputedMap,
  ReactiveStore,
} from "/js/signals.js";

function resolveBlockedQuote(post, { getPost }) {
  const blockedQuote = getBlockedQuote(post);
  if (!blockedQuote || isBlockingUser(blockedQuote)) return post;
  const fullBlockedPost = getPost(blockedQuote.uri);
  if (fullBlockedPost) {
    const blockedQuoteEmbed = createEmbedFromPost(fullBlockedPost);
    return replaceBlockedQuote(post, blockedQuoteEmbed);
  }
  return markBlockedQuoteNotFound(post, blockedQuote.uri);
}

function applyMutedWordsInPlace(post, preferences) {
  if (preferences.postHasMutedWord(post)) {
    if (!post.viewer) post.viewer = {};
    post.viewer.hasMutedWord = true;
  }
  const quotedPost = getQuotedPost(post);
  if (quotedPost) {
    if (preferences.quotedPostHasMutedWord(quotedPost)) {
      quotedPost.hasMutedWord = true;
    }
    const nestedQuotedPost = getQuotedPost(quotedPost);
    if (
      nestedQuotedPost &&
      preferences.quotedPostHasMutedWord(nestedQuotedPost)
    ) {
      nestedQuotedPost.hasMutedWord = true;
    }
  }
}

function applyIsHiddenInPlace(post, preferences) {
  if (preferences.isPostHidden(post.uri)) {
    if (!post.viewer) post.viewer = {};
    post.viewer.isHidden = true;
  }
  const quotedPost = getQuotedPost(post);
  if (quotedPost) {
    if (preferences.isPostHidden(quotedPost.uri)) {
      quotedPost.isHidden = true;
    }
    const nestedQuotedPost = getQuotedPost(quotedPost);
    if (nestedQuotedPost && preferences.isPostHidden(nestedQuotedPost.uri)) {
      nestedQuotedPost.isHidden = true;
    }
  }
}

function applyLabelsInPlace(post, preferences) {
  const badgeLabels = preferences.getBadgeLabels(post);
  if (badgeLabels.length > 0) {
    post.badgeLabels = badgeLabels;
  }
  const contentLabel = preferences.getContentLabel(post);
  if (contentLabel) {
    post.contentLabel = contentLabel;
  }
  const mediaLabel = preferences.getMediaLabel(post);
  if (mediaLabel) {
    post.mediaLabel = mediaLabel;
  }
  const quotedPost = getQuotedPost(post);
  if (quotedPost) {
    const quotedBadgeLabels = preferences.getBadgeLabels(quotedPost);
    if (quotedBadgeLabels.length > 0) {
      quotedPost.badgeLabels = quotedBadgeLabels;
    }
    const quotedContentLabel = preferences.getContentLabel(quotedPost);
    if (quotedContentLabel) {
      quotedPost.contentLabel = quotedContentLabel;
    }
    const quotedMediaLabel = preferences.getMediaLabel(quotedPost);
    if (quotedMediaLabel) {
      quotedPost.mediaLabel = quotedMediaLabel;
    }
    const nestedQuotedPost = getQuotedPost(quotedPost);
    if (nestedQuotedPost) {
      const nestedBadgeLabels = preferences.getBadgeLabels(nestedQuotedPost);
      if (nestedBadgeLabels.length > 0) {
        nestedQuotedPost.badgeLabels = nestedBadgeLabels;
      }
      const nestedContentLabel = preferences.getContentLabel(nestedQuotedPost);
      if (nestedContentLabel) {
        nestedQuotedPost.contentLabel = nestedContentLabel;
      }
      const nestedMediaLabel = preferences.getMediaLabel(nestedQuotedPost);
      if (nestedMediaLabel) {
        nestedQuotedPost.mediaLabel = nestedMediaLabel;
      }
    }
  }
}

// Composes the per-post hydrations a view typically wants.
// Returns a new post object; never mutates the input.
function hydratePostForView(post, { preferences, getPost }) {
  if (!post) return null;
  const resolved = resolveBlockedQuote(post, { getPost });
  const result = resolved === post ? deepClone(post) : deepClone(resolved);
  applyMutedWordsInPlace(result, preferences);
  applyIsHiddenInPlace(result, preferences);
  applyLabelsInPlace(result, preferences);
  return result;
}

// Attach parentAuthor to a post's reply record when its parent is loaded.
// Returns the input unchanged if there's no reply or the parent isn't loaded.
function attachParentAuthor(post, getPost) {
  const parentUri = post?.record?.reply?.parent?.uri;
  if (!parentUri) return post;
  const parentPost = getPost(parentUri);
  if (!parentPost) return post;
  return {
    ...post,
    record: {
      ...post.record,
      reply: {
        // NOTE: LEXICON DEVIATION
        ...post.record.reply,
        parentAuthor: parentPost.author,
      },
    },
  };
}

function hydrateNotifications(notifications, { getPost }) {
  if (!notifications) return null;
  return notifications.map((notification) => {
    if (notification.reason === "like" || notification.reason === "repost") {
      const subject =
        getPost(notification.reasonSubject) ??
        createUnavailablePost(notification.reasonSubject);
      return { ...notification, subject };
    }
    if (
      notification.reason === "like-via-repost" ||
      notification.reason === "repost-via-repost"
    ) {
      const postUri = notification.record.subject.uri;
      const subject = getPost(postUri) ?? createUnavailablePost(postUri);
      return { ...notification, subject };
    }
    if (
      notification.reason === "reply" ||
      notification.reason === "mention" ||
      notification.reason === "quote"
    ) {
      const replyPost = getPost(notification.uri);
      const parentPostUri = notification.record?.reply?.parent?.uri;
      const parentPost = parentPostUri ? getPost(parentPostUri) : null;
      return { ...notification, post: replyPost, parentPost };
    }
    if (notification.reason === "subscribed-post") {
      const post = getPost(notification.uri);
      // NOTE: LEXICON DEVIATION
      return { ...notification, reasonSubject: post };
    }
    return notification;
  });
}

function hydratePostThreadNode(node, { getPost, hiddenReplyUris }) {
  if (!node || isEmptyPost(node)) return node;
  const post = getPost(node.post.uri);
  if (!post) return null;
  const hydrated = { post };
  if (hiddenReplyUris.includes(node.post.uri)) {
    // NOTE: LEXICON DEVIATION
    hydrated.post = { ...post, isHidden: true };
  }
  if (node.replies) {
    hydrated.replies = node.replies.map((reply) => {
      if (reply.$type === "app.bsky.feed.defs#threadViewPost") {
        return hydratePostThreadNode(reply, { getPost, hiddenReplyUris });
      }
      return reply;
    });
  }
  return hydrated;
}

function hydratePostThreadParent(parent, { getPost, isUnavailable }) {
  if (isUnavailable(parent.uri)) {
    return createUnavailablePost(parent.uri);
  }
  if (isBlockedPost(parent) && isBlockingUser(parent)) {
    return parent;
  }
  if (parent.$type !== "app.bsky.feed.defs#threadViewPost") {
    return parent;
  }
  const hydratedParent = {
    $type: "app.bsky.feed.defs#threadViewPost",
    post: getPost(parent.post.uri),
  };
  if (parent.parent) {
    hydratedParent.parent = hydratePostThreadParent(parent.parent, {
      getPost,
      isUnavailable,
    });
  }
  return hydratedParent;
}

export class Derived extends ReactiveStore {
  constructor(
    dataStore,
    patchStore,
    preferencesProvider,
    pluginService,
    isAuthenticated,
  ) {
    super("derived");
    this.dataStore = dataStore;
    this.patchStore = patchStore;
    this.preferencesProvider = preferencesProvider;
    this.pluginService = pluginService;
    this.isAuthenticated = isAuthenticated;
    this.$showLessInteractions = new Signal.Computed(() =>
      this.dataStore.$showLessInteractions.get(),
    );
    this.$hydratedPosts = new ComputedMap((uri) => {
      const post = this.patchStore.$patchedPosts.get(uri);
      const preferences = this.$preferences.get();
      if (!post || !preferences) {
        return null;
      }
      return hydratePostForView(post, {
        preferences,
        getPost: (uri) => this.$hydratedPosts.get(uri),
      });
    });
    this.$hydratedFeeds = new ComputedMap((feedURI) => {
      const feed = this.dataStore.$feeds.get(feedURI);
      if (!feed) {
        return null;
      }
      const hydratedFeedItems = [];
      for (const feedItem of feed.feed) {
        const hydratedFeedItem = {
          feedContext: feedItem.feedContext,
          post: this.$hydratedPosts.get(feedItem.post.uri),
        };
        if (feedItem.reason) {
          hydratedFeedItem.reason = feedItem.reason;
        }
        const reply = feedItem.reply;
        if (reply) {
          let root = reply.root;
          if (isPostView(root)) {
            root = this.$hydratedPosts.get(root.uri);
          }
          let parent = reply.parent;
          if (isPostView(parent)) {
            parent = this.$hydratedPosts.get(parent.uri);
          }
          hydratedFeedItem.reply = { ...reply, root, parent };
        }
        hydratedFeedItems.push(hydratedFeedItem);
      }
      const hydratedFeed = {
        feed: hydratedFeedItems,
        cursor: feed.cursor,
      };
      const pluginFilteredFeedItems =
        this.pluginService.$pluginFilteredFeedItems.get(feedURI) ?? {};
      if (feedURI === "following") {
        const currentUser = this.$currentUser.get();
        const preferences = this.$preferences.get();
        return filterFollowingFeed(
          hydratedFeed,
          currentUser,
          preferences,
          pluginFilteredFeedItems,
        );
      } else {
        return filterAlgorithmicFeed(
          hydratedFeed,
          this.isAuthenticated,
          pluginFilteredFeedItems,
        );
      }
    });
    this.$currentUser = new Signal.Computed(() => {
      const user = this.dataStore.$currentUser.get();
      const patches = this.patchStore.$currentUserPatches.get();
      return this.patchStore.applyCurrentUserPatches(user, patches);
    });
    this.$preferences = new Signal.Computed(() => {
      const preferences = this.preferencesProvider.$preferences.get();
      if (!preferences) return null;
      const patches = this.patchStore.$preferencePatches.get();
      return this.patchStore.applyPreferencePatches(preferences, patches);
    });
    const getHydratedPost = (uri) => this.$hydratedPosts.get(uri);
    this.$notifications = new Signal.Computed(() =>
      hydrateNotifications(this.dataStore.$notifications.get(), {
        getPost: getHydratedPost,
      }),
    );
    this.$mentionNotifications = new Signal.Computed(() =>
      hydrateNotifications(this.dataStore.$mentionNotifications.get(), {
        getPost: getHydratedPost,
      }),
    );
    this.$hydratedPostThreads = new ComputedMap((postURI) => {
      const postThread = this.dataStore.$postThreads.get(postURI);
      const postThreadOther = this.dataStore.$postThreadOthers.get(postURI);
      if (!postThread || !postThreadOther) {
        return null;
      }
      if (isEmptyPost(postThread)) {
        return postThread;
      }
      const hiddenReplyUris = postThreadOther.map((item) => item.uri);
      const hydrated = hydratePostThreadNode(postThread, {
        getPost: getHydratedPost,
        hiddenReplyUris,
      });
      if (!hydrated) {
        return null;
      }
      if (postThread.parent) {
        hydrated.parent = hydratePostThreadParent(postThread.parent, {
          getPost: getHydratedPost,
          isUnavailable: (uri) =>
            this.dataStore.$unavailablePosts.get(uri) !== null,
        });
      }
      return hydrated;
    });
    this.$hydratedHashtagFeeds = new ComputedMap((hashtagKey) => {
      const feed = this.dataStore.$hashtagFeeds.get(hashtagKey);
      if (!feed) {
        return null;
      }
      const hydratedFeedItems = [];
      for (const feedItem of feed.feed) {
        const post = this.$hydratedPosts.get(feedItem.post.uri);
        if (!post) continue;
        hydratedFeedItems.push({
          post: attachParentAuthor(post, getHydratedPost),
        });
      }
      return {
        feed: hydratedFeedItems,
        cursor: feed.cursor,
      };
    });
    this.$feedGenerators = new ComputedMap((feedUri) =>
      this.dataStore.$feedGenerators.get(feedUri),
    );
    this.$lists = new ComputedMap((listUri) =>
      this.dataStore.$lists.get(listUri),
    );
    this.$listMembers = new ComputedMap((listUri) =>
      this.dataStore.$listMembers.get(listUri),
    );
    this.$profileSearchResults = new Signal.Computed(() => {
      const data = this.dataStore.$profileSearchResults.get();
      if (!data) return null;
      return data.actors;
    });
    this.$profileSearchCursor = new Signal.Computed(
      () => this.dataStore.$profileSearchResults.get()?.cursor ?? null,
    );
    this.$feedSearchResults = new Signal.Computed(() => {
      const data = this.dataStore.$feedSearchResults.get();
      if (!data) return null;
      return data.feeds;
    });
    this.$feedSearchCursor = new Signal.Computed(
      () => this.dataStore.$feedSearchResults.get()?.cursor ?? null,
    );
    this.$postSearchResults = new Signal.Computed(() => {
      const data = this.dataStore.$postSearchResults.get();
      if (!data) return null;
      const hydratedSearchResults = [];
      for (const result of data.posts) {
        const post = this.$hydratedPosts.get(result.uri);
        if (!post) continue;
        hydratedSearchResults.push(attachParentAuthor(post, getHydratedPost));
      }
      return hydratedSearchResults;
    });
    this.$postSearchCursor = new Signal.Computed(
      () => this.dataStore.$postSearchResults.get()?.cursor ?? null,
    );
    this.$hydratedPostQuotes = new ComputedMap((postUri) => {
      const quotes = this.dataStore.$postQuotes.get(postUri);
      if (!quotes) {
        return null;
      }
      const hydratedPosts = [];
      for (const quote of quotes.posts) {
        const post = this.$hydratedPosts.get(quote.uri);
        if (!post) continue;
        hydratedPosts.push(attachParentAuthor(post, getHydratedPost));
      }
      return {
        posts: hydratedPosts,
        cursor: quotes.cursor,
      };
    });
    this.$hydratedPinnedItems = new Signal.Computed(() => {
      const pinnedItems = this.dataStore.$pinnedItems.get();
      if (!pinnedItems) return null;
      return pinnedItems.map((item) => {
        if (item.type === "following") {
          return {
            type: "following",
            data: item.data,
            uri: "following",
            displayName: "Following",
          };
        }
        if (item.type === "list") {
          return {
            type: "list",
            data: item.data,
            uri: item.data.uri,
            displayName: item.data.name,
          };
        }
        const feedGenerator =
          this.$feedGenerators.get(item.data.uri) ?? item.data;
        return {
          type: "feed",
          data: feedGenerator,
          ...feedGenerator,
        };
      });
    });
    this.$hydratedProfiles = new ComputedMap((did) =>
      this.patchStore.$patchedProfiles.get(did),
    );
    this.$hydratedAuthorFeeds = new ComputedMap((feedURI) => {
      const rawFeed = this.dataStore.$authorFeeds.get(feedURI);
      if (!rawFeed) {
        return null;
      }
      const patches = this.patchStore.$authorFeedPatches.get(feedURI) || [];
      let feed = { feed: [...rawFeed.feed], cursor: rawFeed.cursor };
      for (const patch of patches) {
        feed = this.patchStore.applyAuthorFeedPatch(feed, patch.body);
      }
      const hydratedFeedItems = [];
      for (const feedItem of feed.feed) {
        const hydratedFeedItem = {
          post: this.$hydratedPosts.get(feedItem.post.uri),
        };
        if (feedItem.reason) {
          hydratedFeedItem.reason = feedItem.reason;
        }
        if (feedItem.reply) {
          hydratedFeedItem.reply = {
            ...feedItem.reply,
            root: this.$hydratedPosts.get(feedItem.reply.root.uri),
            parent: this.$hydratedPosts.get(feedItem.reply.parent.uri),
          };
        }
        hydratedFeedItems.push(hydratedFeedItem);
      }
      let hydratedFeed = {
        feed: hydratedFeedItems,
        cursor: feed.cursor,
      };
      const dashIndex = feedURI.lastIndexOf("-");
      const feedType = dashIndex >= 0 ? feedURI.slice(dashIndex + 1) : "";
      if (feedType === "replies") {
        const filteredFeedItems = [];
        for (const feedItem of hydratedFeed.feed) {
          if (feedItem.reply && !feedItem.reason) {
            filteredFeedItems.push(feedItem);
          }
        }
        hydratedFeed = {
          feed: filteredFeedItems,
          cursor: hydratedFeed.cursor,
        };
      }
      return filterAuthorFeed(hydratedFeed, this.isAuthenticated);
    });
    this.$actorFeeds = new ComputedMap((did) =>
      this.dataStore.$actorFeeds.get(did),
    );
    this.$actorLists = new ComputedMap((did) =>
      this.dataStore.$actorLists.get(did),
    );
    this.$profileChatStatus = new ComputedMap((did) =>
      this.dataStore.$profileChatStatus.get(did),
    );
    this.$labelerInfo = new ComputedMap((did) =>
      this.dataStore.$labelerInfo.get(did),
    );
    this.$hydratedBookmarks = new Signal.Computed(() => {
      const bookmarks = this.dataStore.$bookmarks.get();
      if (!bookmarks) {
        return null;
      }
      const hydratedFeed = [];
      for (const bookmark of bookmarks.feed) {
        const post = this.$hydratedPosts.get(bookmark.post.uri);
        hydratedFeed.push({ post: attachParentAuthor(post, getHydratedPost) });
      }
      return filterBookmarksFeed({
        feed: hydratedFeed,
        cursor: bookmarks.cursor,
      });
    });
    this.$labelerSettings = new ComputedMap((labelerDid) => {
      const preferences = this.$preferences.get();
      if (!preferences) return null;
      return preferences.getLabelerSettings(labelerDid);
    });
    this.$convos = new ComputedMap((convoId) =>
      this.dataStore.$convos.get(convoId),
    );
    this.$convoList = new Signal.Computed(() => {
      const convoList = this.dataStore.$convoList.get();
      if (!convoList) return null;
      const hydrated = convoList.map((convo) => this.$convos.get(convo.id));
      return sortBy(
        hydrated,
        (convo) => new Date(getLastInteractionTimestamp(convo)),
        { direction: "desc" },
      );
    });
    this.$convoListCursor = new Signal.Computed(() =>
      this.dataStore.$convoListCursor.get(),
    );
    this.$convoForProfile = new ComputedMap((profileDid) => {
      const convoIds = [...this.dataStore.$convos.keys()];
      for (const convoId of convoIds) {
        const convo = this.dataStore.$convos.get(convoId);
        if (!convo) continue;
        if (
          convo.members.length === 2 &&
          convo.members.some((member) => member.did === profileDid)
        ) {
          return this.$convos.get(convo.id);
        }
      }
      return null;
    });
    this.$convoMessages = new ComputedMap((convoId) => {
      const messages = this.dataStore.$convoMessages.get(convoId);
      if (!messages) return null;
      return {
        messages: messages.messages.map((message) =>
          this.patchStore.$patchedMessages.get(message.id),
        ),
        cursor: messages.cursor,
      };
    });
    this.$postLikes = new ComputedMap((postUri) =>
      this.dataStore.$postLikes.get(postUri),
    );
    this.$postReposts = new ComputedMap((postUri) =>
      this.dataStore.$postReposts.get(postUri),
    );
    this.$profileFollows = new ComputedMap((did) =>
      this.dataStore.$profileFollows.get(did),
    );
    this.$profileFollowers = new ComputedMap((did) =>
      this.dataStore.$profileFollowers.get(did),
    );
    this.$mutedProfiles = new Signal.Computed(() =>
      this.dataStore.$mutedProfiles.get(),
    );
    this.$blockedProfiles = new Signal.Computed(() =>
      this.dataStore.$blockedProfiles.get(),
    );
    this.$notificationCursor = new Signal.Computed(() =>
      this.dataStore.$notificationCursor.get(),
    );
    this.$mentionNotificationCursor = new Signal.Computed(() =>
      this.dataStore.$mentionNotificationCursor.get(),
    );
  }
}
