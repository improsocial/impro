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
export function fetch(url: string, init?: PluginFetchInit): Promise<PluginResponse>;
/**
 * Convenience wrapper that returns a new {@link FlattenedTokens} for `tokens`.
 * @param {RichTextToken[]} tokens
 * @returns {FlattenedTokens}
 */
export function flattenForScan(tokens: RichTextToken[]): FlattenedTokens;
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
    create(): number;
    #private;
}
/**
 * A single item in a {@link Menu}. Configure with the chained setters and
 * an `onClick` handler. Not constructed directly — obtained via
 * `Menu.addItem(builder)`.
 */
export class MenuItem {
    title: string;
    icon: string | VirtualEl | null;
    /** @internal */
    _callback: () => void;
    /**
     * Set the menu item's label.
     * @param {string} title
     * @returns {this}
     */
    setTitle(title: string): this;
    /**
     * Set the leading icon. Either a named icon (string) or a {@link VirtualEl}
     * to render as the icon.
     * @param {string | VirtualEl} icon
     * @returns {this}
     */
    setIcon(icon: string | VirtualEl): this;
    /**
     * Called when the user activates the item.
     * @param {() => void} callback
     * @returns {this}
     */
    onClick(callback: () => void): this;
}
/**
 * A context-menu builder passed as the first argument to
 * `post-context-menu` and `profile-context-menu` event listeners. Call
 * `addItem` to append menu entries.
 */
export class Menu {
    /** @type {MenuItem[]} */
    items: MenuItem[];
    /**
     * Append a menu item. The builder receives a {@link MenuItem} to configure.
     * @param {(item: MenuItem) => void} builder
     * @returns {this}
     */
    addItem(builder: (item: MenuItem) => void): this;
    /** @internal */
    _serialize(): {
        title: string;
        icon: string | SerializedElement | null;
        handlerId: number;
    }[];
}
/**
 * Builder passed as the first argument to `post-composer-open` event
 * listeners. Queues text operations that the host applies to the composer once
 * all listeners have run. operations from multiple plugins are applied in order.
 */
export class Composer {
    /**
     * Replace the composer's current text.
     * @param {string} text
     * @returns {this}
     */
    setText(text: string): this;
    /**
     * Append text to the end of the composer.
     * @param {string} text
     * @returns {this}
     */
    appendText(text: string): this;
    /**
     * Prepend text to the start of the composer.
     * @param {string} text
     * @returns {this}
     */
    prependText(text: string): this;
    /**
     * Move the caret to the given character index in the final text.
     * @param {number} index
     * @returns {this}
     */
    setCursor(index: number): this;
    /** @internal */
    _serialize(): {
        ops: {
            op: string;
            text: string;
        }[];
        cursor: number | null;
    };
    #private;
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
    getPost(uri: string): Promise<PostView>;
    /**
     * Fetch the basic profile view for a DID.
     * @param {string} did
     * @returns {Promise<ProfileView>}
     */
    getProfile(did: string): Promise<ProfileView>;
    /**
     * Like {@link PluginData.getProfile}, but includes viewer relationship
     * details not present on the basic profile view: `viewer.following`,
     * `viewer.followedBy`, and `viewer.knownFollowers` (a summary of mutual
     * followers).
     * @param {string} did
     * @returns {Promise<DetailedProfileView>}
     */
    getDetailedProfile(did: string): Promise<DetailedProfileView>;
    /**
     * The full known-followers list for `did`. The summary on
     * {@link PluginData.getDetailedProfile}'s `viewer.knownFollowers` is
     * capped to a handful; use this to paginate the complete list.
     * @param {string} did
     * @returns {Promise<KnownFollowersResponse>}
     */
    getKnownFollowers(did: string): Promise<KnownFollowersResponse>;
    /**
     * Fetch a raw repo record by `(repo, collection, rkey)`.
     * @param {string} repo
     * @param {string} collection
     * @param {string} rkey
     * @returns {Promise<RepoRecord>}
     */
    getRecord(repo: string, collection: string, rkey: string): Promise<RepoRecord>;
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
    getBacklinks({ subject, source, limit }: {
        subject: string;
        source: string;
        limit?: number;
    }): Promise<BacklinkRecord[]>;
}
/**
 * The plugin's handle to the running impro app. Exposed as `this.app` on a
 * {@link Plugin} instance. Owns event subscriptions, data accessors
 * ({@link App.data}), and user-scoped actions.
 */
export class App {
    /**
     * The signed-in user's basic profile, populated before `onload()` runs.
     * Null when no session is active.
     * @type {ProfileView | null}
     */
    currentUser: ProfileView | null;
    /** Read-only appview accessors — see {@link PluginData}. */
    data: PluginData;
    /** A user-approved network address — see {@link CustomEndpoint}. */
    customEndpoint: CustomEndpoint;
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
    on<K extends keyof PluginEventMap>(event: K, listener: PluginEventMap[K]): void;
    /**
     * Re-run registered feed filters. Pass a `feedURI` to limit the refresh
     * to one feed, or omit/pass `null` to refresh every feed.
     * @param {string | null} [feedURI]
     * @returns {Promise<void>}
     */
    refreshFeedFilters(feedURI?: string | null): Promise<void>;
    /**
     * Mute an actor on behalf of the signed-in user. Requires the `"mute"`
     * scope in the plugin manifest's `permissions.actions`.
     * @param {string} did
     * @returns {Promise<void>}
     */
    muteActor(did: string): Promise<void>;
    /**
     * Unmute an actor. Requires the `"mute"` scope.
     * @param {string} did
     * @returns {Promise<void>}
     */
    unmuteActor(did: string): Promise<void>;
    /**
     * Block an actor on behalf of the signed-in user. Requires the `"block"`
     * scope in the plugin manifest's `permissions.actions`.
     * @param {string} did
     * @returns {Promise<void>}
     */
    blockActor(did: string): Promise<void>;
    /**
     * Unblock an actor. Requires the `"block"` scope.
     * @param {string} did
     * @returns {Promise<void>}
     */
    unblockActor(did: string): Promise<void>;
    /**
     * Acts like the user clicking "Show less like this": sends the
     * `requestLess` feedback signal to `feedUri` and collapses the post
     * behind a feedback message in feeds. Requires the `"feedFeedback"`
     * scope.
     * @param {string} postUri
     * @param {string} feedUri
     * @returns {Promise<void>}
     */
    showLessLikeThis(postUri: string, feedUri: string): Promise<void>;
    /**
     * Sends the `requestMore` feedback signal to `feedUri` for `postUri`.
     * Requires the `"feedFeedback"` scope.
     * @param {string} postUri
     * @param {string} feedUri
     * @returns {Promise<void>}
     */
    showMoreLikeThis(postUri: string, feedUri: string): Promise<void>;
}
/**
 * Response returned from {@link fetch}. The host buffers the raw response
 * bytes and sends them as an `ArrayBuffer`, and this class decodes them on
 * demand depending on which accessor is called. `status`, `ok`, and `headers`
 * (a `Map`) mirror the underlying HTTP response.
 */
export class PluginResponse {
    /**
     * @internal
     * @param {SerializedFetchResponse} response
     */
    constructor({ status, ok, headers, body }: SerializedFetchResponse);
    /** @type {number} */
    status: number;
    /** @type {boolean} */
    ok: boolean;
    /** @type {Map<string, string>} */
    headers: Map<string, string>;
    /**
     * Resolves with the raw response bytes.
     * @returns {Promise<ArrayBuffer>}
     */
    arrayBuffer(): Promise<ArrayBuffer>;
    /**
     * Resolves with the response body decoded as UTF-8 text.
     * @returns {Promise<string>}
     */
    text(): Promise<string>;
    /**
     * Resolves with the response body parsed as JSON.
     * @returns {Promise<unknown>}
     */
    json(): Promise<unknown>;
    #private;
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
    getUrl(): Promise<string | null>;
    /**
     * Prompts the user to approve `url` as this plugin's one allowed network
     * address.
     * @param {string} url
     * @returns {Promise<{ accepted: boolean, url: string | null }>} `url` is
     *   the *current* approved address (unchanged from before if declined);
     *   `accepted` reflects whether this particular request was granted.
     */
    requestUrl(url: string): Promise<{
        accepted: boolean;
        url: string | null;
    }>;
    /**
     * Fetches `url`, which must exactly match the currently-approved address
     * (see {@link CustomEndpoint.requestUrl}) or this rejects.
     * @param {string} url
     * @param {PluginFetchInit} [init]
     * @returns {Promise<PluginResponse>}
     */
    fetch(url: string, init?: PluginFetchInit): Promise<PluginResponse>;
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
    /**
     * `timeout` is in milliseconds; `0` (the default) keeps the toast up until
     * {@link Notice.hide} is called.
     * @param {string} message
     * @param {number} [timeout=0]
     */
    constructor(message: string, timeout?: number);
    /** @type {VirtualEl} */
    noticeEl: VirtualEl;
    /**
     * Updates `noticeEl`'s text. Only takes effect if called synchronously
     * before the microtask that snapshots the toast for the initial render.
     * @param {string} message
     * @returns {this}
     */
    setMessage(message: string): this;
    /**
     * Dismisses the toast. No-op if already hidden.
     * @returns {void}
     */
    hide(): void;
    #private;
}
/**
 * Injects a CSS block scoped to the plugin. The stylesheet is mounted by the
 * host on the next microtask; snippets are automatically removed when the
 * plugin unloads.
 */
export class StyleSnippet {
    /**
     * @param {string} cssText
     */
    constructor(cssText: string);
    /**
     * Resolves once the snippet has been applied by the host.
     * @type {Promise<void>}
     */
    ready: Promise<void>;
    /**
     * Removes the snippet from the document. No-op if already removed.
     * @returns {void}
     */
    remove(): void;
    #private;
}
/**
 * Base class for impro plugins. Subclass this and override {@link Plugin.onload}
 * (and optionally {@link Plugin.onunload}) to wire up your plugin's extension
 * points. `this.app` is the shared {@link App} instance for host actions and
 * data. Call `MyPlugin.register()` at the top of your plugin's main.js to boot.
 */
export class Plugin {
    /**
     * Boots the plugin. Call as `MyPlugin.register()` at the top of your plugin's
     * main.js — instantiates the subclass, resolves the current user onto
     * `app.currentUser`, then invokes {@link Plugin.onload}. Idempotent.
     * @returns {void}
     */
    static register(): void;
    /** @type {App} */
    app: App;
    /**
     * Adds an item to the impro sidebar. `icon` is a {@link VirtualEl} (typically
     * an SVG) or a string; `callback` runs when the item is clicked.
     * @param {string | VirtualEl} icon
     * @param {string} title
     * @param {() => void} [callback]
     * @returns {void}
     */
    addSidebarItem(icon: string | VirtualEl, title: string, callback?: () => void): void;
    /**
     * Loads this plugin's account-synced JSON blob. Follows the user across
     * devices via account preferences. Returns whatever was last saved, or null.
     * @returns {Promise<unknown>}
     */
    loadData(): Promise<unknown>;
    /**
     * Persists `data` as this plugin's account-synced JSON blob.
     * @param {Cloneable} data
     * @returns {Promise<void>}
     */
    saveData(data: Cloneable): Promise<void>;
    /**
     * Device-local counterpart to {@link Plugin.loadData}: never synced through
     * the user's account preferences, so it's the right place for anything that
     * shouldn't silently follow the plugin to another device (e.g. a locally
     * held secret key). Cleared on uninstall, same as loadData/saveData.
     * @returns {Promise<unknown>}
     */
    loadLocalData(): Promise<unknown>;
    /**
     * Device-local counterpart to {@link Plugin.saveData}.
     * @param {Cloneable} data
     * @returns {Promise<void>}
     */
    saveLocalData(data: Cloneable): Promise<void>;
    /**
     * Registers a {@link PluginSettingTab} shown under this plugin's entry in
     * the app's settings.
     * @param {PluginSettingTab} tab
     * @returns {void}
     */
    addSettingTab(tab: PluginSettingTab): void;
    /**
     * Registers a feed filter. `callback(feedUri, feedItems)` returns an object
     * `{ [postUri]: false }` for posts to hide from the feed. Only `false` hides;
     * any other value is ignored, so one plugin can't un-hide what another hid.
     * @param {(feedUri: string, feedItems: FeedItem[]) => Record<string, boolean> | Promise<Record<string, boolean>>} callback
     * @returns {void}
     */
    addFeedFilter(callback?: (feedUri: string, feedItems: FeedItem[]) => Record<string, boolean> | Promise<Record<string, boolean>>): void;
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
    registerRichTextTransform(callback?: (tokens: RichTextToken[], context: {
        uri: string;
        surface: string;
        source: {
            text: string;
        };
    }) => RichTextToken[] | Promise<RichTextToken[]>, options?: {
        handlesFacetTypes?: string[];
    }): void;
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
    registerSlot(name: string, callback?: (context: Record<string, string>) => RenderResult | Promise<RenderResult>, options?: {
        cacheKey?: string[];
    }): void;
    /**
     * Registers a full-page view reachable via {@link Plugin.openPage}. `display()`
     * is called on navigation and must return a {@link VirtualEl}, or nothing to
     * render an empty page.
     * @param {{ id: string, title?: string | null, display?: () => RenderResult | Promise<RenderResult> }} options
     * @returns {void}
     */
    registerPage({ id, title, display }: {
        id: string;
        title?: string | null;
        display?: () => RenderResult | Promise<RenderResult>;
    }): void;
    /**
     * Navigates the user to one of this plugin's registered pages.
     * @param {string} pageId
     * @returns {Promise<void>}
     */
    openPage(pageId: string): Promise<void>;
    /**
     * Re-invokes a registered page's display callback if the page is open.
     * `options.reset` also discards the rendered tree instead of patching it.
     * @param {string} pageId
     * @param {{ reset?: boolean }} [options]
     * @returns {Promise<void>}
     */
    refreshPage(pageId: string, { reset }?: {
        reset?: boolean;
    }): Promise<void>;
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
    refreshSlot(name: string, options?: {
        keys?: Record<string, string>[];
    }): Promise<void>;
    /**
     * Override in your subclass. Runs after the plugin is loaded and the current user is resolved.
     * @returns {void | Promise<void>}
     */
    onload(): void | Promise<void>;
    /**
     * Override in your subclass. Runs when the plugin is being torn down (uninstall/reload).
     * @returns {void | Promise<void>}
     */
    onunload(): void | Promise<void>;
}
/**
 * Flattens a rich-text token stream into a plain string with a position map,
 * so a {@link Plugin.registerRichTextTransform | rich-text transform} can
 * pattern-match (e.g. with a regex) across token boundaries and map matches
 * back to the original tokens.
 */
export class FlattenedTokens {
    /**
     * @param {RichTextToken[]} tokens
     */
    constructor(tokens: RichTextToken[]);
    /** @type {string} */
    text: string;
    /**
     * Return the plain-text slice for `[start, end)` — inert, with no facets.
     * @param {number} start
     * @param {number} end
     * @returns {string}
     */
    textFor(start: number, end: number): string;
    /**
     * Return the tokens covering `[start, end)`. Facet tokens partially
     * overlapping the range are demoted to plain text tokens so the emitted
     * slice never carries a truncated facet.
     * @param {number} start
     * @param {number} end
     * @returns {RichTextToken[]}
     */
    tokensFor(start: number, end: number): RichTextToken[];
    #private;
}
/**
 * A dismissable modal dialog. Subclass and populate `contentEl` and
 * `titleEl` (both {@link VirtualEl}), typically inside {@link Modal.onOpen}.
 * Call `open()` to show and `close()` to hide.
 */
export class Modal {
    /** @type {VirtualEl} */
    contentEl: VirtualEl;
    /** @type {VirtualEl} */
    titleEl: VirtualEl;
    /**
     * Show the modal. Runs {@link Modal.onOpen} first, then mounts the current el state.
     * @returns {void}
     */
    open(): void;
    /**
     * Re-render the open modal from the current `titleEl` / `contentEl` state. No-op if closed.
     * @returns {void}
     */
    update(): void;
    /**
     * Hide the modal and fire {@link Modal.onClose}.
     * @returns {void}
     */
    close(): void;
    /**
     * Lifecycle hook — override to populate `titleEl` / `contentEl` before the modal mounts.
     * @returns {void}
     */
    onOpen(): void;
    /**
     * Lifecycle hook — override to react to the modal being dismissed (by `close()` or the user).
     * @returns {void}
     */
    onClose(): void;
    #private;
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
    constructor(plugin: Plugin);
    /** @type {Plugin} */
    plugin: Plugin;
    /** @type {VirtualEl} */
    containerEl: VirtualEl;
    /** @type {string | null} */
    name: string | null;
    /**
     * Set the tab's label.
     * @param {string} name
     * @returns {this}
     */
    setName(name: string): this;
    /**
     * Override to render the tab's contents into `this.containerEl`.
     * @returns {void}
     */
    display(): void;
    /**
     * Re-invoke {@link PluginSettingTab.display}. `reset: true` also discards the rendered tree.
     * @param {{ reset?: boolean }} [options]
     * @returns {Promise<void>}
     */
    refresh({ reset }?: {
        reset?: boolean;
    }): Promise<void>;
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
    constructor(containerEl: VirtualEl);
    /** @type {VirtualEl} */
    settingEl: VirtualEl;
    /** @type {VirtualEl} */
    infoEl: VirtualEl;
    /** @type {VirtualEl} */
    nameEl: VirtualEl;
    /** @type {VirtualEl} */
    descEl: VirtualEl;
    /** @type {VirtualEl} */
    controlEl: VirtualEl;
    /**
     * Set the row's name/label.
     * @param {string} text
     * @returns {this}
     */
    setName(text: string): this;
    /**
     * Set the row's description text below the name.
     * @param {string} text
     * @returns {this}
     */
    setDesc(text: string): this;
    /**
     * Add a text input; the callback receives a {@link TextComponent}.
     * @param {(component: TextComponent) => void} callback
     * @returns {this}
     */
    addText(callback: (component: TextComponent) => void): this;
    /**
     * Add a multi-line text input; the callback receives a {@link TextAreaComponent}.
     * @param {(component: TextAreaComponent) => void} callback
     * @returns {this}
     */
    addTextArea(callback: (component: TextAreaComponent) => void): this;
    /**
     * Add a toggle switch; the callback receives a {@link ToggleComponent}.
     * @param {(component: ToggleComponent) => void} callback
     * @returns {this}
     */
    addToggle(callback: (component: ToggleComponent) => void): this;
    /**
     * Add a dropdown; the callback receives a {@link DropdownComponent}.
     * @param {(component: DropdownComponent) => void} callback
     * @returns {this}
     */
    addDropdown(callback: (component: DropdownComponent) => void): this;
    /**
     * Add a button; the callback receives a {@link ButtonComponent}.
     * @param {(component: ButtonComponent) => void} callback
     * @returns {this}
     */
    addButton(callback: (component: ButtonComponent) => void): this;
}
/** Single-line text input, built via {@link Setting.addText}. */
export class TextComponent {
    /**
     * @internal
     * @param {VirtualEl} containerEl
     */
    constructor(containerEl: VirtualEl);
    /** @type {VirtualEl} */
    el: VirtualEl;
    /**
     * Set the current value.
     * @param {string | null} value
     * @returns {this}
     */
    setValue(value: string | null): this;
    /**
     * Set the placeholder text shown when the input is empty.
     * @param {string} value
     * @returns {this}
     */
    setPlaceholder(value: string): this;
    /**
     * Fires with the new string value on every change.
     * @param {(value: string) => void} callback
     * @returns {this}
     */
    onChange(callback: (value: string) => void): this;
}
/** Multi-line text input, built via {@link Setting.addTextArea}. */
export class TextAreaComponent {
    /**
     * @internal
     * @param {VirtualEl} containerEl
     */
    constructor(containerEl: VirtualEl);
    /** @type {VirtualEl} */
    el: VirtualEl;
    /**
     * Set the current value.
     * @param {string | null} value
     * @returns {this}
     */
    setValue(value: string | null): this;
    /**
     * Set the placeholder text shown when the input is empty.
     * @param {string} value
     * @returns {this}
     */
    setPlaceholder(value: string): this;
    /**
     * Fires with the new string value on every change.
     * @param {(value: string) => void} callback
     * @returns {this}
     */
    onChange(callback: (value: string) => void): this;
}
/** On/off toggle switch, built via {@link Setting.addToggle}. */
export class ToggleComponent {
    /**
     * @internal
     * @param {VirtualEl} containerEl
     */
    constructor(containerEl: VirtualEl);
    /** @type {VirtualEl} */
    el: VirtualEl;
    /**
     * Set the checked state.
     * @param {boolean} value
     * @returns {this}
     */
    setValue(value: boolean): this;
    /**
     * Fires with the new boolean value on every change.
     * @param {(checked: boolean) => void} callback
     * @returns {this}
     */
    onChange(callback: (checked: boolean) => void): this;
}
/** Single-select dropdown, built via {@link Setting.addDropdown}. */
export class DropdownComponent {
    /**
     * @internal
     * @param {VirtualEl} containerEl
     */
    constructor(containerEl: VirtualEl);
    /** @type {VirtualEl} */
    el: VirtualEl;
    /**
     * Append one option.
     * @param {string} value
     * @param {string} label
     * @returns {this}
     */
    addOption(value: string, label: string): this;
    /**
     * Append every `{ value: label }` entry as an option.
     * @param {Record<string, string>} map
     * @returns {this}
     */
    addOptions(map: Record<string, string>): this;
    /**
     * Select the option whose value matches.
     * @param {string} value
     * @returns {this}
     */
    setValue(value: string): this;
    /**
     * Fires with the newly selected value on every change.
     * @param {(value: string) => void} callback
     * @returns {this}
     */
    onChange(callback: (value: string) => void): this;
}
/** Clickable button, built via {@link Setting.addButton}. */
export class ButtonComponent {
    /**
     * @internal
     * @param {VirtualEl} containerEl
     */
    constructor(containerEl: VirtualEl);
    /** @type {VirtualEl} */
    el: VirtualEl;
    /**
     * Set the button's label.
     * @param {string} text
     * @returns {this}
     */
    setButtonText(text: string): this;
    /**
     * Style the button as the row's primary call-to-action.
     * @returns {this}
     */
    setCta(): this;
    /**
     * Register a click handler.
     * @param {() => void} callback
     * @returns {this}
     */
    onClick(callback: () => void): this;
}
/** Renders a host-provided icon by name. Built via {@link VirtualEl.createIcon}. */
export class IconComponent {
    /**
     * @internal
     * @param {VirtualEl} containerEl
     */
    constructor(containerEl: VirtualEl);
    /** @type {VirtualEl} */
    el: VirtualEl;
    /**
     * Set the icon name.
     * @param {string} name
     * @returns {this}
     */
    setIcon(name: string): this;
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
    constructor(containerEl: VirtualEl);
    /** @type {VirtualEl} */
    el: VirtualEl;
    /**
     * DID of the repo the blob belongs to.
     * @param {string} did
     * @returns {this}
     */
    setDid(did: string): this;
    /**
     * CID of the blob to render.
     * @param {string} cid
     * @returns {this}
     */
    setCid(cid: string): this;
    /**
     * Set the image's alt text.
     * @param {string} alt
     * @returns {this}
     */
    setAlt(alt: string): this;
    /**
     * Override the CDN URL prefix used to fetch the blob.
     * @param {string} prefix
     * @returns {this}
     */
    setCdnPrefix(prefix: string): this;
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
    constructor(containerEl: VirtualEl);
    /** @type {VirtualEl} */
    el: VirtualEl;
    /**
     * Set the DIDs to render (array or comma-separated string).
     * @param {string[] | string} dids
     * @returns {this}
     */
    setDids(dids: string[] | string): this;
    /**
     * Message shown when the list is empty.
     * @param {string} message
     * @returns {this}
     */
    setEmptyMessage(message: string): this;
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
    constructor(containerEl: VirtualEl);
    /** @type {VirtualEl} */
    el: VirtualEl;
    /**
     * Set the post URIs to render (array or comma-separated string).
     * @param {string[] | string} uris
     * @returns {this}
     */
    setUris(uris: string[] | string): this;
    /**
     * Message shown when the feed is empty.
     * @param {string} message
     * @returns {this}
     */
    setEmptyMessage(message: string): this;
}
/**
 * A text node in a {@link VirtualEl} tree. Null/undefined coerce to `""`.
 */
export class VirtualText {
    /**
     * @param {string | null | undefined} value
     */
    constructor(value: string | null | undefined);
    /** @type {string} */
    value: string;
    /**
     * @internal
     * @returns {SerializedText}
     */
    _serialize(): SerializedText;
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
    constructor(tag: string);
    /** @type {string} */
    tag: string;
    /** @type {Record<string, string>} */
    attrs: Record<string, string>;
    /** @type {Record<string, string>} */
    styles: Record<string, string>;
    /** @type {(VirtualEl | VirtualText)[]} */
    children: (VirtualEl | VirtualText)[];
    /** @type {Record<string, number>} */
    events: Record<string, number>;
    /**
     * Set an inline style.
     * @param {string} name
     * @param {string | null} value
     * @returns {this}
     */
    setStyle(name: string, value: string | null): this;
    /**
     * Register a click handler.
     * @param {(event?: object) => void} fn
     * @returns {this}
     */
    onClick(fn: (event?: object) => void): this;
    /**
     * Register a change handler (form controls).
     * @param {(event: { target: { value?: string, checked?: boolean } }) => void} fn
     * @returns {this}
     */
    onChange(fn: (event: {
        target: {
            value?: string;
            checked?: boolean;
        };
    }) => void): this;
    /**
     * Register an input handler (text inputs).
     * @param {(event: { target: { value?: string } }) => void} fn
     * @returns {this}
     */
    onInput(fn: (event: {
        target: {
            value?: string;
        };
    }) => void): this;
    /**
     * Replace all children with a single {@link VirtualText} node.
     * @param {string | null} text
     * @returns {this}
     */
    setText(text: string | null): this;
    /**
     * Remove all children.
     * @returns {this}
     */
    empty(): this;
    /**
     * Append a {@link VirtualEl} or {@link VirtualText}; throws on anything else.
     * @param {VirtualEl | VirtualText} child
     * @returns {this}
     */
    appendChild(child: VirtualEl | VirtualText): this;
    /**
     * Append a {@link VirtualText} child.
     * @param {string} value
     * @returns {this}
     */
    appendText(value: string): this;
    /**
     * Append and return a {@link VirtualText} child.
     * @param {string} value
     * @returns {VirtualText}
     */
    createText(value: string): VirtualText;
    /**
     * Add a CSS class, whitespace-joined with any existing classes.
     * @param {string} cls
     * @returns {this}
     */
    addClass(cls: string): this;
    /**
     * Set an attribute; `undefined` coerces to `""`.
     * @param {string} name
     * @param {string | undefined} value
     * @returns {this}
     */
    setAttr(name: string, value: string | undefined): this;
    /**
     * Append a child element and return it. `options` accepts `text`,
     * `cls` (string or string[]), and `attr` (object). The optional callback
     * receives the new child for further building.
     * @param {string} tag
     * @param {{ text?: string, cls?: string | string[], attr?: Record<string, string> }} [options]
     * @param {(child: VirtualEl) => void} [callback]
     * @returns {VirtualEl}
     */
    createEl(tag: string, options?: {
        text?: string;
        cls?: string | string[];
        attr?: Record<string, string>;
    }, callback?: (child: VirtualEl) => void): VirtualEl;
    /**
     * Shorthand for `createEl("div", ...)`.
     * @param {{ text?: string, cls?: string | string[], attr?: Record<string, string> }} [options]
     * @param {(child: VirtualEl) => void} [callback]
     * @returns {VirtualEl}
     */
    createDiv(options?: {
        text?: string;
        cls?: string | string[];
        attr?: Record<string, string>;
    }, callback?: (child: VirtualEl) => void): VirtualEl;
    /**
     * Shorthand for `createEl("span", ...)`.
     * @param {{ text?: string, cls?: string | string[], attr?: Record<string, string> }} [options]
     * @param {(child: VirtualEl) => void} [callback]
     * @returns {VirtualEl}
     */
    createSpan(options?: {
        text?: string;
        cls?: string | string[];
        attr?: Record<string, string>;
    }, callback?: (child: VirtualEl) => void): VirtualEl;
    /**
     * Append a profiles-list custom component and return its builder.
     * @param {(c: ProfilesListComponent) => void} [callback]
     * @returns {ProfilesListComponent}
     */
    createProfilesList(callback?: (c: ProfilesListComponent) => void): ProfilesListComponent;
    /**
     * Append a posts-feed custom component and return its builder.
     * @param {(c: PostsFeedComponent) => void} [callback]
     * @returns {PostsFeedComponent}
     */
    createPostsFeed(callback?: (c: PostsFeedComponent) => void): PostsFeedComponent;
    /**
     * Append an icon custom component and return its builder.
     * @param {(c: IconComponent) => void} [callback]
     * @returns {IconComponent}
     */
    createIcon(callback?: (c: IconComponent) => void): IconComponent;
    /**
     * Append a blob-image custom component and return its builder.
     * @param {(c: BlobImageComponent) => void} [callback]
     * @returns {BlobImageComponent}
     */
    createBlobImage(callback?: (c: BlobImageComponent) => void): BlobImageComponent;
    /**
     * @internal
     * @returns {SerializedElement}
     */
    _serialize(): SerializedElement;
}
/**
 * Hydrated `app.bsky.feed.defs#postView` shape.
 */
export type PostView = Record<string, unknown>;
/**
 * Basic `app.bsky.actor.defs#profileView` shape.
 */
export type ProfileView = Record<string, unknown>;
/**
 * Detailed profile view with viewer relationship fields.
 */
export type DetailedProfileView = Record<string, unknown>;
/**
 * Paginated response from `getKnownFollowers`: `{ followers, cursor }`.
 */
export type KnownFollowersResponse = Record<string, unknown>;
/**
 * A raw repo record: `{ uri, cid, value }`.
 */
export type RepoRecord = Record<string, unknown>;
/**
 * A record that links to a queried subject.
 */
export type BacklinkRecord = {
    did: string;
    collection: string;
    rkey: string;
};
/**
 * A `app.bsky.feed.defs#feedViewPost` (post + reply/repost context).
 */
export type FeedItem = Record<string, unknown>;
/**
 * One feature of a facet; fields beyond `$type` vary by service.
 */
export type RichTextFacetFeature = {
    $type: string;
} & Record<string, unknown>;
/**
 * An `app.bsky.richtext.facet` — a byte range plus the features applying to it.
 */
export type RichTextFacet = {
    index: {
        byteStart: number;
        byteEnd: number;
    };
    features?: RichTextFacetFeature[];
};
/**
 * A run of plain text.
 */
export type RichTextTextToken = {
    type: "text";
    value: string;
};
/**
 * The text covered by one facet; the host restores the original facet payload.
 */
export type RichTextFacetToken = {
    type: "facet";
    facet: RichTextFacet;
    text: string;
};
/**
 * Custom content the plugin renders itself — `block` on its own line, `inline` in the text flow.
 */
export type RichTextNodeToken = {
    type: "inline" | "block";
    node: VirtualEl | Record<string, unknown>;
    pluginId?: string;
};
/**
 * One token in a rich-text stream — `text`, `facet`, `inline`, or `block`.
 */
export type RichTextToken = RichTextTextToken | RichTextFacetToken | RichTextNodeToken;
/**
 * Any header collection {@link fetch} accepts — read structurally, not by class.
 */
export type PluginFetchHeaders = Record<string, string> | Headers | Map<string, string> | Iterable<[string, string], void, undefined>;
/**
 * Options for {@link fetch} — a subset of `RequestInit` the host proxy supports.
 */
export type PluginFetchInit = {
    method?: string;
    headers?: PluginFetchHeaders;
    body?: string;
};
/**
 * Where a post was seen, passed to `post-context-menu` listeners.
 */
export type PostContextMenuMeta = {
    feedGenerator: Record<string, unknown> | null;
    feedContext: string | null;
    feedProxyUrl: string | null;
};
/**
 * What the composer is being opened for, passed to `post-composer-open` listeners.
 */
export type PostComposerContext = {
    kind: "post" | "reply" | "quote";
    replyTo: PostView | null;
    replyRoot: PostView | null;
    quotedPost: PostView | null;
};
/**
 * The events {@link Plugin.on} accepts, and the listener each one takes.
 */
export type PluginEventMap = {
    "post-context-menu": (menu: Menu, post: PostView, meta?: PostContextMenuMeta) => void;
    "profile-context-menu": (menu: Menu, profile: ProfileView) => void;
    "post-composer-open": (composer: Composer, context: PostComposerContext) => void;
};
/**
 * What a render callback may return: a tree to render, or nothing.
 */
export type RenderResult = VirtualEl | null | undefined;
/**
 * {@internal} The wire format of a {@link VirtualText} node.
 */
export type SerializedText = {
    type: "text";
    value: string;
};
/**
 * {@internal} The wire format of a {@link VirtualEl} node.
 */
export type SerializedElement = {
    type: "element";
    tag: string;
    attrs: Record<string, string>;
    events: Record<string, number>;
    children: SerializedNode[];
    styles?: Record<string, string>;
};
/**
 * {@internal} One node of the serialized tree the host renders and reconciles.
 */
export type SerializedNode = SerializedText | SerializedElement;
/**
 * An object whose values are all {@link Cloneable}.
 */
export type CloneableObject = {
    [key: string]: Cloneable;
};
/**
 * An array of {@link Cloneable} values.
 */
export type CloneableArray = Cloneable[];
/**
 * JSON-shaped data — the only thing that can cross between a plugin and the
 * host. Functions, class instances, `Date`, `Map` and friends cannot.
 */
export type Cloneable = null | undefined | boolean | number | string | CloneableArray | CloneableObject;
/**
 * {@internal}
 */
export type RegisterEventListenerMessage = {
    type: "register";
    target: "eventListener";
    event: string;
    handlerId: number;
};
/**
 * {@internal}
 */
export type RegisterSidebarItemMessage = {
    type: "register";
    target: "sidebarItem";
    icon: string | SerializedElement;
    title: string;
    handlerId: number;
};
/**
 * {@internal}
 */
export type RegisterSettingTabMessage = {
    type: "register";
    target: "settingTab";
    name: string | null;
    displayHandlerId: number;
};
/**
 * {@internal}
 */
export type RegisterFeedFilterMessage = {
    type: "register";
    target: "feedFilter";
    handlerId: number;
};
/**
 * {@internal}
 */
export type RegisterRichTextTransformMessage = {
    type: "register";
    target: "richTextTransform";
    handlerId: number;
    handlesFacetTypes: string[];
};
/**
 * {@internal}
 */
export type RegisterSlotMessage = {
    type: "register";
    target: "slot";
    name: string;
    handlerId: number;
    cacheKey: string[] | null;
    batch: true;
};
/**
 * {@internal}
 */
export type RegisterPageMessage = {
    type: "register";
    target: "page";
    id: string;
    title: string | null;
    displayHandlerId: number;
};
/**
 * {@internal} Announces an extension point this plugin provides.
 */
export type RegisterMessage = RegisterEventListenerMessage | RegisterSidebarItemMessage | RegisterSettingTabMessage | RegisterFeedFilterMessage | RegisterRichTextTransformMessage | RegisterSlotMessage | RegisterPageMessage;
/**
 * {@internal} Calls a host method. Without a `hostCallId` it is fire-and-forget.
 */
export type HostCallRequestMessage = {
    type: "hostCall";
    method: string;
    hostCallId?: number;
    args: Cloneable[];
};
/**
 * {@internal} Answers a {@link HostCallMessage}.
 */
export type CallResultMessage = {
    type: "result";
    callId: number;
    value?: unknown;
    error?: string;
};
/**
 * {@internal} Reports the outcome of plugin load.
 */
export type ReadyMessage = {
    type: "ready";
    error?: string;
};
/**
 * {@internal} Anything this worker may post to the host.
 */
export type WorkerMessage = RegisterMessage | HostCallRequestMessage | CallResultMessage | ReadyMessage;
/**
 * {@internal} The host invoking a handler this worker registered.
 */
export type HostCallMessage = {
    type: "call";
    callId: number;
    handlerId: number;
    args: Cloneable[];
};
/**
 * {@internal} The host answering a {@link hostCall}. Wider than
 * {@link Cloneable} because {@link SerializedFetchResponse} carries its
 * body as an `ArrayBuffer`, which structured clone handles but JSON
 * cannot.
 */
export type HostResultMessage = {
    type: "hostResult";
    hostCallId: number;
    value?: Cloneable | SerializedFetchResponse;
    error?: string;
};
/**
 * {@internal} An out-of-band notification from the host.
 */
export type HostEventMessage = {
    type: "event";
    event: "modalDismissed";
    data: {
        modalId: number;
    };
};
/**
 * {@internal} Anything the host may post to this worker.
 */
export type HostMessage = HostCallMessage | HostResultMessage | HostEventMessage;
/**
 * {@internal} The host's reply to a proxied {@link fetch}. `body` is
 * always the raw response bytes (see {@link PluginResponse}).
 */
export type SerializedFetchResponse = {
    status: number;
    ok: boolean;
    headers: Record<string, string>;
    body: ArrayBuffer;
};
/**
 * {@internal} A {@link PluginFetchInit} with its headers flattened for transfer.
 */
export type SerializedFetchInit = {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
};
/**
 * {@internal} A {@link RichTextToken} whose `inline`/`block` node, if any, has
 * been replaced by its serialized form.
 */
export type SerializedRichTextToken = Record<string, unknown>;
