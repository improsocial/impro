import {
  flattenParents,
  replaceTopParent,
  getQuotedPost,
  getBlockedQuote,
  isBlockingUser,
  isBlockedByViewer,
  createUnavailablePost,
  getPostUrisFromNotifications,
  buildUri,
  parseUri,
  isGroupConvo,
  getGroupConvoDetails,
  getJoinLinkCodesFromPosts,
  getJoinLinkCodesFromMessages,
  getPostsFromPostThread,
  getPostsFromFeed,
  buildProfileFromRecord,
} from "/js/dataHelpers.js";
import { getLocalRefsFromDraft } from "/js/dataHelpers.js";
import { unique } from "/js/utils.js";
import { SignalMap, ComputedMap, ReactiveStore } from "/js/signals.js";
import { ApiError } from "/js/api.js";
import { FOLLOWING_FEED_URI } from "/js/config.js";

const CONVO_LOG_SYSTEM_MESSAGE_TYPES = new Set([
  "chat.bsky.convo.defs#logAddMember",
  "chat.bsky.convo.defs#logRemoveMember",
  "chat.bsky.convo.defs#logMemberJoin",
  "chat.bsky.convo.defs#logMemberLeave",
  "chat.bsky.convo.defs#logLockConvo",
  "chat.bsky.convo.defs#logUnlockConvo",
  "chat.bsky.convo.defs#logLockConvoPermanently",
  "chat.bsky.convo.defs#logEditGroup",
  "chat.bsky.convo.defs#logCreateJoinLink",
  "chat.bsky.convo.defs#logEditJoinLink",
  "chat.bsky.convo.defs#logEnableJoinLink",
  "chat.bsky.convo.defs#logDisableJoinLink",
]);

function readCollectionCursor(signal, { key } = {}) {
  const current = key === undefined ? signal.get() : signal.get(key);
  return current?.cursor ?? "";
}

// Write a page response to a stored collection — an object shaped { [itemsKey]: [...], cursor }
// Re-reads the collection and compares its cursor to the request cursor;
// a mismatch means a reload or competing page load landed mid-flight.
function writePageToCollection(
  signal,
  itemsKey,
  page,
  { key, requestCursor, overwrite = false, dedupeBy },
) {
  const current = key === undefined ? signal.get() : signal.get(key);
  const currentCursor = current?.cursor ?? "";
  if (!overwrite && currentCursor !== (requestCursor ?? "")) {
    console.warn("Cursor mismatch, discarding page", {
      itemsKey,
      key,
      requestCursor,
      currentCursor,
    });
    return false;
  }
  const append = !overwrite && Boolean(currentCursor);
  let items = page[itemsKey] ?? [];
  if (append && dedupeBy) {
    const existingIds = new Set(
      current[itemsKey].map((item) => item[dedupeBy]),
    );
    items = items.filter((item) => !existingIds.has(item[dedupeBy]));
  }
  const next = {
    [itemsKey]: append ? [...current[itemsKey], ...items] : items,
    cursor: page.cursor || null,
  };
  if (key === undefined) {
    signal.set(next);
  } else {
    signal.set(key, next);
  }
  return true;
}

// Get URIs of blocked posts and blocked quotes referenced by the given posts
function getBlockedPostUris(posts) {
  // Blocked "top-level" posts
  const blockedPosts = posts.filter(
    (post) => post.$type === "app.bsky.feed.defs#blockedPost",
  );
  // Blocked quoted posts
  const blockedQuotes = posts
    .map((post) => getBlockedQuote(post))
    .filter(Boolean);
  // Blocked nested quotes
  // Note - this won't load blocked quotes of blocked quotes (edge case)
  const blockedNestedQuotes = posts
    .map((post) => getQuotedPost(post))
    .filter(Boolean)
    .map((quotedPost) => getBlockedQuote(quotedPost))
    .filter(Boolean);

  return unique([...blockedPosts, ...blockedQuotes, ...blockedNestedQuotes], {
    by: "uri",
  }).map((blockedPost) => blockedPost.uri);
}

function updateGroupConvoForSystemMessage(convo, log) {
  const details = getGroupConvoDetails(convo);
  const patch = {};
  switch (log.$type) {
    case "chat.bsky.convo.defs#logLockConvo":
      patch.lockStatus = "locked";
      break;
    case "chat.bsky.convo.defs#logUnlockConvo":
      patch.lockStatus = "unlocked";
      break;
    case "chat.bsky.convo.defs#logLockConvoPermanently":
      patch.lockStatus = "locked-permanently";
      break;
    case "chat.bsky.convo.defs#logEditGroup":
      if (log.message.data.newName) {
        patch.name = log.message.data.newName;
      }
      break;
    case "chat.bsky.convo.defs#logAddMember":
    case "chat.bsky.convo.defs#logMemberJoin":
      patch.memberCount = details.memberCount + 1;
      break;
    case "chat.bsky.convo.defs#logRemoveMember":
    case "chat.bsky.convo.defs#logMemberLeave":
      patch.memberCount = details.memberCount - 1;
      break;
  }
  return {
    ...convo,
    kind: { ...details, ...patch },
  };
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
    draftMediaStore,
    events,
    constellation,
  ) {
    this.api = api;
    this.events = events;
    this.dataStore = dataStore;
    this.preferencesProvider = preferencesProvider;
    this.draftMediaStore = draftMediaStore;
    this.constellation = constellation;
    this.statusStore = new StatusStore();
    // Enable status tracking
    this.enableStatus(
      this.loadPostThread,
      (postUri) => "loadPostThread-" + postUri,
    );
    this.enableStatus(
      this.loadNextFeedPage,
      ({ uri }) => "loadNextFeedPage-" + uri,
    );
    this.enableStatus(
      this.loadDetailedProfile,
      (did) => "loadDetailedProfile-" + did,
    );
    this.enableStatus(
      this.loadProfileSearch,
      (query) => "loadProfileSearch-" + query,
    );
    this.enableStatus(this.loadChatRecipientSearch, "loadChatRecipientSearch");
    this.enableStatus(this.loadSearchTypeahead, "loadSearchTypeahead");
    this.enableStatus(
      this.loadSidebarSearchTypeahead,
      "loadSidebarSearchTypeahead",
    );
    this.enableStatus(
      this.loadPostSearchTop,
      (query) => "loadPostSearchTop-" + query,
    );
    this.enableStatus(
      this.loadPostSearchLatest,
      (query) => "loadPostSearchLatest-" + query,
    );
    this.enableStatus(
      this.loadFeedSearch,
      (query) => "loadFeedSearch-" + query,
    );
    this.enableStatus(this.loadTrends, "loadTrends");
    this.enableStatus(this.loadNotifications, "loadNotifications");
    this.enableStatus(
      this.loadMentionNotifications,
      "loadMentionNotifications",
    );
    this.enableStatus(this.loadChatActorStatus, "loadChatActorStatus");
    this.enableStatus(this.loadConvoList, "loadConvoList");
    this.enableStatus(this.loadConvoRequestList, "loadConvoRequestList");
    this.enableStatus(this.loadConvo, (convoId) => "loadConvo-" + convoId);
    this.enableStatus(
      this.loadConvoMembers,
      (convoId) => "loadConvoMembers-" + convoId,
    );
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
    this.enableStatus(
      this.loadKnownFollowers,
      (profileDid) => "loadKnownFollowers-" + profileDid,
    );
    this.enableStatus(this.loadGifs, (query) => "loadGifs-" + query);
    this.enableStatus(this.loadDrafts, "loadDrafts");
    this.enableStatus(this.loadBlockedProfiles, "loadBlockedProfiles");
    this.enableStatus(this.loadMutedProfiles, "loadMutedProfiles");
  }

  async loadCurrentUser() {
    const session = await this.api.getSession();
    let profile;
    try {
      profile = await this.api.getProfile(session.did);
    } catch (error) {
      console.warn(
        "getProfile failed, falling back to the profile record",
        error,
      );
      profile = await this.loadCurrentUserFromRecord(session);
    }
    this.dataStore.$currentUser.set(profile);
  }

  async loadCurrentUserFromRecord(session) {
    let record = null;
    try {
      record = await this.api.getProfileRecord();
    } catch (error) {
      if (
        !(error instanceof ApiError) ||
        error.data?.error !== "RecordNotFound"
      ) {
        throw error;
      }
    }
    return buildProfileFromRecord({
      did: session.did,
      handle: session.handle,
      record,
    });
  }

  async loadPostThread(postURI, { depth = 6 } = {}) {
    let [postThread, postThreadOther] = await Promise.all([
      this.api.getPostThread(postURI, { depth }),
      this.api.getPostThreadOther(postURI),
    ]);
    // Save posts
    const postsToSave = getPostsFromPostThread(postThread);
    await this._loadPostDependencies(postsToSave);
    this.dataStore.setPosts(postsToSave);
    const parent = postThread.parent;
    if (parent) {
      const topParent = flattenParents(postThread)[0];
      // Special case for post thread: if a parent is blocked or missing, we need to load the parent chain ourselves
      if (topParent.$type === "app.bsky.feed.defs#blockedPost") {
        const rootUri =
          postThread.post?.record?.reply?.root?.uri ?? postThread.post?.uri;
        const loadedParent = await this._loadParentChain(topParent, {
          rootUri,
        });
        postThread = replaceTopParent(postThread, loadedParent);
      }
    }
    const totalNumReplies = postThread.post?.replyCount ?? 0;
    const numAttachedReplies = postThread.replies?.length ?? 0;
    if (numAttachedReplies !== totalNumReplies) {
      postThread.replies = await this._loadBlockedReplies(postThread);
    }

    // Save post thread
    this.dataStore.$postThreads.set(postURI, postThread);
    this.dataStore.$postThreadOthers.set(postURI, postThreadOther);
    // Note - this return value is used by loadParentChain
    return postThread;
  }

  async loadPost(postURI) {
    const post = await this.api.getPost(postURI);
    await this._loadPostDependencies([post]);
    this.dataStore.setPosts([post]);
  }

  async loadPosts(postURIs) {
    if (postURIs.length === 0) return;
    const posts = await this.api.getPosts(postURIs);
    await this._loadPostDependencies(posts);
    this.dataStore.setPosts(posts);
  }

  async _loadParentChain(blockedParent, { rootUri } = {}) {
    if (
      !rootUri ||
      isBlockingUser(blockedParent) ||
      isBlockedByViewer(blockedParent)
    ) {
      return await this.loadPostThread(blockedParent.uri, {
        depth: 0,
      });
    }

    let backlinks;
    try {
      backlinks = await this._getPostsInThreadFromBacklinks(rootUri);
    } catch (error) {
      if (error.name === "AbortError") {
        return await this.loadPostThread(blockedParent.uri, {
          depth: 0,
        });
      }
      throw error;
    }

    const loadedPostsByUri = new Map();
    const loadedAuthorDids = new Set();
    let currentBlocked = blockedParent;

    while (
      currentBlocked?.$type === "app.bsky.feed.defs#blockedPost" &&
      !isBlockingUser(currentBlocked) &&
      !isBlockedByViewer(currentBlocked)
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

      const posts = await this.api.getPosts(authorUris);
      for (const post of posts) {
        loadedPostsByUri.set(post.uri, post);
      }
      await this._loadPostDependencies(posts);
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

  async _loadBlockedReplies(postThread) {
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
      const missingReplies = await this.api.getPosts(urisToLoad);
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
      await this._loadPostDependencies(repliesToAdd);
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

  async loadNextFeedPage({ type, uri }, { reload = false, limit = 31 } = {}) {
    const cursor = reload
      ? ""
      : readCollectionCursor(this.dataStore.$feeds, { key: uri });
    let feed;
    switch (type) {
      case "timeline":
        feed = await this.api.getFollowingFeed({ limit, cursor });
        break;
      case "list":
        feed = await this.api.getListFeed(uri, { limit, cursor });
        break;
      case "feed":
        feed = await this.api.getFeed(uri, { limit, cursor });
        break;
      default:
        throw new Error(`Unknown pinned item type: ${type}`);
    }
    const postsToSave = getPostsFromFeed(feed);
    await this._loadPostDependencies(postsToSave);
    this.dataStore.setPosts(postsToSave);
    await this.events.emitAsync("feedLoaded", { feedURI: uri, feed, reload });
    writePageToCollection(this.dataStore.$feeds, "feed", feed, {
      key: uri,
      requestCursor: cursor,
      overwrite: reload,
    });
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
    if (blockedPostUris.length === 0) return;
    const fetchedBlockedPosts = await this.api.getPosts(blockedPostUris);
    this.dataStore.setPosts(fetchedBlockedPosts);
    // The appview omits posts from getPosts when a block exists in either
    // direction, so a missing post may still exist. Probe the raw record
    // (which block filtering doesn't apply to) and only mark posts as
    // unavailable when the record is confirmed gone.
    const missingPostUris = blockedPostUris.filter(
      (uri) => !fetchedBlockedPosts.some((post) => post.uri === uri),
    );
    const results = await Promise.allSettled(
      missingPostUris.map((uri) => this.api.getRecord(uri)),
    );
    results.forEach((result, index) => {
      if (result.status === "fulfilled") return;
      const error = result.reason;
      if (error instanceof ApiError && error.data?.error === "RecordNotFound") {
        const uri = missingPostUris[index];
        this.dataStore.$unavailablePosts.set(uri, createUnavailablePost(uri));
      }
    });
  }

  async loadDetailedProfile(did) {
    const profile = await this.api.getProfile(did);
    this.dataStore.$profiles.set(did, profile);
    this.dataStore.$detailedProfiles.set(did, profile);
  }

  async loadDetailedProfiles(dids) {
    if (dids.length === 0) return;
    const profiles = await this.api.getProfiles(dids);
    for (const profile of profiles) {
      this.dataStore.$profiles.set(profile.did, profile);
      this.dataStore.$detailedProfiles.set(profile.did, profile);
    }
  }

  async loadProfileSearch(query, { limit = 10, cursor = "" } = {}) {
    if (!query) {
      // Invalidate in-flight searches so they can't repopulate cleared results
      this.dataStore.$latestProfileSearchRequestTime.set(null);
      this.dataStore.$profileSearchResults.set(null);
      return;
    }
    if (!cursor) {
      this.dataStore.$profileSearchResults.set(null);
    }
    const requestTime = Date.now();
    this.dataStore.$latestProfileSearchRequestTime.set(requestTime);
    const searchData = await this.api.searchProfiles(query, {
      limit,
      cursor,
    });
    if (requestTime !== this.dataStore.$latestProfileSearchRequestTime.get()) {
      return;
    }
    this.dataStore.setProfiles(searchData.actors);
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

  async _loadProfileTypeahead(query, { limit, $results, $latestRequestTime }) {
    if (!query) {
      // Invalidate in-flight searches so they can't repopulate cleared results
      $latestRequestTime.set(null);
      $results.set(null);
      return;
    }
    const requestTime = Date.now();
    $latestRequestTime.set(requestTime);
    const searchData = await this.api.searchProfilesTypeahead(query, {
      limit,
    });
    if (requestTime !== $latestRequestTime.get()) {
      return;
    }
    this.dataStore.setProfiles(searchData.actors);
    $results.set(searchData);
  }

  async loadChatRecipientSearch(query, { limit = 12 } = {}) {
    await this._loadProfileTypeahead(query, {
      limit,
      $results: this.dataStore.$chatRecipientSearchResults,
      $latestRequestTime: this.dataStore.$latestChatRecipientSearchRequestTime,
    });
  }

  async loadSearchTypeahead(query, { limit = 8 } = {}) {
    await this._loadProfileTypeahead(query, {
      limit,
      $results: this.dataStore.$searchTypeaheadResults,
      $latestRequestTime: this.dataStore.$latestSearchTypeaheadRequestTime,
    });
  }

  async loadSidebarSearchTypeahead(query, { limit = 8 } = {}) {
    await this._loadProfileTypeahead(query, {
      limit,
      $results: this.dataStore.$sidebarSearchTypeaheadResults,
      $latestRequestTime:
        this.dataStore.$latestSidebarSearchTypeaheadRequestTime,
    });
  }

  async loadPostSearchTop(query, { limit = 25, cursor = "" } = {}) {
    await this._loadPostSearch(query, {
      limit,
      cursor,
      sort: "top",
      $results: this.dataStore.$postSearchResultsTop,
      $latestRequestTime: this.dataStore.$latestPostSearchRequestTimeTop,
    });
  }

  async loadPostSearchLatest(query, { limit = 25, cursor = "" } = {}) {
    await this._loadPostSearch(query, {
      limit,
      cursor,
      sort: "latest",
      $results: this.dataStore.$postSearchResultsLatest,
      $latestRequestTime: this.dataStore.$latestPostSearchRequestTimeLatest,
    });
  }

  async _loadPostSearch(
    query,
    { limit, cursor, sort, $results, $latestRequestTime },
  ) {
    if (!query) {
      // Invalidate in-flight searches so they can't repopulate cleared results
      $latestRequestTime.set(null);
      $results.set(null);
      return;
    }
    if (!cursor) {
      $results.set(null);
    }
    const requestTime = Date.now();
    $latestRequestTime.set(requestTime);
    const searchData = await this.api.searchPosts(query, {
      limit,
      sort,
      cursor,
    });
    if (requestTime !== $latestRequestTime.get()) {
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
          ? await this.api.getPosts(replyParentUris)
          : [];
      await this._loadPostDependencies(searchResults);
      this.dataStore.setPosts([...searchResults, ...parentPosts]);
    }
    // Re-check relevance after loading dependencies
    if (requestTime !== $latestRequestTime.get()) {
      return;
    }
    const existingResults = $results.get();
    if (existingResults && cursor) {
      $results.set({
        posts: [...existingResults.posts, ...searchResults],
        cursor: searchData.cursor,
      });
    } else {
      $results.set({
        posts: searchResults,
        cursor: searchData.cursor,
      });
    }
  }

  async loadFeedSearch(query, { limit = 15, cursor = "" } = {}) {
    if (!query) {
      // Invalidate in-flight searches so they can't repopulate cleared results
      this.dataStore.$latestFeedSearchRequestTime.set(null);
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

  async loadGifs(query, { limit = 30, cursor = "" } = {}) {
    if (!cursor) {
      this.dataStore.$gifResults.set(null);
    }
    const requestTime = Date.now();
    this.dataStore.$latestGifRequestTime.set(requestTime);
    // Empty query loads featured gifs
    const gifData = query
      ? await this.api.searchGifs(query, { limit, cursor })
      : await this.api.getFeaturedGifs({ limit, cursor });
    if (requestTime !== this.dataStore.$latestGifRequestTime.get()) {
      return;
    }
    const results = gifData.results ?? [];
    // The provider repeats ids across pages; a page of nothing-but-repeats
    // should end pagination
    const existingGifs = this.dataStore.$gifResults.get()?.gifs ?? [];
    const existingIds = new Set(existingGifs.map((gifItem) => gifItem.id));
    const hasFreshResults =
      results.filter((gifItem) => !existingIds.has(gifItem.id)).length > 0;
    // KLIPY's `next` is a positional offset; falsy (or a "0" reset sentinel)
    // means end of list
    const nextCursor =
      gifData.next && String(gifData.next) !== "0" ? String(gifData.next) : "";
    writePageToCollection(
      this.dataStore.$gifResults,
      "gifs",
      {
        gifs: results,
        cursor: cursor && !hasFreshResults ? "" : nextCursor,
      },
      { requestCursor: cursor, dedupeBy: "id" },
    );
  }

  async loadNextAuthorFeedPage(
    did,
    feedType,
    { reload = false, limit = 31 } = {},
  ) {
    const feedURI = `${did}-${feedType}`;
    const cursor = reload
      ? ""
      : readCollectionCursor(this.dataStore.$authorFeeds, { key: feedURI });
    const params = { limit, cursor };

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
    const postsToSave = getPostsFromFeed(feed);
    await this._loadPostDependencies(postsToSave);
    this.dataStore.setPosts(postsToSave);
    // Save feed
    writePageToCollection(this.dataStore.$authorFeeds, "feed", feed, {
      key: feedURI,
      requestCursor: cursor,
      overwrite: reload,
    });
  }

  async loadNotifications({ reload = false, limit = 31 } = {}) {
    const cursor = reload
      ? ""
      : readCollectionCursor(this.dataStore.$notifications);
    const res = await this.api.getNotifications({ cursor, limit });
    if (cursor === "") {
      this.dataStore.$notificationsLastSeenAt.set(res.seenAt ?? null);
    }
    this.dataStore.setProfiles(
      res.notifications.map((notification) => notification.author),
    );
    // Get associated posts
    const postUris = getPostUrisFromNotifications(res.notifications);
    if (postUris.length > 0) {
      const fetchedPosts = await this.api.getPosts(postUris);
      await this._loadPostDependencies(fetchedPosts);
      this.dataStore.setPosts(fetchedPosts);
    }
    writePageToCollection(this.dataStore.$notifications, "notifications", res, {
      requestCursor: cursor,
      overwrite: reload,
    });
  }

  async loadMentionNotifications({ reload = false, limit = 31 } = {}) {
    const MENTION_REASONS = ["mention", "reply", "quote"];
    const cursor = reload
      ? ""
      : readCollectionCursor(this.dataStore.$mentionNotifications);
    const res = await this.api.getNotifications({
      cursor,
      limit,
      reasons: MENTION_REASONS,
    });
    this.dataStore.setProfiles(
      res.notifications.map((notification) => notification.author),
    );
    const postUris = getPostUrisFromNotifications(res.notifications);
    if (postUris.length > 0) {
      const fetchedPosts = await this.api.getPosts(postUris);
      await this._loadPostDependencies(fetchedPosts);
      this.dataStore.setPosts(fetchedPosts);
    }
    writePageToCollection(
      this.dataStore.$mentionNotifications,
      "notifications",
      res,
      {
        requestCursor: cursor,
        overwrite: reload,
      },
    );
  }

  async loadConvoList({ reload = false, limit = 30 } = {}) {
    const cursor = reload
      ? ""
      : readCollectionCursor(this.dataStore.$convoList);
    const res = await this.api.listConvos({ cursor, limit });
    // Store individual convos
    for (const convo of res.convos) {
      this.dataStore.$convos.set(convo.id, convo);
    }
    writePageToCollection(this.dataStore.$convoList, "convos", res, {
      requestCursor: cursor,
      overwrite: reload,
      dedupeBy: "id", // skip convos that were bumped locally
    });
  }

  async loadConvoRequestList({ reload = false, limit = 30 } = {}) {
    const cursor = reload
      ? ""
      : readCollectionCursor(this.dataStore.$convoRequestList);
    const res = await this.api.listConvos({
      cursor,
      limit,
      status: "request",
    });
    // Store individual convos
    for (const convo of res.convos) {
      this.dataStore.$convos.set(convo.id, convo);
    }
    writePageToCollection(this.dataStore.$convoRequestList, "convos", res, {
      requestCursor: cursor,
      overwrite: reload,
      dedupeBy: "id", // skip convos that were bumped locally
    });
  }

  async loadConvo(convoId) {
    const res = await this.api.getConvo(convoId);
    this.dataStore.setConvo(res.convo);
  }

  async loadConvoMembers(convoId, { reload = false } = {}) {
    const cursor = reload
      ? ""
      : readCollectionCursor(this.dataStore.$convoMemberLists, {
          key: convoId,
        });
    const res = await this.api.getConvoMembers(convoId, { cursor });
    writePageToCollection(this.dataStore.$convoMemberLists, "members", res, {
      key: convoId,
      requestCursor: cursor,
      overwrite: reload,
    });
  }

  async _loadPostDependencies(posts) {
    const results = await Promise.allSettled([
      this._loadBlockedPosts(getBlockedPostUris(posts)),
      this._loadJoinLinkPreviews(getJoinLinkCodesFromPosts(posts)),
    ]);
    for (const result of results) {
      if (result.status === "rejected") {
        console.error("Failed to load post dependency", result.reason);
      }
    }
  }

  async _loadJoinLinkPreviews(codes) {
    const distinct = unique((codes ?? []).filter(Boolean));
    if (distinct.length === 0) return;
    if (!this.api.isAuthenticated) return;
    try {
      const res = await this.api.getJoinLinkPreviews(distinct);
      for (const preview of res.joinLinkPreviews ?? []) {
        if (preview?.code) {
          this.dataStore.$joinLinkPreviewsByCode.set(preview.code, preview);
        }
      }
    } catch (error) {
      console.error("Failed to load join link previews", error);
    }
  }

  async loadConvoForProfile(profileDid) {
    const res = await this.api.getConvoForMembers([profileDid]);
    this.dataStore.setConvo(res.convo);
  }

  async loadConvoMessages(convoId, { reload = false, limit = 50 } = {}) {
    const cursor = reload
      ? ""
      : readCollectionCursor(this.dataStore.$convoMessages, { key: convoId });
    const res = await this.api.getMessages(convoId, {
      cursor,
      limit,
    });
    // For group convos, convo.members is partial; relatedProfiles carries
    // the authors and system-message subjects for the returned page.
    if (res.relatedProfiles) {
      this.dataStore.setProfiles(res.relatedProfiles);
    }
    await this._loadJoinLinkPreviews(
      getJoinLinkCodesFromMessages(res.messages),
    );
    // Save individual messages
    for (const message of res.messages) {
      this.dataStore.$messages.set(message.id, message);
    }
    writePageToCollection(this.dataStore.$convoMessages, "messages", res, {
      key: convoId,
      requestCursor: cursor,
      overwrite: reload,
    });
  }

  async pollConvoMessages(convoId, { cursor = "" } = {}) {
    const res = await this.api.getChatLogs({ cursor });
    const logsForConvo = res.logs.filter((log) => log.convoId === convoId);
    const newMessages = [];
    for (const log of logsForConvo) {
      const isReactionLog =
        log.$type === "chat.bsky.convo.defs#logAddReaction" ||
        log.$type === "chat.bsky.convo.defs#logRemoveReaction";
      if (isReactionLog && log.message?.id) {
        if (log.relatedProfiles) {
          this.dataStore.setProfiles(log.relatedProfiles);
        }
        this.dataStore.$messages.set(log.message.id, log.message);
        const convoMessages = this.dataStore.$convoMessages.get(convoId);
        if (convoMessages) {
          this.dataStore.$convoMessages.set(convoId, {
            messages: convoMessages.messages.map((message) =>
              message.id === log.message.id ? log.message : message,
            ),
            cursor: convoMessages.cursor,
          });
        }
        continue;
      }
      if (
        log.$type === "chat.bsky.convo.defs#logDeleteMessage" &&
        log.message?.id
      ) {
        const messageId = log.message.id;
        const convoMessages = this.dataStore.$convoMessages.get(convoId);
        if (convoMessages) {
          this.dataStore.$convoMessages.set(convoId, {
            messages: convoMessages.messages.filter(
              (message) => message.id !== messageId,
            ),
            cursor: convoMessages.cursor,
          });
        }
        this.dataStore.$messages.delete(messageId);
        continue;
      }
      const isUserMessage =
        log.$type === "chat.bsky.convo.defs#logCreateMessage";
      const isSystemMessage = CONVO_LOG_SYSTEM_MESSAGE_TYPES.has(log.$type);
      if (!isUserMessage && !isSystemMessage) continue;
      // Group chats include profile info here
      if (log.relatedProfiles) {
        this.dataStore.setProfiles(log.relatedProfiles);
      }
      const convoMessages = this.dataStore.$convoMessages.get(convoId);
      if (!convoMessages) {
        console.warn("No messages data found for convoId", convoId);
        return res.cursor;
      }
      const alreadyIngested = convoMessages.messages.some(
        (message) => message.id === log.message.id,
      );
      if (alreadyIngested) continue;
      if (isSystemMessage) {
        // Update convo for system message
        const convo = this.dataStore.$convos.get(convoId);
        if (convo && isGroupConvo(convo)) {
          this.dataStore.$convos.set(
            convoId,
            updateGroupConvoForSystemMessage(convo, log),
          );
        }
      }
      this.dataStore.$messages.set(log.message.id, log.message);
      this.dataStore.$convoMessages.set(convoId, {
        messages: [log.message, ...convoMessages.messages],
        cursor: convoMessages.cursor,
      });
      newMessages.push(log.message);
    }
    await this._loadJoinLinkPreviews(getJoinLinkCodesFromMessages(newMessages));
    return res.cursor;
  }

  async loadPostLikes(postUri, { cursor } = {}) {
    const res = await this.api.getLikes(postUri, { cursor });
    this.dataStore.setProfiles(res.likes.map((like) => like.actor));

    writePageToCollection(this.dataStore.$postLikes, "likes", res, {
      key: postUri,
      requestCursor: cursor ?? "",
      overwrite: !cursor,
    });
  }

  async loadPostQuotes(postUri, { cursor } = {}) {
    const res = await this.api.getQuotes(postUri, { cursor });

    // if there are posts that are replies, load the parents
    const replyPosts = res.posts.filter((post) => post.record?.reply);
    const replyParentUris = replyPosts
      .map((post) => post.record?.reply?.parent?.uri)
      .filter(Boolean);
    const parentPosts =
      replyParentUris.length > 0
        ? await this.api.getPosts(replyParentUris)
        : [];
    // Save posts and parents
    await this._loadPostDependencies(res.posts);
    this.dataStore.setPosts([...res.posts, ...parentPosts]);
    writePageToCollection(this.dataStore.$postQuotes, "posts", res, {
      key: postUri,
      requestCursor: cursor ?? "",
      overwrite: !cursor,
    });
  }

  async loadPostReposts(postUri, { cursor } = {}) {
    const res = await this.api.getRepostedBy(postUri, { cursor });
    this.dataStore.setProfiles(res.repostedBy);

    writePageToCollection(this.dataStore.$postReposts, "repostedBy", res, {
      key: postUri,
      requestCursor: cursor ?? "",
      overwrite: !cursor,
    });
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
        // Record every failure so views can render error states, but only
        // swallow ApiErrors
        this.statusStore.setError(requestId, error);
        if (!(error instanceof ApiError)) {
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

  async loadStarterPack(starterPackUri) {
    const starterPack = await this.api.getStarterPack(starterPackUri);
    this.dataStore.$starterPacks.set(starterPackUri, starterPack);
  }

  async loadListMembers(listUri, { reload = false, limit = 50 } = {}) {
    const existing = this.dataStore.$listMembers.get(listUri);
    if (existing && !existing.cursor && !reload) {
      return;
    }
    const cursor = reload
      ? ""
      : readCollectionCursor(this.dataStore.$listMembers, { key: listUri });
    const data = await this.api.getList(listUri, { limit, cursor });
    this.dataStore.setProfiles((data.items ?? []).map((item) => item.subject));
    writePageToCollection(this.dataStore.$listMembers, "items", data, {
      key: listUri,
      requestCursor: cursor,
      overwrite: reload,
    });
  }

  async loadTrends({ limit = 5 } = {}) {
    const data = await this.api.getTrends({ limit });
    this.dataStore.$trends.set(unique(data.trends ?? [], { by: "link" }));
  }

  async loadPinnedItems() {
    const preferences = await this.preferencesProvider.requirePreferences();
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
    for (const listView of listViews) {
      this.dataStore.$lists.set(listView.uri, listView);
    }
    const feedGeneratorMap = new Map(feedGenerators.map((fg) => [fg.uri, fg]));
    const listViewMap = new Map(listViews.map((lv) => [lv.uri, lv]));

    const orderedItems = [];
    for (const item of pinnedFeeds) {
      if (item.type === "timeline") {
        orderedItems.push({
          type: "timeline",
          data: { uri: FOLLOWING_FEED_URI, displayName: "Following" },
        });
      } else if (item.type === "feed") {
        const fg = feedGeneratorMap.get(item.value);
        if (fg) orderedItems.push({ type: "feed", data: fg });
      } else if (item.type === "list") {
        const lv = listViewMap.get(item.value);
        if (lv) orderedItems.push({ type: "list", data: lv });
      }
    }

    this.dataStore.setPinnedItems(orderedItems);
  }

  async loadActorFeeds(did, { reload = false, limit = 50 } = {}) {
    const existing = this.dataStore.$actorFeeds.get(did);
    if (existing && !existing.cursor && !reload) {
      return;
    }
    const cursor = reload
      ? ""
      : readCollectionCursor(this.dataStore.$actorFeeds, { key: did });
    const data = await this.api.getActorFeeds(did, { limit, cursor });
    for (const feed of data.feeds) {
      this.dataStore.$feedGenerators.set(feed.uri, feed);
    }
    writePageToCollection(this.dataStore.$actorFeeds, "feeds", data, {
      key: did,
      requestCursor: cursor,
      overwrite: reload,
    });
  }

  async loadActorLists(did, { reload = false, limit = 50 } = {}) {
    const existing = this.dataStore.$actorLists.get(did);
    if (existing && !existing.cursor && !reload) {
      return;
    }
    const cursor = reload
      ? ""
      : readCollectionCursor(this.dataStore.$actorLists, { key: did });
    const data = await this.api.getActorLists(did, { limit, cursor });
    for (const list of data.lists) {
      this.dataStore.$lists.set(list.uri, list);
    }
    writePageToCollection(this.dataStore.$actorLists, "lists", data, {
      key: did,
      requestCursor: cursor,
      overwrite: reload,
    });
  }

  async loadCurrentUserLists({ reload = false } = {}) {
    if (!this.api.isAuthenticated) return;
    await this.loadActorLists(this.api.session.did, { reload });
  }

  async loadListsWithMembershipForActor(
    actorDid,
    { reload = false, limit = 50 } = {},
  ) {
    const existing = this.dataStore.$listsWithMembershipByActor.get(actorDid);
    if (existing && !reload && !existing.cursor) {
      return;
    }
    const cursor = reload
      ? ""
      : readCollectionCursor(this.dataStore.$listsWithMembershipByActor, {
          key: actorDid,
        });
    const data = await this.api.getListsWithMembership(actorDid, {
      limit,
      cursor,
    });
    writePageToCollection(
      this.dataStore.$listsWithMembershipByActor,
      "listsWithMembership",
      data,
      {
        key: actorDid,
        requestCursor: cursor,
        overwrite: reload,
      },
    );
  }

  async loadHashtagFeed(hashtag, sort, { reload = false, limit = 25 } = {}) {
    const hashtagKey = `${hashtag}-${sort}`;

    const cursor = reload
      ? ""
      : readCollectionCursor(this.dataStore.$hashtagFeeds, { key: hashtagKey });

    // Search posts with the hashtag
    const query = `#${hashtag}`;
    const searchData = await this.api.searchPosts(query, {
      limit,
      sort,
      cursor,
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
          ? await this.api.getPosts(replyParentUris)
          : [];
      await this._loadPostDependencies(searchResults);
      this.dataStore.setPosts([...searchResults, ...parentPosts]);
    }

    writePageToCollection(this.dataStore.$hashtagFeeds, "posts", searchData, {
      key: hashtagKey,
      requestCursor: cursor,
      overwrite: reload,
    });
  }

  async loadBookmarks({ reload = false, limit = 31 } = {}) {
    const cursor = reload
      ? ""
      : readCollectionCursor(this.dataStore.$bookmarks);

    const res = await this.api.getBookmarks({ limit, cursor });

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
          ? await this.api.getPosts(replyParentUris)
          : [];
      await this._loadPostDependencies(posts);
      this.dataStore.setPosts([...posts, ...parentPosts]);
    }

    writePageToCollection(this.dataStore.$bookmarks, "bookmarks", res, {
      requestCursor: cursor,
      overwrite: reload,
    });
  }

  async loadDrafts({ reload = false } = {}) {
    const cursor = reload ? "" : readCollectionCursor(this.dataStore.$drafts);
    const res = await this.api.getDrafts({ cursor });
    writePageToCollection(this.dataStore.$drafts, "drafts", res, {
      requestCursor: cursor,
      overwrite: reload,
    });
    // Load media refs
    const localRefs = res.drafts.flatMap((draftView) =>
      getLocalRefsFromDraft(draftView.draft),
    );
    await this.draftMediaStore.load(localRefs);
  }

  async loadProfileFollowers(profileDid, { cursor } = {}) {
    const res = await this.api.getFollowers(profileDid, { cursor });
    this.dataStore.setProfiles(res.followers);

    writePageToCollection(this.dataStore.$profileFollowers, "followers", res, {
      key: profileDid,
      requestCursor: cursor ?? "",
      overwrite: !cursor,
    });
  }

  async loadKnownFollowers(profileDid, { cursor } = {}) {
    const res = await this.api.getKnownFollowers(profileDid, {
      cursor,
    });
    this.dataStore.setProfiles(res.followers);

    writePageToCollection(this.dataStore.$knownFollowers, "followers", res, {
      key: profileDid,
      requestCursor: cursor ?? "",
      overwrite: !cursor,
    });
  }

  async loadProfileFollows(profileDid, { cursor } = {}) {
    const res = await this.api.getFollows(profileDid, { cursor });
    this.dataStore.setProfiles(res.follows);

    writePageToCollection(this.dataStore.$profileFollows, "follows", res, {
      key: profileDid,
      requestCursor: cursor ?? "",
      overwrite: !cursor,
    });
  }

  async loadBlockedProfiles({ cursor } = {}) {
    const res = await this.api.getBlocks({ cursor });
    this.dataStore.setProfiles(res.blocks);

    writePageToCollection(this.dataStore.$blockedProfiles, "blocks", res, {
      requestCursor: cursor ?? "",
      overwrite: !cursor,
    });
  }

  async loadMutedProfiles({ cursor } = {}) {
    const res = await this.api.getMutes({ cursor });
    this.dataStore.setProfiles(res.mutes);

    writePageToCollection(this.dataStore.$mutedProfiles, "mutes", res, {
      requestCursor: cursor ?? "",
      overwrite: !cursor,
    });
  }

  async loadChatActorStatus() {
    const res = await this.api.getChatActorStatus();
    this.dataStore.$chatActorStatus.set(res);
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
