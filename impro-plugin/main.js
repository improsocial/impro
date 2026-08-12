/**
 * @typedef {Record<string, unknown>} PostView
 *   Hydrated `app.bsky.feed.defs#postView` shape.
 * @typedef {Record<string, unknown>} ProfileView
 *   Basic `app.bsky.actor.defs#profileView` shape.
 * @typedef {Record<string, unknown>} DetailedProfileView
 *   Detailed profile view with viewer relationship fields.
 * @typedef {Record<string, unknown>} KnownFollowersResponse
 *   Paginated response from `getKnownFollowers`: `{ followers, cursor }`.
 * @typedef {Record<string, unknown>} RepoRecord
 *   A raw repo record: `{ uri, cid, value }`.
 * @typedef {{ did: string, collection: string, rkey: string }} BacklinkRecord
 *   A record that links to a queried subject.
 * @typedef {Record<string, unknown>} FeedItem
 *   A `app.bsky.feed.defs#feedViewPost` (post + reply/repost context).
 * @typedef {{ $type: string } & Record<string, unknown>} RichTextFacetFeature
 *   One feature of a facet; fields beyond `$type` vary by service.
 * @typedef {{ index: { byteStart: number, byteEnd: number }, features?: RichTextFacetFeature[] }} RichTextFacet
 *   An `app.bsky.richtext.facet` — a byte range plus the features applying to it.
 * @typedef {{ type: "text", value: string }} RichTextTextToken
 *   A run of plain text.
 * @typedef {{ type: "facet", facet: RichTextFacet, text: string }} RichTextFacetToken
 *   The text covered by one facet; the host restores the original facet payload.
 * @typedef {{ type: "inline" | "block", node: VirtualEl | Record<string, unknown>, pluginId?: string }} RichTextNodeToken
 *   Custom content the plugin renders itself — `block` on its own line, `inline` in the text flow.
 * @typedef {RichTextTextToken | RichTextFacetToken | RichTextNodeToken} RichTextToken
 *   One token in a rich-text stream — `text`, `facet`, `inline`, or `block`.
 * @typedef {Record<string, string> | Headers | Map<string, string> | Iterable<[string, string], void, undefined>} PluginFetchHeaders
 *   Any header collection {@link fetch} accepts — read structurally, not by class.
 * @typedef {{ method?: string, headers?: PluginFetchHeaders, body?: string }} PluginFetchInit
 *   Options for {@link fetch} — a subset of `RequestInit` the host proxy supports.
 * @typedef {{ feedGenerator: Record<string, unknown> | null, feedContext: string | null, feedProxyUrl: string | null }} PostContextMenuMeta
 *   Where a post was seen, passed to `post-context-menu` listeners.
 * @typedef {{ kind: "post" | "reply" | "quote", replyTo: PostView | null, replyRoot: PostView | null, quotedPost: PostView | null }} PostComposerContext
 *   What the composer is being opened for, passed to `post-composer-open` listeners.
 * @typedef {{
 *   "post-context-menu": (menu: Menu, post: PostView, meta?: PostContextMenuMeta) => void,
 *   "profile-context-menu": (menu: Menu, profile: ProfileView) => void,
 *   "post-composer-open": (composer: Composer, context: PostComposerContext) => void,
 * }} PluginEventMap
 *   The events {@link Plugin.on} accepts, and the listener each one takes.
 * @typedef {VirtualEl | null | undefined} RenderResult
 *   What a render callback may return: a tree to render, or nothing.
 */

export class SimpleUUID {
  #id = 0;
  create() {
    return this.#id++;
  }
}

const uuid = new SimpleUUID();

/**
 * Posts a message to the host. The only outbound channel, so every message
 * is checked against {@link WorkerMessage}.
 * @param {WorkerMessage} message
 * @returns {void}
 */
function post(message) {
  self.postMessage(message);
}

/** @type {Map<number, (...args: any[]) => unknown>} */
const callHandlers = new Map();

/** @type {Map<number, { resolve: (value: unknown) => void, reject: (reason: unknown) => void }>} */
const pendingHostCalls = new Map();

/**
 * @param {string} method
 * @param {...Cloneable} args
 * @returns {Promise<unknown>}
 */
function hostCall(method, ...args) {
  const hostCallId = uuid.create();
  return new Promise((resolve, reject) => {
    pendingHostCalls.set(hostCallId, { resolve, reject });
    post({ type: "hostCall", method, hostCallId, args });
  });
}

/** @type {Map<string, Set<(...args: any[]) => unknown>>} */
const eventListeners = new Map();
const registeredEvents = new Set();

/**
 * @param {Iterable<(...args: any[]) => unknown>} listeners
 * @param {string} event
 * @param {unknown[]} args
 * @returns {Promise<void>}
 */
async function invokeListeners(listeners, event, args) {
  for (const listener of listeners) {
    try {
      await listener(...args);
    } catch (error) {
      console.error(`"${event}" listener threw:`, error);
    }
  }
}

/**
 * @param {string} event
 * @param {unknown[]} args
 * @returns {Promise<unknown>}
 */
async function dispatchEvent(event, args) {
  const listeners = eventListeners.get(event) ?? new Set();
  switch (event) {
    case "post-context-menu":
    case "profile-context-menu": {
      const menu = new Menu();
      await invokeListeners(listeners, event, [menu, ...args]);
      return menu._serialize();
    }
    case "post-composer-open": {
      const composer = new Composer();
      await invokeListeners(listeners, event, [composer, ...args]);
      return composer._serialize();
    }
    default:
      console.warn(`No dispatch case for plugin event "${event}".`);
      return null;
  }
}

/**
 * @param {string} event
 * @param {(...args: any[]) => unknown} listener
 * @returns {void}
 */
function addEventListener(event, listener) {
  let listeners = eventListeners.get(event);
  if (!listeners) {
    listeners = new Set();
    eventListeners.set(event, listeners);
  }
  listeners.add(listener);
  // Register handler
  if (!registeredEvents.has(event)) {
    registeredEvents.add(event);
    const handlerId = uuid.create();
    callHandlers.set(handlerId, (...args) => dispatchEvent(event, args));
    post({
      type: "register",
      target: "eventListener",
      event,
      handlerId,
    });
  }
}

/**
 * A single item in a {@link Menu}. Configure with the chained setters and
 * an `onClick` handler. Not constructed directly — obtained via
 * `Menu.addItem(builder)`.
 */
export class MenuItem {
  constructor() {
    this.title = "";
    this.icon = null;
    /** @internal */
    this._callback = () => {};
  }
  /**
   * Set the menu item's label.
   * @param {string} title
   * @returns {this}
   */
  setTitle(title) {
    this.title = title;
    return this;
  }
  /**
   * Set the leading icon. Either a named icon (string) or a {@link VirtualEl}
   * to render as the icon.
   * @param {string | VirtualEl} icon
   * @returns {this}
   */
  setIcon(icon) {
    this.icon = icon;
    return this;
  }
  /**
   * Called when the user activates the item.
   * @param {() => void} callback
   * @returns {this}
   */
  onClick(callback) {
    this._callback = callback;
    return this;
  }
}

/**
 * A context-menu builder passed as the first argument to
 * `post-context-menu` and `profile-context-menu` event listeners. Call
 * `addItem` to append menu entries.
 */
export class Menu {
  constructor() {
    /** @type {MenuItem[]} */
    this.items = [];
  }
  /**
   * Append a menu item. The builder receives a {@link MenuItem} to configure.
   * @param {(item: MenuItem) => void} builder
   * @returns {this}
   */
  addItem(builder) {
    const item = new MenuItem();
    builder(item);
    this.items.push(item);
    return this;
  }
  /** @internal */
  _serialize() {
    return this.items.map((item) => {
      const handlerId = uuid.create();
      callHandlers.set(handlerId, item._callback);
      const icon =
        item.icon instanceof VirtualEl ? item.icon._serialize() : item.icon;
      return { title: item.title, icon, handlerId };
    });
  }
}

/**
 * Builder passed as the first argument to `post-composer-open` event
 * listeners. Queues text operations that the host applies to the composer once
 * all listeners have run. operations from multiple plugins are applied in order.
 */
export class Composer {
  /** @type {{ op: string, text: string }[]} */
  #ops = [];
  /** @type {number | null} */
  #cursor = null;
  /**
   * Replace the composer's current text.
   * @param {string} text
   * @returns {this}
   */
  setText(text) {
    this.#ops.push({ op: "set", text: String(text) });
    return this;
  }
  /**
   * Append text to the end of the composer.
   * @param {string} text
   * @returns {this}
   */
  appendText(text) {
    this.#ops.push({ op: "append", text: String(text) });
    return this;
  }
  /**
   * Prepend text to the start of the composer.
   * @param {string} text
   * @returns {this}
   */
  prependText(text) {
    this.#ops.push({ op: "prepend", text: String(text) });
    return this;
  }
  /**
   * Move the caret to the given character index in the final text.
   * @param {number} index
   * @returns {this}
   */
  setCursor(index) {
    this.#cursor = index;
    return this;
  }
  /** @internal */
  _serialize() {
    return { ops: this.#ops, cursor: this.#cursor };
  }
}

/**
 * Read-only accessors for appview data with the current user as the viewer.
 * Reached via {@link App.data} on the plugin's {@link App} instance.
 */
export class PluginData {
  /**
   * Fetch a hydrated post view by AT-URI, as seen by the current user.
   * @param {string} uri
   * @returns {Promise<PostView>}
   */
  getPost(uri) {
    return /** @type {Promise<PostView>} */ (hostCall("getPost", { uri }));
  }
  /**
   * Fetch the basic profile view for a DID.
   * @param {string} did
   * @returns {Promise<ProfileView>}
   */
  getProfile(did) {
    return /** @type {Promise<ProfileView>} */ (
      hostCall("getProfile", { did })
    );
  }
  /**
   * Like {@link PluginData.getProfile}, but includes viewer relationship
   * details not present on the basic profile view: `viewer.following`,
   * `viewer.followedBy`, and `viewer.knownFollowers` (a summary of mutual
   * followers).
   * @param {string} did
   * @returns {Promise<DetailedProfileView>}
   */
  getDetailedProfile(did) {
    return /** @type {Promise<DetailedProfileView>} */ (
      hostCall("getDetailedProfile", { did })
    );
  }
  /**
   * The full known-followers list for `did`. The summary on
   * {@link PluginData.getDetailedProfile}'s `viewer.knownFollowers` is
   * capped to a handful; use this to paginate the complete list.
   * @param {string} did
   * @returns {Promise<KnownFollowersResponse>}
   */
  getKnownFollowers(did) {
    return /** @type {Promise<KnownFollowersResponse>} */ (
      hostCall("getKnownFollowers", { did })
    );
  }
  /**
   * Fetch a raw repo record by `(repo, collection, rkey)`.
   * @param {string} repo
   * @param {string} collection
   * @param {string} rkey
   * @returns {Promise<RepoRecord>}
   */
  getRecord(repo, collection, rkey) {
    return /** @type {Promise<RepoRecord>} */ (
      hostCall("getRecord", { repo, collection, rkey })
    );
  }
  /**
   * Get records that link to `subject`, from a backlink
   * index of public records.
   *
   * `subject` is an AT-URI or a DID; `source` names the linking field as
   * `<collection>:<dot.path.to.field>` (e.g.
   * `"app.bsky.graph.listitem:list"`). The host paginates for you, up to
   * `limit` records (max 1000 per call — page by making further calls
   * with a narrower subject).
   *
   * @param {{ subject: string, source: string, limit?: number }} params
   * @returns {Promise<BacklinkRecord[]>}
   */
  getBacklinks({ subject, source, limit = 100 }) {
    return /** @type {Promise<BacklinkRecord[]>} */ (
      hostCall("getBacklinks", { subject, source, limit })
    );
  }
}

/**
 * The plugin's handle to the running impro app. Exposed as `this.app` on a
 * {@link Plugin} instance. Owns event subscriptions, data accessors
 * ({@link App.data}), and user-scoped actions.
 */
export class App {
  /** @internal */
  constructor() {
    /**
     * The signed-in user's basic profile, populated before `onload()` runs.
     * Null when no session is active.
     * @type {ProfileView | null}
     */
    this.currentUser = null;
    /** Read-only appview accessors — see {@link PluginData}. */
    this.data = new PluginData();
    /** A user-approved network address — see {@link CustomEndpoint}. */
    this.customEndpoint = new CustomEndpoint();
  }
  /**
   * Register an event listener. Supported events:
   *
   * - `"post-context-menu"` — `(menu: Menu, post) => void`, called when the
   *   user opens a post's context menu.
   * - `"profile-context-menu"` — `(menu: Menu, profile) => void`, called
   *   when the user opens a profile's context menu.
   * - `"post-composer-open"` — `(composer: Composer, context: { kind, replyTo, replyRoot, quotedPost }) => void`,
   *   called when the post composer opens; use `composer` to seed text.
   *
   * The `listener` signature varies per event — see {@link PluginEventMap}.
   * @template {keyof PluginEventMap} K
   * @param {K} event
   * @param {PluginEventMap[K]} listener
   * @returns {void}
   */
  on(event, listener) {
    addEventListener(event, listener);
  }

  /**
   * Re-run registered feed filters. Pass a `feedURI` to limit the refresh
   * to one feed, or omit/pass `null` to refresh every feed.
   * @param {string | null} [feedURI]
   * @returns {Promise<void>}
   */
  refreshFeedFilters(feedURI = null) {
    return /** @type {Promise<void>} */ (
      hostCall("refreshFeedFilters", feedURI)
    );
  }

  /**
   * Mute an actor on behalf of the signed-in user. Requires the `"mute"`
   * scope in the plugin manifest's `permissions.actions`.
   * @param {string} did
   * @returns {Promise<void>}
   */
  muteActor(did) {
    return /** @type {Promise<void>} */ (
      hostCall("muteActor", { did, mute: true })
    );
  }
  /**
   * Unmute an actor. Requires the `"mute"` scope.
   * @param {string} did
   * @returns {Promise<void>}
   */
  unmuteActor(did) {
    return /** @type {Promise<void>} */ (
      hostCall("muteActor", { did, mute: false })
    );
  }
  /**
   * Block an actor on behalf of the signed-in user. Requires the `"block"`
   * scope in the plugin manifest's `permissions.actions`.
   * @param {string} did
   * @returns {Promise<void>}
   */
  blockActor(did) {
    return /** @type {Promise<void>} */ (
      hostCall("blockActor", { did, block: true })
    );
  }
  /**
   * Unblock an actor. Requires the `"block"` scope.
   * @param {string} did
   * @returns {Promise<void>}
   */
  unblockActor(did) {
    return /** @type {Promise<void>} */ (
      hostCall("blockActor", { did, block: false })
    );
  }
  /**
   * Acts like the user clicking "Show less like this": sends the
   * `requestLess` feedback signal to `feedUri` and collapses the post
   * behind a feedback message in feeds. Requires the `"feedFeedback"`
   * scope.
   * @param {string} postUri
   * @param {string} feedUri
   * @returns {Promise<void>}
   */
  showLessLikeThis(postUri, feedUri) {
    return /** @type {Promise<void>} */ (
      hostCall("showLessLikeThis", { postUri, feedUri })
    );
  }
  /**
   * Sends the `requestMore` feedback signal to `feedUri` for `postUri`.
   * Requires the `"feedFeedback"` scope.
   * @param {string} postUri
   * @param {string} feedUri
   * @returns {Promise<void>}
   */
  showMoreLikeThis(postUri, feedUri) {
    return /** @type {Promise<void>} */ (
      hostCall("showMoreLikeThis", { postUri, feedUri })
    );
  }
}

/**
 * Proxied fetch through the host. Requires the `"networkRequest"` permission
 * scope and the target URL must be covered by the plugin's manifest allowlist.
 * `init` accepts `method`, `headers` (plain object, `Headers`, `Map`, or
 * `[name, value]` iterable), and a string `body`. Resolves to a
 * {@link PluginResponse}.
 * @param {string} url
 * @param {PluginFetchInit} [init]
 * @returns {Promise<PluginResponse>}
 */
export async function fetch(url, init = {}) {
  const result = /** @type {SerializedFetchResponse} */ (
    await hostCall("fetch", { url, init: serializeFetchInit(init) })
  );
  return new PluginResponse(result);
}

/**
 * @param {unknown} value
 * @returns {value is { forEach: (callback: (value: string, name: string) => void) => void }}
 */
function hasForEach(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    "forEach" in value &&
    typeof value.forEach === "function"
  );
}

/**
 * @param {unknown} value
 * @returns {value is Iterable<[string, string]>}
 */
function isEntryIterable(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    Symbol.iterator in value &&
    typeof value[Symbol.iterator] === "function"
  );
}

/**
 * @param {PluginFetchInit} init
 * @returns {SerializedFetchInit}
 */
function serializeFetchInit(init) {
  /** @type {SerializedFetchInit} */
  const serialized = {};
  if (init.method != null) serialized.method = String(init.method);
  if (init.headers != null) {
    /** @type {Record<string, string>} */
    const headers = {};
    // Probed structurally rather than by class, so any forEach-able or
    // iterable header collection works. Iteration is tried first because
    // Headers, Map, arrays and iterators all yield [name, value] pairs,
    // whereas forEach passes (value, index) on an array or iterator.
    const headersInit = init.headers;
    if (isEntryIterable(headersInit)) {
      for (const [name, value] of headersInit) headers[name] = value;
    } else if (hasForEach(headersInit)) {
      headersInit.forEach((value, name) => {
        headers[name] = value;
      });
    } else {
      Object.assign(headers, headersInit);
    }
    serialized.headers = headers;
  }
  if (init.body != null) serialized.body = init.body;
  return serialized;
}

/**
 * Response returned from {@link fetch}. The host buffers the raw response
 * bytes and sends them as an `ArrayBuffer`, and this class decodes them on
 * demand depending on which accessor is called. `status`, `ok`, and `headers`
 * (a `Map`) mirror the underlying HTTP response.
 */
export class PluginResponse {
  /** @type {ArrayBuffer} raw response bytes */
  #body;
  /**
   * @internal
   * @param {SerializedFetchResponse} response
   */
  constructor({ status, ok, headers, body }) {
    /** @type {number} */
    this.status = status;
    /** @type {boolean} */
    this.ok = ok;
    /** @type {Map<string, string>} */
    this.headers = new Map(Object.entries(headers ?? {}));
    this.#body = body;
  }
  /**
   * Resolves with the raw response bytes.
   * @returns {Promise<ArrayBuffer>}
   */
  async arrayBuffer() {
    return this.#body;
  }
  /**
   * Resolves with the response body decoded as UTF-8 text.
   * @returns {Promise<string>}
   */
  async text() {
    return new TextDecoder().decode(await this.arrayBuffer());
  }
  /**
   * Resolves with the response body parsed as JSON.
   * @returns {Promise<unknown>}
   */
  async json() {
    return JSON.parse(await this.text());
  }
}

/**
 * Lets a plugin talk to one network address a human has personally typed
 * into its settings and approved — not a manifest-declared allowlist like
 * {@link fetch}, and not "any address": {@link CustomEndpoint.requestUrl}
 * always re-prompts the user with the exact address before it takes effect,
 * and {@link CustomEndpoint.fetch} only ever succeeds against that one
 * approved address. Unlike the manifest-gated {@link fetch}, non-`https:`
 * addresses (e.g. a local Ollama server on `http://localhost:11434`) and an
 * `Authorization` header are both allowed — it's the plugin's own
 * credential for an address the user explicitly approved, not an ambient
 * one being smuggled to an unreviewed third-party host. Requires the
 * `"customEndpoint"` scope in the manifest's `permissions.network`.
 */
export class CustomEndpoint {
  /**
   * The currently-approved URL, or null if none has been approved yet (or
   * it was cleared, e.g. by uninstalling and reinstalling the plugin).
   * @returns {Promise<string | null>}
   */
  getUrl() {
    return /** @type {Promise<string | null>} */ (
      hostCall("getCustomEndpointUrl")
    );
  }
  /**
   * Prompts the user to approve `url` as this plugin's one allowed network
   * address.
   * @param {string} url
   * @returns {Promise<{ accepted: boolean, url: string | null }>} `url` is
   *   the *current* approved address (unchanged from before if declined);
   *   `accepted` reflects whether this particular request was granted.
   */
  requestUrl(url) {
    return /** @type {Promise<{ accepted: boolean, url: string | null }>} */ (
      hostCall("requestCustomEndpointUrl", { url: String(url) })
    );
  }
  /**
   * Fetches `url`, which must exactly match the currently-approved address
   * (see {@link CustomEndpoint.requestUrl}) or this rejects.
   * @param {string} url
   * @param {PluginFetchInit} [init]
   * @returns {Promise<PluginResponse>}
   */
  async fetch(url, init = {}) {
    const result = /** @type {SerializedFetchResponse} */ (
      await hostCall("customEndpointFetch", {
        url,
        init: serializeFetchInit(init),
      })
    );
    return new PluginResponse(result);
  }
}

/**
 * Shows a toast notification. `noticeEl` is a {@link VirtualEl} that can be
 * mutated (e.g. `addClass`, appending children) synchronously after
 * construction — the host serializes and renders the toast on a microtask, so
 * any mutations made in the same task apply to the initial render. Mutations
 * or `setMessage` calls made after that point do NOT propagate to the mounted
 * toast; call {@link Notice.hide} and create a new `Notice` to change it.
 */
export class Notice {
  #toastId = uuid.create();
  #timeout;
  #hidden = false;
  /**
   * `timeout` is in milliseconds; `0` (the default) keeps the toast up until
   * {@link Notice.hide} is called.
   * @param {string} message
   * @param {number} [timeout=0]
   */
  constructor(message, timeout = 0) {
    this.#timeout = timeout;
    /** @type {VirtualEl} */
    this.noticeEl = new VirtualEl("div");
    this.noticeEl.addClass("toast");
    this.noticeEl.setText(message);
    queueMicrotask(() => {
      if (this.#hidden) return;
      hostCall("showToast", {
        toastId: this.#toastId,
        element: this.noticeEl._serialize(),
        timeout: this.#timeout,
      });
    });
  }
  /**
   * Updates `noticeEl`'s text. Only takes effect if called synchronously
   * before the microtask that snapshots the toast for the initial render.
   * @param {string} message
   * @returns {this}
   */
  setMessage(message) {
    this.noticeEl.setText(message);
    return this;
  }
  /**
   * Dismisses the toast. No-op if already hidden.
   * @returns {void}
   */
  hide() {
    if (this.#hidden) return;
    this.#hidden = true;
    hostCall("hideToast", { toastId: this.#toastId });
  }
}

/**
 * Injects a CSS block scoped to the plugin. The stylesheet is mounted by the
 * host on the next microtask; snippets are automatically removed when the
 * plugin unloads.
 */
export class StyleSnippet {
  #snippetId = uuid.create();
  #removed = false;
  /**
   * @param {string} cssText
   */
  constructor(cssText) {
    /**
     * Resolves once the snippet has been applied by the host.
     * @type {Promise<void>}
     */
    this.ready = new Promise((resolve, reject) => {
      queueMicrotask(() => {
        if (this.#removed) return resolve();
        hostCall("applyStyleSnippet", {
          snippetId: this.#snippetId,
          cssText,
        }).then(() => resolve(), reject);
      });
    });
  }
  /**
   * Removes the snippet from the document. No-op if already removed.
   * @returns {void}
   */
  remove() {
    if (this.#removed) return;
    this.#removed = true;
    hostCall("removeStyleSnippet", { snippetId: this.#snippetId });
  }
}

let registered = false;

/**
 * Base class for impro plugins. Subclass this and override {@link Plugin.onload}
 * (and optionally {@link Plugin.onunload}) to wire up your plugin's extension
 * points. `this.app` is the shared {@link App} instance for host actions and
 * data. Call `MyPlugin.register()` at the top of your plugin's main.js to boot.
 */
export class Plugin {
  /** @internal */
  constructor() {
    /** @type {App} */
    this.app = new App();
  }

  /**
   * Adds an item to the impro sidebar. `icon` is a {@link VirtualEl} (typically
   * an SVG) or a string; `callback` runs when the item is clicked.
   * @param {string | VirtualEl} icon
   * @param {string} title
   * @param {() => void} [callback]
   * @returns {void}
   */
  addSidebarItem(icon, title, callback = () => {}) {
    const handlerId = uuid.create();
    callHandlers.set(handlerId, callback);
    post({
      type: "register",
      target: "sidebarItem",
      icon: icon instanceof VirtualEl ? icon._serialize() : icon,
      title,
      handlerId,
    });
  }

  /**
   * Loads this plugin's account-synced JSON blob. Follows the user across
   * devices via account preferences. Returns whatever was last saved, or null.
   * @returns {Promise<unknown>}
   */
  async loadData() {
    return hostCall("loadData");
  }

  /**
   * Persists `data` as this plugin's account-synced JSON blob.
   * @param {Cloneable} data
   * @returns {Promise<void>}
   */
  async saveData(data) {
    await hostCall("saveData", { data });
  }

  /**
   * Device-local counterpart to {@link Plugin.loadData}: never synced through
   * the user's account preferences, so it's the right place for anything that
   * shouldn't silently follow the plugin to another device (e.g. a locally
   * held secret key). Cleared on uninstall, same as loadData/saveData.
   * @returns {Promise<unknown>}
   */
  async loadLocalData() {
    return hostCall("loadLocalData");
  }

  /**
   * Device-local counterpart to {@link Plugin.saveData}.
   * @param {Cloneable} data
   * @returns {Promise<void>}
   */
  async saveLocalData(data) {
    await hostCall("saveLocalData", { data });
  }

  /**
   * Registers a {@link PluginSettingTab} shown under this plugin's entry in
   * the app's settings.
   * @param {PluginSettingTab} tab
   * @returns {void}
   */
  addSettingTab(tab) {
    tab.plugin = this;
    const displayHandlerId = uuid.create();
    callHandlers.set(displayHandlerId, () => {
      tab.containerEl = new VirtualEl("div");
      tab.display();
      return tab.containerEl._serialize();
    });
    post({
      type: "register",
      target: "settingTab",
      name: tab.name ?? null,
      displayHandlerId,
    });
  }

  /**
   * Registers a feed filter. `callback(feedUri, feedItems)` returns an object
   * `{ [postUri]: false }` for posts to hide from the feed. Only `false` hides;
   * any other value is ignored, so one plugin can't un-hide what another hid.
   * @param {(feedUri: string, feedItems: FeedItem[]) => Record<string, boolean> | Promise<Record<string, boolean>>} callback
   * @returns {void}
   */
  addFeedFilter(callback = () => ({})) {
    const handlerId = uuid.create();
    callHandlers.set(handlerId, callback);
    post({
      type: "register",
      target: "feedFilter",
      handlerId,
    });
  }

  /**
   * Registers a rich-text transform. `callback(tokens, context)` receives the
   * token stream for one post and returns a new token array (or the input
   * unchanged). Tokens are one of: `text` (plain string run), `facet` (linked
   * text with an atproto facet feature), `inline` (a plugin-produced inline
   * {@link VirtualEl}), or `block` (a plugin-produced block VirtualEl). See
   * {@link FlattenedTokens} for pattern-matching across token boundaries.
   *
   * A node token's `node` is a {@link VirtualEl} when this transform creates it,
   * but arrives in serialized form when an earlier transform produced it.
   *
   * `options.handlesFacetTypes` is an array of facet feature `$type` strings
   * this transform owns, so the host can suppress fallback rendering flash
   * while the transform runs.
   * @param {(tokens: RichTextToken[], context: { uri: string, surface: string, source: { text: string } }) => RichTextToken[] | Promise<RichTextToken[]>} callback
   * @param {{ handlesFacetTypes?: string[] }} [options]
   * @returns {void}
   */
  registerRichTextTransform(callback = (tokens) => tokens, options = {}) {
    const handlerId = uuid.create();
    callHandlers.set(handlerId, async (batch) => {
      const results = [];
      for (const { tokens, context } of batch) {
        try {
          const value = await callback(tokens, context);
          results.push({ value: serializeTransformTokens(value) });
        } catch (error) {
          results.push({ error: getErrorMessage(error) });
        }
      }
      return results;
    });
    const handlesFacetTypes = Array.isArray(options.handlesFacetTypes)
      ? options.handlesFacetTypes.filter((type) => typeof type === "string")
      : [];
    post({
      type: "register",
      target: "richTextTransform",
      handlerId,
      handlesFacetTypes,
    });
  }

  /**
   * Registers a slot renderer. `<plugin-slot name="...">` elements in the host
   * UI (or other plugins' output) invoke `callback(context)`, where `context`
   * is a flat string map of the slot element's attributes. The callback should
   * return a {@link VirtualEl} or `null`.
   *
   * `options.cacheKey` is an array of context field names. If provided, the
   * host treats the slot content as a pure function of these fields — omitting
   * other fields from the callback's context and caching return values until
   * invalidated by {@link Plugin.refreshSlot}. An empty array declares that
   * the content depends on no context at all, so one cached result serves
   * every instance.
   *
   * The host batches all pending contexts of a render into one call.
   * @param {string} name
   * @param {(context: Record<string, string>) => RenderResult | Promise<RenderResult>} callback
   * @param {{ cacheKey?: string[] }} [options]
   * @returns {void}
   */
  registerSlot(name, callback = () => null, options = {}) {
    const handlerId = uuid.create();
    callHandlers.set(handlerId, async (batch) => {
      const results = [];
      for (const context of batch) {
        try {
          results.push({
            value: await getSlotContent(name, callback, context),
          });
        } catch (error) {
          results.push({ error: getErrorMessage(error) });
        }
      }
      return results;
    });
    const cacheKey = Array.isArray(options.cacheKey)
      ? options.cacheKey.filter((field) => typeof field === "string")
      : null;
    post({
      type: "register",
      target: "slot",
      name,
      handlerId,
      cacheKey,
      batch: true,
    });
  }

  /**
   * Registers a full-page view reachable via {@link Plugin.openPage}. `display()`
   * is called on navigation and must return a {@link VirtualEl}, or nothing to
   * render an empty page.
   * @param {{ id: string, title?: string | null, display?: () => RenderResult | Promise<RenderResult> }} options
   * @returns {void}
   */
  registerPage({ id, title = null, display = () => null }) {
    const displayHandlerId = uuid.create();
    callHandlers.set(displayHandlerId, async () => {
      const result = /** @type {unknown} */ (await display());
      if (result == null) return null;
      if (!(result instanceof VirtualEl)) {
        throw new Error(
          `Page "${id}" must return a VirtualEl or null, got ${describeValue(result)}`,
        );
      }
      return result._serialize();
    });
    post({
      type: "register",
      target: "page",
      id,
      title,
      displayHandlerId,
    });
  }

  /**
   * Navigates the user to one of this plugin's registered pages.
   * @param {string} pageId
   * @returns {Promise<void>}
   */
  openPage(pageId) {
    return /** @type {Promise<void>} */ (hostCall("openPage", { pageId }));
  }

  /**
   * Re-invokes a registered page's display callback if the page is open.
   * `options.reset` also discards the rendered tree instead of patching it.
   * @param {string} pageId
   * @param {{ reset?: boolean }} [options]
   * @returns {Promise<void>}
   */
  refreshPage(pageId, { reset = false } = {}) {
    return /** @type {Promise<void>} */ (
      hostCall("refreshPage", { pageId, reset })
    );
  }

  /**
   * Makes mounted `<plugin-slot name=...>` instances re-invoke this plugin's
   * registered callback for that slot, and drops any cached results. Useful
   * when a slot's content depends on plugin state that changed after render.
   *
   * `options.keys` is an array of matcher objects OR'd together,
   * e.g. `[{ did: "..." }]` — any matching slots are invalidated and refreshed.
   * Omit to refresh every instance. A slot registered with a `cacheKey` can
   * only be matched on those declared fields, since its output depends on
   * nothing else.
   * @param {string} name
   * @param {{ keys?: Record<string, string>[] }} [options]
   * @returns {Promise<void>}
   */
  refreshSlot(name, options = {}) {
    return /** @type {Promise<void>} */ (
      hostCall("refreshSlot", { name, keys: options.keys ?? null })
    );
  }

  /**
   * Override in your subclass. Runs after the plugin is loaded and the current user is resolved.
   * @returns {void | Promise<void>}
   */
  onload() {}
  /**
   * Override in your subclass. Runs when the plugin is being torn down (uninstall/reload).
   * @returns {void | Promise<void>}
   */
  onunload() {}

  /**
   * Boots the plugin. Call as `MyPlugin.register()` at the top of your plugin's
   * main.js — instantiates the subclass, resolves the current user onto
   * `app.currentUser`, then invokes {@link Plugin.onload}. Idempotent.
   * @returns {void}
   */
  static register() {
    if (registered) return;
    registered = true;
    const instance = new this();
    /** @type {Promise<ProfileView | null>} */ (hostCall("getCurrentUser"))
      .then((user) => {
        instance.app.currentUser = user;
        return instance.onload();
      })
      .then(
        () => post({ type: "ready" }),
        (error) =>
          post({
            type: "ready",
            error: getErrorMessage(error),
          }),
      );
  }
}

/**
 * Extracts a message from a caught value, which need not be an Error.
 * @param {unknown} error
 * @returns {string}
 */
function getErrorMessage(error) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String(error.message);
  }
  return String(error);
}

/**
 * Names the type of an arbitrary value, for use in an error message.
 * @param {unknown} value
 * @returns {string}
 */
function describeValue(value) {
  if (value === null) return "null";
  if (typeof value !== "object") return typeof value;
  return value.constructor?.name ?? "object";
}

/**
 * @param {string} name
 * @param {(context: Record<string, string>) => RenderResult | Promise<RenderResult>} callback
 * @param {Record<string, string>} context
 * @returns {Promise<SerializedElement | null>}
 */
async function getSlotContent(name, callback, context) {
  const result = /** @type {unknown} */ (await callback(context));
  if (result == null) return null;
  if (!(result instanceof VirtualEl)) {
    throw new Error(
      `Slot "${name}" must return a VirtualEl or null, got ${describeValue(result)}`,
    );
  }
  return result._serialize();
}

/**
 * @param {RichTextToken[]} tokens
 * @returns {SerializedRichTextToken[]}
 */
function serializeTransformTokens(tokens) {
  if (!Array.isArray(tokens)) return tokens;
  return tokens.map((token) => {
    if (
      (token?.type === "inline" || token?.type === "block") &&
      token.node instanceof VirtualEl
    ) {
      return { ...token, node: token.node._serialize() };
    }
    return token;
  });
}

/**
 * Flattens a rich-text token stream into a plain string with a position map,
 * so a {@link Plugin.registerRichTextTransform | rich-text transform} can
 * pattern-match (e.g. with a regex) across token boundaries and map matches
 * back to the original tokens.
 */
export class FlattenedTokens {
  /** @type {{ token: RichTextToken, start: number, end: number }[]} */
  #segments = [];
  /**
   * @param {RichTextToken[]} tokens
   */
  constructor(tokens) {
    let text = "";
    for (const token of tokens) {
      let value = null;
      if (token.type === "text") value = token.value;
      else if (token.type === "facet") value = token.text;
      const start = text.length;
      if (value != null) text += value;
      this.#segments.push({ token, start, end: text.length });
    }
    /** @type {string} */
    this.text = text;
  }

  /**
   * Return the plain-text slice for `[start, end)` — inert, with no facets.
   * @param {number} start
   * @param {number} end
   * @returns {string}
   */
  textFor(start, end) {
    return this.text.slice(start, end);
  }

  /**
   * Return the tokens covering `[start, end)`. Facet tokens partially
   * overlapping the range are demoted to plain text tokens so the emitted
   * slice never carries a truncated facet.
   * @param {number} start
   * @param {number} end
   * @returns {RichTextToken[]}
   */
  tokensFor(start, end) {
    /** @type {RichTextToken[]} */
    const out = [];
    for (const segment of this.#segments) {
      if (segment.start === segment.end) {
        if (segment.start >= start && segment.start < end) {
          out.push(segment.token);
        }
        continue;
      }
      if (segment.end <= start || segment.start >= end) continue;
      const from = Math.max(start, segment.start);
      const to = Math.min(end, segment.end);
      const isWholeToken = from === segment.start && to === segment.end;
      if (isWholeToken) {
        out.push(segment.token);
      } else {
        out.push({ type: "text", value: this.text.slice(from, to) });
      }
    }
    return out;
  }
}

/**
 * Convenience wrapper that returns a new {@link FlattenedTokens} for `tokens`.
 * @param {RichTextToken[]} tokens
 * @returns {FlattenedTokens}
 */
export function flattenForScan(tokens) {
  return new FlattenedTokens(tokens);
}

/** @type {Map<number, Modal>} */
const openModals = new Map();

/**
 * A dismissable modal dialog. Subclass and populate `contentEl` and
 * `titleEl` (both {@link VirtualEl}), typically inside {@link Modal.onOpen}.
 * Call `open()` to show and `close()` to hide.
 */
export class Modal {
  #modalId = uuid.create();
  constructor() {
    /** @type {VirtualEl} */
    this.contentEl = new VirtualEl("div");
    /** @type {VirtualEl} */
    this.titleEl = new VirtualEl("h2");
  }

  /**
   * Show the modal. Runs {@link Modal.onOpen} first, then mounts the current el state.
   * @returns {void}
   */
  open() {
    if (openModals.has(this.#modalId)) return;
    openModals.set(this.#modalId, this);
    this.onOpen();
    post({
      type: "hostCall",
      method: "openModal",
      args: [
        {
          modalId: this.#modalId,
          title: this.titleEl._serialize(),
          content: this.contentEl._serialize(),
        },
      ],
    });
  }

  /**
   * Re-render the open modal from the current `titleEl` / `contentEl` state. No-op if closed.
   * @returns {void}
   */
  update() {
    if (!openModals.has(this.#modalId)) return;
    post({
      type: "hostCall",
      method: "updateModal",
      args: [
        {
          modalId: this.#modalId,
          title: this.titleEl._serialize(),
          content: this.contentEl._serialize(),
        },
      ],
    });
  }

  /**
   * Hide the modal and fire {@link Modal.onClose}.
   * @returns {void}
   */
  close() {
    if (!openModals.has(this.#modalId)) return;
    openModals.delete(this.#modalId);
    post({
      type: "hostCall",
      method: "closeModal",
      args: [{ modalId: this.#modalId }],
    });
    this.onClose();
  }

  /**
   * Lifecycle hook — override to populate `titleEl` / `contentEl` before the modal mounts.
   * @returns {void}
   */
  onOpen() {}
  /**
   * Lifecycle hook — override to react to the modal being dismissed (by `close()` or the user).
   * @returns {void}
   */
  onClose() {}
}

/**
 * A tab in the plugin's settings UI. Subclass and override {@link PluginSettingTab.display}
 * to render into `this.containerEl`. Pass the owning plugin to `super(plugin)`
 * and register with `plugin.addSettingTab(tab)`.
 */
export class PluginSettingTab {
  /**
   * @param {Plugin} plugin The owning plugin, available as `this.plugin`.
   */
  constructor(plugin) {
    /** @type {Plugin} */
    this.plugin = plugin;
    /** @type {VirtualEl} */
    this.containerEl = new VirtualEl("div");
    /** @type {string | null} */
    this.name = null;
  }
  /**
   * Set the tab's label.
   * @param {string} name
   * @returns {this}
   */
  setName(name) {
    this.name = name;
    return this;
  }
  /**
   * Override to render the tab's contents into `this.containerEl`.
   * @returns {void}
   */
  display() {}
  /**
   * Re-invoke {@link PluginSettingTab.display}. `reset: true` also discards the rendered tree.
   * @param {{ reset?: boolean }} [options]
   * @returns {Promise<void>}
   */
  refresh({ reset = false } = {}) {
    return /** @type {Promise<void>} */ (
      hostCall("refreshSettingTab", { reset })
    );
  }
}

/**
 * Fluent builder for a single labeled settings row. `new Setting(containerEl)`
 * appends a row (name + description + control area) to `containerEl` and
 * returns a builder for populating it.
 */
export class Setting {
  /**
   * @param {VirtualEl} containerEl
   */
  constructor(containerEl) {
    /** @type {VirtualEl} */
    this.settingEl = containerEl.createDiv({ cls: "setting-item" });
    /** @type {VirtualEl} */
    this.infoEl = this.settingEl.createDiv({ cls: "setting-item-info" });
    /** @type {VirtualEl} */
    this.nameEl = this.infoEl.createEl("h2", { cls: "setting-item-name" });
    /** @type {VirtualEl} */
    this.descEl = this.infoEl.createEl("p", { cls: "setting-item-desc" });
    /** @type {VirtualEl} */
    this.controlEl = this.settingEl.createDiv({
      cls: "setting-item-control",
    });
  }
  /**
   * Set the row's name/label.
   * @param {string} text
   * @returns {this}
   */
  setName(text) {
    this.nameEl.setText(text);
    return this;
  }
  /**
   * Set the row's description text below the name.
   * @param {string} text
   * @returns {this}
   */
  setDesc(text) {
    this.descEl.setText(text);
    return this;
  }
  /**
   * Add a text input; the callback receives a {@link TextComponent}.
   * @param {(component: TextComponent) => void} callback
   * @returns {this}
   */
  addText(callback) {
    const component = new TextComponent(this.controlEl);
    callback(component);
    return this;
  }
  /**
   * Add a multi-line text input; the callback receives a {@link TextAreaComponent}.
   * @param {(component: TextAreaComponent) => void} callback
   * @returns {this}
   */
  addTextArea(callback) {
    const component = new TextAreaComponent(this.controlEl);
    callback(component);
    return this;
  }
  /**
   * Add a toggle switch; the callback receives a {@link ToggleComponent}.
   * @param {(component: ToggleComponent) => void} callback
   * @returns {this}
   */
  addToggle(callback) {
    const component = new ToggleComponent(this.controlEl);
    callback(component);
    return this;
  }
  /**
   * Add a dropdown; the callback receives a {@link DropdownComponent}.
   * @param {(component: DropdownComponent) => void} callback
   * @returns {this}
   */
  addDropdown(callback) {
    const component = new DropdownComponent(this.controlEl);
    callback(component);
    return this;
  }
  /**
   * Add a button; the callback receives a {@link ButtonComponent}.
   * @param {(component: ButtonComponent) => void} callback
   * @returns {this}
   */
  addButton(callback) {
    const component = new ButtonComponent(this.controlEl);
    callback(component);
    return this;
  }
}

/** Single-line text input, built via {@link Setting.addText}. */
export class TextComponent {
  /**
   * @internal
   * @param {VirtualEl} containerEl
   */
  constructor(containerEl) {
    /** @type {VirtualEl} */
    this.el = containerEl.createEl("input", {
      attr: { type: "text" },
      cls: "setting-item-text-input",
    });
  }
  /**
   * Set the current value.
   * @param {string | null} value
   * @returns {this}
   */
  setValue(value) {
    this.el.setAttr("value", value == null ? "" : String(value));
    return this;
  }
  /**
   * Set the placeholder text shown when the input is empty.
   * @param {string} value
   * @returns {this}
   */
  setPlaceholder(value) {
    this.el.setAttr("placeholder", value);
    return this;
  }
  /**
   * Fires with the new string value on every change.
   * @param {(value: string) => void} callback
   * @returns {this}
   */
  onChange(callback) {
    this.el.onChange((event) => callback(event.target.value ?? ""));
    return this;
  }
}

/** Multi-line text input, built via {@link Setting.addTextArea}. */
export class TextAreaComponent {
  /**
   * @internal
   * @param {VirtualEl} containerEl
   */
  constructor(containerEl) {
    /** @type {VirtualEl} */
    this.el = containerEl.createEl("textarea", {
      cls: "setting-item-textarea",
    });
  }
  /**
   * Set the current value.
   * @param {string | null} value
   * @returns {this}
   */
  setValue(value) {
    this.el.setText(value == null ? "" : String(value));
    return this;
  }
  /**
   * Set the placeholder text shown when the input is empty.
   * @param {string} value
   * @returns {this}
   */
  setPlaceholder(value) {
    this.el.setAttr("placeholder", value);
    return this;
  }
  /**
   * Fires with the new string value on every change.
   * @param {(value: string) => void} callback
   * @returns {this}
   */
  onChange(callback) {
    this.el.onChange((event) => callback(event.target.value ?? ""));
    return this;
  }
}

/** On/off toggle switch, built via {@link Setting.addToggle}. */
export class ToggleComponent {
  /**
   * @internal
   * @param {VirtualEl} containerEl
   */
  constructor(containerEl) {
    /** @type {VirtualEl} */
    this.el = containerEl.createEl("toggle-switch", {
      cls: "setting-item-toggle",
    });
  }
  /**
   * Set the checked state.
   * @param {boolean} value
   * @returns {this}
   */
  setValue(value) {
    if (value) this.el.setAttr("checked", "");
    else delete this.el.attrs.checked;
    return this;
  }
  /**
   * Fires with the new boolean value on every change.
   * @param {(checked: boolean) => void} callback
   * @returns {this}
   */
  onChange(callback) {
    this.el.onChange((event) => callback(event.target.checked ?? false));
    return this;
  }
}

/** Single-select dropdown, built via {@link Setting.addDropdown}. */
export class DropdownComponent {
  /**
   * @internal
   * @param {VirtualEl} containerEl
   */
  constructor(containerEl) {
    /** @type {VirtualEl} */
    this.el = containerEl.createEl("select", {
      cls: "setting-item-dropdown",
    });
  }
  /**
   * Append one option.
   * @param {string} value
   * @param {string} label
   * @returns {this}
   */
  addOption(value, label) {
    this.el.createEl("option", { text: label, attr: { value } });
    return this;
  }
  /**
   * Append every `{ value: label }` entry as an option.
   * @param {Record<string, string>} map
   * @returns {this}
   */
  addOptions(map) {
    for (const [value, label] of Object.entries(map)) {
      this.addOption(value, label);
    }
    return this;
  }
  /**
   * Select the option whose value matches.
   * @param {string} value
   * @returns {this}
   */
  setValue(value) {
    for (const child of this.el.children) {
      if (!(child instanceof VirtualEl)) continue;
      if (child.attrs.value === value) {
        child.attrs.selected = "";
      } else {
        delete child.attrs.selected;
      }
    }
    return this;
  }
  /**
   * Fires with the newly selected value on every change.
   * @param {(value: string) => void} callback
   * @returns {this}
   */
  onChange(callback) {
    this.el.onChange((event) => callback(event.target.value ?? ""));
    return this;
  }
}

/** Clickable button, built via {@link Setting.addButton}. */
export class ButtonComponent {
  /**
   * @internal
   * @param {VirtualEl} containerEl
   */
  constructor(containerEl) {
    /** @type {VirtualEl} */
    this.el = containerEl.createEl("button", {
      cls: "rounded-button",
    });
  }
  /**
   * Set the button's label.
   * @param {string} text
   * @returns {this}
   */
  setButtonText(text) {
    this.el.setText(text);
    return this;
  }
  /**
   * Style the button as the row's primary call-to-action.
   * @returns {this}
   */
  setCta() {
    this.el.addClass("rounded-button-primary");
    return this;
  }
  /**
   * Register a click handler.
   * @param {() => void} callback
   * @returns {this}
   */
  onClick(callback) {
    this.el.onClick(callback);
    return this;
  }
}

/** Renders a host-provided icon by name. Built via {@link VirtualEl.createIcon}. */
export class IconComponent {
  /**
   * @internal
   * @param {VirtualEl} containerEl
   */
  constructor(containerEl) {
    /** @type {VirtualEl} */
    this.el = containerEl.createEl("plugin-icon");
  }
  /**
   * Set the icon name.
   * @param {string} name
   * @returns {this}
   */
  setIcon(name) {
    this.el.setAttr("icon", name);
    return this;
  }
}

/**
 * Renders a repo blob (by owning DID + blob CID) as an image. Built via
 * {@link VirtualEl.createBlobImage}.
 */
export class BlobImageComponent {
  /**
   * @internal
   * @param {VirtualEl} containerEl
   */
  constructor(containerEl) {
    /** @type {VirtualEl} */
    this.el = containerEl.createEl("plugin-blob-image");
  }
  /**
   * DID of the repo the blob belongs to.
   * @param {string} did
   * @returns {this}
   */
  setDid(did) {
    this.el.setAttr("did", did);
    return this;
  }
  /**
   * CID of the blob to render.
   * @param {string} cid
   * @returns {this}
   */
  setCid(cid) {
    this.el.setAttr("cid", cid);
    return this;
  }
  /**
   * Set the image's alt text.
   * @param {string} alt
   * @returns {this}
   */
  setAlt(alt) {
    this.el.setAttr("alt", alt);
    return this;
  }
  /**
   * Override the CDN URL prefix used to fetch the blob.
   * @param {string} prefix
   * @returns {this}
   */
  setCdnPrefix(prefix) {
    this.el.setAttr("cdn-prefix", prefix);
    return this;
  }
}

/**
 * Renders a list of profiles from an array of DIDs, hydrated by the host.
 * Built via {@link VirtualEl.createProfilesList}.
 */
export class ProfilesListComponent {
  /**
   * @internal
   * @param {VirtualEl} containerEl
   */
  constructor(containerEl) {
    /** @type {VirtualEl} */
    this.el = containerEl.createEl("plugin-profiles-list");
  }
  /**
   * Set the DIDs to render (array or comma-separated string).
   * @param {string[] | string} dids
   * @returns {this}
   */
  setDids(dids) {
    const value = Array.isArray(dids) ? dids.join(",") : String(dids ?? "");
    this.el.setAttr("dids", value);
    return this;
  }
  /**
   * Message shown when the list is empty.
   * @param {string} message
   * @returns {this}
   */
  setEmptyMessage(message) {
    this.el.setAttr("empty-message", message);
    return this;
  }
}

/**
 * Renders a feed of posts from an array of post URIs, hydrated by the host.
 * Built via {@link VirtualEl.createPostsFeed}.
 */
export class PostsFeedComponent {
  /**
   * @internal
   * @param {VirtualEl} containerEl
   */
  constructor(containerEl) {
    /** @type {VirtualEl} */
    this.el = containerEl.createEl("plugin-posts-feed");
  }
  /**
   * Set the post URIs to render (array or comma-separated string).
   * @param {string[] | string} uris
   * @returns {this}
   */
  setUris(uris) {
    const value = Array.isArray(uris) ? uris.join(",") : String(uris ?? "");
    this.el.setAttr("uris", value);
    return this;
  }
  /**
   * Message shown when the feed is empty.
   * @param {string} message
   * @returns {this}
   */
  setEmptyMessage(message) {
    this.el.setAttr("empty-message", message);
    return this;
  }
}

/**
 * A text node in a {@link VirtualEl} tree. Null/undefined coerce to `""`.
 */
export class VirtualText {
  /**
   * @param {string | null | undefined} value
   */
  constructor(value) {
    /** @type {string} */
    this.value = value == null ? "" : String(value);
  }

  /**
   * @internal
   * @returns {SerializedText}
   */
  _serialize() {
    return { type: "text", value: this.value };
  }
}

/**
 * Minimal DOM-builder node. Plugins run in a sandbox and cannot touch the real
 * DOM directly; instead they build a serializable {@link VirtualEl} tree that
 * the host renders and reconciles.
 */
export class VirtualEl {
  /**
   * @param {string} tag
   */
  constructor(tag) {
    /** @type {string} */
    this.tag = tag;
    /** @type {Record<string, string>} */
    this.attrs = {};
    /** @type {Record<string, string>} */
    this.styles = {};
    /** @type {(VirtualEl | VirtualText)[]} */
    this.children = [];
    /** @type {Record<string, number>} */
    this.events = {};
  }

  /**
   * Set an inline style.
   * @param {string} name
   * @param {string | null} value
   * @returns {this}
   */
  setStyle(name, value) {
    this.styles[String(name)] = value == null ? "" : String(value);
    return this;
  }

  /**
   * Register a click handler.
   * @param {(event?: object) => void} fn
   * @returns {this}
   */
  onClick(fn) {
    const handlerId = uuid.create();
    callHandlers.set(handlerId, fn);
    this.events.click = handlerId;
    return this;
  }

  /**
   * Register a change handler (form controls).
   * @param {(event: { target: { value?: string, checked?: boolean } }) => void} fn
   * @returns {this}
   */
  onChange(fn) {
    const handlerId = uuid.create();
    callHandlers.set(handlerId, fn);
    this.events.change = handlerId;
    return this;
  }

  /**
   * Register an input handler (text inputs).
   * @param {(event: { target: { value?: string } }) => void} fn
   * @returns {this}
   */
  onInput(fn) {
    const handlerId = uuid.create();
    callHandlers.set(handlerId, fn);
    this.events.input = handlerId;
    return this;
  }

  /**
   * Replace all children with a single {@link VirtualText} node.
   * @param {string | null} text
   * @returns {this}
   */
  setText(text) {
    this.children = [];
    if (text != null && text !== "") this.children.push(new VirtualText(text));
    return this;
  }

  /**
   * Remove all children.
   * @returns {this}
   */
  empty() {
    this.children = [];
    return this;
  }

  /**
   * Append a {@link VirtualEl} or {@link VirtualText}; throws on anything else.
   * @param {VirtualEl | VirtualText} child
   * @returns {this}
   */
  appendChild(child) {
    if (!(child instanceof VirtualEl) && !(child instanceof VirtualText)) {
      throw new TypeError(
        "appendChild expects a VirtualEl or VirtualText instance",
      );
    }
    this.children.push(child);
    return this;
  }

  /**
   * Append a {@link VirtualText} child.
   * @param {string} value
   * @returns {this}
   */
  appendText(value) {
    this.children.push(new VirtualText(value));
    return this;
  }

  /**
   * Append and return a {@link VirtualText} child.
   * @param {string} value
   * @returns {VirtualText}
   */
  createText(value) {
    const node = new VirtualText(value);
    this.children.push(node);
    return node;
  }

  /**
   * Add a CSS class, whitespace-joined with any existing classes.
   * @param {string} cls
   * @returns {this}
   */
  addClass(cls) {
    this.attrs.class = this.attrs.class ? `${this.attrs.class} ${cls}` : cls;
    return this;
  }

  /**
   * Set an attribute; `undefined` coerces to `""`.
   * @param {string} name
   * @param {string | undefined} value
   * @returns {this}
   */
  setAttr(name, value) {
    this.attrs[name] = value === undefined ? "" : value;
    return this;
  }

  /**
   * Append a child element and return it. `options` accepts `text`,
   * `cls` (string or string[]), and `attr` (object). The optional callback
   * receives the new child for further building.
   * @param {string} tag
   * @param {{ text?: string, cls?: string | string[], attr?: Record<string, string> }} [options]
   * @param {(child: VirtualEl) => void} [callback]
   * @returns {VirtualEl}
   */
  createEl(tag, options = {}, callback) {
    const child = new VirtualEl(tag);
    if (options.text != null) child.setText(options.text);
    if (options.cls) {
      child.attrs.class = Array.isArray(options.cls)
        ? options.cls.join(" ")
        : options.cls;
    }
    if (options.attr) Object.assign(child.attrs, options.attr);
    this.children.push(child);
    if (typeof callback === "function") callback(child);
    return child;
  }

  /**
   * Shorthand for `createEl("div", ...)`.
   * @param {{ text?: string, cls?: string | string[], attr?: Record<string, string> }} [options]
   * @param {(child: VirtualEl) => void} [callback]
   * @returns {VirtualEl}
   */
  createDiv(options = {}, callback) {
    return this.createEl("div", options, callback);
  }

  /**
   * Shorthand for `createEl("span", ...)`.
   * @param {{ text?: string, cls?: string | string[], attr?: Record<string, string> }} [options]
   * @param {(child: VirtualEl) => void} [callback]
   * @returns {VirtualEl}
   */
  createSpan(options = {}, callback) {
    return this.createEl("span", options, callback);
  }

  /**
   * Append a profiles-list custom component and return its builder.
   * @param {(c: ProfilesListComponent) => void} [callback]
   * @returns {ProfilesListComponent}
   */
  createProfilesList(callback) {
    const component = new ProfilesListComponent(this);
    if (typeof callback === "function") callback(component);
    return component;
  }

  /**
   * Append a posts-feed custom component and return its builder.
   * @param {(c: PostsFeedComponent) => void} [callback]
   * @returns {PostsFeedComponent}
   */
  createPostsFeed(callback) {
    const component = new PostsFeedComponent(this);
    if (typeof callback === "function") callback(component);
    return component;
  }

  /**
   * Append an icon custom component and return its builder.
   * @param {(c: IconComponent) => void} [callback]
   * @returns {IconComponent}
   */
  createIcon(callback) {
    const component = new IconComponent(this);
    if (typeof callback === "function") callback(component);
    return component;
  }

  /**
   * Append a blob-image custom component and return its builder.
   * @param {(c: BlobImageComponent) => void} [callback]
   * @returns {BlobImageComponent}
   */
  createBlobImage(callback) {
    const component = new BlobImageComponent(this);
    if (typeof callback === "function") callback(component);
    return component;
  }

  /**
   * @internal
   * @returns {SerializedElement}
   */
  _serialize() {
    /** @type {SerializedElement} */
    const serialized = {
      type: "element",
      tag: this.tag,
      attrs: this.attrs,
      events: this.events,
      children: this.children.map((child) => child._serialize()),
    };
    if (Object.keys(this.styles).length > 0) serialized.styles = this.styles;
    return serialized;
  }
}

/**
 * @typedef {{ type: "text", value: string }} SerializedText
 *   {@internal} The wire format of a {@link VirtualText} node.
 * @typedef {{ type: "element", tag: string, attrs: Record<string, string>, events: Record<string, number>, children: SerializedNode[], styles?: Record<string, string> }} SerializedElement
 *   {@internal} The wire format of a {@link VirtualEl} node.
 * @typedef {SerializedText | SerializedElement} SerializedNode
 *   {@internal} One node of the serialized tree the host renders and reconciles.
 * @typedef {{ [key: string]: Cloneable }} CloneableObject
 *   An object whose values are all {@link Cloneable}.
 * @typedef {Cloneable[]} CloneableArray
 *   An array of {@link Cloneable} values.
 * @typedef {null | undefined | boolean | number | string | CloneableArray | CloneableObject} Cloneable
 *   JSON-shaped data — the only thing that can cross between a plugin and the
 *   host. Functions, class instances, `Date`, `Map` and friends cannot.
 * @typedef {{ type: "register", target: "eventListener", event: string, handlerId: number }} RegisterEventListenerMessage
 *   {@internal}
 * @typedef {{ type: "register", target: "sidebarItem", icon: string | SerializedElement, title: string, handlerId: number }} RegisterSidebarItemMessage
 *   {@internal}
 * @typedef {{ type: "register", target: "settingTab", name: string | null, displayHandlerId: number }} RegisterSettingTabMessage
 *   {@internal}
 * @typedef {{ type: "register", target: "feedFilter", handlerId: number }} RegisterFeedFilterMessage
 *   {@internal}
 * @typedef {{ type: "register", target: "richTextTransform", handlerId: number, handlesFacetTypes: string[] }} RegisterRichTextTransformMessage
 *   {@internal}
 * @typedef {{ type: "register", target: "slot", name: string, handlerId: number, cacheKey: string[] | null, batch: true }} RegisterSlotMessage
 *   {@internal}
 * @typedef {{ type: "register", target: "page", id: string, title: string | null, displayHandlerId: number }} RegisterPageMessage
 *   {@internal}
 * @typedef {RegisterEventListenerMessage | RegisterSidebarItemMessage | RegisterSettingTabMessage | RegisterFeedFilterMessage | RegisterRichTextTransformMessage | RegisterSlotMessage | RegisterPageMessage} RegisterMessage
 *   {@internal} Announces an extension point this plugin provides.
 * @typedef {{ type: "hostCall", method: string, hostCallId?: number, args: Cloneable[] }} HostCallRequestMessage
 *   {@internal} Calls a host method. Without a `hostCallId` it is fire-and-forget.
 * @typedef {{ type: "result", callId: number, value?: unknown, error?: string }} CallResultMessage
 *   {@internal} Answers a {@link HostCallMessage}.
 * @typedef {{ type: "ready", error?: string }} ReadyMessage
 *   {@internal} Reports the outcome of plugin load.
 * @typedef {RegisterMessage | HostCallRequestMessage | CallResultMessage | ReadyMessage} WorkerMessage
 *   {@internal} Anything this worker may post to the host.
 * @typedef {{ type: "call", callId: number, handlerId: number, args: Cloneable[] }} HostCallMessage
 *   {@internal} The host invoking a handler this worker registered.
 * @typedef {{ type: "hostResult", hostCallId: number, value?: Cloneable | SerializedFetchResponse, error?: string }} HostResultMessage
 *   {@internal} The host answering a {@link hostCall}. Wider than
 *   {@link Cloneable} because {@link SerializedFetchResponse} carries its
 *   body as an `ArrayBuffer`, which structured clone handles but JSON
 *   cannot.
 * @typedef {{ type: "event", event: "modalDismissed", data: { modalId: number } }} HostEventMessage
 *   {@internal} An out-of-band notification from the host.
 * @typedef {HostCallMessage | HostResultMessage | HostEventMessage} HostMessage
 *   {@internal} Anything the host may post to this worker.
 * @typedef {{ status: number, ok: boolean, headers: Record<string, string>, body: ArrayBuffer }} SerializedFetchResponse
 *   {@internal} The host's reply to a proxied {@link fetch}. `body` is
 *   always the raw response bytes (see {@link PluginResponse}).
 * @typedef {{ method?: string, headers?: Record<string, string>, body?: string }} SerializedFetchInit
 *   {@internal} A {@link PluginFetchInit} with its headers flattened for transfer.
 * @typedef {Record<string, unknown>} SerializedRichTextToken
 *   {@internal} A {@link RichTextToken} whose `inline`/`block` node, if any, has
 *   been replaced by its serialized form.
 */

self.onmessage = async (event) => {
  /** @type {HostMessage} */
  const message = event.data;
  if (!message || typeof message !== "object") return;

  // RPC calls
  if (message.type === "call") {
    const fn = callHandlers.get(message.handlerId);
    if (!fn) {
      post({
        type: "result",
        callId: message.callId,
        error: `unknown handler ${message.handlerId}`,
      });
      return;
    }
    try {
      const value = await fn(...message.args);
      post({ type: "result", callId: message.callId, value });
    } catch (error) {
      post({
        type: "result",
        callId: message.callId,
        error: getErrorMessage(error),
      });
    }
    return;
  }

  // Host call results
  if (message.type === "hostResult") {
    const pending = pendingHostCalls.get(message.hostCallId);
    if (!pending) return;
    pendingHostCalls.delete(message.hostCallId);
    if (message.error) pending.reject(new Error(message.error));
    else pending.resolve(message.value);
    return;
  }

  // Events
  if (message.type === "event") {
    switch (message.event) {
      case "modalDismissed": {
        const modal = openModals.get(message.data.modalId);
        if (modal) {
          openModals.delete(message.data.modalId);
          modal.onClose();
        }
        return;
      }
    }
  }
};
