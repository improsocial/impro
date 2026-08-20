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
import {
  AUTHOR_FEED_PAGE_SIZE,
  BOOKMARKS_PAGE_SIZE,
  FOLLOWING_FEED_URI,
} from "/js/config.js";
import {
  Resources,
  actorFeedsQueryKey,
  actorListsQueryKey,
  authorFeedQueryKey,
  blockedProfilesQueryKey,
  bookmarksQueryKey,
  buildQueryKey,
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

export class StatusStore extends ReactiveStore {
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
  static convoRequestKey({ convoId }) {
    return buildQueryKey(Resources.CONVO, { convoId });
  }

  constructor(
    api,
    dataStore,
    preferencesProvider,
    draftMediaStore,
    events,
    constellation,
    queryStore,
  ) {
    this.api = api;
    this.events = events;
    this.dataStore = dataStore;
    this.queryStore = queryStore;
    this.preferencesProvider = preferencesProvider;
    this.draftMediaStore = draftMediaStore;
    this.constellation = constellation;
    this.statusStore = new StatusStore();
    this._inFlightRequests = new Map();
    // Register the loaders
    this.registerLoader(
      this.loadDetailedProfile,
      (did) => detailedProfileRequestKey({ did }),
      { dedupe: true },
    );
    this.registerLoader(
      this.loadConvo,
      (convoId) => Requests.convoRequestKey({ convoId }),
      {
        dedupe: true,
      },
    );
    this._defineQueryLoaders();
  }

  // Query loaders are named here rather than on the prototype so each one sits
  // next to the query key it reads and writes under.

  _defineQueryLoaders() {
    this.loadBookmarks = this.collectionQueryLoader(
      () => bookmarksQueryKey(),
      async (cursor, { limit = BOOKMARKS_PAGE_SIZE + 1 } = {}) => {
        const labelers = await this.requireLabelers();
        const res = await this.api.getBookmarks({ limit, cursor, labelers });

        // Extract posts from bookmarks array: [{item: post, ...}]
        const posts = res.bookmarks.map((bookmark) => bookmark.item);

        // Replies render with their parent, which the response doesn't carry.
        const replyParentUris = posts
          .map((post) => post.record?.reply?.parent?.uri)
          .filter(Boolean);
        const parentPosts = replyParentUris.length
          ? await this.api.getPosts(replyParentUris, { labelers })
          : [];

        await this._loadPostDependencies(posts);
        this.dataStore.setPosts([...posts, ...parentPosts]);

        return { items: posts.map((post) => post.uri), cursor: res.cursor };
      },
    );
    this.loadActorFeeds = this.collectionQueryLoader(
      ({ did }) => actorFeedsQueryKey({ did }),
      async (cursor, { did, limit = 50 }) => {
        const data = await this.api.getActorFeeds(did, { limit, cursor });
        for (const feed of data.feeds) {
          this.dataStore.$feedGenerators.set(feed.uri, feed);
        }
        return {
          items: data.feeds.map((feed) => feed.uri),
          cursor: data.cursor,
        };
      },
    );
    this.loadActorLists = this.collectionQueryLoader(
      ({ did }) => actorListsQueryKey({ did }),
      async (cursor, { did, limit = 50 }) => {
        const data = await this.api.getActorLists(did, { limit, cursor });
        for (const list of data.lists) {
          this.dataStore.$lists.set(list.uri, list);
        }
        return {
          items: data.lists.map((list) => list.uri),
          cursor: data.cursor,
        };
      },
    );
    this.loadNextAuthorFeedPage = this.collectionQueryLoader(
      ({ did, feedType }) => authorFeedQueryKey({ did, feedType }),
      async (cursor, { did, feedType, limit = AUTHOR_FEED_PAGE_SIZE + 1 }) => {
        const labelers = await this.requireLabelers();
        const params = { limit, cursor, labelers };

        let feed;
        // The likes feed uses a different API endpoint
        if (feedType === "likes") {
          feed = await this.api.getActorLikes(did, params);
        } else {
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

        const postsToSave = getPostsFromFeed(feed);
        await this._loadPostDependencies(postsToSave);
        this.dataStore.setPosts(postsToSave);

        return { items: feed.feed, cursor: feed.cursor };
      },
    );
    this.loadPostThread = this.queryLoader(
      ({ uri }) => postThreadQueryKey({ uri }),
      async ({ uri, depth = 6 }) => {
        const labelers = await this.requireLabelers();
        let [postThread, postThreadOther] = await Promise.all([
          this.api.getPostThread(uri, {
            labelers,
            depth,
          }),
          this.api.getPostThreadOther(uri, {
            labelers,
          }),
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

        this.queryStore.setValue(
          postThreadOtherQueryKey({ uri }),
          postThreadOther,
        );
        // Returned for queryLoader to store, and used by _loadParentChain
        return postThread;
      },
      { dedupe: true },
    );

    this.loadConvoMessages = this.collectionQueryLoader(
      ({ convoId }) => convoMessagesQueryKey({ convoId }),
      async (cursor, { convoId, limit = 50 }) => {
        const labelers = await this.requireLabelers();
        const res = await this.api.getMessages(convoId, {
          cursor,
          limit,
          labelers,
        });
        // For group convos, convo.members is partial; relatedProfiles carries
        // the authors and system-message subjects for the returned page.
        if (res.relatedProfiles) {
          this.dataStore.setProfiles(res.relatedProfiles);
        }
        await this._loadJoinLinkPreviews(
          getJoinLinkCodesFromMessages(res.messages),
        );
        for (const message of res.messages) {
          this.dataStore.$messages.set(message.id, message);
        }
        return {
          items: res.messages.map((message) => message.id),
          cursor: res.cursor,
        };
      },
    );

    this.loadTrends = this.collectionQueryLoader(
      () => trendsQueryKey(),
      async (cursor, { limit = 5 } = {}) => {
        const data = await this.api.getTrends({ limit });
        return {
          items: unique(data.trends ?? [], { by: "link" }),
          cursor: null,
        };
      },
    );

    this.loadNextFeedPage = this.collectionQueryLoader(
      ({ uri }) => feedQueryKey({ uri }),
      async (cursor, { type, uri, limit = 31 }, { reload }) => {
        const labelers = await this.requireLabelers();
        let feed;
        switch (type) {
          case "timeline":
            feed = await this.api.getFollowingFeed({ limit, cursor, labelers });
            break;
          case "list":
            feed = await this.api.getListFeed(uri, { limit, cursor, labelers });
            break;
          case "feed":
            feed = await this.api.getFeed(uri, { limit, cursor, labelers });
            break;
          default:
            throw new Error(`Unknown pinned item type: ${type}`);
        }
        const postsToSave = getPostsFromFeed(feed);
        await this._loadPostDependencies(postsToSave);
        this.dataStore.setPosts(postsToSave);
        await this.events.emitAsync("feedLoaded", {
          feedURI: uri,
          feed,
          reload,
        });
        return { items: feed.feed, cursor: feed.cursor };
      },
    );

    this.loadSidebarSearchTypeahead = this.collectionQueryLoader(
      ({ query }) => sidebarSearchTypeaheadQueryKey({ query }),
      async (cursor, { query, limit = 8 }) => {
        const labelers = await this.requireLabelers();
        const searchData = await this.api.searchProfilesTypeahead(query, {
          limit,
          labelers,
        });
        this.dataStore.setProfiles(searchData.actors);
        return {
          items: searchData.actors.map((actor) => actor.did),
          cursor: searchData.cursor,
        };
      },
    );

    this.loadChatRecipientSearch = this.collectionQueryLoader(
      ({ query }) => chatRecipientSearchQueryKey({ query }),
      async (cursor, { query, limit = 12 }) => {
        const labelers = await this.requireLabelers();
        const searchData = await this.api.searchProfilesTypeahead(query, {
          limit,
          labelers,
        });
        this.dataStore.setProfiles(searchData.actors);
        return {
          items: searchData.actors.map((actor) => actor.did),
          cursor: searchData.cursor,
        };
      },
    );

    this.loadGifs = this.collectionQueryLoader(
      ({ query = "" }) => gifSearchQueryKey({ query }),
      async (cursor, { query = "", limit = 30 }) => {
        // Empty query loads featured gifs
        const gifData = query
          ? await this.api.searchGifs(query, { limit, cursor })
          : await this.api.getFeaturedGifs({ limit, cursor });
        const results = gifData.results ?? [];
        // The provider repeats ids across pages; a page of nothing-but-repeats
        // should end pagination
        const existingGifs = cursor
          ? (this.queryStore.getItems(gifSearchQueryKey({ query })) ?? [])
          : [];
        const existingIds = new Set(existingGifs.map((gifItem) => gifItem.id));
        const items = results.filter((gifItem) => !existingIds.has(gifItem.id));
        // KLIPY's `next` is a positional offset; falsy (or a "0" reset
        // sentinel) means end of list
        const nextCursor =
          gifData.next && String(gifData.next) !== "0"
            ? String(gifData.next)
            : "";
        return {
          items,
          cursor: cursor && items.length === 0 ? "" : nextCursor,
        };
      },
    );

    this.loadFeedSearch = this.collectionQueryLoader(
      ({ query }) => feedSearchQueryKey({ query }),
      async (cursor, { query, limit = 15 }) => {
        const res = await this.api.searchFeedGenerators(query, {
          limit,
          cursor,
        });
        const feeds = res.feeds ?? [];
        for (const feed of feeds) {
          this.dataStore.$feedGenerators.set(feed.uri, feed);
        }
        return { items: feeds.map((feed) => feed.uri), cursor: res.cursor };
      },
    );

    this.loadConvoList = this.collectionQueryLoader(
      () => convoListQueryKey(),
      async (cursor, { limit = 30 } = {}) => {
        const labelers = await this.requireLabelers();
        const res = await this.api.listConvos({ cursor, limit, labelers });
        for (const convo of res.convos) {
          this.dataStore.$convos.set(convo.id, convo);
        }
        return {
          items: res.convos.map((convo) => convo.id),
          cursor: res.cursor,
        };
      },
    );

    this.loadProfileFollowers = this.collectionQueryLoader(
      ({ did }) => profileFollowersQueryKey({ did }),
      async (cursor, { did }) => {
        const labelers = await this.requireLabelers();
        const res = await this.api.getFollowers(did, { cursor, labelers });
        this.dataStore.setProfiles(res.followers);
        return {
          items: res.followers.map((profile) => profile.did),
          cursor: res.cursor,
        };
      },
    );

    this.loadProfileSearch = this.collectionQueryLoader(
      ({ query }) => profileSearchQueryKey({ query }),
      async (cursor, { query, limit = 10 }) => {
        const labelers = await this.requireLabelers();
        const res = await this.api.searchProfiles(query, {
          limit,
          cursor,
          labelers,
        });
        this.dataStore.setProfiles(res.actors);
        return {
          items: res.actors.map((profile) => profile.did),
          cursor: res.cursor,
        };
      },
    );

    this.loadKnownFollowers = this.collectionQueryLoader(
      ({ did }) => knownFollowersQueryKey({ did }),
      async (cursor, { did }) => {
        const labelers = await this.requireLabelers();
        const res = await this.api.getKnownFollowers(did, { cursor, labelers });
        this.dataStore.setProfiles(res.followers);
        return {
          items: res.followers.map((profile) => profile.did),
          cursor: res.cursor,
        };
      },
    );

    this.loadProfileFollows = this.collectionQueryLoader(
      ({ did }) => profileFollowsQueryKey({ did }),
      async (cursor, { did }) => {
        const labelers = await this.requireLabelers();
        const res = await this.api.getFollows(did, { cursor, labelers });
        this.dataStore.setProfiles(res.follows);
        return {
          items: res.follows.map((profile) => profile.did),
          cursor: res.cursor,
        };
      },
    );

    this.loadBlockedProfiles = this.collectionQueryLoader(
      () => blockedProfilesQueryKey(),
      async (cursor) => {
        const labelers = await this.requireLabelers();
        const res = await this.api.getBlocks({ cursor, labelers });
        this.dataStore.setProfiles(res.blocks);
        return {
          items: res.blocks.map((profile) => profile.did),
          cursor: res.cursor,
        };
      },
    );

    this.loadSearchTypeahead = this.collectionQueryLoader(
      ({ query }) => searchTypeaheadQueryKey({ query }),
      async (cursor, { query, limit = 8 }) => {
        const labelers = await this.requireLabelers();
        const res = await this.api.searchProfilesTypeahead(query, {
          limit,
          labelers,
        });
        this.dataStore.setProfiles(res.actors);
        return {
          items: res.actors.map((actor) => actor.did),
          cursor: res.cursor,
        };
      },
    );

    this.loadPostLikes = this.collectionQueryLoader(
      ({ postUri }) => postLikesQueryKey({ postUri }),
      async (cursor, { postUri }) => {
        const labelers = await this.requireLabelers();
        const res = await this.api.getLikes(postUri, { cursor, labelers });
        this.dataStore.setProfiles(res.likes.map((like) => like.actor));
        return {
          items: res.likes.map((like) => like.actor.did),
          cursor: res.cursor,
        };
      },
    );

    this.loadPostReposts = this.collectionQueryLoader(
      ({ postUri }) => postRepostsQueryKey({ postUri }),
      async (cursor, { postUri }) => {
        const labelers = await this.requireLabelers();
        const res = await this.api.getRepostedBy(postUri, { cursor, labelers });
        this.dataStore.setProfiles(res.repostedBy);
        return {
          items: res.repostedBy.map((profile) => profile.did),
          cursor: res.cursor,
        };
      },
    );

    this.loadPostSearchLatest = this.collectionQueryLoader(
      ({ query }) => postSearchLatestQueryKey({ query }),
      async (cursor, { query, limit = 25 }) => {
        const labelers = await this.requireLabelers();
        const searchData = await this.api.searchPosts(query, {
          limit,
          sort: "latest",
          cursor,
          labelers,
        });
        const posts = searchData.posts || [];
        if (posts.length > 0) {
          // If there are posts that are replies, load the parents
          const replyParentUris = posts
            .map((post) => post.record?.reply?.parent?.uri)
            .filter(Boolean);
          const parentPosts =
            replyParentUris.length > 0
              ? await this.api.getPosts(replyParentUris, { labelers })
              : [];
          await this._loadPostDependencies(posts);
          this.dataStore.setPosts([...posts, ...parentPosts]);
        }
        return {
          items: posts.map((post) => post.uri),
          cursor: searchData.cursor,
        };
      },
    );

    this.loadPostQuotes = this.collectionQueryLoader(
      ({ postUri }) => postQuotesQueryKey({ postUri }),
      async (cursor, { postUri }) => {
        const labelers = await this.requireLabelers();
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
        await this._loadPostDependencies(res.posts);
        this.dataStore.setPosts([...res.posts, ...parentPosts]);

        return {
          items: res.posts.map((post) => post.uri),
          cursor: res.cursor,
        };
      },
    );

    this.loadHashtagFeed = this.collectionQueryLoader(
      ({ hashtag, sort }) => hashtagFeedQueryKey({ hashtag, sort }),
      async (cursor, { hashtag, sort, limit = 25 }) => {
        const labelers = await this.requireLabelers();
        const res = await this.api.searchPosts(`#${hashtag}`, {
          limit,
          sort,
          cursor,
          labelers,
        });

        const posts = res.posts || [];
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
          await this._loadPostDependencies(posts);
          this.dataStore.setPosts([...posts, ...parentPosts]);
        }

        return {
          items: posts.map((post) => post.uri),
          cursor: res.cursor,
        };
      },
    );

    this.loadPostSearchTop = this.collectionQueryLoader(
      ({ query }) => postSearchTopQueryKey({ query }),
      async (cursor, { query, limit = 25 }) => {
        const labelers = await this.requireLabelers();
        const res = await this.api.searchPosts(query, {
          limit,
          sort: "top",
          cursor,
          labelers,
        });

        const posts = res.posts || [];
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
          await this._loadPostDependencies(posts);
          this.dataStore.setPosts([...posts, ...parentPosts]);
        }

        return {
          items: posts.map((post) => post.uri),
          cursor: res.cursor,
        };
      },
    );

    this.loadListMembers = this.collectionQueryLoader(
      ({ listUri }) => listMembersQueryKey({ listUri }),
      async (cursor, { listUri, limit = 50 }) => {
        const data = await this.api.getList(listUri, { limit, cursor });
        const items = data.items ?? [];
        this.dataStore.setProfiles(items.map((item) => item.subject));
        this.dataStore.setListItemUris(listUri, items);
        return {
          items: items.map((item) => item.subject.did),
          cursor: data.cursor,
        };
      },
    );

    this.loadConvoMembers = this.collectionQueryLoader(
      ({ convoId }) => convoMembersQueryKey({ convoId }),
      async (cursor, { convoId }) => {
        const labelers = await this.requireLabelers();
        const res = await this.api.getConvoMembers(convoId, {
          cursor,
          labelers,
        });
        return { items: res.members, cursor: res.cursor };
      },
    );

    this.loadListsWithMembershipForActor = this.collectionQueryLoader(
      ({ did }) => listsWithMembershipQueryKey({ did }),
      async (cursor, { did, limit = 50 }) => {
        const data = await this.api.getListsWithMembership(did, {
          limit,
          cursor,
        });
        const entries = data.listsWithMembership ?? [];
        for (const entry of entries) {
          this.dataStore.$lists.set(entry.list.uri, entry.list);
          if (entry.listItem) {
            this.dataStore.setListItemUri(
              entry.list.uri,
              did,
              entry.listItem.uri,
            );
          } else {
            this.dataStore.deleteListItemUri(entry.list.uri, did);
          }
        }
        return {
          items: entries.map((entry) => entry.list.uri),
          cursor: data.cursor,
        };
      },
    );

    this.loadNotifications = this.collectionQueryLoader(
      () => notificationsQueryKey(),
      async (cursor, { limit = 31 } = {}) => {
        const labelers = await this.requireLabelers();
        const res = await this.api.getNotifications({
          cursor,
          limit,
          labelers,
        });
        if (cursor === "") {
          this.dataStore.$notificationsLastSeenAt.set(res.seenAt ?? null);
        }
        this.dataStore.setProfiles(
          res.notifications.map((notification) => notification.author),
        );
        // Get associated posts
        const postUris = getPostUrisFromNotifications(res.notifications);
        if (postUris.length > 0) {
          const fetchedPosts = await this.api.getPosts(postUris, { labelers });
          await this._loadPostDependencies(fetchedPosts);
          this.dataStore.setPosts(fetchedPosts);
        }
        return { items: res.notifications, cursor: res.cursor };
      },
    );

    this.loadMentionNotifications = this.collectionQueryLoader(
      () => mentionNotificationsQueryKey(),
      async (cursor, { limit = 31 } = {}) => {
        const labelers = await this.requireLabelers();
        const res = await this.api.getNotifications({
          cursor,
          limit,
          reasons: ["mention", "reply", "quote"],
          labelers,
        });
        this.dataStore.setProfiles(
          res.notifications.map((notification) => notification.author),
        );
        const postUris = getPostUrisFromNotifications(res.notifications);
        if (postUris.length > 0) {
          const fetchedPosts = await this.api.getPosts(postUris, { labelers });
          await this._loadPostDependencies(fetchedPosts);
          this.dataStore.setPosts(fetchedPosts);
        }
        return { items: res.notifications, cursor: res.cursor };
      },
    );

    this.loadMutedProfiles = this.collectionQueryLoader(
      () => mutedProfilesQueryKey(),
      async (cursor) => {
        const labelers = await this.requireLabelers();
        const res = await this.api.getMutes({ cursor, labelers });
        this.dataStore.setProfiles(res.mutes);
        return {
          items: res.mutes.map((profile) => profile.did),
          cursor: res.cursor,
        };
      },
    );

    this.loadDrafts = this.collectionQueryLoader(
      () => draftsQueryKey(),
      async (cursor) => {
        const res = await this.api.getDrafts({ cursor });
        const localRefs = res.drafts.flatMap((draftView) =>
          getLocalRefsFromDraft(draftView.draft),
        );
        await this.draftMediaStore.load(localRefs);
        return { items: res.drafts, cursor: res.cursor };
      },
    );

    this.loadConvoRequestList = this.collectionQueryLoader(
      () => convoRequestListQueryKey(),
      async (cursor, { limit = 30 } = {}) => {
        const labelers = await this.requireLabelers();
        const res = await this.api.listConvos({
          cursor,
          limit,
          status: "request",
          labelers,
        });
        for (const convo of res.convos) {
          this.dataStore.$convos.set(convo.id, convo);
        }
        return {
          items: res.convos.map((convo) => convo.id),
          cursor: res.cursor,
        };
      },
    );
  }

  async requireLabelers() {
    const preferences = await this.preferencesProvider.requirePreferences();
    return preferences.getLabelerDids();
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

  async loadPost(postURI) {
    const labelers = await this.requireLabelers();
    const post = await this.api.getPost(postURI, { labelers });
    await this._loadPostDependencies([post]);
    this.dataStore.setPosts([post]);
  }

  async loadPosts(postURIs) {
    if (postURIs.length === 0) return;
    const labelers = await this.requireLabelers();
    const posts = await this.api.getPosts(postURIs, { labelers });
    await this._loadPostDependencies(posts);
    this.dataStore.setPosts(posts);
  }

  async _loadParentChain(blockedParent, { labelers = [], rootUri } = {}) {
    if (
      !rootUri ||
      isBlockingUser(blockedParent) ||
      isBlockedByViewer(blockedParent)
    ) {
      return await this.loadPostThread({
        uri: blockedParent.uri,
        depth: 0,
        labelers,
      });
    }

    let backlinks;
    try {
      backlinks = await this._getPostsInThreadFromBacklinks(rootUri);
    } catch (error) {
      if (error.name === "AbortError") {
        return await this.loadPostThread({
          uri: blockedParent.uri,
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

      const posts = await this.api.getPosts(authorUris, { labelers });
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
      return await this.loadPostThread({
        uri: blockedParent.uri,
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
    const labelers = await this.requireLabelers();
    const fetchedBlockedPosts = await this.api.getPosts(blockedPostUris, {
      labelers,
    });
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
    const labelers = await this.requireLabelers();
    const profile = await this.api.getProfile(did, { labelers });
    this.dataStore.$profiles.set(did, profile);
    this.dataStore.$detailedProfiles.set(did, profile);
  }

  async loadDetailedProfiles(dids) {
    if (dids.length === 0) return;
    const labelers = await this.requireLabelers();
    const profiles = await this.api.getProfiles(dids, { labelers });
    for (const profile of profiles) {
      this.dataStore.$profiles.set(profile.did, profile);
      this.dataStore.$detailedProfiles.set(profile.did, profile);
    }
  }

  async loadConvo(convoId) {
    const labelers = await this.requireLabelers();
    const res = await this.api.getConvo(convoId, { labelers });
    this.dataStore.setConvo(res.convo);
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
    const labelers = await this.requireLabelers();
    const res = await this.api.getConvoForMembers([profileDid], { labelers });
    this.dataStore.setConvo(res.convo);
  }

  async pollConvoMessages(convoId, { cursor = "" } = {}) {
    const labelers = await this.requireLabelers();
    const res = await this.api.getChatLogs({ cursor, labelers });
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
        continue;
      }
      if (
        log.$type === "chat.bsky.convo.defs#logDeleteMessage" &&
        log.message?.id
      ) {
        this.queryStore.removeFromQuery(
          convoMessagesQueryKey({ convoId }),
          log.message.id,
        );
        this.dataStore.$messages.delete(log.message.id);
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
      const queryKey = convoMessagesQueryKey({ convoId });
      const messageIds = this.queryStore.getItems(queryKey);
      if (!messageIds) {
        console.warn("No messages data found for convoId", convoId);
        return res.cursor;
      }
      if (messageIds.includes(log.message.id)) continue;
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
      this.queryStore.prependToQuery(queryKey, log.message.id);
      newMessages.push(log.message);
    }
    await this._loadJoinLinkPreviews(getJoinLinkCodesFromMessages(newMessages));
    return res.cursor;
  }

  queryLoader(queryKeyFn, fetchValue, options = {}) {
    return this._wrapLoader(
      async (queryKey, params = {}) => {
        const value = await fetchValue(params);
        this.queryStore.setValue(queryKey, value);
        return value;
      },
      queryKeyFn,
      { ...options, injectKey: true },
    );
  }

  collectionQueryLoader(queryKeyFn, fetchPage) {
    return this._wrapLoader(
      async (queryKey, params = {}, { reload = false } = {}) => {
        const cursor = reload ? "" : this.queryStore.getNextCursor(queryKey);
        if (cursor === null) {
          return;
        }
        const page = await fetchPage(cursor, params, { reload });
        this.queryStore.writePage(queryKey, page, {
          reload,
          requestCursor: cursor,
        });
      },
      queryKeyFn,
      { injectKey: true },
    );
  }

  registerLoader(requestMethod, requestIdOrFn, options) {
    this[requestMethod.name] = this._wrapLoader(
      requestMethod,
      requestIdOrFn,
      options,
    );
  }

  _wrapLoader(
    requestMethod,
    requestIdOrFn,
    { dedupe = false, injectKey = false } = {},
  ) {
    async function wrappedRequestMethod(...args) {
      const requestId =
        typeof requestIdOrFn === "function"
          ? requestIdOrFn(...args)
          : requestIdOrFn;

      if (dedupe) {
        const inFlight = this._inFlightRequests.get(requestId);
        if (inFlight) {
          return inFlight;
        }
      }

      const promise = (async () => {
        this.statusStore.setLoading(requestId, true);
        try {
          const result = await requestMethod.apply(
            this,
            injectKey ? [requestId, ...args] : args,
          );
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
      })();

      if (!dedupe) {
        return promise;
      }

      this._inFlightRequests.set(requestId, promise);
      try {
        return await promise;
      } finally {
        this._inFlightRequests.delete(requestId);
      }
    }
    return wrappedRequestMethod.bind(this);
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

  async loadCurrentUserLists(params = {}, { reload = false } = {}) {
    const currentUser = this.dataStore.$currentUser.get();
    if (!currentUser) return;
    await this.loadActorLists({ did: currentUser.did }, { reload });
  }

  async loadProfileChatStatus(profileDid) {
    const labelers = await this.requireLabelers();
    const res = await this.api.getConvoAvailability([profileDid], {
      labelers,
    });
    this.dataStore.$profileChatStatus.set(profileDid, res);
  }

  async loadLabelerInfo(labelerDid) {
    const labelerInfo = await this.api.getLabeler(labelerDid);
    this.dataStore.$labelerInfo.set(labelerDid, labelerInfo);
  }
}
