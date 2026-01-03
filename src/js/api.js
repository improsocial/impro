import { parseUri } from "/js/dataHelpers.js";
import { RefreshTokenError, getAuth } from "/js/auth.js";
import { TokenRefreshError as OauthRefreshTokenError } from "/js/oauth.js";
import { batch, getCurrentTimestamp } from "/js/utils.js";

export function buildQueryString(obj) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      value.forEach((v) => query.append(key, v));
    } else {
      query.append(key, value);
    }
  }
  return query.toString();
}

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

class PublicSession {
  constructor() {
    this.serviceEndpoint = "https://public.api.bsky.app";
  }
  async fetch(url, options) {
    return fetch(url, options);
  }
  get did() {
    throw new Error("Public session does not have a DID");
  }
}

export class Api {
  constructor(session) {
    this.isAuthenticated = !!session;
    this.session = session ?? new PublicSession();
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
        fetchOptions
      );
    } catch (error) {
      // Handle token refresh error
      if (
        error instanceof RefreshTokenError ||
        error instanceof OauthRefreshTokenError
      ) {
        console.error("Token refresh error", error);
        const auth = await getAuth();
        await auth.logout();
        window.location.href = "/login";
        await new Promise(() => {});
      }
      throw error;
    }
    let data = null;
    if (parseJson) {
      data = await res.json();
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
    const res = await this.request("app.bsky.bookmark.createBookmark", {
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
    const res = await this.request("app.bsky.bookmark.deleteBookmark", {
      method: "POST",
      body: {
        uri: post.uri,
      },
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

  async getPostThread(postUri, { labelers = [], depth = 6 } = {}) {
    const res = await this.request(`app.bsky.feed.getPostThread`, {
      query: {
        uri: postUri,
        depth,
        parentHeight: 1000, // max height, just so we don't set the wrong reply root by accident. This should be really rare - the default is 80.
      },
      headers: {
        "atproto-accept-labelers": labelers.join(","),
        "atproto-proxy": "did:web:api.bsky.app#bsky_appview",
      },
    });
    return res.data.thread;
  }

  async getFeed(feedURI, { limit = 31, cursor = "", labelers = [] } = {}) {
    const res = await this.request(`app.bsky.feed.getFeed`, {
      query: {
        feed: feedURI,
        limit,
        cursor,
      },
      headers: {
        "atproto-accept-labelers": labelers.join(","),
        "atproto-proxy": "did:web:api.bsky.app#bsky_appview",
      },
    });
    return res.data;
  }

  async getFeedGenerator(feedURI) {
    const res = await this.request(`app.bsky.feed.getFeedGenerator`, {
      query: { feed: feedURI },
      headers: {
        "atproto-proxy": "did:web:api.bsky.app#bsky_appview",
      },
    });
    return res.data.view; // note- returning the view object.
  }

  async getFeedGenerators(feedURIs) {
    const res = await this.request(`app.bsky.feed.getFeedGenerators`, {
      query: { feeds: feedURIs },
      headers: {
        "atproto-proxy": "did:web:api.bsky.app#bsky_appview",
      },
    });
    return res.data.feeds;
  }

  async getFollowingFeed({ limit = 31, cursor = "", labelers = [] } = {}) {
    const res = await this.request(`app.bsky.feed.getTimeline`, {
      query: { limit, cursor },
      headers: {
        "atproto-accept-labelers": labelers.join(","),
        "atproto-proxy": "did:web:api.bsky.app#bsky_appview",
      },
    });
    return res.data;
  }

  async getPosts(postURIs, { labelers = [] } = {}) {
    const batches = batch(postURIs, 25);
    let posts = [];
    for (const batch of batches) {
      const res = await this.request(`app.bsky.feed.getPosts`, {
        query: { uris: batch },
        headers: {
          "atproto-accept-labelers": labelers.join(","),
          "atproto-proxy": "did:web:api.bsky.app#bsky_appview",
        },
      });
      posts.push(...res.data.posts);
    }
    return posts;
  }

  async getPost(postUri, { labelers = [] } = {}) {
    // todo - individual API call?
    const posts = await this.getPosts([postUri], { labelers });
    if (posts.length === 0) {
      throw new Error(`Post not found: ${postUri}`);
    }
    return posts[0];
  }

  async getRepost(repostUri) {
    const { repo, rkey, collection } = parseUri(repostUri);
    const res = await this.request(`com.atproto.repo.getRecord`, {
      query: {
        repo,
        collection,
        rkey,
      },
    });
    return res.data;
  }

  async getReposts(repostUris) {
    const reposts = [];
    // Batch to avoid rate limiting
    const batches = batch(repostUris, 5);
    for (const batch of batches) {
      const results = await Promise.allSettled(
        batch.map((repostUri) => this.getRepost(repostUri))
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
    const res = await this.request(`app.bsky.actor.getProfile`, {
      query: { actor: did },
    });
    return res.data;
  }

  async searchProfiles(query, { limit = 10, labelers = [] } = {}) {
    const res = await this.request(`app.bsky.actor.searchActors`, {
      query: {
        q: query,
        limit,
      },
      headers: {
        "atproto-accept-labelers": labelers.join(","),
        "atproto-proxy": "did:web:api.bsky.app#bsky_appview",
      },
    });
    return res.data.actors;
  }

  async searchPosts(
    query,
    { limit = 25, sort = "top", cursor = "", labelers = [] } = {}
  ) {
    const queryParams = { q: query, limit, sort };
    if (cursor) {
      queryParams.cursor = cursor;
    }
    const res = await this.request(`app.bsky.feed.searchPosts`, {
      query: queryParams,
      headers: {
        "atproto-accept-labelers": labelers.join(","),
        "atproto-proxy": "did:web:api.bsky.app#bsky_appview",
      },
    });
    return res.data;
  }

  async sendInteractions(interactions, feedProxyUrl) {
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
      labelers = [],
    } = {}
  ) {
    const res = await this.request(`app.bsky.feed.getAuthorFeed`, {
      query: { actor: did, limit, cursor, filter, includePins },
      headers: {
        "atproto-accept-labelers": labelers.join(","),
        "atproto-proxy": "did:web:api.bsky.app#bsky_appview",
      },
    });
    return res.data;
  }

  async getActorLikes(did, { limit = 31, cursor = "", labelers = [] } = {}) {
    const query = { actor: did, limit };
    if (cursor) {
      query.cursor = cursor;
    }
    const res = await this.request(`app.bsky.feed.getActorLikes`, {
      query,
      headers: {
        "atproto-accept-labelers": labelers.join(","),
        "atproto-proxy": "did:web:api.bsky.app#bsky_appview",
      },
    });
    return res.data;
  }

  async getPreferences() {
    const res = await this.request(`app.bsky.actor.getPreferences`);
    return res.data.preferences;
  }

  async updatePreferences(preferencesObj) {
    const res = await this.request(`app.bsky.actor.putPreferences`, {
      method: "POST",
      body: { preferences: preferencesObj },
      parseJson: false,
    });
    return res;
  }

  async getLabelers(labelerDids) {
    const res = await this.request(`app.bsky.labeler.getServices`, {
      query: { dids: labelerDids, detailed: true },
    });
    return res.data.views;
  }

  async getSession() {
    const res = await this.request("com.atproto.server.getSession", {
      method: "GET",
    });
    return res.data;
  }

  async getNumNotifications() {
    const res = await this.request("app.bsky.notification.getUnreadCount");
    return res.data.count;
  }

  async getNotifications({ cursor, limit = 31 } = {}) {
    const res = await this.request("app.bsky.notification.listNotifications", {
      query: { cursor: cursor ?? "", limit },
    });
    return res.data;
  }

  async markNotificationsAsRead() {
    await this.request("app.bsky.notification.updateSeen", {
      method: "POST",
      body: { seenAt: getCurrentTimestamp() },
      parseJson: false,
    });
  }

  async listConvos({ cursor, limit = 30, readState } = {}) {
    const query = { limit };
    if (cursor) {
      query.cursor = cursor;
    }
    if (readState) {
      query.readState = readState;
    }
    const res = await this.request("chat.bsky.convo.listConvos", {
      query,
      headers: {
        "atproto-proxy": "did:web:api.bsky.chat#bsky_chat",
      },
    });
    return res.data;
  }

  async getConvo(convoId) {
    const res = await this.request("chat.bsky.convo.getConvo", {
      query: { convoId },
      headers: {
        "atproto-proxy": "did:web:api.bsky.chat#bsky_chat",
      },
    });
    return res.data;
  }

  async getMessages(convoId, { cursor, limit = 50 } = {}) {
    const query = { convoId, limit };
    if (cursor) {
      query.cursor = cursor;
    }
    const res = await this.request("chat.bsky.convo.getMessages", {
      query,
      headers: {
        "atproto-proxy": "did:web:api.bsky.chat#bsky_chat",
      },
    });
    return res.data;
  }

  async sendMessage(convoId, { text, facets }) {
    const res = await this.request("chat.bsky.convo.sendMessage", {
      method: "POST",
      body: {
        convoId,
        message: {
          text,
          facets,
        },
      },
      headers: {
        "atproto-proxy": "did:web:api.bsky.chat#bsky_chat",
      },
    });
    return res.data;
  }

  async acceptConvo(convoId) {
    const res = await this.request("chat.bsky.convo.acceptConvo", {
      method: "POST",
      body: {
        convoId,
      },
      headers: {
        "atproto-proxy": "did:web:api.bsky.chat#bsky_chat",
      },
    });
    return res.data;
  }

  async leaveConvo(convoId) {
    const res = await this.request("chat.bsky.convo.leaveConvo", {
      method: "POST",
      body: {
        convoId,
      },
      headers: {
        "atproto-proxy": "did:web:api.bsky.chat#bsky_chat",
      },
    });
    return res.data;
  }

  async getConvoAvailability(memberDids) {
    const res = await this.request("chat.bsky.convo.getConvoAvailability", {
      query: { members: memberDids },
      headers: {
        "atproto-proxy": "did:web:api.bsky.chat#bsky_chat",
      },
    });
    return res.data;
  }

  async getConvoForMembers(memberDids) {
    const res = await this.request("chat.bsky.convo.getConvoForMembers", {
      query: { members: memberDids },
      headers: {
        "atproto-proxy": "did:web:api.bsky.chat#bsky_chat",
      },
    });
    return res.data;
  }

  async getChatLogs({ cursor }) {
    const res = await this.request("chat.bsky.convo.getLog", {
      query: { cursor },
      headers: {
        "atproto-proxy": "did:web:api.bsky.chat#bsky_chat",
      },
    });
    return res.data;
  }

  async markConvoAsRead(convoId) {
    await this.request("chat.bsky.convo.updateRead", {
      method: "POST",
      body: {
        convoId,
      },
      headers: {
        "atproto-proxy": "did:web:api.bsky.chat#bsky_chat",
      },
    });
  }

  async addMessageReaction(convoId, messageId, emoji) {
    const res = await this.request("chat.bsky.convo.addReaction", {
      method: "POST",
      body: {
        convoId,
        messageId,
        value: emoji,
      },
      headers: {
        "atproto-proxy": "did:web:api.bsky.chat#bsky_chat",
      },
    });
    return res.data.message;
  }

  async removeMessageReaction(convoId, messageId, emoji) {
    const res = await this.request("chat.bsky.convo.removeReaction", {
      method: "POST",
      body: {
        convoId,
        messageId,
        value: emoji,
      },
      headers: {
        "atproto-proxy": "did:web:api.bsky.chat#bsky_chat",
      },
    });
    return res.data.message;
  }

  async getLikes(postUri, { limit = 50, cursor } = {}) {
    const query = { uri: postUri, limit };
    if (cursor) {
      query.cursor = cursor;
    }
    const res = await this.request("app.bsky.feed.getLikes", {
      query,
    });
    return res.data;
  }

  async getQuotes(postUri, { limit = 50, cursor } = {}) {
    const query = { uri: postUri, limit };
    if (cursor) {
      query.cursor = cursor;
    }
    const res = await this.request("app.bsky.feed.getQuotes", {
      query,
    });
    return res.data;
  }

  async getRepostedBy(postUri, { limit = 50, cursor } = {}) {
    const query = { uri: postUri, limit };
    if (cursor) {
      query.cursor = cursor;
    }
    const res = await this.request("app.bsky.feed.getRepostedBy", {
      query,
    });
    return res.data;
  }

  async getBookmarks({ limit = 31, cursor } = {}) {
    const query = { limit };
    if (cursor) {
      query.cursor = cursor;
    }
    const res = await this.request("app.bsky.bookmark.getBookmarks", {
      query,
    });
    return res.data;
  }

  async getFollowers(actor, { limit = 50, cursor } = {}) {
    const query = { actor, limit };
    if (cursor) {
      query.cursor = cursor;
    }
    const res = await this.request("app.bsky.graph.getFollowers", {
      query,
    });
    return res.data;
  }

  async getFollows(actor, { limit = 50, cursor } = {}) {
    const query = { actor, limit };
    if (cursor) {
      query.cursor = cursor;
    }
    const res = await this.request("app.bsky.graph.getFollows", {
      query,
    });
    return res.data;
  }

  async muteActor(did) {
    const res = await this.request("app.bsky.graph.muteActor", {
      method: "POST",
      body: {
        actor: did,
      },
      parseJson: false,
    });
    return res;
  }

  async unmuteActor(did) {
    const res = await this.request("app.bsky.graph.unmuteActor", {
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

  async createPost({ text, facets, embed, reply }) {
    const record = {
      text,
      facets,
      createdAt: getCurrentTimestamp(),
    };
    if (embed) {
      record.embed = embed;
    }
    if (reply) {
      record.reply = reply;
    }
    const res = await this.request("com.atproto.repo.createRecord", {
      method: "POST",
      body: {
        repo: this.session.did,
        collection: "app.bsky.feed.post",
        record,
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

  async uploadBlob(blob) {
    const res = await this.request("com.atproto.repo.uploadBlob", {
      method: "POST",
      headers: {
        "Content-Type": blob.type,
      },
      body: blob,
      stringifyBody: false,
    });
    return res.data.blob;
  }
}
