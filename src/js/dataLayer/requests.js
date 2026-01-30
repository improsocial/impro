import { Normalizer } from "./normalizer.js";
import {
  flattenParents,
  replaceTopParent,
  getBlockedQuote,
  getPostUrisFromReposts,
  isBlockingUser,
  createUnavailablePost,
  getPostUrisFromNotifications,
  buildUri,
} from "/js/dataHelpers.js";
import { getLinks } from "/js/constellation.js";
import { unique } from "/js/utils.js";
import { ApiError } from "/js/api.js";

async function getReplyUrisForPostFromBacklinks(post) {
  const backlinks = await getLinks({
    subject: post.uri,
    source: "app.bsky.feed.post:reply.parent.uri",
    timeout: 2000,
  });
  return backlinks.map(({ did, collection, rkey }) =>
    buildUri({ repo: did, collection, rkey }),
  );
}

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
  return unique([...blockedPosts, ...blockedQuotes], {
    by: "uri",
  }).map((blockedPost) => blockedPost.uri);
}

class StatusStore {
  constructor() {
    this.loadingMap = new Map();
    this.errorMap = new Map();
  }

  setLoading(requestId, loading) {
    this.loadingMap.set(requestId, loading);
  }

  setError(requestId, error) {
    this.errorMap.set(requestId, error);
  }

  getLoading(requestId) {
    return this.loadingMap.get(requestId) ?? false;
  }

  getError(requestId) {
    return this.errorMap.get(requestId) ?? null;
  }
}

// Handles making requests to the API and storing the data in the data store.
export class Requests {
  constructor(api, dataStore, preferencesProvider) {
    this.api = api;
    this.dataStore = dataStore;
    this.preferencesProvider = preferencesProvider;
    this.normalizer = new Normalizer();
    this.statusStore = new StatusStore();

    this.enableStatus(this.loadCurrentUser, "loadCurrentUser");
    this.enableStatus(this.loadPreferences, "loadPreferences");
    this.enableStatus(this.loadPostThread, "loadPostThread");
    this.enableStatus(this.loadPost, "loadPost");
    this.enableStatus(
      this.loadNextFeedPage,
      (feedURI) => "loadNextFeedPage-" + feedURI,
    );
    this.enableStatus(this.loadProfile, "loadProfile");
    this.enableStatus(this.loadNextAuthorFeedPage, "loadNextAuthorFeedPage");
    this.enableStatus(this.loadProfileSearch, "loadProfileSearch");
    this.enableStatus(this.loadPostSearch, "loadPostSearch");
    this.enableStatus(this.loadNotifications, "loadNotifications");
    this.enableStatus(this.loadConvoList, "loadConvoList");
    this.enableStatus(this.loadConvo, "loadConvo");
    this.enableStatus(this.loadConvoMessages, "loadConvoMessages");
    this.enableStatus(this.loadPostLikes, "loadPostLikes");
    this.enableStatus(this.loadPostQuotes, "loadPostQuotes");
    this.enableStatus(this.loadPostReposts, "loadPostReposts");
    this.enableStatus(this.loadFeedGenerator, "loadFeedGenerator");
    this.enableStatus(this.loadHashtagFeed, "loadHashtagFeed");
    this.enableStatus(this.loadBookmarks, "loadBookmarks");
    this.enableStatus(this.loadProfileFollowers, "loadProfileFollowers");
    this.enableStatus(this.loadProfileFollows, "loadProfileFollows");
    this.enableStatus(this.loadProfileChatStatus, "loadProfileChatStatus");
    this.enableStatus(this.loadLabelerInfo, "loadLabelerInfo");
  }

  requireLabelers() {
    const preferences = this.preferencesProvider.requirePreferences();
    return preferences.getLabelerDids();
  }

  async loadCurrentUser() {
    const session = await this.api.getSession();
    const profile = await this.api.getProfile(session.did);
    this.dataStore.setCurrentUser(profile);
  }

  async loadPreferences() {
    const preferences = await this.api.getPreferences();
    this.dataStore.setPreferences(preferences);
  }

  async loadPostThread(postURI, { depth = 6 } = {}) {
    const labelers = this.requireLabelers();
    let postThread = await this.api.getPostThread(postURI, {
      labelers,
      depth,
    });
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
        const loadedParent = await this._loadParentChain(topParent, {
          labelers,
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
    this.dataStore.setPostThread(postURI, postThread);
    // Note - this return value is used by loadParentChain
    return postThread;
  }

  async loadPost(postURI) {
    const labelers = this.requireLabelers();
    const post = await this.api.getPost(postURI, { labelers });
    this.dataStore.setPost(postURI, post);
  }

  async _loadParentChain(parent, { labelers = [] } = {}) {
    // Load the parent chain recursively. This might be a bit slow if there's a string of blocked posts.
    return await this.loadPostThread(parent.uri, { depth: 0, labelers });
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
      allReplyUris = await getReplyUrisForPostFromBacklinks(post);
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
    const existingFeed = this.dataStore.getFeed(feedURI);
    let cursor = existingFeed ? existingFeed.cursor : "";
    if (reload) {
      cursor = "";
    }
    const feed =
      feedURI === "following"
        ? await this.api.getFollowingFeed({ limit, cursor, labelers })
        : await this.api.getFeed(feedURI, { limit, cursor, labelers });
    // Save posts
    const postsToSave = this.normalizer.getPostsFromFeed(feed);
    this.dataStore.setPosts(postsToSave);
    // Load any blocked posts if necessary
    const blockedPostUris = getBlockedPostUris(postsToSave);
    if (blockedPostUris.length > 0) {
      await this._loadBlockedPosts(blockedPostUris);
    }
    if (existingFeed && !reload) {
      // Append to existing feed
      this.dataStore.setFeed(feedURI, {
        feed: [...existingFeed.feed, ...feed.feed],
        cursor: feed.cursor,
      });
    } else {
      // Set new feed
      this.dataStore.setFeed(feedURI, feed);
    }
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
        this.dataStore.setUnavailablePost(uri, createUnavailablePost(uri));
      }
    }
  }

  async loadProfile(did) {
    const profile = await this.api.getProfile(did);
    this.dataStore.setProfile(did, profile);
  }

  async loadProfileSearch(query, { limit = 10 } = {}) {
    const labelers = this.requireLabelers();
    if (!query) {
      this.dataStore.clearProfileSearchResults();
      return;
    }
    const searchResults = await this.api.searchProfiles(query, {
      limit,
      labelers,
    });
    this.dataStore.setProfileSearchResults(searchResults);
  }

  async loadPostSearch(query, { limit = 25, sort = "top" } = {}) {
    if (!query) {
      this.dataStore.clearPostSearchResults();
      return;
    }
    const labelers = this.requireLabelers();
    const searchData = await this.api.searchPosts(query, {
      limit,
      sort,
      labelers,
    });
    const searchResults = searchData.posts || [];
    if (searchResults.length > 0) {
      // If there are posts that are replies, load the parents
      const replyPosts = searchResults.filter((post) => post.record?.reply);
      const replyParentUris = replyPosts
        .map((post) => post.record?.reply?.parent?.uri)
        .filter(Boolean);
      const parentPosts = await this.api.getPosts(replyParentUris);
      this.dataStore.setPosts([...searchResults, ...parentPosts]);
      const blockedPostUris = getBlockedPostUris(searchResults);
      if (blockedPostUris.length > 0) {
        await this._loadBlockedPosts(blockedPostUris);
      }
    }
    this.dataStore.setPostSearchResults(searchResults);
  }

  async loadNextAuthorFeedPage(
    did,
    feedType,
    { reload = false, limit = 31 } = {},
  ) {
    const feedURI = `${did}-${feedType}`;
    const existingFeed = this.dataStore.getAuthorFeed(feedURI);
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
      this.dataStore.setAuthorFeed(feedURI, {
        feed: [...existingFeed.feed, ...feed.feed],
        cursor: feed.cursor,
      });
    } else {
      // Set new feed
      this.dataStore.setAuthorFeed(feedURI, feed);
    }
  }

  async loadNotifications({ reload = false, limit = 31 } = {}) {
    let cursor = this.dataStore.getNotificationCursor() ?? "";
    if (reload) {
      cursor = "";
    }
    const res = await this.api.getNotifications({ cursor, limit });
    // Get associated posts
    const postUris = getPostUrisFromNotifications(res.notifications);
    if (postUris.length > 0) {
      const fetchedPosts = await this.api.getPosts(postUris);
      this.dataStore.setPosts(fetchedPosts);
    }
    const previousCursor = this.dataStore.getNotificationCursor();
    // If the req cursor matches the previous cursor, append
    console.debug("loadNotifications", {
      cursor,
      previousCursor,
      reload,
      res,
      existingNotifications: this.dataStore.getNotifications(),
    });
    if (previousCursor && previousCursor === cursor && !reload) {
      console.debug("Appending to existing notifications");
      const existingNotifications = this.dataStore.getNotifications() ?? [];
      this.dataStore.setNotifications([
        ...existingNotifications,
        ...res.notifications,
      ]);
    } else {
      console.debug("Setting new notifications", {
        notifications: res.notifications,
      });
      this.dataStore.setNotifications(res.notifications);
    }
    this.dataStore.setNotificationCursor(res.cursor);
  }

  async loadConvoList({ reload = false, limit = 30 } = {}) {
    let cursor = this.dataStore.getConvoListCursor() ?? "";
    if (reload) {
      cursor = "";
    }
    const res = await this.api.listConvos({ cursor, limit });
    const previousCursor = this.dataStore.getConvoListCursor();
    // Store individual convos
    for (const convo of res.convos) {
      this.dataStore.setConvo(convo.id, convo);
    }
    // If the req cursor matches the previous cursor, append
    if (previousCursor && previousCursor === cursor && !reload) {
      const existingConvos = this.dataStore.getConvoList() ?? [];
      this.dataStore.setConvoList([...existingConvos, ...res.convos]);
    } else {
      this.dataStore.setConvoList(res.convos);
    }
    this.dataStore.setConvoListCursor(res.cursor);
  }

  async loadConvo(convoId) {
    const res = await this.api.getConvo(convoId);
    this.dataStore.setConvo(convoId, res.convo);
  }

  async loadConvoForProfile(profileDid) {
    const res = await this.api.getConvoForMembers([profileDid]);
    this.dataStore.setConvo(res.convo.id, res.convo);
  }

  async loadConvoMessages(convoId, { reload = false, limit = 50 } = {}) {
    const existingMessages = this.dataStore.getConvoMessages(convoId);
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
      this.dataStore.setMessage(message.id, message);
    }
    if (existingMessages && !reload) {
      this.dataStore.setConvoMessages(convoId, {
        messages: [...existingMessages.messages, ...res.messages],
        cursor: res.cursor,
      });
    } else {
      this.dataStore.setConvoMessages(convoId, res);
    }
  }

  async loadPostLikes(postUri, { cursor } = {}) {
    const existingLikes = this.dataStore.getPostLikes(postUri);
    const res = await this.api.getLikes(postUri, { cursor });

    if (existingLikes && cursor) {
      // Append to existing likes
      this.dataStore.setPostLikes(postUri, {
        likes: [...existingLikes.likes, ...res.likes],
        cursor: res.cursor,
      });
    } else {
      // Set new likes
      this.dataStore.setPostLikes(postUri, res);
    }
  }

  async loadPostQuotes(postUri, { cursor } = {}) {
    const existingQuotes = this.dataStore.getPostQuotes(postUri);
    const res = await this.api.getQuotes(postUri, { cursor });

    // if there are posts that are replies, load the parents
    const replyPosts = res.posts.filter((post) => post.record?.reply);
    const replyParentUris = replyPosts
      .map((post) => post.record?.reply?.parent?.uri)
      .filter(Boolean);
    const parentPosts = await this.api.getPosts(replyParentUris);
    // Save posts and parents
    this.dataStore.setPosts([...res.posts, ...parentPosts]);
    if (existingQuotes && cursor) {
      // Append to existing quotes
      this.dataStore.setPostQuotes(postUri, {
        posts: [...existingQuotes.posts, ...res.posts],
        cursor: res.cursor,
      });
    } else {
      // Set new quotes
      this.dataStore.setPostQuotes(postUri, res);
    }
  }

  async loadPostReposts(postUri, { cursor } = {}) {
    const existingReposts = this.dataStore.getPostReposts(postUri);
    const res = await this.api.getRepostedBy(postUri, { cursor });

    if (existingReposts && cursor) {
      // Append to existing reposts
      this.dataStore.setPostReposts(postUri, {
        reposts: [...existingReposts.reposts, ...res.repostedBy],
        cursor: res.cursor,
      });
    } else {
      // Set new reposts
      this.dataStore.setPostReposts(postUri, {
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
    this.dataStore.setFeedGenerator(feedUri, feedGeneratorData);
  }

  async loadPinnedFeedGenerators() {
    const preferences = this.preferencesProvider.requirePreferences();
    const pinnedFeeds = preferences.getPinnedFeeds();
    const feedUris = pinnedFeeds
      .map((pinnedFeed) => pinnedFeed.value)
      .filter((feedUri) => feedUri !== "following");
    const feedGenerators = await this.api.getFeedGenerators(feedUris);
    for (const feedGenerator of feedGenerators) {
      this.dataStore.setFeedGenerator(feedGenerator.uri, feedGenerator);
    }
    this.dataStore.setPinnedFeedGenerators(feedGenerators);
  }

  async loadHashtagFeed(hashtag, sort, { reload = false, limit = 25 } = {}) {
    const hashtagKey = `${hashtag}-${sort}`;
    const labelers = this.requireLabelers();

    const existingFeed = this.dataStore.getHashtagFeed(hashtagKey);
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
      this.dataStore.setPosts(searchResults);
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
      this.dataStore.setHashtagFeed(hashtagKey, {
        feed: [...existingFeed.feed, ...feed.feed],
        cursor: feed.cursor,
      });
    } else {
      // Set new feed
      this.dataStore.setHashtagFeed(hashtagKey, feed);
    }
  }

  async loadBookmarks({ reload = false, limit = 31 } = {}) {
    const existingBookmarks = this.dataStore.getBookmarks();
    let cursor = existingBookmarks ? existingBookmarks.cursor : "";
    if (reload) {
      cursor = "";
    }

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
      const parentPosts = await this.api.getPosts(replyParentUris);
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
      this.dataStore.setBookmarks({
        feed: [...existingBookmarks.feed, ...bookmarksFeed.feed],
        cursor: bookmarksFeed.cursor,
      });
    } else {
      // Set new bookmarks
      this.dataStore.setBookmarks(bookmarksFeed);
    }
  }

  async loadProfileFollowers(profileDid, { cursor } = {}) {
    const existingFollowers = this.dataStore.getProfileFollowers(profileDid);
    const res = await this.api.getFollowers(profileDid, { cursor });

    if (existingFollowers && cursor) {
      // Append to existing followers
      this.dataStore.setProfileFollowers(profileDid, {
        followers: [...existingFollowers.followers, ...res.followers],
        cursor: res.cursor,
      });
    } else {
      // Set new followers
      this.dataStore.setProfileFollowers(profileDid, res);
    }
  }

  async loadProfileFollows(profileDid, { cursor } = {}) {
    const existingFollows = this.dataStore.getProfileFollows(profileDid);
    const res = await this.api.getFollows(profileDid, { cursor });

    if (existingFollows && cursor) {
      // Append to existing follows
      this.dataStore.setProfileFollows(profileDid, {
        follows: [...existingFollows.follows, ...res.follows],
        cursor: res.cursor,
      });
    } else {
      // Set new follows
      this.dataStore.setProfileFollows(profileDid, res);
    }
  }

  async loadProfileChatStatus(profileDid) {
    const res = await this.api.getConvoAvailability([profileDid]);
    this.dataStore.setProfileChatStatus(profileDid, res);
  }

  async loadLabelerInfo(labelerDid) {
    const labelerInfo = await this.api.getLabeler(labelerDid);
    this.dataStore.setLabelerInfo(labelerDid, labelerInfo);
  }
}
