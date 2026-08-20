import { Requests } from "/js/dataLayer/requests.js";
import {
  actorFeedsQueryKey,
  actorListsQueryKey,
  authorFeedQueryKey,
  blockedProfilesQueryKey,
  bookmarksQueryKey,
  chatRecipientSearchQueryKey,
  convoListQueryKey,
  convoMembersQueryKey,
  convoMessagesQueryKey,
  convoRequestListQueryKey,
  detailedProfileRequestKey,
  draftsQueryKey,
  feedQueryKey,
  feedSearchQueryKey,
  gifSearchQueryKey,
  hashtagFeedQueryKey,
  knownFollowersQueryKey,
  listMembersQueryKey,
  listsWithMembershipQueryKey,
  mentionNotificationsQueryKey,
  mutedProfilesQueryKey,
  notificationsQueryKey,
  pinnedItemsQueryKey,
  postLikesQueryKey,
  postQuotesQueryKey,
  postRepostsQueryKey,
  postSearchLatestQueryKey,
  postSearchTopQueryKey,
  postThreadOtherQueryKey,
  postThreadQueryKey,
  profileFollowersQueryKey,
  profileFollowsQueryKey,
  profileSearchQueryKey,
  searchTypeaheadQueryKey,
  sidebarSearchTypeaheadQueryKey,
  trendsQueryKey,
} from "/js/dataLayer/queryKeys.js";
import {
  filterFollowingFeed,
  filterAlgorithmicFeed,
  filterAuthorFeed,
  filterBookmarksFeed,
} from "/js/feedFilters.js";
import {
  createBlockedPost,
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
  isBlockedByViewer,
  isGroupConvo,
  markBlockedQuoteNotFound,
  replaceBlockedQuote,
  transformNestedQuotes,
  attachJoinLinkPreviewToEmbed,
  getJoinLinkCodeFromEmbed,
  isFollowingFeedUri,
} from "/js/dataHelpers.js";
import { sortBy } from "/js/utils.js";
import { FOLLOWING_FEED_URI } from "/js/config.js";
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
  const badgeLabels = preferences.getBadgeLabelsForPost(post);
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

// Match social-app: hide notifications from blocked / muted
// users unless the viewer follows them (a follow overrides a mute).
function shouldHideNotification(notification) {
  const viewer = notification.author?.viewer;
  if (!viewer) return false;
  if (viewer.blocking) return true;
  if (viewer.muted && !viewer.following) return true;
  return false;
}

function filterBlockedReactions(reactions, memberProfiles) {
  return (reactions || []).filter((reaction) => {
    const profile = memberProfiles.find(
      (member) => member.did === reaction.sender.did,
    );
    return !profile?.viewer?.blocking && !profile?.viewer?.blockedBy;
  });
}

export class Derived extends ReactiveStore {
  constructor(
    dataStore,
    patchStore,
    preferencesProvider,
    hiddenFeedItemsStore,
    isAuthenticated,
    draftMediaStore,
    statusStore,
    queryStore,
  ) {
    super("derived");
    this.dataStore = dataStore;
    this.queryStore = queryStore;
    this.statusStore = statusStore;
    this.patchStore = patchStore;
    this.preferencesProvider = preferencesProvider;
    this.hiddenFeedItemsStore = hiddenFeedItemsStore;
    this.isAuthenticated = isAuthenticated;
    this.draftMediaStore = draftMediaStore;
    this.$showLessInteractions = new ComputedMap(
      (feedUri) => this.dataStore.$showLessInteractions.get(feedUri) ?? [],
    );
    this.$isFollowPending = new ComputedMap((did) =>
      this.patchStore.hasPendingProfilePatch(did, [
        "followProfile",
        "unfollowProfile",
      ]),
    );
    this.$isBlockPending = new ComputedMap((did) =>
      this.patchStore.hasPendingProfilePatch(did, [
        "blockProfile",
        "unblockProfile",
      ]),
    );
    this.$isMutePending = new ComputedMap((did) =>
      this.patchStore.hasPendingProfilePatch(did, [
        "muteProfile",
        "unmuteProfile",
      ]),
    );
    this.$hydratedPosts = new ComputedMap((uri) => {
      const post = this.patchStore.$patchedPosts.get(uri);
      const preferences = this.$preferences.get();
      return this.hydratePost(post, preferences);
    });
    this.$hydratedEmbeddedPosts = new ComputedMap((uri) => {
      const post = this.dataStore.$embeddedPosts.get(uri);
      const preferences = this.$preferences.get();
      return this.hydratePost(post, preferences);
    });
    this.$hydratedFeeds = new ComputedMap((feedURI) => {
      const queryKey = feedQueryKey({ uri: feedURI });
      const feedItems = this.queryStore.getItems(queryKey);
      if (!feedItems) {
        return null;
      }
      const hydratedFeedItems = [];
      for (const feedItem of feedItems) {
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
        cursor: this.queryStore.getNextCursor(queryKey) || null,
      };
      const pluginFilteredFeedItems =
        this.hiddenFeedItemsStore.$items.get(feedURI) ?? {};
      if (isFollowingFeedUri(feedURI)) {
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
    this.$feedError = new ComputedMap(
      (feedURI) =>
        this.statusStore.$errors.get(feedQueryKey({ uri: feedURI })) ?? null,
    );
    this.$isFeedLoading = new ComputedMap(
      (feedURI) =>
        this.statusStore.$loading.get(feedQueryKey({ uri: feedURI })) ?? false,
    );
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
      const notifications = this.queryStore.getItems(notificationsQueryKey());
      if (!notifications) return null;
      return notifications
        .map((notification) => this.hydrateNotification(notification))
        .filter((notification) => !shouldHideNotification(notification));
    });
    this.$mentionNotifications = new Signal.Computed(() => {
      const notifications = this.queryStore.getItems(
        mentionNotificationsQueryKey(),
      );
      if (!notifications) return null;
      return notifications
        .map((notification) => this.hydrateNotification(notification))
        .filter((notification) => !shouldHideNotification(notification));
    });
    this.$hydratedPostThreads = new ComputedMap((postURI) => {
      const postThread = this.queryStore.getValue(
        postThreadQueryKey({ uri: postURI }),
      );
      const postThreadOther = this.queryStore.getValue(
        postThreadOtherQueryKey({ uri: postURI }),
      );
      if (!postThread || !postThreadOther) {
        return null;
      }
      if (isEmptyPost(postThread)) {
        return postThread;
      }
      const hiddenReplyUris = new Set(postThreadOther.map((item) => item.uri));
      const hydrated = this.hydratePostThreadNode(postThread, hiddenReplyUris);
      if (!hydrated) {
        return null;
      }
      if (postThread.parent) {
        hydrated.parent = this.hydratePostThreadParent(postThread.parent);
      }
      return hydrated;
    });
    // Keyed by `${hashtag}-${sort}`; sort never contains a hyphen, so the last
    // one separates the two.
    this.$hydratedHashtagFeeds = new ComputedMap((hashtagKey) => {
      const separatorIndex = hashtagKey.lastIndexOf("-");
      const hashtag = hashtagKey.slice(0, separatorIndex);
      const sort = hashtagKey.slice(separatorIndex + 1);
      const queryKey = hashtagFeedQueryKey({ hashtag, sort });
      const postUris = this.queryStore.getItems(queryKey);
      if (!postUris) {
        return null;
      }
      const hydratedFeedItems = [];
      for (const postUri of postUris) {
        const post = this.$hydratedPosts.get(postUri);
        if (!post) continue;
        hydratedFeedItems.push({
          post: this.attachParentAuthor(post),
        });
      }
      return {
        feed: hydratedFeedItems,
        cursor: this.queryStore.getNextCursor(queryKey) || null,
      };
    });
    this.$feedGenerators = new ComputedMap((feedUri) =>
      this.dataStore.$feedGenerators.get(feedUri),
    );
    this.$lists = new ComputedMap((listUri) =>
      this.dataStore.$lists.get(listUri),
    );
    this.$starterPacks = new ComputedMap((starterPackUri) =>
      this.dataStore.$starterPacks.get(starterPackUri),
    );
    this.$listMembers = new ComputedMap((listUri) => {
      const queryKey = listMembersQueryKey({ listUri });
      const dids = this.queryStore.getItems(queryKey);
      if (!dids) return null;
      return {
        members: dids.map((did) => this.$hydratedProfiles.get(did)),
        cursor: this.queryStore.getNextCursor(queryKey) || null,
      };
    });
    this.$listMemberItemUris = new ComputedMap(
      (listUri) => this.dataStore.$listItemUris.get(listUri) ?? new Map(),
    );
    this.$profileSearchResults = new ComputedMap((query) => {
      const queryKey = profileSearchQueryKey({ query });
      const dids = this.queryStore.getItems(queryKey);
      if (!dids) return null;
      return {
        profiles: dids.map((did) => this.$hydratedProfiles.get(did)),
        cursor: this.queryStore.getNextCursor(queryKey) || null,
      };
    });
    this.$profileSearchError = new ComputedMap(
      (query) =>
        this.statusStore.$errors.get(profileSearchQueryKey({ query })) ?? null,
    );
    this.$isProfileSearchLoading = new ComputedMap(
      (query) =>
        this.statusStore.$loading.get(profileSearchQueryKey({ query })) ??
        false,
    );
    this.$chatRecipientSearchResults = new ComputedMap((query) => {
      const dids = this.queryStore.getItems(
        chatRecipientSearchQueryKey({ query }),
      );
      if (!dids) return null;
      return dids.map((did) => this.$hydratedProfiles.get(did));
    });
    this.$chatRecipientSearchError = new ComputedMap(
      (query) =>
        this.statusStore.$errors.get(chatRecipientSearchQueryKey({ query })) ??
        null,
    );
    this.$searchTypeaheadResults = new ComputedMap((query) => {
      const dids = this.queryStore.getItems(searchTypeaheadQueryKey({ query }));
      if (!dids) return null;
      return dids.map((did) => this.$hydratedProfiles.get(did));
    });
    this.$sidebarSearchTypeaheadResults = new ComputedMap((query) => {
      const dids = this.queryStore.getItems(
        sidebarSearchTypeaheadQueryKey({ query }),
      );
      if (!dids) return null;
      return dids.map((did) => this.$hydratedProfiles.get(did));
    });
    this.$recentSearchTerms = new Signal.Computed(() => {
      const preferences = this.$preferences.get();
      if (!preferences) return [];
      return preferences.getRecentSearches();
    });
    this.$recentSearchProfiles = new Signal.Computed(() => {
      const preferences = this.$preferences.get();
      if (!preferences) return null;
      return preferences.getRecentSearchProfiles().map((did) => ({
        did,
        profile:
          this.$hydratedDetailedProfiles.get(did) ??
          this.$hydratedProfiles.get(did) ??
          null,
      }));
    });
    this.$feedSearchResults = new ComputedMap((query) => {
      const feedUris = this.queryStore.getItems(feedSearchQueryKey({ query }));
      if (!feedUris) return null;
      return feedUris.map((feedUri) => this.$feedGenerators.get(feedUri));
    });
    this.$feedSearchCursor = new ComputedMap(
      (query) =>
        this.queryStore.getNextCursor(feedSearchQueryKey({ query })) || null,
    );
    this.$feedSearchError = new ComputedMap(
      (query) =>
        this.statusStore.$errors.get(feedSearchQueryKey({ query })) ?? null,
    );
    this.$gifResults = new ComputedMap((query) =>
      this.queryStore.getItems(gifSearchQueryKey({ query })),
    );
    this.$gifCursor = new ComputedMap(
      (query) =>
        this.queryStore.getNextCursor(gifSearchQueryKey({ query })) || null,
    );
    this.$isGifsLoading = new ComputedMap(
      (query) =>
        this.statusStore.$loading.get(gifSearchQueryKey({ query })) ?? false,
    );
    this.$gifsError = new ComputedMap(
      (query) =>
        this.statusStore.$errors.get(gifSearchQueryKey({ query })) ?? null,
    );
    this.$recentGifs = new Signal.Computed(() => {
      const preferences = this.$preferences.get();
      if (!preferences) return [];
      return preferences.getRecentGifs();
    });
    this.$trends = new Signal.Computed(() =>
      this.queryStore.getItems(trendsQueryKey()),
    );
    this.$selectedFeedUri = new Signal.Computed(() =>
      this.dataStore.$selectedFeedUri.get(),
    );
    this.$postSearchResultsTop = new ComputedMap((query) => {
      const queryKey = postSearchTopQueryKey({ query });
      const postUris = this.queryStore.getItems(queryKey);
      if (!postUris) {
        return null;
      }
      const hydratedSearchResults = [];
      for (const postUri of postUris) {
        const post = this.$hydratedPosts.get(postUri);
        if (!post) continue;
        hydratedSearchResults.push(this.attachParentAuthor(post));
      }
      return hydratedSearchResults;
    });
    this.$postSearchResultsLatest = new ComputedMap((query) => {
      const queryKey = postSearchLatestQueryKey({ query });
      const postUris = this.queryStore.getItems(queryKey);
      if (!postUris) {
        return null;
      }
      const hydratedSearchResults = [];
      for (const postUri of postUris) {
        const post = this.$hydratedPosts.get(postUri);
        if (!post) continue;
        hydratedSearchResults.push(this.attachParentAuthor(post));
      }
      return hydratedSearchResults;
    });
    this.$postSearchCursorTop = new ComputedMap(
      (query) =>
        this.queryStore.getNextCursor(postSearchTopQueryKey({ query })) || null,
    );
    this.$postSearchTopError = new ComputedMap(
      (query) =>
        this.statusStore.$errors.get(postSearchTopQueryKey({ query })) ?? null,
    );
    this.$isPostSearchTopLoading = new ComputedMap(
      (query) =>
        this.statusStore.$loading.get(postSearchTopQueryKey({ query })) ??
        false,
    );
    this.$postSearchCursorLatest = new ComputedMap(
      (query) =>
        this.queryStore.getNextCursor(postSearchLatestQueryKey({ query })) ||
        null,
    );
    this.$postSearchLatestError = new ComputedMap(
      (query) =>
        this.statusStore.$errors.get(postSearchLatestQueryKey({ query })) ??
        null,
    );
    this.$isPostSearchLatestLoading = new ComputedMap(
      (query) =>
        this.statusStore.$loading.get(postSearchLatestQueryKey({ query })) ??
        false,
    );
    this.$hydratedPostQuotes = new ComputedMap((postUri) => {
      const queryKey = postQuotesQueryKey({ postUri });
      const uris = this.queryStore.getItems(queryKey);
      if (!uris) {
        return null;
      }
      const hydratedPosts = [];
      for (const uri of uris) {
        const post = this.$hydratedPosts.get(uri);
        if (!post) continue;
        hydratedPosts.push(this.attachParentAuthor(post));
      }
      return {
        posts: hydratedPosts,
        cursor: this.queryStore.getNextCursor(queryKey) || null,
      };
    });
    this.$postQuotesError = new ComputedMap(
      (postUri) =>
        this.statusStore.$errors.get(postQuotesQueryKey({ postUri })) ?? null,
    );
    this.$hydratedPinnedItems = new Signal.Computed(() => {
      const pinnedItems = this.queryStore.getItems(pinnedItemsQueryKey());
      if (!pinnedItems) return null;
      return pinnedItems.map((item) => {
        if (item.type === "timeline") {
          return {
            type: "timeline",
            data: item.data,
            uri: FOLLOWING_FEED_URI,
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
      return this.hydrateProfileLabels(profile, preferences);
    });
    this.$hydratedDetailedProfiles = new ComputedMap((did) => {
      const profile = this.patchStore.$patchedDetailedProfiles.get(did);
      if (!profile) return null;
      const preferences = this.$preferences.get();
      if (!preferences) return profile;
      return this.hydrateProfileLabels(profile, preferences);
    });
    this.$hydratedAuthorFeeds = new ComputedMap((feedURI) => {
      const dashIndex = feedURI.lastIndexOf("-");
      const did = dashIndex >= 0 ? feedURI.slice(0, dashIndex) : feedURI;
      const feedType = dashIndex >= 0 ? feedURI.slice(dashIndex + 1) : "";
      const queryKey = authorFeedQueryKey({ did, feedType });
      const feedItems = this.queryStore.getItems(queryKey);
      if (!feedItems) {
        return null;
      }
      const patches = this.patchStore.$authorFeedPatches.get(feedURI) || [];
      let feed = {
        feed: feedItems,
        cursor: this.queryStore.getNextCursor(queryKey) || null,
      };
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
          let root = feedItem.reply.root;
          if (isPostView(root)) {
            root = this.$hydratedPosts.get(root.uri);
          }
          let parent = feedItem.reply.parent;
          if (isPostView(parent)) {
            parent = this.$hydratedPosts.get(parent.uri);
          }
          hydratedFeedItem.reply = { ...feedItem.reply, root, parent };
        }
        hydratedFeedItems.push(hydratedFeedItem);
      }
      let hydratedFeed = { feed: hydratedFeedItems, cursor: feed.cursor };
      if (feedType === "replies") {
        hydratedFeed = {
          feed: hydratedFeed.feed.filter(
            (feedItem) => feedItem.reply && !feedItem.reason,
          ),
          cursor: hydratedFeed.cursor,
        };
      }
      return filterAuthorFeed(hydratedFeed, this.isAuthenticated);
    });
    this.$actorFeeds = new ComputedMap((did) => {
      const queryKey = actorFeedsQueryKey({ did });
      const feedUris = this.queryStore.getItems(queryKey);
      if (!feedUris) return null;
      return {
        feeds: feedUris.map((feedUri) => this.$feedGenerators.get(feedUri)),
        cursor: this.queryStore.getNextCursor(queryKey) || null,
      };
    });
    this.$actorLists = new ComputedMap((did) => {
      const queryKey = actorListsQueryKey({ did });
      const uris = this.queryStore.getItems(queryKey);
      if (!uris) return null;
      return {
        lists: uris.map((uri) => this.$lists.get(uri)).filter(Boolean),
        cursor: this.queryStore.getNextCursor(queryKey) || null,
      };
    });
    this.$listsWithMembershipByActor = new ComputedMap((did) => {
      const queryKey = listsWithMembershipQueryKey({ did });
      const listUris = this.queryStore.getItems(queryKey);
      if (!listUris) return null;
      const listsWithMembership = [];
      for (const listUri of listUris) {
        const list = this.$lists.get(listUri);
        if (!list) continue;
        const listItemUri = this.$listMemberItemUris.get(listUri).get(did);
        listsWithMembership.push(
          listItemUri
            ? { list, listItem: { uri: listItemUri, subject: did } }
            : { list },
        );
      }
      return {
        listsWithMembership,
        cursor: this.queryStore.getNextCursor(queryKey) || null,
      };
    });
    this.$listsWithMembershipError = new ComputedMap(
      (did) =>
        this.statusStore.$errors.get(listsWithMembershipQueryKey({ did })) ??
        null,
    );
    this.$profileChatStatus = new ComputedMap((did) =>
      this.dataStore.$profileChatStatus.get(did),
    );
    this.$labelerInfo = new ComputedMap((did) =>
      this.dataStore.$labelerInfo.get(did),
    );
    this.$hydratedBookmarks = new Signal.Computed(() => {
      const queryKey = bookmarksQueryKey();
      const uris = this.queryStore.getItems(queryKey);
      if (!uris) {
        return null;
      }
      const feed = uris.map((uri) => ({
        post: this.attachParentAuthor(this.$hydratedPosts.get(uri)),
      }));
      return filterBookmarksFeed({
        feed,
        cursor: this.queryStore.getNextCursor(queryKey) || null,
      });
    });
    this.$hydratedDrafts = new Signal.Computed(() => {
      const queryKey = draftsQueryKey();
      const draftViews = this.queryStore.getItems(queryKey);
      if (!draftViews) {
        return null;
      }
      const media = this.draftMediaStore.$media.get();
      return {
        drafts: draftViews.map((draftView) => ({
          ...draftView,
          posts: (draftView.draft.posts ?? []).map((draftPost) =>
            this.hydrateDraftPost(draftPost, media),
          ),
        })),
        cursor: this.queryStore.getNextCursor(queryKey) || null,
      };
    });
    this.$labelerSettings = new ComputedMap((labelerDid) => {
      const preferences = this.$preferences.get();
      if (!preferences) return null;
      return preferences.getLabelerSettings(labelerDid);
    });
    this.$convos = new ComputedMap((convoId) =>
      this.patchStore.$patchedConvos.get(convoId),
    );
    this.$convoList = new Signal.Computed(() => {
      const convoIds = this.queryStore.getItems(convoListQueryKey());
      if (!convoIds) return null;
      const hydrated = convoIds
        .map((convoId) => this.$convos.get(convoId))
        .filter(Boolean);
      return sortBy(
        hydrated,
        (convo) => new Date(getLastInteractionTimestamp(convo)),
        { direction: "desc" },
      );
    });
    this.$convoListCursor = new Signal.Computed(
      () => this.queryStore.getNextCursor(convoListQueryKey()) || null,
    );
    this.$convoListError = new Signal.Computed(
      () => this.statusStore.$errors.get(convoListQueryKey()) ?? null,
    );
    this.$convoRequestList = new Signal.Computed(() => {
      const convoIds = this.queryStore.getItems(convoRequestListQueryKey());
      if (!convoIds) return null;
      const hydrated = convoIds
        .map((convoId) => this.$convos.get(convoId))
        .filter(Boolean);
      return sortBy(
        hydrated,
        (convo) => new Date(getLastInteractionTimestamp(convo)),
        { direction: "desc" },
      );
    });
    this.$convoRequestListCursor = new Signal.Computed(
      () => this.queryStore.getNextCursor(convoRequestListQueryKey()) || null,
    );
    this.$convoRequestListError = new Signal.Computed(
      () => this.statusStore.$errors.get(convoRequestListQueryKey()) ?? null,
    );
    // The convo's members plus the hydrated profiles its interactions
    // reference (group convo member lists are partial)
    this.$convoProfiles = new ComputedMap((convoId) => {
      const convo = this.dataStore.$convos.get(convoId);
      if (!convo) return [];
      const messageIds =
        this.queryStore.getItems(convoMessagesQueryKey({ convoId })) ?? [];
      const interactions = [
        convo.lastMessage,
        convo.lastReaction,
        ...messageIds.map((id) => this.dataStore.$messages.get(id)),
      ].filter(Boolean);
      const referencedDids = new Set(
        interactions.flatMap((interaction) =>
          getInteractionProfileDids(interaction),
        ),
      );
      const referencedProfiles = [...referencedDids]
        .filter((did) => !convo.members.some((member) => member.did === did))
        .map((did) => this.$hydratedProfiles.get(did))
        .filter(Boolean);
      const preferences = this.$preferences.get();
      const members = preferences
        ? convo.members.map((member) =>
            this.hydrateProfileLabels(member, preferences),
          )
        : convo.members;
      return [...members, ...referencedProfiles];
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
    this.$convoMembers = new ComputedMap((convoId) => {
      return this.dataStore.$convos.get(convoId)?.members ?? null;
    });
    this.$groupConvoMemberList = new ComputedMap((convoId) => {
      const queryKey = convoMembersQueryKey({ convoId });
      const members = this.queryStore.getItems(queryKey);
      if (!members) return null;
      return {
        members,
        cursor: this.queryStore.getNextCursor(queryKey) || null,
      };
    });
    this.$groupConvoMemberListError = new ComputedMap(
      (convoId) =>
        this.statusStore.$errors.get(convoMembersQueryKey({ convoId })) ?? null,
    );
    this.$convoMessages = new ComputedMap((convoId) => {
      const queryKey = convoMessagesQueryKey({ convoId });
      const messageIds = this.queryStore.getItems(queryKey);
      if (!messageIds) return null;
      const members = this.$convoMembers.get(convoId) ?? [];
      return {
        messages: messageIds.map((messageId) => {
          const patched = this.patchStore.$patchedMessages.get(messageId);
          const hydrated = this.attachJoinLinkPreview(patched);
          if (!hydrated.reactions) return hydrated;
          return {
            ...hydrated,
            reactions: filterBlockedReactions(hydrated.reactions, members),
          };
        }),
        cursor: this.queryStore.getNextCursor(queryKey) || null,
      };
    });
    this.$convoError = new ComputedMap(
      (convoId) =>
        this.statusStore.$errors.get(Requests.convoRequestKey({ convoId })) ??
        null,
    );
    this.$detailedProfileError = new ComputedMap(
      (did) =>
        this.statusStore.$errors.get(detailedProfileRequestKey({ did })) ??
        null,
    );
    this.$postThreadError = new ComputedMap(
      (uri) =>
        this.statusStore.$errors.get(postThreadQueryKey({ uri })) ?? null,
    );
    this.$convoMessagesError = new ComputedMap(
      (convoId) =>
        this.statusStore.$errors.get(convoMessagesQueryKey({ convoId })) ??
        null,
    );
    this.$hydratedConvoMessages = new ComputedMap((convoId) => {
      return this.$convoMessages.get(convoId);
    });
    this.$postLikes = new ComputedMap((postUri) => {
      const queryKey = postLikesQueryKey({ postUri });
      const dids = this.queryStore.getItems(queryKey);
      if (!dids) return null;
      return {
        likes: dids.map((did) => ({ actor: this.$hydratedProfiles.get(did) })),
        cursor: this.queryStore.getNextCursor(queryKey) || null,
      };
    });
    this.$postLikesError = new ComputedMap(
      (postUri) =>
        this.statusStore.$errors.get(postLikesQueryKey({ postUri })) ?? null,
    );
    this.$postReposts = new ComputedMap((postUri) => {
      const queryKey = postRepostsQueryKey({ postUri });
      const dids = this.queryStore.getItems(queryKey);
      if (!dids) return null;
      return {
        repostedBy: dids.map((did) => this.$hydratedProfiles.get(did)),
        cursor: this.queryStore.getNextCursor(queryKey) || null,
      };
    });
    this.$postRepostsError = new ComputedMap(
      (postUri) =>
        this.statusStore.$errors.get(postRepostsQueryKey({ postUri })) ?? null,
    );
    this.$profileFollows = new ComputedMap((did) => {
      const queryKey = profileFollowsQueryKey({ did });
      const dids = this.queryStore.getItems(queryKey);
      if (!dids) return null;
      return {
        follows: dids.map((followDid) => this.$hydratedProfiles.get(followDid)),
        cursor: this.queryStore.getNextCursor(queryKey) || null,
      };
    });
    this.$profileFollowsError = new ComputedMap(
      (did) =>
        this.statusStore.$errors.get(profileFollowsQueryKey({ did })) ?? null,
    );
    this.$profileFollowers = new ComputedMap((did) => {
      const queryKey = profileFollowersQueryKey({ did });
      const dids = this.queryStore.getItems(queryKey);
      if (!dids) return null;
      return {
        followers: dids.map((followerDid) =>
          this.$hydratedProfiles.get(followerDid),
        ),
        cursor: this.queryStore.getNextCursor(queryKey) || null,
      };
    });
    this.$profileFollowersError = new ComputedMap(
      (did) =>
        this.statusStore.$errors.get(profileFollowersQueryKey({ did })) ?? null,
    );
    this.$knownFollowers = new ComputedMap((did) => {
      const queryKey = knownFollowersQueryKey({ did });
      const dids = this.queryStore.getItems(queryKey);
      if (!dids) return null;
      return {
        followers: dids.map((followerDid) =>
          this.$hydratedProfiles.get(followerDid),
        ),
        cursor: this.queryStore.getNextCursor(queryKey) || null,
      };
    });
    this.$knownFollowersError = new ComputedMap(
      (did) =>
        this.statusStore.$errors.get(knownFollowersQueryKey({ did })) ?? null,
    );
    this.$mutedProfiles = new Signal.Computed(() => {
      const queryKey = mutedProfilesQueryKey();
      const dids = this.queryStore.getItems(queryKey);
      if (!dids) return null;
      return {
        mutes: dids.map((did) => this.$hydratedProfiles.get(did)),
        cursor: this.queryStore.getNextCursor(queryKey) || null,
      };
    });
    this.$blockedProfiles = new Signal.Computed(() => {
      const queryKey = blockedProfilesQueryKey();
      const dids = this.queryStore.getItems(queryKey);
      if (!dids) return null;
      return {
        blocks: dids.map((did) => this.$hydratedProfiles.get(did)),
        cursor: this.queryStore.getNextCursor(queryKey) || null,
      };
    });
    this.$mutedProfilesError = new Signal.Computed(
      () => this.statusStore.$errors.get(mutedProfilesQueryKey()) ?? null,
    );
    this.$blockedProfilesError = new Signal.Computed(
      () => this.statusStore.$errors.get(blockedProfilesQueryKey()) ?? null,
    );
    this.$notificationCursor = new Signal.Computed(
      () => this.queryStore.getNextCursor(notificationsQueryKey()) || null,
    );
    this.$notificationsError = new Signal.Computed(
      () => this.statusStore.$errors.get(notificationsQueryKey()) ?? null,
    );
    this.$mentionNotificationCursor = new Signal.Computed(
      () =>
        this.queryStore.getNextCursor(mentionNotificationsQueryKey()) || null,
    );
    this.$mentionNotificationsError = new Signal.Computed(
      () =>
        this.statusStore.$errors.get(mentionNotificationsQueryKey()) ?? null,
    );
  }

  hydrateDraftImageItem(item, media) {
    if (!item.localRef?.path) {
      return item;
    }
    const entry = media[item.localRef.path];
    return {
      ...item,
      exists: entry != null,
      previewUrl: entry?.url ?? null,
    };
  }

  // Decorates a draft post's media embeds with local state: `exists` on
  // images and videos, plus `previewUrl` on images
  hydrateDraftPost(draftPost, media) {
    const hydrated = { ...draftPost };
    if (draftPost.embedGallery) {
      hydrated.embedGallery = {
        ...draftPost.embedGallery,
        items: (draftPost.embedGallery.items ?? []).map((item) =>
          this.hydrateDraftImageItem(item, media),
        ),
      };
    }
    if (draftPost.embedImages) {
      hydrated.embedImages = draftPost.embedImages.map((item) =>
        this.hydrateDraftImageItem(item, media),
      );
    }
    if (draftPost.embedVideos) {
      hydrated.embedVideos = draftPost.embedVideos.map((videoEmbed) => {
        if (!videoEmbed.localRef?.path) {
          return videoEmbed;
        }
        const entry = media[videoEmbed.localRef.path];
        return { ...videoEmbed, exists: entry != null };
      });
    }
    return hydrated;
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

  hydrateProfileLabels(profile, preferences) {
    let result = profile;
    const blurLabel = preferences.getProfileBlurLabel(profile);
    if (blurLabel) {
      result = { ...result, blurLabel };
    }
    const badgeLabels = preferences.getBadgeLabelsForProfile(profile);
    if (badgeLabels.length > 0) {
      result = { ...result, badgeLabels };
    }
    return result;
  }

  hydratePost(post, preferences) {
    if (!post || !preferences) {
      return null;
    }
    if (!isBlockedPost(post) && isBlockedByViewer(post)) {
      // Create synthetic blocked post if the user has blocked the author
      return createBlockedPost({
        uri: post.uri,
        author: post.author,
      });
    }
    let result = this.resolveBlockedQuote(post);
    result = this.attachJoinLinkPreview(result);
    result = applyMutedWords(result, preferences);
    result = applyIsHidden(result, preferences);
    return applyLabels(result, preferences);
  }

  resolveBlockedQuote(post) {
    const blockedQuote = getBlockedQuote(post);
    if (!blockedQuote) return post;
    if (this.dataStore.$unavailablePosts.get(blockedQuote.uri)) {
      return markBlockedQuoteNotFound(post, blockedQuote.uri);
    }
    if (isBlockingUser(blockedQuote) || isBlockedByViewer(blockedQuote)) {
      return post;
    }
    const fullBlockedPost = this.$hydratedPosts.get(blockedQuote.uri);
    if (fullBlockedPost) {
      const blockedQuoteEmbed = isEmptyPost(fullBlockedPost)
        ? fullBlockedPost
        : createEmbedFromPost(fullBlockedPost);
      return replaceBlockedQuote(post, blockedQuoteEmbed);
    }
    return post;
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

  hydrateNotification(rawNotification) {
    const notification = {
      ...rawNotification,
      author: this.$hydratedProfiles.get(rawNotification.author.did),
    };
    // The server marks every notification as read the moment updateSeen
    // fires, so pages fetched after that arrive with isRead: true even when
    // the user hasn't seen them. Recompute read state against the seenAt
    // captured from the first page's response instead.
    const seenAt = this.dataStore.$notificationsLastSeenAt.get();
    if (seenAt) {
      notification.isRead =
        new Date(notification.indexedAt) <= new Date(seenAt);
    }
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
    if (hiddenReplyUris.has(node.post.uri)) {
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
