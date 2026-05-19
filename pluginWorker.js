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

function addEventListener(event, listener) {
  let listeners = eventListeners.get(event);
  if (!listeners) {
    listeners = new Set();
    eventListeners.set(event, listeners);
    const handlerId = uuid.create();
    callHandlers.set(handlerId, async (...args) => {
      const menu = new Menu();
      for (const eventListener of listeners) {
        try {
          await eventListener(menu, ...args);
        } catch (error) {
          console.error(`"${event}" listener threw:`, error);
        }
      }
      return menu._serialize();
    });
    self.postMessage({
      type: "register",
      target: "eventListener",
      event,
      handlerId,
    });
  }
  listeners.add(listener);
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
      return { title: item.title, icon: item.icon, handlerId };
    });
  }
}

class App {
  constructor() {
    this.currentUser = null;
  }
  on(event, listener) {
    addEventListener(event, listener);
  }

  refreshFeedFilters(feedURI = null) {
    return hostCall("refreshFeedFilters", feedURI);
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
    queueMicrotask(() => {
      if (this._removed) return;
      hostCall("applyStyleSnippet", {
        snippetId: this._snippetId,
        cssText,
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
      icon,
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
  refresh() {
    return hostCall("refreshSettingTab");
  }
}

export class Setting {
  constructor(containerEl) {
    this.settingEl = containerEl.createDiv({ cls: "plugin-setting-item" });
    this.infoEl = this.settingEl.createDiv({ cls: "plugin-setting-item-info" });
    this.nameEl = this.infoEl.createDiv({ cls: "plugin-setting-item-name" });
    this.descEl = this.infoEl.createDiv({ cls: "plugin-setting-item-desc" });
    this.controlEl = this.settingEl.createDiv({
      cls: "plugin-setting-item-control",
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
      cls: "plugin-setting-text-input",
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

class ToggleComponent {
  constructor(containerEl) {
    this.el = containerEl.createEl("input", {
      attr: { type: "checkbox" },
      cls: "plugin-setting-toggle",
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
      cls: "plugin-setting-dropdown",
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
      cls: "plugin-setting-button",
    });
  }
  setButtonText(text) {
    this.el.setText(text);
    return this;
  }
  setCta() {
    this.el.addClass("primary-button");
    return this;
  }
  onClick(callback) {
    this.el.onClick(callback);
    return this;
  }
}

class VirtualEl {
  constructor(tag) {
    this.tag = tag;
    this.attrs = {};
    this.text = null;
    this.children = [];
    this.events = {};
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
    this.text = text;
    this.children = [];
    return this;
  }

  empty() {
    this.text = null;
    this.children = [];
    return this;
  }

  addClass(cls) {
    this.attrs.class = this.attrs.class ? `${this.attrs.class} ${cls}` : cls;
    return this;
  }

  setAttr(name, value) {
    this.attrs[name] = value;
    return this;
  }

  createEl(tag, options = {}, callback) {
    const child = new VirtualEl(tag);
    if (options.text != null) child.text = options.text;
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

  _serialize() {
    return {
      tag: this.tag,
      attrs: this.attrs,
      text: this.text,
      children: this.children.map((child) => child._serialize()),
      events: this.events,
    };
  }
}

self.addEventListener("message", async (event) => {
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
});
