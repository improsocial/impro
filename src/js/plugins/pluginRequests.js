import { Api, ApiError } from "/js/api.js";

const ALLOWED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"];

const FORBIDDEN_HEADERS = ["cookie"];
const MAX_BODY_CHARS = 1_000_000;
export const MAX_RESPONSE_BYTES = 100_000_000;

// Read-only AppView query endpoints plugins may call through the user's
// session via the xrpcQuery host method. "public" queries return the same
// data an unauthenticated caller could fetch; "private" queries reveal
// viewer-scoped state and require the "privateData" action permission.
const PUBLIC_XRPC_QUERIES = new Set([
  "app.bsky.actor.getProfile",
  "app.bsky.actor.getProfiles",
  "app.bsky.actor.searchActors",
  "app.bsky.actor.searchActorsTypeahead",
  "app.bsky.feed.getActorFeeds",
  "app.bsky.feed.getAuthorFeed",
  "app.bsky.feed.getFeedGenerator",
  "app.bsky.feed.getFeedGenerators",
  "app.bsky.feed.getLikes",
  "app.bsky.feed.getListFeed",
  "app.bsky.feed.getPostThread",
  "app.bsky.feed.getPosts",
  "app.bsky.feed.getQuotes",
  "app.bsky.feed.getRepostedBy",
  "app.bsky.feed.searchPosts",
  "app.bsky.graph.getFollowers",
  "app.bsky.graph.getFollows",
  "app.bsky.graph.getKnownFollowers",
  "app.bsky.graph.getList",
  "app.bsky.graph.getLists",
  "app.bsky.graph.getRelationships",
  "app.bsky.graph.getStarterPack",
  "app.bsky.graph.getStarterPacks",
  "app.bsky.labeler.getServices",
]);

const PRIVATE_XRPC_QUERIES = new Set([
  "app.bsky.actor.getPreferences",
  "app.bsky.bookmark.getBookmarks",
  "app.bsky.feed.getActorLikes",
  "app.bsky.feed.getTimeline",
  "app.bsky.graph.getBlocks",
  "app.bsky.graph.getListBlocks",
  "app.bsky.graph.getListMutes",
  "app.bsky.graph.getMutes",
  "app.bsky.notification.getUnreadCount",
  "app.bsky.notification.listNotifications",
]);

export class PluginRequests {
  constructor({ dataLayer, session, permissionsManager, fetchImpl }) {
    this.dataLayer = dataLayer;
    this.session = session;
    this.permissionsManager = permissionsManager;
    this.fetchImpl = fetchImpl;
  }

  async pluginFetch(permissions, url, init) {
    if (!permissions.allowsFetch(url)) {
      throw new Error(`fetch to "${url}" not permitted`);
    }
    const fetchImpl = this.fetchImpl ?? fetch.bind(globalThis);
    const response = await fetchImpl(url, {
      ...sanitizeFetchInit(init),
      credentials: "omit",
      redirect: "error",
      mode: "cors",
      referrerPolicy: "no-referrer",
    });
    const bodyBuffer = await response.arrayBuffer();
    if (bodyBuffer.byteLength > MAX_RESPONSE_BYTES) {
      throw new Error(
        `fetch response too large (${bodyBuffer.byteLength} bytes, max ${MAX_RESPONSE_BYTES})`,
      );
    }
    return {
      status: response.status,
      ok: response.ok,
      headers: filterResponseHeaders(response.headers, ["content-type"]),
      body: bodyBuffer,
    };
  }

  async pluginXrpcRequest(plugin, nsid, params) {
    const access = getXrpcQueryAccess(nsid);
    if (!access) {
      throw new Error(`xrpcQuery: "${nsid}" is not an allowed query`);
    }
    if (access === "private") {
      if (!this.session) throw new Error("Not signed in");
      this.permissionsManager.requireActionPermission(plugin, "privateData");
    }
    const query = sanitizeXrpcParams(params);
    try {
      const res = await this.dataLayer.api.request(nsid, {
        query,
        headers: {
          "atproto-accept-labelers": Api.buildAcceptLabelersHeader(
            this._getLabelers(),
          ),
          "atproto-proxy": this.dataLayer.api.bskyAppViewServiceDid,
        },
      });
      return { ok: true, status: res.status, data: res.data };
    } catch (error) {
      if (error instanceof ApiError) {
        return { ok: false, status: error.status, data: error.data ?? null };
      }
      throw new Error(`xrpcQuery: request to "${nsid}" failed`);
    }
  }

  _getLabelers() {
    // Preferences may not be loaded yet (or the user is signed out) —
    // requests without the labelers header just hydrate fewer labels.
    try {
      return this.dataLayer.requests.requireLabelers();
    } catch {
      return [];
    }
  }
}

function sanitizeFetchInit(init) {
  const safeInit = {};
  const method = (init?.method ?? "GET").toUpperCase();
  if (!ALLOWED_METHODS.includes(method)) {
    throw new Error(`fetch method "${method}" not permitted`);
  }
  safeInit.method = method;
  const headers = {};
  for (const [name, value] of Object.entries(init?.headers ?? {})) {
    const lowerName = String(name).toLowerCase();
    if (FORBIDDEN_HEADERS.includes(lowerName)) {
      throw new Error(`fetch header "${name}" not permitted`);
    }
    headers[name] = String(value);
  }
  safeInit.headers = headers;
  if (init?.body != null) {
    if (typeof init.body !== "string") {
      throw new Error("fetch body must be a string");
    }
    if (init.body.length > MAX_BODY_CHARS) {
      throw new Error("fetch body too large");
    }
    safeInit.body = init.body;
  }
  return safeInit;
}

function getXrpcQueryAccess(nsid) {
  if (PUBLIC_XRPC_QUERIES.has(nsid)) return "public";
  if (PRIVATE_XRPC_QUERIES.has(nsid)) return "private";
  return null;
}

const MAX_XRPC_PARAMS = 20;
const MAX_XRPC_PARAM_CHARS = 2000;

function sanitizeXrpcParams(params) {
  if (params == null) return {};
  if (typeof params !== "object" || Array.isArray(params)) {
    throw new Error("xrpcQuery params must be an object");
  }
  const entries = Object.entries(params);
  if (entries.length > MAX_XRPC_PARAMS) {
    throw new Error("xrpcQuery: too many params");
  }
  const sanitized = {};
  for (const [name, value] of entries) {
    if (value == null) continue;
    const values = Array.isArray(value) ? value : [value];
    for (const entry of values) {
      const entryType = typeof entry;
      if (
        entryType !== "string" &&
        entryType !== "number" &&
        entryType !== "boolean"
      ) {
        throw new Error(`xrpcQuery: param "${name}" has an unsupported type`);
      }
      if (entryType === "string" && entry.length > MAX_XRPC_PARAM_CHARS) {
        throw new Error(`xrpcQuery: param "${name}" is too long`);
      }
    }
    sanitized[name] = value;
  }
  return sanitized;
}

function filterResponseHeaders(headers, allowedNames) {
  const picked = {};
  for (const name of allowedNames) {
    const value = headers.get(name);
    if (value != null) picked[name] = value;
  }
  return picked;
}
