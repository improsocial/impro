export class SimpleUUID {
  constructor() {
    this._id = 0;
  }
  create() {
    return this._id++;
  }
}

const uuid = new SimpleUUID();

const callHandlers = new Map();

const pendingHostCalls = new Map();

function hostCall(method, ...args) {
  const hostCallId = uuid.create();
  return new Promise((resolve, reject) => {
    pendingHostCalls.set(hostCallId, { resolve, reject });
    self.postMessage({ type: "hostCall", method, hostCallId, args });
  });
}

const eventListeners = new Map();
const registeredEvents = new Set();

async function invokeListeners(listeners, event, args) {
  for (const listener of listeners) {
    try {
      await listener(...args);
    } catch (error) {
      console.error(`"${event}" listener threw:`, error);
    }
  }
}

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
    self.postMessage({
      type: "register",
      target: "eventListener",
      event,
      handlerId,
    });
  }
}

export class MenuItem {
  constructor() {
    this.title = "";
    this.icon = null;
    this._callback = () => {};
  }
  setTitle(title) {
    this.title = title;
    return this;
  }
  setIcon(icon) {
    this.icon = icon;
    return this;
  }
  onClick(callback) {
    this._callback = callback;
    return this;
  }
}

export class Menu {
  constructor() {
    this.items = [];
  }
  addItem(builder) {
    const item = new MenuItem();
    builder(item);
    this.items.push(item);
    return this;
  }
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

export class Composer {
  constructor() {
    this._ops = [];
    this._cursor = null;
  }
  setText(text) {
    this._ops.push({ op: "set", text: String(text) });
    return this;
  }
  appendText(text) {
    this._ops.push({ op: "append", text: String(text) });
    return this;
  }
  prependText(text) {
    this._ops.push({ op: "prepend", text: String(text) });
    return this;
  }
  setCursor(index) {
    this._cursor = index;
    return this;
  }
  _serialize() {
    return { ops: this._ops, cursor: this._cursor };
  }
}

class PluginData {
  getPost(uri) {
    return hostCall("getPost", { uri });
  }
  getProfile(did) {
    return hostCall("getProfile", { did });
  }
  // Like getProfile, but includes viewer relationship details not present
  // on the basic profile view: viewer.following, viewer.followedBy, and
  // viewer.knownFollowers (a summary of mutual followers).
  getDetailedProfile(did) {
    return hostCall("getDetailedProfile", { did });
  }
  // The full known-followers list for did (the summary on
  // getDetailedProfile's viewer.knownFollowers is capped to a handful).
  getKnownFollowers(did) {
    return hostCall("getKnownFollowers", { did });
  }
  getRecord(repo, collection, rkey) {
    return hostCall("getRecord", { repo, collection, rkey });
  }
  // Writes to the signed-in user's own repo only — there is no `repo`
  // parameter, unlike getRecord, since a plugin can never write to anyone
  // else's account. There's also no `collection` parameter: every
  // records-write plugin shares one fixed collection (requires
  // `permissions.records: ["write"]`, granted by the user at install time),
  // and the host rejects any rkey that already belongs to a different
  // plugin, so a plugin only ever needs to pick its own rkey.
  putRecord(rkey, record) {
    return hostCall("putRecord", { rkey, record });
  }
  deleteRecord(rkey) {
    return hostCall("deleteRecord", { rkey });
  }
  // Lists this plugin's own records in the shared collection — never
  // another plugin's, even though they live in the same collection; the
  // host filters by ownership before this ever reaches plugin code.
  // Requires permissions.records: ["write"], same as putRecord/deleteRecord.
  // Returns { cursor, records: [{uri, cid, value}] } — page through with
  // cursor until it comes back undefined/null.
  listRecords(cursor, limit) {
    return hostCall("listRecords", { cursor, limit });
  }
}

class App {
  constructor() {
    this.currentUser = null;
    this.data = new PluginData();
  }
  on(event, listener) {
    addEventListener(event, listener);
  }

  refreshFeedFilters(feedURI = null) {
    return hostCall("refreshFeedFilters", feedURI);
  }

  // Actions on behalf of the signed-in user. Each method requires the
  // corresponding scope ("mute", "block", "feedFeedback") to be declared in
  // the plugin manifest's `permissions.actions` array, which the user must
  // grant at install time.
  muteActor(did) {
    return hostCall("muteActor", { did, mute: true });
  }
  unmuteActor(did) {
    return hostCall("muteActor", { did, mute: false });
  }
  blockActor(did) {
    return hostCall("blockActor", { did, block: true });
  }
  unblockActor(did) {
    return hostCall("blockActor", { did, block: false });
  }
  // Acts like the user clicking "Show less like this": sends the requestLess
  // feedback signal to the feed that served the post and collapses the post
  // behind a feedback message in feeds.
  showLessLikeThis(postUri, feedUri) {
    return hostCall("showLessLikeThis", { postUri, feedUri });
  }
  showMoreLikeThis(postUri, feedUri) {
    return hostCall("showMoreLikeThis", { postUri, feedUri });
  }
}

export async function fetch(url, init = {}) {
  const result = await hostCall("fetch", {
    url,
    init: serializeFetchInit(init),
  });
  return new PluginResponse(result);
}

function serializeFetchInit(init) {
  const serialized = {};
  if (init.method != null) serialized.method = String(init.method);
  if (init.headers != null) {
    const headers = {};
    if (typeof init.headers.forEach === "function") {
      // Headers, Map, and similar iterables expose forEach(value, name)
      init.headers.forEach((value, name) => {
        headers[name] = value;
      });
    } else if (typeof init.headers[Symbol.iterator] === "function") {
      for (const [name, value] of init.headers) headers[name] = value;
    } else {
      Object.assign(headers, init.headers);
    }
    serialized.headers = headers;
  }
  if (init.body != null) serialized.body = init.body;
  return serialized;
}

class PluginResponse {
  constructor({ status, ok, headers, body }) {
    this.status = status;
    this.ok = ok;
    this.headers = new Map(Object.entries(headers ?? {}));
    this._body = body;
  }
  async text() {
    return this._body;
  }
  async json() {
    return JSON.parse(this._body);
  }
}

export class Notice {
  constructor(message, timeout = 0) {
    this._toastId = uuid.create();
    this._timeout = timeout;
    this._hidden = false;
    this.noticeEl = new VirtualEl("div");
    this.noticeEl.addClass("toast");
    this.noticeEl.setText(message);
    queueMicrotask(() => {
      if (this._hidden) return;
      hostCall("showToast", {
        toastId: this._toastId,
        element: this.noticeEl._serialize(),
        timeout: this._timeout,
      });
    });
  }
  setMessage(message) {
    this.noticeEl.setText(message);
    return this;
  }
  hide() {
    if (this._hidden) return;
    this._hidden = true;
    hostCall("hideToast", { toastId: this._toastId });
  }
}

export class StyleSnippet {
  constructor(cssText) {
    this._snippetId = uuid.create();
    this._removed = false;
    this.ready = new Promise((resolve, reject) => {
      queueMicrotask(() => {
        if (this._removed) return resolve();
        hostCall("applyStyleSnippet", {
          snippetId: this._snippetId,
          cssText,
        }).then(resolve, reject);
      });
    });
  }
  remove() {
    if (this._removed) return;
    this._removed = true;
    hostCall("removeStyleSnippet", { snippetId: this._snippetId });
  }
}

let registered = false;

export class Plugin {
  constructor() {
    this.app = new App();
  }

  addSidebarItem(icon, title, callback = () => {}) {
    const handlerId = uuid.create();
    callHandlers.set(handlerId, callback);
    self.postMessage({
      type: "register",
      target: "sidebarItem",
      icon: icon instanceof VirtualEl ? icon._serialize() : icon,
      title,
      handlerId,
    });
  }

  async loadData() {
    return hostCall("loadData");
  }

  async saveData(data) {
    await hostCall("saveData", { data });
  }

  // Device-local counterpart to loadData/saveData: never synced through the
  // user's account preferences, so it's the right place for anything that
  // shouldn't silently follow the plugin to another device (e.g. a locally
  // held secret key). Cleared on uninstall, same as loadData/saveData.
  async loadLocalData() {
    return hostCall("loadLocalData");
  }

  async saveLocalData(data) {
    await hostCall("saveLocalData", { data });
  }

  addSettingTab(tab) {
    tab.plugin = this;
    const displayHandlerId = uuid.create();
    callHandlers.set(displayHandlerId, () => {
      tab.containerEl = new VirtualEl("div");
      tab.display();
      return tab.containerEl._serialize();
    });
    self.postMessage({
      type: "register",
      target: "settingTab",
      name: tab.name ?? null,
      displayHandlerId,
    });
    this._settingTab = tab;
  }

  addFeedFilter(callback = () => {}) {
    const handlerId = uuid.create();
    callHandlers.set(handlerId, callback);
    self.postMessage({
      type: "register",
      target: "feedFilter",
      handlerId,
    });
  }

  // callback(tokens, context) receives the rich-text token stream for one
  // post and returns a new token array (or the input unchanged). The host
  // batches all posts of a render into one call per plugin.
  //
  // options.handlesFacetTypes: array of facet feature $type strings this
  // transform owns, to prevent render flash of fallback text
  registerRichTextTransform(callback = (tokens) => tokens, options = {}) {
    const handlerId = uuid.create();
    callHandlers.set(handlerId, async (batch) => {
      const results = [];
      for (const { tokens, context } of batch) {
        try {
          const value = await callback(tokens, context);
          results.push({ value: serializeTransformTokens(value) });
        } catch (error) {
          results.push({ error: error?.message ?? String(error) });
        }
      }
      return results;
    });
    const handlesFacetTypes = Array.isArray(options.handlesFacetTypes)
      ? options.handlesFacetTypes.filter((type) => typeof type === "string")
      : [];
    self.postMessage({
      type: "register",
      target: "richTextTransform",
      handlerId,
      handlesFacetTypes,
    });
  }

  registerSlot(name, callback = () => null) {
    const handlerId = uuid.create();
    callHandlers.set(handlerId, async (context) => {
      const result = await callback(context);
      if (result == null) return null;
      if (!(result instanceof VirtualEl)) {
        const description = result?.constructor?.name ?? typeof result;
        throw new Error(
          `Slot "${name}" must return a VirtualEl (or null), got ${description}`,
        );
      }
      return result._serialize();
    });
    self.postMessage({
      type: "register",
      target: "slot",
      name,
      handlerId,
    });
  }

  // Forces every mounted <plugin-slot name=...> to re-invoke its registered
  // plugins' callbacks (including other plugins' — the slot has no concept
  // of per-plugin refresh). Useful when a slot's content depends on data
  // that resolves asynchronously after the initial render.
  refreshSlot(name) {
    return hostCall("refreshSlot", { name });
  }

  onload() {}
  onunload() {}

  static register() {
    if (registered) return;
    registered = true;
    const instance = new this();
    hostCall("getCurrentUser")
      .then((user) => {
        instance.app.currentUser = user;
        return instance.onload();
      })
      .then(
        () => self.postMessage({ type: "ready" }),
        (error) =>
          self.postMessage({
            type: "ready",
            error: error?.message ?? String(error),
          }),
      );
  }
}

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

// Concatenates the renderable text of a token stream into a string with a position map,
// so a transform can pattern-match across token boundaries and map matches back to tokens.
export class FlattenedTokens {
  constructor(tokens) {
    this._segments = [];
    let text = "";
    for (const token of tokens) {
      let value = null;
      if (token.type === "text") value = token.value;
      else if (token.type === "facet") value = token.text;
      const start = text.length;
      if (value != null) text += value;
      this._segments.push({ token, start, end: text.length });
    }
    this.text = text;
  }

  // emit an inert range (no facets)
  textFor(start, end) {
    return this.text.slice(start, end);
  }

  // emit a live range, demoting partial facet tokens to text tokens
  tokensFor(start, end) {
    const out = [];
    for (const segment of this._segments) {
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

export function flattenForScan(tokens) {
  return new FlattenedTokens(tokens);
}

const openModals = new Map();

export class Modal {
  constructor() {
    this._modalId = uuid.create();
    this.contentEl = new VirtualEl("div");
    this.titleEl = new VirtualEl("h2");
  }

  open() {
    if (openModals.has(this._modalId)) return;
    openModals.set(this._modalId, this);
    this.onOpen();
    self.postMessage({
      type: "hostCall",
      method: "openModal",
      args: [
        {
          modalId: this._modalId,
          title: this.titleEl._serialize(),
          content: this.contentEl._serialize(),
        },
      ],
    });
  }

  close() {
    if (!openModals.has(this._modalId)) return;
    openModals.delete(this._modalId);
    self.postMessage({
      type: "hostCall",
      method: "closeModal",
      args: [{ modalId: this._modalId }],
    });
    this.onClose();
  }

  onOpen() {}
  onClose() {}
}

export class PluginSettingTab {
  constructor() {
    this.containerEl = new VirtualEl("div");
    this.name = null;
  }
  setName(name) {
    this.name = name;
    return this;
  }
  display() {}
  refresh({ reset = false } = {}) {
    return hostCall("refreshSettingTab", { reset });
  }
}

export class Setting {
  constructor(containerEl) {
    this.settingEl = containerEl.createDiv({ cls: "setting-item" });
    this.infoEl = this.settingEl.createDiv({ cls: "setting-item-info" });
    this.nameEl = this.infoEl.createEl("h2", { cls: "setting-item-name" });
    this.descEl = this.infoEl.createEl("p", { cls: "setting-item-desc" });
    this.controlEl = this.settingEl.createDiv({
      cls: "setting-item-control",
    });
  }
  setName(text) {
    this.nameEl.setText(text);
    return this;
  }
  setDesc(text) {
    this.descEl.setText(text);
    return this;
  }
  addText(callback) {
    const component = new TextComponent(this.controlEl);
    callback(component);
    return this;
  }
  addTextArea(callback) {
    const component = new TextAreaComponent(this.controlEl);
    callback(component);
    return this;
  }
  addToggle(callback) {
    const component = new ToggleComponent(this.controlEl);
    callback(component);
    return this;
  }
  addDropdown(callback) {
    const component = new DropdownComponent(this.controlEl);
    callback(component);
    return this;
  }
  addButton(callback) {
    const component = new ButtonComponent(this.controlEl);
    callback(component);
    return this;
  }
}

class TextComponent {
  constructor(containerEl) {
    this.el = containerEl.createEl("input", {
      attr: { type: "text" },
      cls: "setting-item-text-input",
    });
  }
  setValue(value) {
    this.el.setAttr("value", value == null ? "" : String(value));
    return this;
  }
  setPlaceholder(value) {
    this.el.setAttr("placeholder", value);
    return this;
  }
  onChange(callback) {
    this.el.onChange((event) => callback(event.target.value));
    return this;
  }
}

class TextAreaComponent {
  constructor(containerEl) {
    this.el = containerEl.createEl("textarea", {
      cls: "setting-item-textarea",
    });
  }
  setValue(value) {
    this.el.setText(value == null ? "" : String(value));
    return this;
  }
  setPlaceholder(value) {
    this.el.setAttr("placeholder", value);
    return this;
  }
  onChange(callback) {
    this.el.onChange((event) => callback(event.target.value));
    return this;
  }
}

class ToggleComponent {
  constructor(containerEl) {
    this.el = containerEl.createEl("toggle-switch", {
      cls: "setting-item-toggle",
    });
  }
  setValue(value) {
    if (value) this.el.setAttr("checked", "");
    else delete this.el.attrs.checked;
    return this;
  }
  onChange(callback) {
    this.el.onChange((event) => callback(event.target.checked));
    return this;
  }
}

class DropdownComponent {
  constructor(containerEl) {
    this.el = containerEl.createEl("select", {
      cls: "setting-item-dropdown",
    });
  }
  addOption(value, label) {
    this.el.createEl("option", { text: label, attr: { value } });
    return this;
  }
  addOptions(map) {
    for (const [value, label] of Object.entries(map)) {
      this.addOption(value, label);
    }
    return this;
  }
  setValue(value) {
    for (const child of this.el.children) {
      if (child.attrs?.value === value) {
        child.attrs.selected = "";
      } else if (child.attrs) {
        delete child.attrs.selected;
      }
    }
    return this;
  }
  onChange(callback) {
    this.el.onChange((event) => callback(event.target.value));
    return this;
  }
}

class ButtonComponent {
  constructor(containerEl) {
    this.el = containerEl.createEl("button", {
      cls: "rounded-button",
    });
  }
  setButtonText(text) {
    this.el.setText(text);
    return this;
  }
  setCta() {
    this.el.addClass("rounded-button-primary");
    return this;
  }
  onClick(callback) {
    this.el.onClick(callback);
    return this;
  }
}

class IconComponent {
  constructor(containerEl) {
    this.el = containerEl.createEl("plugin-icon");
  }
  setIcon(name) {
    this.el.setAttr("icon", name);
    return this;
  }
}

class BlobImageComponent {
  constructor(containerEl) {
    this.el = containerEl.createEl("plugin-blob-image");
  }
  setDid(did) {
    this.el.setAttr("did", did);
    return this;
  }
  setCid(cid) {
    this.el.setAttr("cid", cid);
    return this;
  }
  setAlt(alt) {
    this.el.setAttr("alt", alt);
    return this;
  }
  setCdnPrefix(prefix) {
    this.el.setAttr("cdn-prefix", prefix);
    return this;
  }
}

class ProfilesListComponent {
  constructor(containerEl) {
    this.el = containerEl.createEl("plugin-profiles-list");
  }
  setDids(dids) {
    const value = Array.isArray(dids) ? dids.join(",") : String(dids ?? "");
    this.el.setAttr("dids", value);
    return this;
  }
  setEmptyMessage(message) {
    this.el.setAttr("empty-message", message);
    return this;
  }
}

class PostsFeedComponent {
  constructor(containerEl) {
    this.el = containerEl.createEl("plugin-posts-feed");
  }
  setUris(uris) {
    const value = Array.isArray(uris) ? uris.join(",") : String(uris ?? "");
    this.el.setAttr("uris", value);
    return this;
  }
  setEmptyMessage(message) {
    this.el.setAttr("empty-message", message);
    return this;
  }
}

export class VirtualText {
  constructor(value) {
    this.value = value == null ? "" : String(value);
  }

  _serialize() {
    return { type: "text", value: this.value };
  }
}

export class VirtualEl {
  constructor(tag) {
    this.tag = tag;
    this.attrs = {};
    this.styles = {};
    this.children = [];
    this.events = {};
  }

  setStyle(name, value) {
    this.styles[String(name)] = value == null ? "" : String(value);
    return this;
  }

  onClick(fn) {
    const handlerId = uuid.create();
    callHandlers.set(handlerId, fn);
    this.events.click = handlerId;
    return this;
  }

  onChange(fn) {
    const handlerId = uuid.create();
    callHandlers.set(handlerId, fn);
    this.events.change = handlerId;
    return this;
  }

  onInput(fn) {
    const handlerId = uuid.create();
    callHandlers.set(handlerId, fn);
    this.events.input = handlerId;
    return this;
  }

  setText(text) {
    this.children = [];
    if (text != null && text !== "") this.children.push(new VirtualText(text));
    return this;
  }

  empty() {
    this.children = [];
    return this;
  }

  appendChild(child) {
    if (!(child instanceof VirtualEl) && !(child instanceof VirtualText)) {
      throw new TypeError(
        "appendChild expects a VirtualEl or VirtualText instance",
      );
    }
    this.children.push(child);
    return this;
  }

  appendText(value) {
    this.children.push(new VirtualText(value));
    return this;
  }

  createText(value) {
    const node = new VirtualText(value);
    this.children.push(node);
    return node;
  }

  addClass(cls) {
    this.attrs.class = this.attrs.class ? `${this.attrs.class} ${cls}` : cls;
    return this;
  }

  setAttr(name, value) {
    this.attrs[name] = value === undefined ? "" : value;
    return this;
  }

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

  createDiv(options = {}, callback) {
    return this.createEl("div", options, callback);
  }

  createSpan(options = {}, callback) {
    return this.createEl("span", options, callback);
  }

  createProfilesList(callback) {
    const component = new ProfilesListComponent(this);
    if (typeof callback === "function") callback(component);
    return component;
  }

  createPostsFeed(callback) {
    const component = new PostsFeedComponent(this);
    if (typeof callback === "function") callback(component);
    return component;
  }

  createIcon(callback) {
    const component = new IconComponent(this);
    if (typeof callback === "function") callback(component);
    return component;
  }

  createBlobImage(callback) {
    const component = new BlobImageComponent(this);
    if (typeof callback === "function") callback(component);
    return component;
  }

  _serialize() {
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

self.onmessage = async (event) => {
  const message = event.data;
  if (!message || typeof message !== "object") return;

  // RPC calls
  if (message.type === "call") {
    const fn = callHandlers.get(message.handlerId);
    if (!fn) {
      self.postMessage({
        type: "result",
        callId: message.callId,
        error: `unknown handler ${message.handlerId}`,
      });
      return;
    }
    try {
      const value = await fn(...message.args);
      self.postMessage({ type: "result", callId: message.callId, value });
    } catch (error) {
      self.postMessage({
        type: "result",
        callId: message.callId,
        error: error.message ?? String(error),
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
    return;
  }
};
