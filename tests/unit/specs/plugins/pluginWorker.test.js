import { describe, it } from "node:test";
import assert from "node:assert/strict";

// impro-plugin/main.js uses the worker global `self` for postMessage and assigns
// `self.onmessage` for incoming messages. We install a mock `self` BEFORE
// importing so the assigned handler is captured here.
const postedMessages = [];
let messageListener = null;

globalThis.self = {
  postMessage(message) {
    postedMessages.push(message);
  },
  set onmessage(listener) {
    messageListener = listener;
  },
  get onmessage() {
    return messageListener;
  },
};

const worker = await import("../../../../impro-plugin/main.js");
const {
  SimpleUUID,
  MenuItem,
  Menu,
  Notice,
  StyleSnippet,
  Plugin,
  Modal,
  PluginSettingTab,
  Setting,
  VirtualEl,
  fetch: pluginFetch,
  flattenForScan,
  FlattenedTokens,
} = worker;

function lastMessage() {
  return postedMessages[postedMessages.length - 1];
}

function clearMessages() {
  postedMessages.length = 0;
}

// Dispatches a message to the worker's registered listener.
function dispatch(data) {
  return messageListener({ data });
}

// Waits for queued microtasks to flush.
function flushMicrotasks() {
  return Promise.resolve().then(() => Promise.resolve());
}

describe("SimpleUUID", () => {
  it("returns sequential ids starting from 0", () => {
    const uuid = new SimpleUUID();
    assert.deepEqual(uuid.create(), 0);
    assert.deepEqual(uuid.create(), 1);
    assert.deepEqual(uuid.create(), 2);
  });
});

describe("MenuItem", () => {
  it("setters return the item for chaining and apply values", () => {
    const item = new MenuItem();
    const result = item
      .setTitle("Hello")
      .setIcon("star")
      .onClick(() => 42);
    assert(result === item, "chained setters should return the item");
    assert.deepEqual(item.title, "Hello");
    assert.deepEqual(item.icon, "star");
    assert.deepEqual(item._callback(), 42);
  });

  it("has sensible defaults", () => {
    const item = new MenuItem();
    assert.deepEqual(item.title, "");
    assert.deepEqual(item.icon, null);
    // Default callback is a no-op that returns undefined.
    assert.deepEqual(item._callback(), undefined);
  });
});

describe("Menu", () => {
  it("addItem invokes the builder and serializes items with handlerIds", () => {
    const menu = new Menu();
    menu.addItem((item) => item.setTitle("One").setIcon("a"));
    menu.addItem((item) => item.setTitle("Two"));
    const serialized = menu._serialize();
    assert.deepEqual(serialized.length, 2);
    assert.deepEqual(serialized[0].title, "One");
    assert.deepEqual(serialized[0].icon, "a");
    assert.deepEqual(serialized[1].title, "Two");
    assert.deepEqual(serialized[1].icon, null);
    assert(
      typeof serialized[0].handlerId === "number",
      "each item gets a numeric handlerId",
    );
    assert(
      serialized[0].handlerId !== serialized[1].handlerId,
      "handlerIds are unique",
    );
  });
});

describe("VirtualEl (via Setting & friends)", () => {
  it("setText replaces content and createEl appends children with attrs", () => {
    const container = new Setting(
      new (class {
        createDiv(options) {
          // delegate to a real VirtualEl via plugin worker's serialize chain:
          // build a minimal VirtualEl by constructing a Plugin's settingTab.
          return makeVirtualEl().createDiv(options);
        }
      })(),
    );
    // Use the Setting's name/desc/control to exercise VirtualEl indirectly.
    container.setName("Hello").setDesc("World");
    const serialized = container.settingEl._serialize();
    assert.deepEqual(serialized.tag, "div");
    // settingEl has info + control children
    assert.deepEqual(serialized.children.length, 2);
    const info = serialized.children[0];
    assert.deepEqual(info.attrs.class, "setting-item-info");
    assert.deepEqual(info.children[0].children[0], {
      type: "text",
      value: "Hello",
    });
    assert.deepEqual(info.children[1].children[0], {
      type: "text",
      value: "World",
    });
  });

  it("addClass concatenates classes and setAttr stores attributes", () => {
    const el = makeVirtualEl();
    el.addClass("a").addClass("b").setAttr("data-x", "1");
    const serialized = el._serialize();
    assert.deepEqual(serialized.attrs.class, "a b");
    assert.deepEqual(serialized.attrs["data-x"], "1");
  });

  it("setAttr with an omitted value still sets the attribute as an empty string", () => {
    const el = makeVirtualEl();
    el.setAttr("disabled");
    const serialized = el._serialize();
    assert.deepEqual(serialized.attrs.disabled, "");
  });

  it("empty() clears children", () => {
    const el = makeVirtualEl();
    el.createDiv({ text: "child" });
    el.setText("hi");
    el.empty();
    const serialized = el._serialize();
    assert.deepEqual(serialized.children, []);
    assert(!("text" in serialized));
  });

  it("setText appends a single text child, and skips empty/null values", () => {
    const el = makeVirtualEl();
    el.setText("hi");
    assert.deepEqual(el._serialize().children, [{ type: "text", value: "hi" }]);
    el.setText("");
    assert.deepEqual(el._serialize().children, []);
    el.setText(null);
    assert.deepEqual(el._serialize().children, []);
  });

  it("appendText and createText add ordered text nodes", () => {
    const el = makeVirtualEl();
    el.appendText("before ");
    el.createEl("em", { text: "middle" });
    const tail = el.createText(" after");
    assert.deepEqual(el._serialize().children, [
      { type: "text", value: "before " },
      {
        type: "element",
        tag: "em",
        attrs: {},
        events: {},
        children: [{ type: "text", value: "middle" }],
      },
      { type: "text", value: " after" },
    ]);
    assert.deepEqual(tail._serialize(), { type: "text", value: " after" });
  });

  it("setStyle is chainable and serializes a distinct styles field", () => {
    const el = makeVirtualEl();
    const result = el
      .setStyle("height", "0.68333em")
      .setStyle("vertical-align", "-0.08333em");
    assert(result === el);
    const serialized = el._serialize();
    assert.deepEqual(serialized.styles, {
      height: "0.68333em",
      "vertical-align": "-0.08333em",
    });
    assert(!("style" in serialized.attrs));
  });

  it("omits the styles field when no styles are set", () => {
    const el = makeVirtualEl();
    const serialized = el._serialize();
    assert(!("styles" in serialized));
  });

  it("setStyle coerces numeric values to strings", () => {
    const el = makeVirtualEl();
    el.setStyle("z-index", 3);
    assert.deepEqual(el._serialize().styles, { "z-index": "3" });
  });

  it("appendChild rejects values that are not VirtualEl or VirtualText", () => {
    const el = makeVirtualEl();
    assert.throws(() => el.appendChild({ tag: "div" }), TypeError);
  });

  it("createEl supports text, cls (string or array), and attr options", () => {
    const el = makeVirtualEl();
    el.createEl("span", { text: "x", cls: ["one", "two"], attr: { id: "z" } });
    const serialized = el._serialize();
    assert.deepEqual(serialized.children[0].tag, "span");
    assert.deepEqual(serialized.children[0].children[0], {
      type: "text",
      value: "x",
    });
    assert.deepEqual(serialized.children[0].attrs.class, "one two");
    assert.deepEqual(serialized.children[0].attrs.id, "z");
  });

  it("event handlers register a handlerId in the events map", () => {
    const el = makeVirtualEl();
    el.onClick(() => {});
    el.onChange(() => {});
    el.onInput(() => {});
    const serialized = el._serialize();
    assert(typeof serialized.events.click === "number");
    assert(typeof serialized.events.change === "number");
    assert(typeof serialized.events.input === "number");
  });
});

// Helper: create a VirtualEl by leveraging Modal.contentEl (which is a VirtualEl).
function makeVirtualEl() {
  return new Modal().contentEl;
}

describe("Plugin sidebar/feedFilter registration", () => {
  it("addSidebarItem posts a register message with title and icon", () => {
    clearMessages();
    const plugin = new Plugin();
    plugin.addSidebarItem("⭐", "Stars", () => {});
    const msg = lastMessage();
    assert.deepEqual(msg.type, "register");
    assert.deepEqual(msg.target, "sidebarItem");
    assert.deepEqual(msg.icon, "⭐");
    assert.deepEqual(msg.title, "Stars");
    assert(typeof msg.handlerId === "number");
  });

  it("addFeedFilter posts a register message", () => {
    clearMessages();
    const plugin = new Plugin();
    plugin.addFeedFilter(() => true);
    const msg = lastMessage();
    assert.deepEqual(msg.type, "register");
    assert.deepEqual(msg.target, "feedFilter");
    assert(typeof msg.handlerId === "number");
  });

  it("registerSlot posts a register message with the slot name", () => {
    clearMessages();
    const plugin = new Plugin();
    plugin.registerSlot("post-thread-view:after-main", () => null);
    const msg = lastMessage();
    assert.deepEqual(msg.type, "register");
    assert.deepEqual(msg.target, "slot");
    assert.deepEqual(msg.name, "post-thread-view:after-main");
    assert(typeof msg.handlerId === "number");
  });

  it("registerSlot serializes the returned VirtualEl when invoked", async () => {
    clearMessages();
    const plugin = new Plugin();
    let received = null;
    plugin.registerSlot("slot:demo", (context) => {
      received = context;
      const el = new VirtualEl("div");
      el.addClass("hello");
      el.setText("world");
      return el;
    });
    const register = lastMessage();
    clearMessages();
    await dispatch({
      type: "call",
      handlerId: register.handlerId,
      callId: 42,
      args: [{ uri: "at://example" }],
    });
    assert.deepEqual(received, { uri: "at://example" });
    const result = postedMessages.find((message) => message.type === "result");
    assert.deepEqual(result.callId, 42);
    assert.deepEqual(result.value.tag, "div");
    assert.deepEqual(result.value.attrs.class, "hello");
    assert.deepEqual(result.value.children[0], {
      type: "text",
      value: "world",
    });
  });

  it("registerSlot returns null when the callback returns null", async () => {
    clearMessages();
    const plugin = new Plugin();
    plugin.registerSlot("slot:nullable", () => null);
    const register = lastMessage();
    clearMessages();
    await dispatch({
      type: "call",
      handlerId: register.handlerId,
      callId: 1,
      args: [{}],
    });
    const result = postedMessages.find((message) => message.type === "result");
    assert.deepEqual(result.value, null);
  });

  it("registerSlot rejects non-VirtualEl return values", async () => {
    clearMessages();
    const plugin = new Plugin();
    plugin.registerSlot("slot:bad", () => "not a node");
    const register = lastMessage();
    clearMessages();
    await dispatch({
      type: "call",
      handlerId: register.handlerId,
      callId: 1,
      args: [{}],
    });
    const result = postedMessages.find((message) => message.type === "result");
    assert(/must return a VirtualEl/.test(result.error));
  });

  it("addSettingTab posts a register message and remembers the tab", () => {
    clearMessages();
    const plugin = new Plugin();
    const tab = new PluginSettingTab().setName("Prefs");
    plugin.addSettingTab(tab);
    const msg = lastMessage();
    assert.deepEqual(msg.type, "register");
    assert.deepEqual(msg.target, "settingTab");
    assert.deepEqual(msg.name, "Prefs");
    assert(tab.plugin === plugin, "tab.plugin is set to its owning plugin");
  });
});

describe("hostCall round-trip", () => {
  it("loadData posts a hostCall and resolves with the host result", async () => {
    clearMessages();
    const plugin = new Plugin();
    const promise = plugin.loadData();
    const sent = lastMessage();
    assert.deepEqual(sent.type, "hostCall");
    assert.deepEqual(sent.method, "loadData");
    assert(typeof sent.hostCallId === "number");
    dispatch({
      type: "hostResult",
      hostCallId: sent.hostCallId,
      value: { foo: 1 },
    });
    assert.deepEqual(await promise, { foo: 1 });
  });

  it("rejects when host returns an error", async () => {
    clearMessages();
    const plugin = new Plugin();
    const promise = plugin.saveData({ a: 1 });
    const sent = lastMessage();
    assert.deepEqual(sent.method, "saveData");
    assert.deepEqual(sent.args[0], { data: { a: 1 } });
    dispatch({
      type: "hostResult",
      hostCallId: sent.hostCallId,
      error: "nope",
    });
    let caught = null;
    try {
      await promise;
    } catch (error) {
      caught = error;
    }
    assert(caught instanceof Error && caught.message === "nope");
  });

  it("app.refreshFeedFilters forwards feedURI in args", () => {
    clearMessages();
    const plugin = new Plugin();
    plugin.app.refreshFeedFilters("at://example/feed");
    const sent = lastMessage();
    assert.deepEqual(sent.method, "refreshFeedFilters");
    assert.deepEqual(sent.args[0], "at://example/feed");
  });

  it("app mute and block methods post hostCalls with the direction flag", async () => {
    clearMessages();
    const plugin = new Plugin();
    const did = "did:plc:target";

    plugin.app.muteActor(did);
    assert.deepEqual(lastMessage().method, "muteActor");
    assert.deepEqual(lastMessage().args[0], { did, mute: true });

    plugin.app.unmuteActor(did);
    assert.deepEqual(lastMessage().method, "muteActor");
    assert.deepEqual(lastMessage().args[0], { did, mute: false });

    plugin.app.blockActor(did);
    assert.deepEqual(lastMessage().method, "blockActor");
    assert.deepEqual(lastMessage().args[0], { did, block: true });

    plugin.app.unblockActor(did);
    assert.deepEqual(lastMessage().method, "blockActor");
    assert.deepEqual(lastMessage().args[0], { did, block: false });
  });

  it("app feedback methods post hostCalls with postUri and feedUri", async () => {
    clearMessages();
    const plugin = new Plugin();
    const postUri = "at://example/post/1";
    const feedUri = "at://example/feed/cool";

    plugin.app.showLessLikeThis(postUri, feedUri);
    assert.deepEqual(lastMessage().method, "showLessLikeThis");
    assert.deepEqual(lastMessage().args[0], { postUri, feedUri });

    plugin.app.showMoreLikeThis(postUri, feedUri);
    assert.deepEqual(lastMessage().method, "showMoreLikeThis");
    assert.deepEqual(lastMessage().args[0], { postUri, feedUri });
  });

  it("app.data.getPost posts a hostCall and resolves with the host result", async () => {
    clearMessages();
    const plugin = new Plugin();
    const promise = plugin.app.data.getPost("at://example/post/1");
    const sent = lastMessage();
    assert.deepEqual(sent.type, "hostCall");
    assert.deepEqual(sent.method, "getPost");
    assert.deepEqual(sent.args[0], { uri: "at://example/post/1" });
    assert(typeof sent.hostCallId === "number");
    dispatch({
      type: "hostResult",
      hostCallId: sent.hostCallId,
      value: { uri: "at://example/post/1", record: { text: "hi" } },
    });
    assert.deepEqual(await promise, {
      uri: "at://example/post/1",
      record: { text: "hi" },
    });
  });

  it("app.data.getPost resolves with null when host returns null", async () => {
    clearMessages();
    const plugin = new Plugin();
    const promise = plugin.app.data.getPost("at://missing");
    const sent = lastMessage();
    dispatch({
      type: "hostResult",
      hostCallId: sent.hostCallId,
      value: null,
    });
    assert.deepEqual(await promise, null);
  });

  it("app.data.getProfile posts a hostCall and resolves with the host result", async () => {
    clearMessages();
    const plugin = new Plugin();
    const promise = plugin.app.data.getProfile("did:plc:abc");
    const sent = lastMessage();
    assert.deepEqual(sent.type, "hostCall");
    assert.deepEqual(sent.method, "getProfile");
    assert.deepEqual(sent.args[0], { did: "did:plc:abc" });
    dispatch({
      type: "hostResult",
      hostCallId: sent.hostCallId,
      value: { did: "did:plc:abc", handle: "alice.test" },
    });
    assert.deepEqual(await promise, {
      did: "did:plc:abc",
      handle: "alice.test",
    });
  });
});

describe("Notice", () => {
  it("posts a showToast hostCall on next microtask", async () => {
    clearMessages();
    new Notice("Saved!", 1000);
    await flushMicrotasks();
    const sent = postedMessages.find(
      (message) => message.method === "showToast",
    );
    assert(sent, "expected a showToast hostCall");
    assert.deepEqual(sent.args[0].timeout, 1000);
    assert.deepEqual(sent.args[0].element.tag, "div");
    assert.deepEqual(sent.args[0].element.children[0], {
      type: "text",
      value: "Saved!",
    });
  });

  it("hide() before the microtask suppresses the showToast", async () => {
    clearMessages();
    const notice = new Notice("Temp");
    notice.hide();
    await flushMicrotasks();
    const showToast = postedMessages.find(
      (message) => message.method === "showToast",
    );
    assert(
      !showToast,
      "showToast should not be sent when hidden synchronously",
    );
  });

  it("hide() after display posts hideToast exactly once", async () => {
    clearMessages();
    const notice = new Notice("Hello");
    await flushMicrotasks();
    notice.hide();
    notice.hide(); // second call is a no-op
    const hideCalls = postedMessages.filter(
      (message) => message.method === "hideToast",
    );
    assert.deepEqual(hideCalls.length, 1);
  });
});

describe("StyleSnippet", () => {
  it("posts applyStyleSnippet on next microtask", async () => {
    clearMessages();
    new StyleSnippet(".x { color: red; }");
    await flushMicrotasks();
    const sent = postedMessages.find(
      (message) => message.method === "applyStyleSnippet",
    );
    assert(sent, "expected applyStyleSnippet hostCall");
    assert.deepEqual(sent.args[0].cssText, ".x { color: red; }");
  });

  it("remove() before microtask cancels apply", async () => {
    clearMessages();
    const snippet = new StyleSnippet(".y { }");
    snippet.remove();
    await flushMicrotasks();
    const apply = postedMessages.find(
      (message) => message.method === "applyStyleSnippet",
    );
    assert(!apply, "apply should be suppressed");
  });

  it("remove() after apply posts removeStyleSnippet once", async () => {
    clearMessages();
    const snippet = new StyleSnippet(".z {}");
    await flushMicrotasks();
    snippet.remove();
    snippet.remove();
    const removes = postedMessages.filter(
      (message) => message.method === "removeStyleSnippet",
    );
    assert.deepEqual(removes.length, 1);
  });
});

describe("Modal", () => {
  it("open() posts openModal hostCall and invokes onOpen", () => {
    clearMessages();
    const modal = new Modal();
    modal.titleEl.setText("Title");
    modal.contentEl.setText("Body");
    let opened = false;
    modal.onOpen = () => {
      opened = true;
    };
    modal.open();
    assert(opened, "onOpen should fire");
    const sent = lastMessage();
    assert.deepEqual(sent.type, "hostCall");
    assert.deepEqual(sent.method, "openModal");
    assert.deepEqual(sent.args[0].title.children[0], {
      type: "text",
      value: "Title",
    });
    assert.deepEqual(sent.args[0].content.children[0], {
      type: "text",
      value: "Body",
    });
  });

  it("calling open() twice only sends one openModal", () => {
    clearMessages();
    const modal = new Modal();
    modal.open();
    modal.open();
    const opens = postedMessages.filter(
      (message) => message.method === "openModal",
    );
    assert.deepEqual(opens.length, 1);
  });

  it("update() posts updateModal with the current title and content", () => {
    const modal = new Modal();
    modal.titleEl.setText("Title");
    modal.contentEl.setText("Before");
    modal.open();
    clearMessages();
    modal.contentEl.setText("After");
    modal.update();
    const sent = lastMessage();
    assert.deepEqual(sent.type, "hostCall");
    assert.deepEqual(sent.method, "updateModal");
    assert.deepEqual(sent.args[0].modalId, modal._modalId);
    assert.deepEqual(sent.args[0].content.children[0], {
      type: "text",
      value: "After",
    });
  });

  it("update() before open posts nothing", () => {
    clearMessages();
    const modal = new Modal();
    modal.contentEl.setText("Body");
    modal.update();
    const updates = postedMessages.filter(
      (message) => message.method === "updateModal",
    );
    assert.deepEqual(updates.length, 0);
  });

  it("close() posts closeModal and invokes onClose", () => {
    const modal = new Modal();
    modal.open();
    clearMessages();
    let closed = false;
    modal.onClose = () => {
      closed = true;
    };
    modal.close();
    assert(closed, "onClose should fire");
    assert.deepEqual(lastMessage().method, "closeModal");
  });

  it("modalDismissed event closes the modal and fires onClose", () => {
    const modal = new Modal();
    let closed = false;
    modal.onClose = () => {
      closed = true;
    };
    modal.open();
    const modalId = modal._modalId;
    dispatch({ type: "event", event: "modalDismissed", data: { modalId } });
    assert(closed, "onClose fires when host dismisses the modal");
  });
});

describe("message dispatch — call handlers", () => {
  it("invokes a registered handler and posts the result", async () => {
    clearMessages();
    const plugin = new Plugin();
    let receivedArgs = null;
    plugin.addSidebarItem("i", "t", (...args) => {
      receivedArgs = args;
      return "ok";
    });
    const register = lastMessage();
    clearMessages();
    await dispatch({
      type: "call",
      handlerId: register.handlerId,
      callId: 99,
      args: [1, 2],
    });
    assert.deepEqual(receivedArgs, [1, 2]);
    const result = postedMessages.find((message) => message.type === "result");
    assert.deepEqual(result.callId, 99);
    assert.deepEqual(result.value, "ok");
  });

  it("reports unknown handlerIds via the result message", async () => {
    clearMessages();
    await dispatch({
      type: "call",
      handlerId: 999999,
      callId: 7,
      args: [],
    });
    const result = postedMessages.find((message) => message.type === "result");
    assert.deepEqual(result.callId, 7);
    assert(/unknown handler/.test(result.error));
  });

  it("captures handler errors and forwards them as result.error", async () => {
    clearMessages();
    const plugin = new Plugin();
    plugin.addSidebarItem("i", "t", () => {
      throw new Error("boom");
    });
    const register = lastMessage();
    clearMessages();
    await dispatch({
      type: "call",
      handlerId: register.handlerId,
      callId: 5,
      args: [],
    });
    const result = postedMessages.find((message) => message.type === "result");
    assert.deepEqual(result.error, "boom");
  });
});

describe("app.on event listeners", () => {
  it("registers an eventListener target and returns serialized menu items", async () => {
    clearMessages();
    const plugin = new Plugin();
    plugin.app.on("post-context-menu", (menu, post) => {
      menu.addItem((item) =>
        item.setTitle(`Open ${post.id}`).onClick(() => {}),
      );
    });
    const register = postedMessages.find(
      (message) =>
        message.type === "register" && message.target === "eventListener",
    );
    assert(register, "an eventListener register message should be posted");
    assert.deepEqual(register.event, "post-context-menu");

    clearMessages();
    await dispatch({
      type: "call",
      handlerId: register.handlerId,
      callId: 1,
      args: [{ id: 42 }],
    });
    const result = postedMessages.find((message) => message.type === "result");
    assert.deepEqual(result.value.length, 1);
    assert.deepEqual(result.value[0].title, "Open 42");
  });

  it("warns when an event with no dispatch case is invoked", async () => {
    clearMessages();
    const plugin = new Plugin();
    plugin.app.on("totally-unknown-event", () => {});
    const register = postedMessages.find(
      (message) =>
        message.type === "register" && message.target === "eventListener",
    );
    assert(register, "registration should still happen for unknown events");

    clearMessages();
    const originalWarn = console.warn;
    let warned = null;
    console.warn = (...args) => {
      warned = args.join(" ");
    };
    try {
      await dispatch({
        type: "call",
        handlerId: register.handlerId,
        callId: 1,
        args: [],
      });
    } finally {
      console.warn = originalWarn;
    }
    assert(
      warned && warned.includes("totally-unknown-event"),
      "should warn at dispatch time",
    );
    const result = postedMessages.find((message) => message.type === "result");
    assert.deepEqual(result.value, null);
  });
});

describe("PluginSettingTab.refresh", () => {
  it("posts a refreshSettingTab hostCall defaulting reset to false", () => {
    clearMessages();
    const tab = new PluginSettingTab();
    tab.refresh();
    const sent = lastMessage();
    assert.deepEqual(sent.type, "hostCall");
    assert.deepEqual(sent.method, "refreshSettingTab");
    assert.deepEqual(sent.args[0].reset, false);
  });

  it("forwards reset: true when requested", () => {
    clearMessages();
    const tab = new PluginSettingTab();
    tab.refresh({ reset: true });
    const sent = lastMessage();
    assert.deepEqual(sent.method, "refreshSettingTab");
    assert.deepEqual(sent.args[0].reset, true);
  });
});

describe("Setting components", () => {
  it("addText creates a text input with placeholder and value", () => {
    const container = makeVirtualEl();
    const setting = new Setting(container);
    setting.addText((text) => text.setValue("hello").setPlaceholder("type…"));
    const input = setting.controlEl.children[0];
    assert.deepEqual(input.tag, "input");
    assert.deepEqual(input.attrs.type, "text");
    assert.deepEqual(input.attrs.value, "hello");
    assert.deepEqual(input.attrs.placeholder, "type…");
  });

  it("addToggle reflects checked state on setValue", () => {
    const container = makeVirtualEl();
    const setting = new Setting(container);
    setting.addToggle((toggle) => toggle.setValue(true));
    let toggle = setting.controlEl.children[0];
    assert.deepEqual(toggle.tag, "toggle-switch");
    assert("checked" in toggle.attrs);

    const setting2 = new Setting(makeVirtualEl());
    setting2.addToggle((toggle) => toggle.setValue(true).setValue(false));
    toggle = setting2.controlEl.children[0];
    assert(!("checked" in toggle.attrs));
  });

  it("addDropdown adds options and marks selected value", () => {
    const container = makeVirtualEl();
    const setting = new Setting(container);
    setting.addDropdown((dropdown) =>
      dropdown.addOptions({ a: "Alpha", b: "Beta" }).setValue("b"),
    );
    const select = setting.controlEl.children[0];
    assert.deepEqual(select.children.length, 2);
    assert.deepEqual(select.children[0].attrs.value, "a");
    assert(!("selected" in select.children[0].attrs));
    assert("selected" in select.children[1].attrs);
  });

  it("addButton sets text and CTA class", () => {
    const container = makeVirtualEl();
    const setting = new Setting(container);
    setting.addButton((button) =>
      button
        .setButtonText("Save")
        .setCta()
        .onClick(() => {}),
    );
    const button = setting.controlEl.children[0];
    assert.deepEqual(button.tag, "button");
    assert.deepEqual(button.children[0]._serialize(), {
      type: "text",
      value: "Save",
    });
    assert(button.attrs.class.includes("rounded-button-primary"));
    assert(typeof button.events.click === "number");
  });

  it("createProfilesList builds a plugin-profiles-list with array dids", () => {
    const container = makeVirtualEl();
    container.createProfilesList((list) =>
      list
        .setDids(["did:plc:a", "did:plc:b"])
        .setEmptyMessage("No one here yet."),
    );
    const child = container.children[0]._serialize();
    assert.deepEqual(child.tag, "plugin-profiles-list");
    assert.deepEqual(child.attrs.dids, "did:plc:a,did:plc:b");
    assert.deepEqual(child.attrs["empty-message"], "No one here yet.");
  });

  it("createIcon builds a plugin-icon with the given name", () => {
    const container = makeVirtualEl();
    container.createIcon((icon) => icon.setIcon("alert-circle"));
    const child = container.children[0]._serialize();
    assert.deepEqual(child.tag, "plugin-icon");
    assert.deepEqual(child.attrs.icon, "alert-circle");
  });

  it("createProfilesList accepts a pre-joined string of dids", () => {
    const container = makeVirtualEl();
    container.createProfilesList((list) => list.setDids("did:plc:a,did:plc:b"));
    const child = container.children[0]._serialize();
    assert.deepEqual(child.attrs.dids, "did:plc:a,did:plc:b");
  });

  it("createPostsFeed builds a plugin-posts-feed with array uris", () => {
    const container = makeVirtualEl();
    container.createPostsFeed((feed) =>
      feed
        .setUris([
          "at://did:plc:a/app.bsky.feed.post/1",
          "at://did:plc:b/app.bsky.feed.post/2",
        ])
        .setEmptyMessage("Nothing to show."),
    );
    const child = container.children[0]._serialize();
    assert.deepEqual(child.tag, "plugin-posts-feed");
    assert.deepEqual(
      child.attrs.uris,
      "at://did:plc:a/app.bsky.feed.post/1,at://did:plc:b/app.bsky.feed.post/2",
    );
    assert.deepEqual(child.attrs["empty-message"], "Nothing to show.");
  });

  it("createPostsFeed accepts a pre-joined string of uris", () => {
    const container = makeVirtualEl();
    container.createPostsFeed((feed) =>
      feed.setUris("at://did:plc:a/app.bsky.feed.post/1"),
    );
    const child = container.children[0]._serialize();
    assert.deepEqual(child.attrs.uris, "at://did:plc:a/app.bsky.feed.post/1");
  });

  it("createBlobImage builds a plugin-blob-image with did/cid/alt/cdn-prefix", () => {
    const container = makeVirtualEl();
    container.createBlobImage((image) =>
      image
        .setDid("did:plc:abc")
        .setCid("bafkreiabcdefghijklmnopqrstuvwxyz234567")
        .setAlt("A cat")
        .setCdnPrefix("avatar"),
    );
    const child = container.children[0]._serialize();
    assert.deepEqual(child.tag, "plugin-blob-image");
    assert.deepEqual(child.attrs.did, "did:plc:abc");
    assert.deepEqual(
      child.attrs.cid,
      "bafkreiabcdefghijklmnopqrstuvwxyz234567",
    );
    assert.deepEqual(child.attrs.alt, "A cat");
    assert.deepEqual(child.attrs["cdn-prefix"], "avatar");
  });
});

describe("fetch — header serialization", () => {
  function findFetchCall() {
    return postedMessages.find(
      (message) => message.type === "hostCall" && message.method === "fetch",
    );
  }

  it("serializes a plain-object headers init", () => {
    clearMessages();
    pluginFetch("https://example.com/", {
      method: "POST",
      headers: { "X-Foo": "bar", "X-Baz": "qux" },
      body: "hi",
    });
    const sent = findFetchCall();
    assert.deepEqual(sent.args[0].url, "https://example.com/");
    assert.deepEqual(sent.args[0].init.method, "POST");
    assert.deepEqual(sent.args[0].init.headers, {
      "X-Foo": "bar",
      "X-Baz": "qux",
    });
    assert.deepEqual(sent.args[0].init.body, "hi");
  });

  it("serializes a Map headers init via forEach(value, name)", () => {
    clearMessages();
    const headers = new Map([
      ["X-One", "1"],
      ["X-Two", "2"],
    ]);
    pluginFetch("https://example.com/", { headers });
    const sent = findFetchCall();
    assert.deepEqual(sent.args[0].init.headers, { "X-One": "1", "X-Two": "2" });
  });

  it("serializes a Headers-like object that only exposes forEach", () => {
    clearMessages();
    const headers = {
      forEach(callback) {
        callback("application/json", "content-type");
        callback("Bearer token", "authorization");
      },
    };
    pluginFetch("https://example.com/", { headers });
    const sent = findFetchCall();
    assert.deepEqual(sent.args[0].init.headers, {
      "content-type": "application/json",
      authorization: "Bearer token",
    });
  });

  it("falls back to Symbol.iterator entries when forEach is absent", () => {
    clearMessages();
    const headers = {
      *[Symbol.iterator]() {
        yield ["X-Iter", "1"];
        yield ["X-Iter-2", "2"];
      },
    };
    pluginFetch("https://example.com/", { headers });
    const sent = findFetchCall();
    assert.deepEqual(sent.args[0].init.headers, {
      "X-Iter": "1",
      "X-Iter-2": "2",
    });
  });

  it("omits headers from the serialized init when not provided", () => {
    clearMessages();
    pluginFetch("https://example.com/", { method: "GET" });
    const sent = findFetchCall();
    assert(
      !("headers" in sent.args[0].init),
      "headers should be omitted when init.headers is null",
    );
  });
});

describe("registerRichTextTransform", () => {
  it("posts a register message", () => {
    clearMessages();
    const plugin = new Plugin();
    plugin.registerRichTextTransform((tokens) => tokens);
    const msg = lastMessage();
    assert.deepEqual(msg.type, "register");
    assert.deepEqual(msg.target, "richTextTransform");
    assert(typeof msg.handlerId === "number");
  });

  it("maps a batch through the callback and serializes VirtualEl nodes", async () => {
    clearMessages();
    const plugin = new Plugin();
    plugin.registerRichTextTransform((tokens, context) => {
      if (context.surface === "smallPost") return tokens;
      const node = new VirtualEl("code");
      node.setText("hi");
      return [...tokens, { type: "inline", node }];
    });
    const register = lastMessage();
    clearMessages();
    const batch = [
      {
        tokens: [{ type: "text", value: "one" }],
        context: { surface: "largePost" },
      },
      {
        tokens: [{ type: "text", value: "two" }],
        context: { surface: "smallPost" },
      },
    ];
    await dispatch({
      type: "call",
      handlerId: register.handlerId,
      callId: 7,
      args: [batch],
    });
    const result = postedMessages.find((message) => message.type === "result");
    assert.deepEqual(result.callId, 7);
    assert.deepEqual(result.value.length, 2);
    const [first, second] = result.value;
    assert.deepEqual(first.value[0], { type: "text", value: "one" });
    assert.deepEqual(first.value[1].type, "inline");
    assert.deepEqual(first.value[1].node.tag, "code");
    assert.deepEqual(first.value[1].node.children[0], {
      type: "text",
      value: "hi",
    });
    assert.deepEqual(second.value, [{ type: "text", value: "two" }]);
  });

  it("returns an error entry for items whose callback throws", async () => {
    clearMessages();
    const plugin = new Plugin();
    plugin.registerRichTextTransform((tokens, context) => {
      if (context.uri === "at://bad") throw new Error("nope");
      return tokens;
    });
    const register = lastMessage();
    clearMessages();
    await dispatch({
      type: "call",
      handlerId: register.handlerId,
      callId: 8,
      args: [
        [
          { tokens: [], context: { uri: "at://bad" } },
          {
            tokens: [{ type: "text", value: "ok" }],
            context: { uri: "at://good" },
          },
        ],
      ],
    });
    const result = postedMessages.find((message) => message.type === "result");
    assert.deepEqual(result.value[0].error, "nope");
    assert.deepEqual(result.value[1].value, [{ type: "text", value: "ok" }]);
  });
});

describe("flattenForScan", () => {
  const facetToken = {
    type: "facet",
    facet: {
      index: { byteStart: 4, byteEnd: 23 },
      features: [
        {
          $type: "app.bsky.richtext.facet#link",
          uri: "https://example.com",
        },
      ],
    },
    text: "https://example.com",
  };
  const tokens = [
    { type: "text", value: "see " },
    facetToken,
    { type: "text", value: " now" },
  ];

  it("returns a FlattenedTokens instance concatenating text and facet token text", () => {
    const flat = flattenForScan(tokens);
    assert(flat instanceof FlattenedTokens);
    assert.deepEqual(flat.text, "see https://example.com now");
  });

  it("textFor returns the flattened source text", () => {
    const flat = flattenForScan(tokens);
    assert.deepEqual(flat.textFor(4, 23), "https://example.com");
  });

  it("tokensFor preserves whole tokens by identity", () => {
    const flat = flattenForScan(tokens);
    const covered = flat.tokensFor(0, flat.text.length);
    assert.deepEqual(covered.length, 3);
    assert(covered[1] === facetToken);
  });

  it("tokensFor slices partially covered text tokens", () => {
    const flat = flattenForScan(tokens);
    assert.deepEqual(flat.tokensFor(0, 3), [{ type: "text", value: "see" }]);
  });

  it("tokensFor demotes a partially covered facet to text", () => {
    const flat = flattenForScan(tokens);
    const covered = flat.tokensFor(0, 9);
    assert.deepEqual(covered, [
      { type: "text", value: "see " },
      { type: "text", value: "https" },
    ]);
  });

  it("passes zero-width inline/block tokens through in range", () => {
    const inlineToken = { type: "inline", node: { tag: "code" } };
    const flat = flattenForScan([
      { type: "text", value: "ab" },
      inlineToken,
      { type: "text", value: "cd" },
    ]);
    assert.deepEqual(flat.text, "abcd");
    const covered = flat.tokensFor(0, 4);
    assert.deepEqual(covered.length, 3);
    assert(covered[1] === inlineToken);
  });
});
