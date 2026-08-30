import { parseUri } from "/js/dataHelpers.js";
import { RefreshTokenError } from "/js/auth.js";
import { TokenRefreshError as OauthRefreshTokenError } from "/js/oauth.js";
import {
  batch,
  buildQueryString,
  getCurrentTimestamp,
  unique,
} from "/js/utils.js";
import { linkToLogin } from "/js/navigation.js";
import {
  PUBLIC_SERVICE_ENDPOINT_URL,
  BSKY_APPVIEW_SERVICE_DID,
  BSKY_CHAT_SERVICE_DID,
  BSKY_LABELER_DID,
  VIDEO_SERVICE_URL,
  VIDEO_SERVICE_DID,
  GIF_SERVICE_URL,
} from "/js/config.js";

export class ApiError extends Error {
  constructor(res) {
    const message = `${res.status} ${res.statusText}`;
    super(message);
    this.status = res.status;
    this.statusText = res.statusText;
    this.data = res.data;
    this.headers = res.headers;
    this.url = res.url;
  }
}

export function isRecordNotFoundError(error) {
  return error instanceof ApiError && error.data?.error === "RecordNotFound";
}

class PublicSession {
  constructor() {
    this.serviceEndpoint = PUBLIC_SERVICE_ENDPOINT_URL;
  }
  async fetch(url, options) {
    return fetch(url, options);
  }
  get did() {
    throw new Error("Public session does not have a DID");
  }
}

// Matches the header format in @atproto/api
function buildAcceptLabelersHeader(labelerDids) {
  return labelerDids
    .map((did) => (did === BSKY_LABELER_DID ? `${did};redact` : did))
    .join(", ");
}

// Used for merging provided headers with defaults
function parseAcceptLabelersHeader(header) {
  return (header ?? "")
    .split(",")
    .map((entry) => entry.split(";")[0].trim())
    .filter(Boolean);
}

export class Api {
  constructor(
    session,
    {
      onTokenRefreshError = null,
      bskyAppViewServiceDid = BSKY_APPVIEW_SERVICE_DID,
      chatAppViewServiceDid = BSKY_CHAT_SERVICE_DID,
      getLabelerDids = null,
    } = {},
  ) {
    this.isAuthenticated = !!session;
    this.session = session ?? new PublicSession();
    this.onTokenRefreshError = onTokenRefreshError;
    this.bskyAppViewServiceDid = bskyAppViewServiceDid;
    this.chatAppViewServiceDid = chatAppViewServiceDid;
    this.getLabelerDids = getLabelerDids;
  }

  async appViewRequest(path, options = {}) {
    const headers = {
      "atproto-proxy": this.bskyAppViewServiceDid,
      ...options.headers,
    };
    if (this.getLabelerDids) {
      const providedDids = await this.getLabelerDids();
      // Merge provided labeler dids into existing labelers header if present
      const headerDids = headers["atproto-accept-labelers"]
        ? parseAcceptLabelersHeader(headers["atproto-accept-labelers"])
        : [];
      const allDids = unique([...providedDids, ...headerDids]);
      if (allDids.length) {
        headers["atproto-accept-labelers"] = buildAcceptLabelersHeader(allDids);
      }
    }
    return this.request(path, { ...options, headers });
  }

  chatRequest(path, options = {}) {
    return this.request(path, {
      ...options,
      headers: {
        "atproto-proxy": this.chatAppViewServiceDid,
        ...options.headers,
      },
    });
  }

  async request(path, options = {}) {
    const {
      body,
      query,
      method,
      headers = {},
      parseJson = true,
      stringifyBody = true,
      ...restOptions
    } = options;
    let queryString = "";
    if (query) {
      queryString = "?" + buildQueryString(query);
    }
    let res = null;
    try {
      const fetchOptions = {
        ...restOptions,
        method: method ?? "GET",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
      };
      if (body) {
        if (stringifyBody) {
          fetchOptions.body = JSON.stringify(body);
        } else {
          fetchOptions.body = body;
        }
      }
      res = await this.session.fetch(
        `${this.session.serviceEndpoint}/xrpc/${path}${queryString}`,
        fetchOptions,
      );
    } catch (error) {
      // Handle token refresh error
      if (
        error instanceof RefreshTokenError ||
        error instanceof OauthRefreshTokenError
      ) {
        console.error("Token refresh error", error);
        const did = this.isAuthenticated ? (this.session.did ?? null) : null;
        await this.onTokenRefreshError?.(did);
        window.location.href = linkToLogin();
        await new Promise(() => {});
      }
      throw error;
    }
    let data = null;
    if (parseJson) {
      // If body was already consumed by the oauth library, use that
      data = res.data ?? (await res.json());
    }
    res.data = data;
    if (!res.ok) {
      throw new ApiError(res);
    }
    return res;
  }

  async createLikeRecord(post) {
    const res = await this.request("com.atproto.repo.createRecord", {
      method: "POST",
      body: {
        repo: this.session.did,
        collection: "app.bsky.feed.like",
        record: {
          createdAt: getCurrentTimestamp(),
          subject: { uri: post.uri, cid: post.cid },
        },
      },
    });
    return res.data;
  }

  async deleteLikeRecord(post) {
    const like = post.viewer.like;
    const rkey = like.split("/").pop();
    const res = await this.request("com.atproto.repo.deleteRecord", {
      method: "POST",
      body: {
        repo: this.session.did,
        collection: "app.bsky.feed.like",
        rkey,
      },
    });
    return res.data;
  }

  async createRepostRecord(post) {
    const res = await this.request("com.atproto.repo.createRecord", {
      method: "POST",
      body: {
        repo: this.session.did,
        collection: "app.bsky.feed.repost",
        record: {
          createdAt: getCurrentTimestamp(),
          subject: { uri: post.uri, cid: post.cid },
        },
      },
    });
    return res.data;
  }

  async deleteRepostRecord(post) {
    const repost = post.viewer.repost;
    const rkey = repost.split("/").pop();
    const res = await this.request("com.atproto.repo.deleteRecord", {
      method: "POST",
      body: {
        repo: this.session.did,
        collection: "app.bsky.feed.repost",
        rkey,
      },
    });
    return res.data;
  }

  async createBookmark(post) {
    const res = await this.appViewRequest("app.bsky.bookmark.createBookmark", {
      method: "POST",
      body: {
        uri: post.uri,
        cid: post.cid,
      },
      parseJson: false,
    });
    return res.data;
  }

  async deleteBookmark(post) {
    const res = await this.appViewRequest("app.bsky.bookmark.deleteBookmark", {
      method: "POST",
      body: {
        uri: post.uri,
      },
      parseJson: false,
    });
    return res.data;
  }

  async getDrafts({ cursor = "", limit } = {}) {
    const query = {};
    if (cursor) {
      query.cursor = cursor;
    }
    if (limit) {
      query.limit = limit;
    }
    const res = await this.appViewRequest("app.bsky.draft.getDrafts", {
      query,
    });
    return res.data;
  }

  async createDraft(draft) {
    const res = await this.appViewRequest("app.bsky.draft.createDraft", {
      method: "POST",
      body: { draft },
    });
    return res.data;
  }

  async updateDraft(id, draft) {
    const res = await this.appViewRequest("app.bsky.draft.updateDraft", {
      method: "POST",
      body: { draft: { id, draft } },
      parseJson: false,
    });
    return res.data;
  }

  async deleteDraft(id) {
    const res = await this.appViewRequest("app.bsky.draft.deleteDraft", {
      method: "POST",
      body: { id },
      parseJson: false,
    });
    return res.data;
  }

  async createFollowRecord(profile) {
    const res = await this.request(`com.atproto.repo.createRecord`, {
      method: "POST",
      body: {
        repo: this.session.did,
        collection: "app.bsky.graph.follow",
        record: {
          createdAt: getCurrentTimestamp(),
          subject: profile.did,
        },
      },
    });
    return res.data;
  }

  async deleteFollowRecord(profile) {
    const follow = profile.viewer.following;
    const rkey = follow.split("/").pop();
    const res = await this.request("com.atproto.repo.deleteRecord", {
      method: "POST",
      body: {
        repo: this.session.did,
        collection: "app.bsky.graph.follow",
        rkey,
      },
    });
    return res.data;
  }

  async createListItemRecord(listUri, subjectDid) {
    const res = await this.request("com.atproto.repo.createRecord", {
      method: "POST",
      body: {
        repo: this.session.did,
        collection: "app.bsky.graph.listitem",
        record: {
          createdAt: getCurrentTimestamp(),
          subject: subjectDid,
          list: listUri,
        },
      },
    });
    return res.data;
  }

  async deleteListItemRecord(listItemUri) {
    const rkey = listItemUri.split("/").pop();
    const res = await this.request("com.atproto.repo.deleteRecord", {
      method: "POST",
      body: {
        repo: this.session.did,
        collection: "app.bsky.graph.listitem",
        rkey,
      },
    });
    return res.data;
  }

  async getListItems({ limit = 100, cursor = "" } = {}) {
    const query = {
      repo: this.session.did,
      collection: "app.bsky.graph.listitem",
      limit,
    };
    if (cursor) {
      query.cursor = cursor;
    }
    const res = await this.request("com.atproto.repo.listRecords", { query });
    return res.data;
  }

  async getPostThread(postUri, { depth = 6 } = {}) {
    const res = await this.appViewRequest(`app.bsky.feed.getPostThread`, {
      query: {
        uri: postUri,
        depth,
        parentHeight: 1000, // max height, just so we don't set the wrong reply root by accident. This should be really rare - the default is 80.
      },
    });
    return res.data.thread;
  }

  async getPostThreadOther(postUri) {
    const res = await this.appViewRequest(
      `app.bsky.unspecced.getPostThreadOtherV2`,
      {
        query: { anchor: postUri },
      },
    );
    return res.data.thread;
  }

  async getFeed(feedURI, { limit = 31, cursor = "" } = {}) {
    const res = await this.appViewRequest(`app.bsky.feed.getFeed`, {
      query: {
        feed: feedURI,
        limit,
        cursor,
      },
    });
    return res.data;
  }

  async getFeedGenerator(feedURI) {
    const res = await this.appViewRequest(`app.bsky.feed.getFeedGenerator`, {
      query: { feed: feedURI },
    });
    return res.data.view; // note- returning the view object.
  }

  async getFeedGenerators(feedURIs) {
    const res = await this.appViewRequest(`app.bsky.feed.getFeedGenerators`, {
      query: { feeds: feedURIs },
    });
    return res.data.feeds;
  }

  async getStarterPack(starterPackURI) {
    const res = await this.appViewRequest(`app.bsky.graph.getStarterPack`, {
      query: { starterPack: starterPackURI },
    });
    return res.data.starterPack;
  }

  async getList(listURI, { limit = 1, cursor = "" } = {}) {
    const query = { list: listURI, limit };
    if (cursor) {
      query.cursor = cursor;
    }
    const res = await this.appViewRequest(`app.bsky.graph.getList`, {
      query,
    });
    return res.data;
  }

  async getListFeed(listURI, { limit = 31, cursor = "" } = {}) {
    const query = { list: listURI, limit };
    if (cursor) {
      query.cursor = cursor;
    }
    const res = await this.appViewRequest(`app.bsky.feed.getListFeed`, {
      query,
    });
    return res.data;
  }

  async getActorFeeds(did, { limit = 50, cursor = "" } = {}) {
    const query = { actor: did, limit };
    if (cursor) {
      query.cursor = cursor;
    }
    const res = await this.appViewRequest(`app.bsky.feed.getActorFeeds`, {
      query,
    });
    return res.data;
  }

  async getListsWithMembership(actor, { limit = 50, cursor = "" } = {}) {
    const query = { actor, limit };
    if (cursor) {
      query.cursor = cursor;
    }
    const res = await this.appViewRequest(
      "app.bsky.graph.getListsWithMembership",
      {
        query,
      },
    );
    return res.data;
  }

  async getActorLists(did, { limit = 50, cursor = "" } = {}) {
    const query = { actor: did, limit };
    if (cursor) {
      query.cursor = cursor;
    }
    const res = await this.appViewRequest(`app.bsky.graph.getLists`, {
      query,
    });
    return res.data;
  }

  async searchFeedGenerators(query, { limit = 15, cursor = "" } = {}) {
    const queryParams = { limit, query };
    if (cursor) {
      queryParams.cursor = cursor;
    }
    const res = await this.appViewRequest(
      `app.bsky.unspecced.getPopularFeedGenerators`,
      {
        query: queryParams,
      },
    );
    return res.data;
  }

  async getTrends({ limit = 5 } = {}) {
    const res = await this.appViewRequest(`app.bsky.unspecced.getTrends`, {
      query: { limit },
    });
    return res.data;
  }

  async getFollowingFeed({ limit = 31, cursor = "" } = {}) {
    const res = await this.appViewRequest(`app.bsky.feed.getTimeline`, {
      query: { limit, cursor },
    });
    return res.data;
  }

  // Returns the posts in request order. The result may still be a subset
  // because the app view omits deleted and blocked posts
  async getPosts(postURIs) {
    const batches = batch(postURIs, 25);
    let posts = [];
    for (const batch of batches) {
      const res = await this.appViewRequest(`app.bsky.feed.getPosts`, {
        query: { uris: batch },
      });
      posts.push(...res.data.posts);
    }
    const orderByUri = new Map(postURIs.map((uri, index) => [uri, index]));
    posts.sort(
      (a, b) =>
        (orderByUri.get(a.uri) ?? Infinity) -
        (orderByUri.get(b.uri) ?? Infinity),
    );
    return posts;
  }

  async getPost(postUri) {
    const posts = await this.getPosts([postUri]);
    if (posts.length === 0) {
      throw new Error(`Post not found: ${postUri}`);
    }
    return posts[0];
  }

  async getRecord(uri) {
    const { repo, rkey, collection } = parseUri(uri);
    const res = await this.request(`com.atproto.repo.getRecord`, {
      query: {
        repo,
        collection,
        rkey,
      },
    });
    return res.data;
  }

  async getRepost(repostUri) {
    return this.getRecord(repostUri);
  }

  async getReposts(repostUris) {
    const reposts = [];
    // Batch to avoid rate limiting
    const batches = batch(repostUris, 5);
    for (const batch of batches) {
      const results = await Promise.allSettled(
        batch.map((repostUri) => this.getRepost(repostUri)),
      );
      // Only keep successful responses. This is similar to getPosts()
      const successfulResponses = results
        .filter((result) => result.status === "fulfilled")
        .map((result) => result.value);
      reposts.push(...successfulResponses);
    }
    return reposts;
  }

  async getProfile(did) {
    const res = await this.appViewRequest(`app.bsky.actor.getProfile`, {
      query: { actor: did },
    });
    return res.data;
  }

  async getProfiles(dids) {
    const results = await Promise.all(
      batch(dids, 25).map((chunk) =>
        this.appViewRequest(`app.bsky.actor.getProfiles`, {
          query: { actors: chunk },
        }),
      ),
    );
    return results.flatMap((res) => res.data.profiles);
  }

  async searchProfiles(query, { limit = 10, cursor = "" } = {}) {
    const queryParams = { q: query, limit };
    if (cursor) {
      queryParams.cursor = cursor;
    }
    const res = await this.appViewRequest(`app.bsky.actor.searchActors`, {
      query: queryParams,
    });
    return res.data;
  }

  async searchProfilesTypeahead(query, { limit = 12 } = {}) {
    const res = await this.appViewRequest(
      `app.bsky.actor.searchActorsTypeahead`,
      {
        query: { q: query, limit },
      },
    );
    return res.data;
  }

  async searchPosts(query, { limit = 25, sort = "top", cursor = "" } = {}) {
    const queryParams = { q: query, limit, sort };
    if (cursor) {
      queryParams.cursor = cursor;
    }
    const res = await this.appViewRequest(`app.bsky.feed.searchPosts`, {
      query: queryParams,
    });
    return res.data;
  }

  async sendInteractions(interactions, feedProxyUrl) {
    // Interactions are only useful to the feed generator that served the
    // posts, so callers must route to one.
    if (!feedProxyUrl) {
      throw new Error("sendInteractions requires a feedProxyUrl");
    }
    await this.request(`app.bsky.feed.sendInteractions`, {
      method: "POST",
      body: { interactions },
      headers: {
        "atproto-proxy": feedProxyUrl,
      },
      parseJson: false, // third-party feed might not return JSON
    });
  }

  async getAuthorFeed(
    did,
    {
      limit = 31,
      cursor = "",
      filter = "posts_and_author_threads",
      includePins = false,
    } = {},
  ) {
    const res = await this.appViewRequest(`app.bsky.feed.getAuthorFeed`, {
      query: { actor: did, limit, cursor, filter, includePins },
    });
    return res.data;
  }

  async getActorLikes(did, { limit = 31, cursor = "" } = {}) {
    const query = { actor: did, limit };
    if (cursor) {
      query.cursor = cursor;
    }
    const res = await this.appViewRequest(`app.bsky.feed.getActorLikes`, {
      query,
    });
    return res.data;
  }

  async getPreferences() {
    const res = await this.request(`app.bsky.actor.getPreferences`); // note - no atproto-proxy for this endpoint
    return res.data.preferences;
  }

  async updatePreferences(preferencesObj) {
    const res = await this.appViewRequest(`app.bsky.actor.putPreferences`, {
      method: "POST",
      body: { preferences: preferencesObj },
      parseJson: false,
    });
    return res;
  }

  async getLabelers(labelerDids) {
    const res = await this.appViewRequest(`app.bsky.labeler.getServices`, {
      query: { dids: labelerDids, detailed: true },
    });
    return res.data.views;
  }

  async getLabeler(labelerDid) {
    const labelers = await this.getLabelers([labelerDid]);
    return labelers[0];
  }

  async getSession() {
    const res = await this.request("com.atproto.server.getSession", {
      method: "GET",
    });
    return res.data;
  }

  async getNumNotifications() {
    const res = await this.appViewRequest(
      "app.bsky.notification.getUnreadCount",
    );
    return res.data.count;
  }

  async registerPush({ serviceDid, token, platform, appId }) {
    await this.request("app.bsky.notification.registerPush", {
      method: "POST",
      body: { serviceDid, token, platform, appId },
      headers: {
        "atproto-proxy": `${serviceDid}#bsky_notif`,
      },
      parseJson: false,
    });
  }

  async unregisterPush({ serviceDid, token, platform, appId }) {
    await this.request("app.bsky.notification.unregisterPush", {
      method: "POST",
      body: { serviceDid, token, platform, appId },
      headers: {
        "atproto-proxy": `${serviceDid}#bsky_notif`,
      },
      parseJson: false,
    });
  }

  async getNotifications({ cursor, limit = 31, reasons } = {}) {
    const query = { cursor: cursor ?? "", limit };
    if (reasons?.length) {
      query.reasons = reasons;
    }
    const res = await this.appViewRequest(
      "app.bsky.notification.listNotifications",
      {
        query,
      },
    );
    return res.data;
  }

  async markNotificationsAsRead() {
    await this.appViewRequest("app.bsky.notification.updateSeen", {
      method: "POST",
      body: { seenAt: getCurrentTimestamp() },
      parseJson: false,
    });
  }

  async listConvos({ cursor, limit = 30, readState, status } = {}) {
    const query = { limit };
    if (cursor) {
      query.cursor = cursor;
    }
    if (readState) {
      query.readState = readState;
    }
    if (status) {
      query.status = status;
    }
    const res = await this.chatRequest("chat.bsky.convo.listConvos", {
      query,
    });
    return res.data;
  }

  async getConvo(convoId) {
    const res = await this.chatRequest("chat.bsky.convo.getConvo", {
      query: { convoId },
    });
    return res.data;
  }

  async getConvoMembers(convoId, { cursor, limit = 50 } = {}) {
    const query = { convoId, limit };
    if (cursor) {
      query.cursor = cursor;
    }
    const res = await this.chatRequest("chat.bsky.convo.getConvoMembers", {
      query,
    });
    return res.data;
  }

  async getMessages(convoId, { cursor, limit = 50 } = {}) {
    const query = { convoId, limit };
    if (cursor) {
      query.cursor = cursor;
    }
    const res = await this.chatRequest("chat.bsky.convo.getMessages", {
      query,
    });
    return res.data;
  }

  async sendMessage(convoId, { text, facets, replyTo, embed }) {
    const message = { text, facets };
    if (replyTo) {
      message.replyTo = replyTo;
    }
    if (embed) {
      message.embed = embed;
    }
    const res = await this.chatRequest("chat.bsky.convo.sendMessage", {
      method: "POST",
      body: {
        convoId,
        message,
      },
    });
    return res.data;
  }

  async acceptConvo(convoId) {
    const res = await this.chatRequest("chat.bsky.convo.acceptConvo", {
      method: "POST",
      body: {
        convoId,
      },
    });
    return res.data;
  }

  async leaveConvo(convoId) {
    const res = await this.chatRequest("chat.bsky.convo.leaveConvo", {
      method: "POST",
      body: {
        convoId,
      },
    });
    return res.data;
  }

  async muteConvo(convoId) {
    const res = await this.chatRequest("chat.bsky.convo.muteConvo", {
      method: "POST",
      body: {
        convoId,
      },
    });
    return res.data;
  }

  async unmuteConvo(convoId) {
    const res = await this.chatRequest("chat.bsky.convo.unmuteConvo", {
      method: "POST",
      body: {
        convoId,
      },
    });
    return res.data;
  }

  async getConvoAvailability(memberDids) {
    const res = await this.chatRequest("chat.bsky.convo.getConvoAvailability", {
      query: { members: memberDids },
    });
    return res.data;
  }

  async createGroupChat(name, memberDids) {
    const res = await this.chatRequest("chat.bsky.group.createGroup", {
      method: "POST",
      body: { name, members: memberDids },
    });
    return res.data;
  }

  async getChatActorStatus() {
    const res = await this.chatRequest("chat.bsky.actor.getStatus");
    return res.data;
  }

  async getConvoForMembers(memberDids) {
    const res = await this.chatRequest("chat.bsky.convo.getConvoForMembers", {
      query: { members: memberDids },
    });
    return res.data;
  }

  async getChatLogs({ cursor }) {
    const res = await this.chatRequest("chat.bsky.convo.getLog", {
      query: { cursor },
    });
    return res.data;
  }

  async markConvoAsRead(convoId) {
    await this.chatRequest("chat.bsky.convo.updateRead", {
      method: "POST",
      body: {
        convoId,
      },
    });
  }

  async getChatUnreadCounts({ includeGroupChats = true } = {}) {
    const res = await this.chatRequest("chat.bsky.convo.getUnreadCounts", {
      query: { includeGroupChats },
    });
    return res.data;
  }

  async addMessageReaction(convoId, messageId, emoji) {
    const res = await this.chatRequest("chat.bsky.convo.addReaction", {
      method: "POST",
      body: {
        convoId,
        messageId,
        value: emoji,
      },
    });
    return res.data.message;
  }

  async removeMessageReaction(convoId, messageId, emoji) {
    const res = await this.chatRequest("chat.bsky.convo.removeReaction", {
      method: "POST",
      body: {
        convoId,
        messageId,
        value: emoji,
      },
    });
    return res.data.message;
  }

  async getJoinLinkPreviews(codes) {
    const res = await this.chatRequest("chat.bsky.group.getJoinLinkPreviews", {
      query: { codes },
    });
    return res.data;
  }

  async requestJoinGroupChat(code) {
    const res = await this.chatRequest("chat.bsky.group.requestJoin", {
      method: "POST",
      body: { code },
    });
    return res.data;
  }

  async getLikes(postUri, { limit = 50, cursor } = {}) {
    const query = { uri: postUri, limit };
    if (cursor) {
      query.cursor = cursor;
    }
    const res = await this.appViewRequest("app.bsky.feed.getLikes", {
      query,
    });
    return res.data;
  }

  async getQuotes(postUri, { limit = 50, cursor } = {}) {
    const query = { uri: postUri, limit };
    if (cursor) {
      query.cursor = cursor;
    }
    const res = await this.appViewRequest("app.bsky.feed.getQuotes", {
      query,
    });
    return res.data;
  }

  async getRepostedBy(postUri, { limit = 50, cursor } = {}) {
    const query = { uri: postUri, limit };
    if (cursor) {
      query.cursor = cursor;
    }
    const res = await this.appViewRequest("app.bsky.feed.getRepostedBy", {
      query,
    });
    return res.data;
  }

  async getBookmarks({ limit = 31, cursor } = {}) {
    const query = { limit };
    if (cursor) {
      query.cursor = cursor;
    }
    const res = await this.appViewRequest("app.bsky.bookmark.getBookmarks", {
      query,
    });
    return res.data;
  }

  async getFollowers(actor, { limit = 50, cursor } = {}) {
    const query = { actor, limit };
    if (cursor) {
      query.cursor = cursor;
    }
    const res = await this.appViewRequest("app.bsky.graph.getFollowers", {
      query,
    });
    return res.data;
  }

  async getKnownFollowers(actor, { limit = 50, cursor } = {}) {
    const query = { actor, limit };
    if (cursor) {
      query.cursor = cursor;
    }
    const res = await this.appViewRequest("app.bsky.graph.getKnownFollowers", {
      query,
    });
    return res.data;
  }

  async getFollows(actor, { limit = 50, cursor } = {}) {
    const query = { actor, limit };
    if (cursor) {
      query.cursor = cursor;
    }
    const res = await this.appViewRequest("app.bsky.graph.getFollows", {
      query,
    });
    return res.data;
  }

  async putActivitySubscription(did, activitySubscription) {
    const res = await this.appViewRequest(
      "app.bsky.notification.putActivitySubscription",
      {
        method: "POST",
        body: {
          subject: did,
          activitySubscription,
        },
      },
    );
    return res.data;
  }

  async muteActor(did) {
    const res = await this.appViewRequest("app.bsky.graph.muteActor", {
      method: "POST",
      body: {
        actor: did,
      },
      parseJson: false,
    });
    return res;
  }

  async unmuteActor(did) {
    const res = await this.appViewRequest("app.bsky.graph.unmuteActor", {
      method: "POST",
      body: {
        actor: did,
      },
      parseJson: false,
    });
    return res;
  }

  async blockActor(profile) {
    const res = await this.request("com.atproto.repo.createRecord", {
      method: "POST",
      body: {
        repo: this.session.did,
        collection: "app.bsky.graph.block",
        record: {
          createdAt: getCurrentTimestamp(),
          subject: profile.did,
        },
      },
    });
    return res.data;
  }

  async getBlocks({ limit = 50, cursor } = {}) {
    const query = { limit };
    if (cursor) {
      query.cursor = cursor;
    }
    const res = await this.appViewRequest("app.bsky.graph.getBlocks", {
      query,
    });
    return res.data;
  }

  async getMutes({ limit = 50, cursor } = {}) {
    const query = { limit };
    if (cursor) {
      query.cursor = cursor;
    }
    const res = await this.appViewRequest("app.bsky.graph.getMutes", {
      query,
    });
    return res.data;
  }

  async unblockActor(profile) {
    const block = profile.viewer.blocking;
    const rkey = block.split("/").pop();
    const res = await this.request("com.atproto.repo.deleteRecord", {
      method: "POST",
      body: {
        repo: this.session.did,
        collection: "app.bsky.graph.block",
        rkey,
      },
    });
    return res.data;
  }

  async muteModList(listUri) {
    const res = await this.appViewRequest("app.bsky.graph.muteActorList", {
      method: "POST",
      body: {
        list: listUri,
      },
      parseJson: false,
    });
    return res;
  }

  async unmuteModList(listUri) {
    const res = await this.appViewRequest("app.bsky.graph.unmuteActorList", {
      method: "POST",
      body: {
        list: listUri,
      },
      parseJson: false,
    });
    return res;
  }

  async blockModList(listUri) {
    const res = await this.request("com.atproto.repo.createRecord", {
      method: "POST",
      body: {
        repo: this.session.did,
        collection: "app.bsky.graph.listblock",
        record: {
          createdAt: getCurrentTimestamp(),
          subject: listUri,
        },
      },
    });
    return res.data;
  }

  async unblockModList(blockUri) {
    const rkey = blockUri.split("/").pop();
    const res = await this.request("com.atproto.repo.deleteRecord", {
      method: "POST",
      body: {
        repo: this.session.did,
        collection: "app.bsky.graph.listblock",
        rkey,
      },
    });
    return res.data;
  }

  async applyWrites(writes) {
    const res = await this.request("com.atproto.repo.applyWrites", {
      method: "POST",
      body: {
        repo: this.session.did,
        writes,
        validate: true,
      },
    });
    return res.data;
  }

  async deletePost(post) {
    const { rkey } = parseUri(post.uri);
    await this.request("com.atproto.repo.deleteRecord", {
      method: "POST",
      body: {
        repo: this.session.did,
        collection: "app.bsky.feed.post",
        rkey,
      },
    });
  }

  async uploadBlob(blob, { signal = null } = {}) {
    const res = await this.request("com.atproto.repo.uploadBlob", {
      method: "POST",
      headers: {
        "Content-Type": blob.type,
      },
      body: blob,
      stringifyBody: false,
      signal,
    });
    return res.data.blob;
  }

  async getServiceAuthToken({ aud, lxm, exp, signal = null }) {
    const res = await this.request("com.atproto.server.getServiceAuth", {
      query: { aud, lxm, exp: exp ?? Math.floor(Date.now() / 1000) + 60 },
      signal,
    });
    return res.data.token;
  }

  async serviceRequest(
    url,
    { token, method = "GET", query, body, headers = {}, signal = null } = {},
  ) {
    let queryString = "";
    if (query) {
      queryString = "?" + buildQueryString(query);
    }
    const res = await fetch(`${url}${queryString}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body,
      signal,
    });
    const data = await res.json();
    res.data = data;
    if (!res.ok) {
      throw new ApiError(res);
    }
    return res;
  }

  async getVideoUploadLimits({ signal = null } = {}) {
    const token = await this.getServiceAuthToken({
      aud: VIDEO_SERVICE_DID,
      lxm: "app.bsky.video.getUploadLimits",
      signal,
    });
    const res = await this.serviceRequest(
      `${VIDEO_SERVICE_URL}/xrpc/app.bsky.video.getUploadLimits`,
      { token, signal },
    );
    return res.data;
  }

  async uploadVideoBlob(file, { signal = null } = {}) {
    const pdsHostname = new URL(this.session.serviceEndpoint).hostname;
    const token = await this.getServiceAuthToken({
      aud: `did:web:${pdsHostname}`,
      lxm: "com.atproto.repo.uploadBlob",
      exp: Math.floor(Date.now() / 1000) + 60 * 30,
      signal,
    });
    try {
      const res = await this.serviceRequest(
        `${VIDEO_SERVICE_URL}/xrpc/app.bsky.video.uploadVideo`,
        {
          token,
          method: "POST",
          query: { did: this.session.did, name: file.name },
          headers: { "Content-Type": file.type },
          body: file,
          signal,
        },
      );
      return res.data;
    } catch (error) {
      // If the same video has been uploaded before, the service returns 409
      // Treat this as a success
      if (
        error instanceof ApiError &&
        error.data?.error === "already_exists" &&
        error.data.jobId
      ) {
        return error.data;
      }
      throw error;
    }
  }

  async getVideoJobStatus(jobId, { signal = null } = {}) {
    const res = await this.serviceRequest(
      `${VIDEO_SERVICE_URL}/xrpc/app.bsky.video.getJobStatus`,
      { query: { jobId }, signal },
    );
    return res.data.jobStatus;
  }

  // The gifs.bsky.app proxy normalizes KLIPY responses into the Tenor Gif
  // shape: { next, results }.
  async _gifServiceRequest(path, { query = "", limit, cursor, signal }) {
    const params = {
      client_key: "impro-web",
      limit: String(limit),
      contentfilter: "low",
    };
    if (query) {
      params.q = query;
    }
    if (cursor) {
      params.pos = String(cursor);
    }
    const res = await this.serviceRequest(
      `${GIF_SERVICE_URL}/klipy/v2/${path}`,
      {
        query: params,
        signal,
      },
    );
    return res.data;
  }

  async searchGifs(query, { limit = 30, cursor = "", signal = null } = {}) {
    return this._gifServiceRequest("search", { query, limit, cursor, signal });
  }

  async getFeaturedGifs({ limit = 30, cursor = "", signal = null } = {}) {
    return this._gifServiceRequest("featured", { limit, cursor, signal });
  }

  async getProfileRecord() {
    const res = await this.request("com.atproto.repo.getRecord", {
      query: {
        repo: this.session.did,
        collection: "app.bsky.actor.profile",
        rkey: "self",
      },
    });
    return res.data;
  }

  async putProfileRecord(record, swapRecord) {
    const res = await this.request("com.atproto.repo.putRecord", {
      method: "POST",
      body: {
        repo: this.session.did,
        collection: "app.bsky.actor.profile",
        rkey: "self",
        record: {
          $type: "app.bsky.actor.profile",
          ...record,
        },
        swapRecord: swapRecord ?? null,
      },
    });
    return res.data;
  }

  async createListRecord(record) {
    const res = await this.request("com.atproto.repo.createRecord", {
      method: "POST",
      body: {
        repo: this.session.did,
        collection: "app.bsky.graph.list",
        record: {
          $type: "app.bsky.graph.list",
          ...record,
        },
      },
    });
    return res.data;
  }

  async getListRecord(rkey) {
    const res = await this.request("com.atproto.repo.getRecord", {
      query: {
        repo: this.session.did,
        collection: "app.bsky.graph.list",
        rkey,
      },
    });
    return res.data;
  }

  async putListRecord(rkey, record, swapRecord) {
    const res = await this.request("com.atproto.repo.putRecord", {
      method: "POST",
      body: {
        repo: this.session.did,
        collection: "app.bsky.graph.list",
        rkey,
        record: {
          $type: "app.bsky.graph.list",
          ...record,
        },
        swapRecord: swapRecord ?? null,
      },
    });
    return res.data;
  }

  async getThreadgateRecord(rkey) {
    const res = await this.request("com.atproto.repo.getRecord", {
      query: {
        repo: this.session.did,
        collection: "app.bsky.feed.threadgate",
        rkey,
      },
    });
    return res.data;
  }

  async putThreadgateRecord(rkey, record, swapRecord) {
    const res = await this.request("com.atproto.repo.putRecord", {
      method: "POST",
      body: {
        repo: this.session.did,
        collection: "app.bsky.feed.threadgate",
        rkey,
        record: {
          $type: "app.bsky.feed.threadgate",
          ...record,
        },
        swapRecord: swapRecord ?? null,
      },
    });
    return res.data;
  }

  async getPostgateRecord(rkey) {
    const res = await this.request("com.atproto.repo.getRecord", {
      query: {
        repo: this.session.did,
        collection: "app.bsky.feed.postgate",
        rkey,
      },
    });
    return res.data;
  }

  async putPostgateRecord(rkey, record, swapRecord) {
    const res = await this.request("com.atproto.repo.putRecord", {
      method: "POST",
      body: {
        repo: this.session.did,
        collection: "app.bsky.feed.postgate",
        rkey,
        record: {
          $type: "app.bsky.feed.postgate",
          ...record,
        },
        swapRecord: swapRecord ?? null,
      },
    });
    return res.data;
  }

  async createModerationReport({ reasonType, reason, subject, labelerDid }) {
    const body = {
      reasonType,
      subject,
    };
    // Reason is optional
    if (reason) {
      body.reason = reason;
    }
    const res = await this.request("com.atproto.moderation.createReport", {
      method: "POST",
      body,
      headers: {
        "atproto-proxy": `${labelerDid}#atproto_labeler`,
      },
    });
    return res.data;
  }
}
