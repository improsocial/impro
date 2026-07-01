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
  getInteractionProfileDids,
  getLastInteractionTimestamp,
  isGroupConvo,
  markBlockedQuoteNotFound,
  replaceBlockedQuote,
  transformNestedQuotes,
  attachJoinLinkPreviewToEmbed,
  getJoinLinkCodeFromEmbed,
} from "/js/dataHelpers.js";
import { sortBy } from "/js/utils.js";
import {
  effect,
  Signal,
  SignalMap,
  ComputedMap,
  ReactiveStore,
  untrack,
} from "/js/signals.js";

function applyMutedWords(post, preferences) {
  let result = post;
  if (preferences.postHasMutedWord(post)) {
    result = {
      ...result,
      viewer: { ...(result.viewer ?? {}), hasMutedWord: true },
    };
  }
  return transformNestedQuotes(result, (quotedPost) => {
    if (!preferences.quotedPostHasMutedWord(quotedPost)) return quotedPost;
    return { ...quotedPost, hasMutedWord: true };
  });
}

function applyIsHidden(post, preferences) {
  let result = post;
  if (preferences.isPostHidden(post.uri)) {
    result = {
      ...result,
      viewer: { ...(result.viewer ?? {}), isHidden: true },
    };
  }
  return transformNestedQuotes(result, (quotedPost) => {
    if (!preferences.isPostHidden(quotedPost.uri)) return quotedPost;
    return { ...quotedPost, isHidden: true };
  });
}

function applyLabelsToPost(post, preferences) {
  let result = post;
  const badgeLabels = preferences.getBadgeLabels(post);
  if (badgeLabels.length > 0) {
    result = { ...result, badgeLabels };
  }
  const contentLabel = preferences.getContentLabel(post);
  if (contentLabel) {
    result = { ...result, contentLabel };
  }
  const mediaLabel = preferences.getMediaLabel(post);
  if (mediaLabel) {
    result = { ...result, mediaLabel };
  }
  const authorBlurLabel = preferences.getProfileBlurLabel(result.author);
  if (authorBlurLabel) {
    result = {
      ...result,
      author: { ...result.author, blurLabel: authorBlurLabel },
    };
  }
  return result;
}

function applyLabels(post, preferences) {
  const result = applyLabelsToPost(post, preferences);
  return transformNestedQuotes(result, (quotedPost) =>
    applyLabelsToPost(quotedPost, preferences),
  );
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
      let result = this.resolveBlockedQuote(post);
      result = this.attachJoinLinkPreview(result);
      result = applyMutedWords(result, preferences);
      result = applyIsHidden(result, preferences);
      result = applyLabels(result, preferences);
      return result;
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
    this.$notifications = new Signal.Computed(() => {
      const notifications = this.dataStore.$notifications.get();
      if (!notifications) return null;
      return notifications.map((notification) =>
        this.hydrateNotification(notification),
      );
    });
    this.$mentionNotifications = new Signal.Computed(() => {
      const notifications = this.dataStore.$mentionNotifications.get();
      if (!notifications) return null;
      return notifications.map((notification) =>
        this.hydrateNotification(notification),
      );
    });
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
      const hydrated = this.hydratePostThreadNode(postThread, hiddenReplyUris);
      if (!hydrated) {
        return null;
      }
      if (postThread.parent) {
        hydrated.parent = this.hydratePostThreadParent(postThread.parent);
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
          post: this.attachParentAuthor(post),
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
    this.$listMembers = new ComputedMap((listUri) => {
      const data = this.dataStore.$listMembers.get(listUri);
      if (!data) return data;
      return {
        ...data,
        members: data.members.map((actor) =>
          this.$hydratedProfiles.get(actor.did),
        ),
      };
    });
    this.$profileSearchResults = new Signal.Computed(() => {
      const data = this.dataStore.$profileSearchResults.get();
      if (!data) return null;
      return data.actors.map((actor) => this.$hydratedProfiles.get(actor.did));
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
        hydratedSearchResults.push(this.attachParentAuthor(post));
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
        hydratedPosts.push(this.attachParentAuthor(post));
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
    this.$hydratedProfiles = new ComputedMap((did) => {
      const profile = this.patchStore.$patchedProfiles.get(did);
      if (!profile) return profile;
      const preferences = this.$preferences.get();
      if (!preferences) return profile;
      const blurLabel = preferences.getProfileBlurLabel(profile);
      if (!blurLabel) return profile;
      return { ...profile, blurLabel };
    });
    this.$hydratedDetailedProfiles = new ComputedMap((did) => {
      const profile = this.patchStore.$patchedDetailedProfiles.get(did);
      if (!profile) return null;
      const preferences = this.$preferences.get();
      if (!preferences) return profile;
      const blurLabel = preferences.getProfileBlurLabel(profile);
      if (!blurLabel) return profile;
      return { ...profile, blurLabel };
    });
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
    this.$listsWithMembershipByActor = new ComputedMap((did) =>
      this.dataStore.$listsWithMembershipByActor.get(did),
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
        hydratedFeed.push({ post: this.attachParentAuthor(post) });
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
    // The convo's members plus the hydrated profiles its interactions
    // reference (group convo member lists are partial)
    this.$convoProfiles = new ComputedMap((convoId) => {
      const convo = this.dataStore.$convos.get(convoId);
      if (!convo) return [];
      const messages = this.dataStore.$convoMessages.get(convoId);
      const interactions = [
        convo.lastMessage,
        convo.lastReaction,
        ...(messages?.messages ?? []),
      ];
      const referencedDids = new Set(
        interactions.flatMap((interaction) =>
          getInteractionProfileDids(interaction),
        ),
      );
      const referencedProfiles = [...referencedDids]
        .filter((did) => !convo.members.some((member) => member.did === did))
        .map((did) => this.$hydratedProfiles.get(did))
        .filter(Boolean);
      return [...convo.members, ...referencedProfiles];
    });
    this.$convoForProfile = new ComputedMap((profileDid) => {
      const convoIds = [...this.dataStore.$convos.keys()];
      for (const convoId of convoIds) {
        const convo = untrack(() => this.dataStore.$convos.get(convoId));
        if (!convo) continue;
        if (isGroupConvo(convo)) continue;
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
        messages: messages.messages.map((message) => {
          const patched = this.patchStore.$patchedMessages.get(message.id);
          return this.attachJoinLinkPreview(patched);
        }),
        cursor: messages.cursor,
      };
    });
    this.$hydratedConvoMessages = new ComputedMap((convoId) => {
      return this.$convoMessages.get(convoId);
    });
    this.$postLikes = new ComputedMap((postUri) => {
      const data = this.dataStore.$postLikes.get(postUri);
      if (!data) return data;
      return {
        ...data,
        likes: data.likes.map((like) => ({
          ...like,
          actor: this.$hydratedProfiles.get(like.actor.did),
        })),
      };
    });
    this.$postReposts = new ComputedMap((postUri) => {
      const data = this.dataStore.$postReposts.get(postUri);
      if (!data) return data;
      return {
        ...data,
        reposts: data.reposts.map((actor) =>
          this.$hydratedProfiles.get(actor.did),
        ),
      };
    });
    this.$profileFollows = new ComputedMap((did) => {
      const data = this.dataStore.$profileFollows.get(did);
      if (!data) return data;
      return {
        ...data,
        follows: data.follows.map((actor) =>
          this.$hydratedProfiles.get(actor.did),
        ),
      };
    });
    this.$profileFollowers = new ComputedMap((did) => {
      const data = this.dataStore.$profileFollowers.get(did);
      if (!data) return data;
      return {
        ...data,
        followers: data.followers.map((actor) =>
          this.$hydratedProfiles.get(actor.did),
        ),
      };
    });
    this.$knownFollowers = new ComputedMap((did) => {
      const data = this.dataStore.$knownFollowers.get(did);
      if (!data) return data;
      return {
        ...data,
        followers: data.followers.map((actor) =>
          this.$hydratedProfiles.get(actor.did),
        ),
      };
    });
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

  attachJoinLinkPreview(item) {
    const code = getJoinLinkCodeFromEmbed(item?.embed);
    if (!code) return item;
    const preview = this.dataStore.$joinLinkPreviewsByCode.get(code);
    if (!preview) return item;
    const updated = attachJoinLinkPreviewToEmbed(item.embed, preview);
    if (!updated) return item;
    return { ...item, embed: updated };
  }

  resolveBlockedQuote(post) {
    const blockedQuote = getBlockedQuote(post);
    if (!blockedQuote || isBlockingUser(blockedQuote)) return post;
    const fullBlockedPost = this.$hydratedPosts.get(blockedQuote.uri);
    if (fullBlockedPost) {
      const blockedQuoteEmbed = isEmptyPost(fullBlockedPost)
        ? fullBlockedPost
        : createEmbedFromPost(fullBlockedPost);
      return replaceBlockedQuote(post, blockedQuoteEmbed);
    }
    return markBlockedQuoteNotFound(post, blockedQuote.uri);
  }

  // Attach parentAuthor to a post's reply record when its parent is loaded.
  // Returns the input unchanged if there's no reply or the parent isn't loaded.
  attachParentAuthor(post) {
    const parentUri = post?.record?.reply?.parent?.uri;
    if (!parentUri) return post;
    const parentPost = this.$hydratedPosts.get(parentUri);
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

  hydrateNotification(notification) {
    if (notification.reason === "like" || notification.reason === "repost") {
      const subject =
        this.$hydratedPosts.get(notification.reasonSubject) ??
        createUnavailablePost(notification.reasonSubject);
      return { ...notification, subject };
    }
    if (
      notification.reason === "like-via-repost" ||
      notification.reason === "repost-via-repost"
    ) {
      const postUri = notification.record.subject.uri;
      const subject =
        this.$hydratedPosts.get(postUri) ?? createUnavailablePost(postUri);
      return { ...notification, subject };
    }
    if (
      notification.reason === "reply" ||
      notification.reason === "mention" ||
      notification.reason === "quote"
    ) {
      const replyPost = this.$hydratedPosts.get(notification.uri);
      const parentPostUri = notification.record?.reply?.parent?.uri;
      const parentPost = parentPostUri
        ? this.$hydratedPosts.get(parentPostUri)
        : null;
      return { ...notification, post: replyPost, parentPost };
    }
    if (notification.reason === "subscribed-post") {
      const post = this.$hydratedPosts.get(notification.uri);
      // NOTE: LEXICON DEVIATION
      return { ...notification, reasonSubject: post };
    }
    return notification;
  }

  hydratePostThreadNode(node, hiddenReplyUris) {
    if (!node || isEmptyPost(node)) return node;
    const post = this.$hydratedPosts.get(node.post.uri);
    if (!post) return null;
    const hydrated = { post };
    if (hiddenReplyUris.includes(node.post.uri)) {
      // NOTE: LEXICON DEVIATION
      hydrated.post = { ...post, isHidden: true };
    }
    if (node.replies) {
      hydrated.replies = node.replies.map((reply) => {
        if (reply.$type === "app.bsky.feed.defs#threadViewPost") {
          return this.hydratePostThreadNode(reply, hiddenReplyUris);
        }
        return reply;
      });
    }
    return hydrated;
  }

  hydratePostThreadParent(parent) {
    if (this.dataStore.$unavailablePosts.get(parent.uri) !== null) {
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
      post: this.$hydratedPosts.get(parent.post.uri),
    };
    if (parent.parent) {
      hydratedParent.parent = this.hydratePostThreadParent(parent.parent);
    }
    return hydratedParent;
  }
}
