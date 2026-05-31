import { Normalizer } from "/js/dataLayer/normalizer.js";
import {
  flattenParents,
  replaceTopParent,
  getQuotedPost,
  getBlockedQuote,
  isBlockingUser,
  createUnavailablePost,
  getPostUrisFromNotifications,
  buildUri,
  parseUri,
} from "/js/dataHelpers.js";
import { Constellation } from "/js/constellation.js";
import { unique } from "/js/utils.js";
import { SignalMap, ComputedMap, ReactiveStore } from "/js/signals.js";
import { ApiError } from "/js/api.js";

// Get URIs of blocked quotes from posts where the author has not blocked the viewer
function getBlockedPostUris(posts) {
  // Blocked "top-level" posts
  const blockedPosts = posts
    .filter((post) => post.$type === "app.bsky.feed.defs#blockedPost")
    .filter((blockedPost) => !isBlockingUser(blockedPost));
  // Blocked quoted posts
  const blockedQuotes = posts
    .map((post) => getBlockedQuote(post))
    .filter(Boolean)
    .filter((blockedPost) => !isBlockingUser(blockedPost));
  // Blocked nested quotes
  // Note - this won't load blocked quotes of blocked quotes (edge case)
  const blockedNestedQuotes = posts
    .map((post) => getQuotedPost(post))
    .filter(Boolean)
    .map((quotedPost) => getBlockedQuote(quotedPost))
    .filter(Boolean)
    .filter((blockedPost) => !isBlockingUser(blockedPost));

  return unique([...blockedPosts, ...blockedQuotes, ...blockedNestedQuotes], {
    by: "uri",
  }).map((blockedPost) => blockedPost.uri);
}

class StatusStore extends ReactiveStore {
  constructor() {
    super("statusStore");
    this.$loading = new SignalMap();
    this.$errors = new SignalMap();
    this.$statuses = new ComputedMap((requestId) => ({
      loading: this.$loading.get(requestId) ?? false,
      error: this.$errors.get(requestId) ?? null,
    }));
  }

  setLoading(requestId, loading) {
    this.$loading.set(requestId, loading);
  }

  setError(requestId, error) {
    this.$errors.set(requestId, error);
  }

  getLoading(requestId) {
    return this.$loading.get(requestId) ?? false;
  }

  getError(requestId) {
    return this.$errors.get(requestId) ?? null;
  }
}

// Handles making requests to the API and storing the data in the data store.
export class Requests {
  constructor(
    api,
    dataStore,
    preferencesProvider,
    pluginService,
    { constellation } = {},
  ) {
    this.api = api;
    this.pluginService = pluginService;
    this.dataStore = dataStore;
    this.preferencesProvider = preferencesProvider;
    this.constellation = constellation ?? new Constellation();
    this.normalizer = new Normalizer();
    this.statusStore = new StatusStore();
    // Enable status tracking
    this.enableStatus(
      this.loadPostThread,
      (postUri) => "loadPostThread-" + postUri,
    );
    this.enableStatus(
      this.loadNextFeedPage,
      (feedURI) => "loadNextFeedPage-" + feedURI,
    );
    this.enableStatus(this.loadProfile, (did) => "loadProfile-" + did);
    this.enableStatus(
      this.loadProfileSearch,
      (query) => "loadProfileSearch-" + query,
    );
    this.enableStatus(
      this.loadPostSearch,
      (query, { sort = "top" } = {}) => `loadPostSearch-${query}-${sort}`,
    );
    this.enableStatus(
      this.loadFeedSearch,
      (query) => "loadFeedSearch-" + query,
    );
    this.enableStatus(this.loadNotifications, "loadNotifications");
    this.enableStatus(
      this.loadMentionNotifications,
      "loadMentionNotifications",
    );
    this.enableStatus(this.loadConvoList, "loadConvoList");
    this.enableStatus(
      this.loadConvoMessages,
      (convoId) => "loadConvoMessages-" + convoId,
    );
    this.enableStatus(
      this.loadPostLikes,
      (postUri) => "loadPostLikes-" + postUri,
    );
    this.enableStatus(
      this.loadPostQuotes,
      (postUri) => "loadPostQuotes-" + postUri,
    );
    this.enableStatus(
      this.loadPostReposts,
      (postUri) => "loadPostReposts-" + postUri,
    );
    this.enableStatus(
      this.loadProfileFollowers,
      (profileDid) => "loadProfileFollowers-" + profileDid,
    );
    this.enableStatus(
      this.loadProfileFollows,
      (profileDid) => "loadProfileFollows-" + profileDid,
    );
    this.enableStatus(this.loadBlockedProfiles, "loadBlockedProfiles");
    this.enableStatus(this.loadMutedProfiles, "loadMutedProfiles");
  }

  requireLabelers() {
    const preferences = this.preferencesProvider.requirePreferences();
    return preferences.getLabelerDids();
  }

  async loadCurrentUser() {
    const session = await this.api.getSession();
    const profile = await this.api.getProfile(session.did);
    this.dataStore.$currentUser.set(profile);
  }

  async loadPostThread(postURI, { depth = 6 } = {}) {
    const labelers = this.requireLabelers();
    let [postThread, postThreadOther] = await Promise.all([
      this.api.getPostThread(postURI, {
        labelers,
        depth,
      }),
      this.api.getPostThreadOther(postURI, {
        labelers,
      }),
    ]);
    // Save posts
    const postsToSave = this.normalizer.getPostsFromPostThread(postThread);
    this.dataStore.setPosts(postsToSave);
    // Load any blocked posts if necessary
    const blockedPostUris = getBlockedPostUris(postsToSave);
    const parent = postThread.parent;
    if (parent) {
      const topParent = flattenParents(postThread)[0];
      // Special case for post thread: if a parent is blocked or missing, we need to load the parent chain ourselves
      if (topParent.$type === "app.bsky.feed.defs#blockedPost") {
        const rootUri =
          postThread.post?.record?.reply?.root?.uri ?? postThread.post?.uri;
        const loadedParent = await this._loadParentChain(topParent, {
          labelers,
          rootUri,
        });
        postThread = replaceTopParent(postThread, loadedParent);
      }
    }
    const totalNumReplies = postThread.post?.replyCount ?? 0;
    const numAttachedReplies = postThread.replies?.length ?? 0;
    if (numAttachedReplies !== totalNumReplies) {
      postThread.replies = await this._loadBlockedReplies(postThread, {
        labelers,
      });
    }

    if (blockedPostUris.length > 0) {
      await this._loadBlockedPosts(blockedPostUris);
    }
    // Save post thread
    this.dataStore.$postThreads.set(postURI, postThread);
    this.dataStore.$postThreadOthers.set(postURI, postThreadOther);
    // Note - this return value is used by loadParentChain
    return postThread;
  }

  async loadPost(postURI) {
    const labelers = this.requireLabelers();
    const post = await this.api.getPost(postURI, { labelers });
    this.dataStore.setPosts([post]);
  }

  async loadPosts(postURIs) {
    if (postURIs.length === 0) return;
    const labelers = this.requireLabelers();
    const posts = await this.api.getPosts(postURIs, { labelers });
    this.dataStore.setPosts(posts);
  }

  async _loadParentChain(blockedParent, { labelers = [], rootUri } = {}) {
    if (!rootUri || isBlockingUser(blockedParent)) {
      return await this.loadPostThread(blockedParent.uri, {
        depth: 0,
        labelers,
      });
    }

    let backlinks;
    try {
      backlinks = await this._getPostsInThreadFromBacklinks(rootUri);
    } catch (error) {
      if (error.name === "AbortError") {
        return await this.loadPostThread(blockedParent.uri, {
          depth: 0,
          labelers,
        });
      }
      throw error;
    }

    const loadedPostsByUri = new Map();
    const loadedAuthorDids = new Set();
    let currentBlocked = blockedParent;

    while (
      currentBlocked?.$type === "app.bsky.feed.defs#blockedPost" &&
      !isBlockingUser(currentBlocked)
    ) {
      const authorDid = currentBlocked.author?.did;
      if (!authorDid || loadedAuthorDids.has(authorDid)) break;
      loadedAuthorDids.add(authorDid);

      const authorUris = backlinks
        .filter((backlink) => backlink.did === authorDid)
        .map(({ did, collection, rkey }) =>
          buildUri({ repo: did, collection, rkey }),
        );

      if (authorUris.length === 0) break;

      const posts = await this.api.getPosts(authorUris, { labelers });
      for (const post of posts) {
        loadedPostsByUri.set(post.uri, post);
      }
      this.dataStore.setPosts(posts);

      // Walk up from the current blocked post to find the next unresolved parent
      let uri = currentBlocked.uri;
      currentBlocked = null;
      while (uri) {
        const post = loadedPostsByUri.get(uri);
        if (!post) break;
        const parentUri = post.record?.reply?.parent?.uri;
        if (!parentUri) break;
        if (loadedPostsByUri.has(parentUri)) {
          uri = parentUri;
          continue;
        }
        // Parent not loaded — might be by another blocked author
        const parentDid = parseUri(parentUri).repo;
        if (parentDid && !loadedAuthorDids.has(parentDid)) {
          currentBlocked = {
            $type: "app.bsky.feed.defs#blockedPost",
            uri: parentUri,
            author: { did: parentDid },
          };
        }
        break;
      }
    }

    if (loadedPostsByUri.size === 0) {
      return await this.loadPostThread(blockedParent.uri, {
        depth: 0,
        labelers,
      });
    }

    return this._buildThreadChain(blockedParent.uri, loadedPostsByUri);
  }

  _buildThreadChain(startUri, postsByUri) {
    const post = postsByUri.get(startUri);
    if (!post) return null;

    const parentUri = post.record?.reply?.parent?.uri;
    let parent = null;
    if (parentUri && postsByUri.has(parentUri)) {
      parent = this._buildThreadChain(parentUri, postsByUri);
    }

    return {
      $type: "app.bsky.feed.defs#threadViewPost",
      post,
      parent,
      replies: [],
    };
  }

  async _loadBlockedReplies(postThread, { labelers = [] } = {}) {
    const post = postThread.post;
    if (!post) {
      // note, I'm not sure if this ever happens
      return [];
    }
    const loadedReplies = postThread.replies ?? [];
    let allReplyUris = null;
    try {
      allReplyUris = await this._getReplyUrisForPostFromBacklinks(post);
    } catch (error) {
      if (error.name === "AbortError") {
        console.warn("Timed out getting backlinks for replies");
        return loadedReplies;
      }
      throw error;
    }
    const missingReplyUris = allReplyUris.filter(
      (uri) => !loadedReplies.some((reply) => reply.post?.uri === uri),
    );
    if (missingReplyUris.length > 0) {
      // Load up to 100 blocked replies.
      // Larger numbers can happen when a post has a lot of replies and they aren't all included in the initial load.
      // The v2 endpoint solves this (I think) but it's still unspec'd.
      const urisToLoad = missingReplyUris.slice(0, 100);
      const missingReplies = await this.api.getPosts(urisToLoad, {
        labelers,
      });
      let repliesToAdd = missingReplies.filter((post) => !isBlockingUser(post));
      // Add an attribute indicating that this was a blocked reply
      // we use this to put in the hidden section on the post thread view
      repliesToAdd = repliesToAdd.map((post) => {
        return {
          ...post,
          // NOTE: LEXICON DEVIATION
          isBlockedReply: true,
        };
      });
      this.dataStore.setPosts(repliesToAdd);
      loadedReplies.push(
        ...repliesToAdd.map((post) => {
          return {
            $type: "app.bsky.feed.defs#threadViewPost",
            post: post,
            replies: [], // don't bother loading replies, if people want to see them they can click the post detail
          };
        }),
      );
    }
    return loadedReplies;
  }

  async loadNextFeedPage(feedURI, { reload = false, limit = 31 } = {}) {
    const labelers = this.requireLabelers();
    const existingFeed = this.dataStore.$feeds.get(feedURI);
    let cursor = existingFeed ? existingFeed.cursor : "";
    if (reload) {
      cursor = "";
    }
    const isListFeed = feedURI.includes("/app.bsky.graph.list/");
    const feed =
      feedURI === "following"
        ? await this.api.getFollowingFeed({ limit, cursor, labelers })
        : isListFeed
          ? await this.api.getListFeed(feedURI, { limit, cursor, labelers })
          : await this.api.getFeed(feedURI, { limit, cursor, labelers });
    // Save posts
    const postsToSave = this.normalizer.getPostsFromFeed(feed);
    this.dataStore.setPosts(postsToSave);
    // Load any blocked posts if necessary
    const blockedPostUris = getBlockedPostUris(postsToSave);
    if (blockedPostUris.length > 0) {
      await this._loadBlockedPosts(blockedPostUris);
    }
    // Filter posts with plugins
    await this.pluginService.refreshFiltersForFeed(feedURI, feed);
    if (existingFeed && !reload) {
      // Append to existing feed
      this.dataStore.$feeds.set(feedURI, {
        feed: [...existingFeed.feed, ...feed.feed],
        cursor: feed.cursor,
      });
    } else {
      // Set new feed
      this.dataStore.$feeds.set(feedURI, feed);
    }
  }

  async loadPluginFilteredFeedItems(feedURI, { reload = false } = {}) {
    const feed = this.dataStore.$feeds.get(feedURI);
    if (!feed) {
      return;
    }
    await this.pluginService.refreshFiltersForFeed(feedURI, feed, { reload });
  }

  async _getReplyUrisForPostFromBacklinks(post) {
    const backlinks = await this.constellation.getLinks({
      subject: post.uri,
      source: "app.bsky.feed.post:reply.parent.uri",
      timeout: 2000,
    });
    return backlinks.map(({ did, collection, rkey }) =>
      buildUri({ repo: did, collection, rkey }),
    );
  }

  async _getPostsInThreadFromBacklinks(rootUri) {
    const backlinks = await this.constellation.getLinks({
      subject: rootUri,
      source: "app.bsky.feed.post:reply.root.uri",
      timeout: 2000,
    });
    // Also add the root itself
    const { repo, collection, rkey } = parseUri(rootUri);
    backlinks.push({ did: repo, collection, rkey });
    return backlinks;
  }

  async _loadBlockedPosts(blockedPostUris) {
    const labelers = this.requireLabelers();
    const fetchedBlockedPosts = await this.api.getPosts(blockedPostUris, {
      labelers,
    });
    this.dataStore.setPosts(fetchedBlockedPosts);
    // If any blocked posts are not found, create an unavailable post for them
    const notFoundPostUris = blockedPostUris.filter(
      (uri) => !fetchedBlockedPosts.some((post) => post.uri === uri),
    );
    if (notFoundPostUris.length > 0) {
      for (const uri of notFoundPostUris) {
        this.dataStore.$unavailablePosts.set(uri, createUnavailablePost(uri));
      }
    }
  }

  async loadProfile(did) {
    const labelers = this.requireLabelers();
    const profile = await this.api.getProfile(did, { labelers });
    this.dataStore.$profiles.set(did, profile);
  }

  async loadProfiles(dids) {
    if (dids.length === 0) return;
    const labelers = this.requireLabelers();
    const profiles = await this.api.getProfiles(dids, { labelers });
    for (const profile of profiles) {
      this.dataStore.$profiles.set(profile.did, profile);
    }
  }

  async loadProfileSearch(query, { limit = 10, cursor = "" } = {}) {
    if (!query) {
      this.dataStore.$profileSearchResults.set(null);
      return;
    }
    if (!cursor) {
      this.dataStore.$profileSearchResults.set(null);
    }
    const labelers = this.requireLabelers();
    const requestTime = Date.now();
    this.dataStore.$latestProfileSearchRequestTime.set(requestTime);
    const searchData = await this.api.searchProfiles(query, {
      limit,
      cursor,
      labelers,
    });
    if (requestTime !== this.dataStore.$latestProfileSearchRequestTime.get()) {
      return;
    }
    const existingResults = this.dataStore.$profileSearchResults.get();
    if (existingResults && cursor) {
      this.dataStore.$profileSearchResults.set({
        actors: [...existingResults.actors, ...searchData.actors],
        cursor: searchData.cursor,
      });
    } else {
      this.dataStore.$profileSearchResults.set(searchData);
    }
  }

  async loadPostSearch(query, { limit = 25, sort = "top", cursor = "" } = {}) {
    if (!query) {
      this.dataStore.$postSearchResults.set(null);
      return;
    }
    if (!cursor) {
      this.dataStore.$postSearchResults.set(null);
    }
    const labelers = this.requireLabelers();
    const requestTime = Date.now();
    this.dataStore.$latestPostSearchRequestTime.set(requestTime);
    const searchData = await this.api.searchPosts(query, {
      limit,
      sort,
      cursor,
      labelers,
    });
    if (requestTime !== this.dataStore.$latestPostSearchRequestTime.get()) {
      return;
    }
    const searchResults = searchData.posts || [];
    if (searchResults.length > 0) {
      // If there are posts that are replies, load the parents
      const replyPosts = searchResults.filter((post) => post.record?.reply);
      const replyParentUris = replyPosts
        .map((post) => post.record?.reply?.parent?.uri)
        .filter(Boolean);
      const parentPosts =
        replyParentUris.length > 0
          ? await this.api.getPosts(replyParentUris, { labelers })
          : [];
      this.dataStore.setPosts([...searchResults, ...parentPosts]);
      const blockedPostUris = getBlockedPostUris(searchResults);
      if (blockedPostUris.length > 0) {
        await this._loadBlockedPosts(blockedPostUris);
      }
    }
    const existingResults = this.dataStore.$postSearchResults.get();
    if (existingResults && cursor) {
      this.dataStore.$postSearchResults.set({
        posts: [...existingResults.posts, ...searchResults],
        cursor: searchData.cursor,
      });
    } else {
      this.dataStore.$postSearchResults.set({
        posts: searchResults,
        cursor: searchData.cursor,
      });
    }
  }

  async loadFeedSearch(query, { limit = 15, cursor = "" } = {}) {
    if (!query) {
      this.dataStore.$feedSearchResults.set(null);
      return;
    }
    if (!cursor) {
      this.dataStore.$feedSearchResults.set(null);
    }
    const requestTime = Date.now();
    this.dataStore.$latestFeedSearchRequestTime.set(requestTime);
    const searchData = await this.api.searchFeedGenerators(query, {
      limit,
      cursor,
    });
    if (requestTime !== this.dataStore.$latestFeedSearchRequestTime.get()) {
      return;
    }
    const feeds = searchData.feeds || [];
    for (const feed of feeds) {
      this.dataStore.$feedGenerators.set(feed.uri, feed);
    }
    const existingResults = this.dataStore.$feedSearchResults.get();
    if (existingResults && cursor) {
      this.dataStore.$feedSearchResults.set({
        feeds: [...existingResults.feeds, ...feeds],
        cursor: searchData.cursor,
      });
    } else {
      this.dataStore.$feedSearchResults.set({
        feeds,
        cursor: searchData.cursor,
      });
    }
  }

  async loadNextAuthorFeedPage(
    did,
    feedType,
    { reload = false, limit = 31 } = {},
  ) {
    const feedURI = `${did}-${feedType}`;
    const existingFeed = this.dataStore.$authorFeeds.get(feedURI);
    let cursor = existingFeed ? existingFeed.cursor : "";
    if (reload) {
      cursor = "";
    }
    const labelers = this.requireLabelers();
    const params = { limit, cursor, labelers };

    let feed;

    // Handle likes feed separately since it uses a different API endpoint
    if (feedType === "likes") {
      feed = await this.api.getActorLikes(did, params);
    } else {
      // set params based on feed type
      switch (feedType) {
        case "posts":
          params.filter = "posts_and_author_threads";
          params.includePins = true;
          break;
        case "replies":
          params.filter = "posts_with_replies";
          params.includePins = false;
          break;
        case "media":
          params.filter = "posts_with_media";
          params.includePins = false;
          break;
        default:
          throw new Error(`Unknown feed type: ${feedType}`);
      }
      feed = await this.api.getAuthorFeed(did, params);
    }

    // Save posts
    const postsToSave = this.normalizer.getPostsFromFeed(feed);
    this.dataStore.setPosts(postsToSave);
    // Load any blocked posts if necessary
    const blockedPostUris = getBlockedPostUris(postsToSave);
    if (blockedPostUris.length > 0) {
      await this._loadBlockedPosts(blockedPostUris);
    }
    // Save feed
    if (existingFeed && !reload) {
      // Append to existing feed
      this.dataStore.$authorFeeds.set(feedURI, {
        feed: [...existingFeed.feed, ...feed.feed],
        cursor: feed.cursor,
      });
    } else {
      // Set new feed
      this.dataStore.$authorFeeds.set(feedURI, feed);
    }
  }

  async loadNotifications({ reload = false, limit = 31 } = {}) {
    let cursor = this.dataStore.$notificationCursor.get() ?? "";
    if (reload) {
      cursor = "";
    }
    const labelers = this.requireLabelers();
    const res = await this.api.getNotifications({ cursor, limit, labelers });
    // Get associated posts
    const postUris = getPostUrisFromNotifications(res.notifications);
    if (postUris.length > 0) {
      const fetchedPosts = await this.api.getPosts(postUris, { labelers });
      this.dataStore.setPosts(fetchedPosts);
    }
    const previousCursor = this.dataStore.$notificationCursor.get();
    // If the req cursor matches the previous cursor, append
    if (previousCursor && !reload) {
      if (previousCursor === cursor) {
        const existingNotifications = this.dataStore.$notifications.get() ?? [];
        this.dataStore.$notifications.set([
          ...existingNotifications,
          ...res.notifications,
        ]);
      } else {
        console.warn(
          "loadNotifications: cursor mismatch, discarding response",
          {
            previousCursor,
            cursor,
          },
        );
      }
    } else {
      this.dataStore.$notifications.set(res.notifications);
    }
    this.dataStore.$notificationCursor.set(res.cursor);
  }

  async loadMentionNotifications({ reload = false, limit = 31 } = {}) {
    const MENTION_REASONS = ["mention", "reply", "quote"];
    let cursor = this.dataStore.$mentionNotificationCursor.get() ?? "";
    if (reload) {
      cursor = "";
    }
    const labelers = this.requireLabelers();
    const res = await this.api.getNotifications({
      cursor,
      limit,
      reasons: MENTION_REASONS,
      labelers,
    });
    const postUris = getPostUrisFromNotifications(res.notifications);
    if (postUris.length > 0) {
      const fetchedPosts = await this.api.getPosts(postUris, { labelers });
      this.dataStore.setPosts(fetchedPosts);
    }
    const previousCursor = this.dataStore.$mentionNotificationCursor.get();
    if (previousCursor && !reload) {
      if (previousCursor === cursor) {
        const existingNotifications =
          this.dataStore.$mentionNotifications.get() ?? [];
        this.dataStore.$mentionNotifications.set([
          ...existingNotifications,
          ...res.notifications,
        ]);
      } else {
        console.warn(
          "loadMentionNotifications: cursor mismatch, discarding response",
          { previousCursor, cursor },
        );
      }
    } else {
      this.dataStore.$mentionNotifications.set(res.notifications);
    }
    this.dataStore.$mentionNotificationCursor.set(res.cursor);
  }

  async loadConvoList({ reload = false, limit = 30 } = {}) {
    let cursor = this.dataStore.$convoListCursor.get() ?? "";
    if (reload) {
      cursor = "";
    }
    const res = await this.api.listConvos({ cursor, limit });
    const previousCursor = this.dataStore.$convoListCursor.get();
    // Store individual convos
    for (const convo of res.convos) {
      this.dataStore.$convos.set(convo.id, convo);
    }
    // If the req cursor matches the previous cursor, append
    if (previousCursor && !reload) {
      if (previousCursor === cursor) {
        const existingConvos = this.dataStore.$convoList.get() ?? [];
        this.dataStore.$convoList.set([...existingConvos, ...res.convos]);
      } else {
        console.warn("loadConvoList: cursor mismatch, discarding response", {
          previousCursor,
          cursor,
        });
      }
    } else {
      this.dataStore.$convoList.set(res.convos);
    }
    this.dataStore.$convoListCursor.set(res.cursor);
  }

  async loadConvo(convoId) {
    const res = await this.api.getConvo(convoId);
    this.dataStore.$convos.set(convoId, res.convo);
  }

  async loadConvoForProfile(profileDid) {
    const res = await this.api.getConvoForMembers([profileDid]);
    this.dataStore.$convos.set(res.convo.id, res.convo);
  }

  async loadConvoMessages(convoId, { reload = false, limit = 50 } = {}) {
    const existingMessages = this.dataStore.$convoMessages.get(convoId);
    let cursor = existingMessages ? existingMessages.cursor : "";
    if (reload) {
      cursor = "";
    }
    const res = await this.api.getMessages(convoId, { cursor, limit });
    // Hack - sometimes the first response comes back with a cursor, even though it shouldn't.
    // So, let's just make another request to check if it's actually valid.
    if (res.cursor) {
      const res2 = await this.api.getMessages(convoId, {
        cursor: res.cursor,
        limit: 1,
      });
      if (res2.messages.length === 0) {
        res.cursor = null;
      }
    }
    // Save individual messages
    for (const message of res.messages) {
      this.dataStore.$messages.set(message.id, message);
    }
    if (existingMessages && !reload) {
      this.dataStore.$convoMessages.set(convoId, {
        messages: [...existingMessages.messages, ...res.messages],
        cursor: res.cursor,
      });
    } else {
      this.dataStore.$convoMessages.set(convoId, res);
    }
  }

  async pollConvoMessages(convoId, { cursor = "" } = {}) {
    const currentUser = this.dataStore.$currentUser.get();
    const res = await this.api.getChatLogs({ cursor });
    const logsForConvo = res.logs.filter((log) => log.convoId === convoId);
    for (const log of logsForConvo) {
      if (log.$type !== "chat.bsky.convo.defs#logCreateMessage") continue;
      if (log.message.sender.did === currentUser?.did) {
        // Skip if the message is from the current user, since we already set it in the store
        continue;
      }
      const convoMessages = this.dataStore.$convoMessages.get(convoId);
      if (!convoMessages) {
        console.warn("No messages data found for convoId", convoId);
        return res.cursor;
      }
      this.dataStore.$messages.set(log.message.id, log.message);
      this.dataStore.$convoMessages.set(convoId, {
        messages: [log.message, ...convoMessages.messages],
        cursor: convoMessages.cursor,
      });
    }
    return res.cursor;
  }

  async loadPostLikes(postUri, { cursor } = {}) {
    const labelers = this.requireLabelers();
    const existingLikes = this.dataStore.$postLikes.get(postUri);
    const res = await this.api.getLikes(postUri, { cursor, labelers });

    if (existingLikes && cursor) {
      // Append to existing likes
      this.dataStore.$postLikes.set(postUri, {
        likes: [...existingLikes.likes, ...res.likes],
        cursor: res.cursor,
      });
    } else {
      // Set new likes
      this.dataStore.$postLikes.set(postUri, res);
    }
  }

  async loadPostQuotes(postUri, { cursor } = {}) {
    const labelers = this.requireLabelers();
    const existingQuotes = this.dataStore.$postQuotes.get(postUri);
    const res = await this.api.getQuotes(postUri, { cursor, labelers });

    // if there are posts that are replies, load the parents
    const replyPosts = res.posts.filter((post) => post.record?.reply);
    const replyParentUris = replyPosts
      .map((post) => post.record?.reply?.parent?.uri)
      .filter(Boolean);
    const parentPosts =
      replyParentUris.length > 0
        ? await this.api.getPosts(replyParentUris, { labelers })
        : [];
    // Save posts and parents
    this.dataStore.setPosts([...res.posts, ...parentPosts]);
    if (existingQuotes && cursor) {
      // Append to existing quotes
      this.dataStore.$postQuotes.set(postUri, {
        posts: [...existingQuotes.posts, ...res.posts],
        cursor: res.cursor,
      });
    } else {
      // Set new quotes
      this.dataStore.$postQuotes.set(postUri, res);
    }
  }

  async loadPostReposts(postUri, { cursor } = {}) {
    const labelers = this.requireLabelers();
    const existingReposts = this.dataStore.$postReposts.get(postUri);
    const res = await this.api.getRepostedBy(postUri, { cursor, labelers });

    if (existingReposts && cursor) {
      // Append to existing reposts
      this.dataStore.$postReposts.set(postUri, {
        reposts: [...existingReposts.reposts, ...res.repostedBy],
        cursor: res.cursor,
      });
    } else {
      // Set new reposts
      this.dataStore.$postReposts.set(postUri, {
        reposts: res.repostedBy,
        cursor: res.cursor,
      });
    }
  }

  // Decorate a request method with status tracking
  enableStatus(requestMethod, requestIdOrFn) {
    async function wrappedRequestMethod(...args) {
      const requestId =
        typeof requestIdOrFn === "function"
          ? requestIdOrFn(...args)
          : requestIdOrFn;
      this.statusStore.setLoading(requestId, true);
      try {
        const result = await requestMethod.apply(this, args);
        // Clear any errors from previous requests
        this.statusStore.setError(requestId, null);
        return result;
      } catch (error) {
        // Only store ApiErrors
        if (error instanceof ApiError) {
          this.statusStore.setError(requestId, error);
        } else {
          throw error;
        }
      } finally {
        this.statusStore.setLoading(requestId, false);
      }
    }
    this[requestMethod.name] = wrappedRequestMethod.bind(this);
  }

  getStatus(requestId) {
    const loading = this.statusStore.getLoading(requestId);
    const error = this.statusStore.getError(requestId);
    return { loading, error };
  }

  async loadFeedGenerator(feedUri) {
    const feedGeneratorData = await this.api.getFeedGenerator(feedUri);
    this.dataStore.$feedGenerators.set(feedUri, feedGeneratorData);
  }

  async loadList(listUri) {
    const data = await this.api.getList(listUri, { limit: 1 });
    this.dataStore.$lists.set(listUri, data.list);
  }

  async loadListMembers(listUri, { reload = false, limit = 50 } = {}) {
    const existing = this.dataStore.$listMembers.get(listUri);
    let cursor = existing ? existing.cursor : "";
    if (reload) {
      cursor = "";
    }
    if (existing && !existing.cursor && !reload) {
      return;
    }
    const data = await this.api.getList(listUri, { limit, cursor });
    const newMembers = (data.items ?? []).map((item) => item.subject);
    if (reload || !existing) {
      this.dataStore.$listMembers.set(listUri, {
        members: newMembers,
        cursor: data.cursor || null,
      });
    } else {
      this.dataStore.$listMembers.set(listUri, {
        members: [...existing.members, ...newMembers],
        cursor: data.cursor || null,
      });
    }
  }

  async loadPinnedItems() {
    const preferences = this.preferencesProvider.requirePreferences();
    const pinnedFeeds = preferences.getPinnedFeeds();

    const feedUris = pinnedFeeds
      .filter((item) => item.type === "feed")
      .map((item) => item.value);
    const listUris = pinnedFeeds
      .filter((item) => item.type === "list")
      .map((item) => item.value);

    const [feedGenerators, listResults] = await Promise.all([
      feedUris.length
        ? this.api.getFeedGenerators(feedUris)
        : Promise.resolve([]),
      Promise.allSettled(listUris.map((uri) => this.api.getList(uri))),
    ]);
    const listViews = listResults
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value.list);

    for (const feedGenerator of feedGenerators) {
      this.dataStore.$feedGenerators.set(feedGenerator.uri, feedGenerator);
    }
    const feedGeneratorMap = new Map(feedGenerators.map((fg) => [fg.uri, fg]));
    const listViewMap = new Map(listViews.map((lv) => [lv.uri, lv]));

    const orderedItems = [];
    for (const item of pinnedFeeds) {
      if (item.type === "timeline") {
        orderedItems.push({
          type: "following",
          data: { uri: "following", displayName: "Following" },
        });
      } else if (item.type === "feed") {
        const fg = feedGeneratorMap.get(item.value);
        if (fg) orderedItems.push({ type: "feed", data: fg });
      } else if (item.type === "list") {
        const lv = listViewMap.get(item.value);
        if (lv) orderedItems.push({ type: "list", data: lv });
      }
    }

    this.dataStore.$pinnedItems.set(orderedItems);
  }

  async loadActorFeeds(did, { reload = false, limit = 50 } = {}) {
    const existing = this.dataStore.$actorFeeds.get(did);
    let cursor = existing ? existing.cursor : "";
    if (reload) {
      cursor = "";
    }
    if (existing && !existing.cursor && !reload) {
      return;
    }
    const data = await this.api.getActorFeeds(did, { limit, cursor });
    for (const feed of data.feeds) {
      this.dataStore.$feedGenerators.set(feed.uri, feed);
    }
    if (reload || !existing) {
      this.dataStore.$actorFeeds.set(did, {
        feeds: data.feeds,
        cursor: data.cursor || null,
      });
    } else {
      this.dataStore.$actorFeeds.set(did, {
        feeds: [...existing.feeds, ...data.feeds],
        cursor: data.cursor || null,
      });
    }
  }

  async loadActorLists(did, { reload = false, limit = 50 } = {}) {
    const existing = this.dataStore.$actorLists.get(did);
    let cursor = existing ? existing.cursor : "";
    if (reload) {
      cursor = "";
    }
    if (existing && !existing.cursor && !reload) {
      return;
    }
    const data = await this.api.getActorLists(did, { limit, cursor });
    for (const list of data.lists) {
      this.dataStore.$lists.set(list.uri, list);
    }
    if (reload || !existing) {
      this.dataStore.$actorLists.set(did, {
        lists: data.lists,
        cursor: data.cursor || null,
      });
    } else {
      this.dataStore.$actorLists.set(did, {
        lists: [...existing.lists, ...data.lists],
        cursor: data.cursor || null,
      });
    }
  }

  async loadHashtagFeed(hashtag, sort, { reload = false, limit = 25 } = {}) {
    const hashtagKey = `${hashtag}-${sort}`;
    const labelers = this.requireLabelers();

    const existingFeed = this.dataStore.$hashtagFeeds.get(hashtagKey);
    let cursor = existingFeed ? existingFeed.cursor : "";
    if (reload) {
      cursor = "";
    }

    // Search posts with the hashtag
    const query = `#${hashtag}`;
    const searchData = await this.api.searchPosts(query, {
      limit,
      sort,
      cursor,
      labelers,
    });

    const searchResults = searchData.posts || [];
    if (searchResults.length > 0) {
      // If there are posts that are replies, load the parents
      const replyPosts = searchResults.filter((post) => post.record?.reply);
      const replyParentUris = replyPosts
        .map((post) => post.record?.reply?.parent?.uri)
        .filter(Boolean);
      const parentPosts =
        replyParentUris.length > 0
          ? await this.api.getPosts(replyParentUris, { labelers })
          : [];
      this.dataStore.setPosts([...searchResults, ...parentPosts]);
      const blockedPostUris = getBlockedPostUris(searchResults);
      if (blockedPostUris.length > 0) {
        await this._loadBlockedPosts(blockedPostUris);
      }
    }

    // Convert posts to feed format
    const feed = {
      feed: searchResults.map((post) => ({
        post: { uri: post.uri },
      })),
      cursor: searchData.cursor || "",
    };

    if (existingFeed && !reload) {
      // Append to existing feed
      this.dataStore.$hashtagFeeds.set(hashtagKey, {
        feed: [...existingFeed.feed, ...feed.feed],
        cursor: feed.cursor,
      });
    } else {
      // Set new feed
      this.dataStore.$hashtagFeeds.set(hashtagKey, feed);
    }
  }

  async loadBookmarks({ reload = false, limit = 31 } = {}) {
    const existingBookmarks = this.dataStore.$bookmarks.get();
    let cursor = existingBookmarks ? existingBookmarks.cursor : "";
    if (reload) {
      cursor = "";
    }

    const labelers = this.requireLabelers();
    const res = await this.api.getBookmarks({ limit, cursor, labelers });

    // Extract posts from bookmarks array: [{item: post, ...}]
    const posts = res.bookmarks.map((bookmark) => bookmark.item);

    // Save posts to the store
    if (posts.length > 0) {
      // If there are posts that are replies, load the parents
      const replyPosts = posts.filter((post) => post.record?.reply);
      const replyParentUris = replyPosts
        .map((post) => post.record?.reply?.parent?.uri)
        .filter(Boolean);
      const parentPosts =
        replyParentUris.length > 0
          ? await this.api.getPosts(replyParentUris, { labelers })
          : [];
      this.dataStore.setPosts([...posts, ...parentPosts]);
      const blockedPostUris = getBlockedPostUris(posts);
      if (blockedPostUris.length > 0) {
        await this._loadBlockedPosts(blockedPostUris);
      }
    }

    // Convert to feed format
    const bookmarksFeed = {
      feed: res.bookmarks.map((bookmark) => ({
        post: { uri: bookmark.item.uri },
      })),
      cursor: res.cursor || "",
    };

    if (existingBookmarks && !reload) {
      // Append to existing bookmarks
      this.dataStore.$bookmarks.set({
        feed: [...existingBookmarks.feed, ...bookmarksFeed.feed],
        cursor: bookmarksFeed.cursor,
      });
    } else {
      // Set new bookmarks
      this.dataStore.$bookmarks.set(bookmarksFeed);
    }
  }

  async loadProfileFollowers(profileDid, { cursor } = {}) {
    const labelers = this.requireLabelers();
    const existingFollowers = this.dataStore.$profileFollowers.get(profileDid);
    const res = await this.api.getFollowers(profileDid, { cursor, labelers });

    if (existingFollowers && cursor) {
      // Append to existing followers
      this.dataStore.$profileFollowers.set(profileDid, {
        followers: [...existingFollowers.followers, ...res.followers],
        cursor: res.cursor,
      });
    } else {
      // Set new followers
      this.dataStore.$profileFollowers.set(profileDid, res);
    }
  }

  async loadProfileFollows(profileDid, { cursor } = {}) {
    const labelers = this.requireLabelers();
    const existingFollows = this.dataStore.$profileFollows.get(profileDid);
    const res = await this.api.getFollows(profileDid, { cursor, labelers });

    if (existingFollows && cursor) {
      // Append to existing follows
      this.dataStore.$profileFollows.set(profileDid, {
        follows: [...existingFollows.follows, ...res.follows],
        cursor: res.cursor,
      });
    } else {
      // Set new follows
      this.dataStore.$profileFollows.set(profileDid, res);
    }
  }

  async loadBlockedProfiles({ cursor } = {}) {
    const labelers = this.requireLabelers();
    const existing = this.dataStore.$blockedProfiles.get();
    const res = await this.api.getBlocks({ cursor, labelers });

    if (existing && cursor) {
      this.dataStore.$blockedProfiles.set({
        blocks: [...existing.blocks, ...res.blocks],
        cursor: res.cursor,
      });
    } else {
      this.dataStore.$blockedProfiles.set(res);
    }
  }

  async loadMutedProfiles({ cursor } = {}) {
    const labelers = this.requireLabelers();
    const existing = this.dataStore.$mutedProfiles.get();
    const res = await this.api.getMutes({ cursor, labelers });

    if (existing && cursor) {
      this.dataStore.$mutedProfiles.set({
        mutes: [...existing.mutes, ...res.mutes],
        cursor: res.cursor,
      });
    } else {
      this.dataStore.$mutedProfiles.set(res);
    }
  }

  async loadProfileChatStatus(profileDid) {
    const res = await this.api.getConvoAvailability([profileDid]);
    this.dataStore.$profileChatStatus.set(profileDid, res);
  }

  async loadLabelerInfo(labelerDid) {
    const labelerInfo = await this.api.getLabeler(labelerDid);
    this.dataStore.$labelerInfo.set(labelerDid, labelerInfo);
  }
}
