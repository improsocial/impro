export class SimpleUUID {
  constructor() {
    this._id = 0;
  }
  create() {
    return this._id++;
  }
}

const uuid = new SimpleUUID();

const handlers = new Map();

let registered = false;

export class Plugin {
  constructor() {}

  addSidebarItem(icon, title, callback) {
    const handlerId = uuid.create();
    handlers.set(handlerId, callback);
    self.postMessage({
      type: "register",
      target: "sidebarItem",
      icon,
      title,
      handlerId,
    });
  }

  onload() {}
  onunload() {}

  static register() {
    if (registered) return;
    registered = true;
    const instance = new this();
    Promise.resolve()
      .then(() => instance.onload())
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
    handlers.set(handlerId, fn);
    this.events.click = handlerId;
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
    const fn = handlers.get(message.handlerId);
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

  // Notifications
  if (message.type === "notification") {
    switch (message.notificationType) {
      case "modalDismissed": {
        const modal = openModals.get(message.modalId);
        if (modal) {
          openModals.delete(message.modalId);
          modal.onClose();
        }
      }
    }
    return;
  }
});
