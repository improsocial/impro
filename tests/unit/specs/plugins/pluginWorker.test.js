import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";

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

const t = new TestSuite("pluginWorker");

t.describe("SimpleUUID", (it) => {
  it("returns sequential ids starting from 0", () => {
    const uuid = new SimpleUUID();
    assertEquals(uuid.create(), 0);
    assertEquals(uuid.create(), 1);
    assertEquals(uuid.create(), 2);
  });
});

t.describe("MenuItem", (it) => {
  it("setters return the item for chaining and apply values", () => {
    const item = new MenuItem();
    const result = item
      .setTitle("Hello")
      .setIcon("star")
      .onClick(() => 42);
    assert(result === item, "chained setters should return the item");
    assertEquals(item.title, "Hello");
    assertEquals(item.icon, "star");
    assertEquals(item._callback(), 42);
  });

  it("has sensible defaults", () => {
    const item = new MenuItem();
    assertEquals(item.title, "");
    assertEquals(item.icon, null);
    // Default callback is a no-op that returns undefined.
    assertEquals(item._callback(), undefined);
  });
});

t.describe("Menu", (it) => {
  it("addItem invokes the builder and serializes items with handlerIds", () => {
    const menu = new Menu();
    menu.addItem((item) => item.setTitle("One").setIcon("a"));
    menu.addItem((item) => item.setTitle("Two"));
    const serialized = menu._serialize();
    assertEquals(serialized.length, 2);
    assertEquals(serialized[0].title, "One");
    assertEquals(serialized[0].icon, "a");
    assertEquals(serialized[1].title, "Two");
    assertEquals(serialized[1].icon, null);
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

t.describe("VirtualEl (via Setting & friends)", (it) => {
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
    assertEquals(serialized.tag, "div");
    // settingEl has info + control children
    assertEquals(serialized.children.length, 2);
    const info = serialized.children[0];
    assertEquals(info.attrs.class, "setting-item-info");
    assertEquals(info.children[0].text, "Hello");
    assertEquals(info.children[1].text, "World");
  });

  it("addClass concatenates classes and setAttr stores attributes", () => {
    const el = makeVirtualEl();
    el.addClass("a").addClass("b").setAttr("data-x", "1");
    const serialized = el._serialize();
    assertEquals(serialized.attrs.class, "a b");
    assertEquals(serialized.attrs["data-x"], "1");
  });

  it("setAttr with an omitted value still sets the attribute as an empty string", () => {
    const el = makeVirtualEl();
    el.setAttr("disabled");
    const serialized = el._serialize();
    assertEquals(serialized.attrs.disabled, "");
  });

  it("empty() clears text and children", () => {
    const el = makeVirtualEl();
    el.createDiv({ text: "child" });
    el.setText("hi");
    el.empty();
    const serialized = el._serialize();
    assertEquals(serialized.text, null);
    assertEquals(serialized.children, []);
  });

  it("createEl supports text, cls (string or array), and attr options", () => {
    const el = makeVirtualEl();
    el.createEl("span", { text: "x", cls: ["one", "two"], attr: { id: "z" } });
    const serialized = el._serialize();
    assertEquals(serialized.children[0].tag, "span");
    assertEquals(serialized.children[0].text, "x");
    assertEquals(serialized.children[0].attrs.class, "one two");
    assertEquals(serialized.children[0].attrs.id, "z");
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

t.describe("Plugin sidebar/feedFilter registration", (it) => {
  it("addSidebarItem posts a register message with title and icon", () => {
    clearMessages();
    const plugin = new Plugin();
    plugin.addSidebarItem("⭐", "Stars", () => {});
    const msg = lastMessage();
    assertEquals(msg.type, "register");
    assertEquals(msg.target, "sidebarItem");
    assertEquals(msg.icon, "⭐");
    assertEquals(msg.title, "Stars");
    assert(typeof msg.handlerId === "number");
  });

  it("addFeedFilter posts a register message", () => {
    clearMessages();
    const plugin = new Plugin();
    plugin.addFeedFilter(() => true);
    const msg = lastMessage();
    assertEquals(msg.type, "register");
    assertEquals(msg.target, "feedFilter");
    assert(typeof msg.handlerId === "number");
  });

  it("registerSlot posts a register message with the slot name", () => {
    clearMessages();
    const plugin = new Plugin();
    plugin.registerSlot("post-thread-view:after-main", () => null);
    const msg = lastMessage();
    assertEquals(msg.type, "register");
    assertEquals(msg.target, "slot");
    assertEquals(msg.name, "post-thread-view:after-main");
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
    assertEquals(received, { uri: "at://example" });
    const result = postedMessages.find((message) => message.type === "result");
    assertEquals(result.callId, 42);
    assertEquals(result.value.tag, "div");
    assertEquals(result.value.attrs.class, "hello");
    assertEquals(result.value.text, "world");
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
    assertEquals(result.value, null);
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
    assertEquals(msg.type, "register");
    assertEquals(msg.target, "settingTab");
    assertEquals(msg.name, "Prefs");
    assert(tab.plugin === plugin, "tab.plugin is set to its owning plugin");
  });
});

t.describe("hostCall round-trip", (it) => {
  it("loadData posts a hostCall and resolves with the host result", async () => {
    clearMessages();
    const plugin = new Plugin();
    const promise = plugin.loadData();
    const sent = lastMessage();
    assertEquals(sent.type, "hostCall");
    assertEquals(sent.method, "loadData");
    assert(typeof sent.hostCallId === "number");
    dispatch({
      type: "hostResult",
      hostCallId: sent.hostCallId,
      value: { foo: 1 },
    });
    assertEquals(await promise, { foo: 1 });
  });

  it("rejects when host returns an error", async () => {
    clearMessages();
    const plugin = new Plugin();
    const promise = plugin.saveData({ a: 1 });
    const sent = lastMessage();
    assertEquals(sent.method, "saveData");
    assertEquals(sent.args[0], { data: { a: 1 } });
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
    assertEquals(sent.method, "refreshFeedFilters");
    assertEquals(sent.args[0], "at://example/feed");
  });

  it("app.data.getPost posts a hostCall and resolves with the host result", async () => {
    clearMessages();
    const plugin = new Plugin();
    const promise = plugin.app.data.getPost("at://example/post/1");
    const sent = lastMessage();
    assertEquals(sent.type, "hostCall");
    assertEquals(sent.method, "getPost");
    assertEquals(sent.args[0], { uri: "at://example/post/1" });
    assert(typeof sent.hostCallId === "number");
    dispatch({
      type: "hostResult",
      hostCallId: sent.hostCallId,
      value: { uri: "at://example/post/1", record: { text: "hi" } },
    });
    assertEquals(await promise, {
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
    assertEquals(await promise, null);
  });

  it("app.data.getProfile posts a hostCall and resolves with the host result", async () => {
    clearMessages();
    const plugin = new Plugin();
    const promise = plugin.app.data.getProfile("did:plc:abc");
    const sent = lastMessage();
    assertEquals(sent.type, "hostCall");
    assertEquals(sent.method, "getProfile");
    assertEquals(sent.args[0], { did: "did:plc:abc" });
    dispatch({
      type: "hostResult",
      hostCallId: sent.hostCallId,
      value: { did: "did:plc:abc", handle: "alice.test" },
    });
    assertEquals(await promise, {
      did: "did:plc:abc",
      handle: "alice.test",
    });
  });
});

t.describe("Notice", (it) => {
  it("posts a showToast hostCall on next microtask", async () => {
    clearMessages();
    new Notice("Saved!", 1000);
    await flushMicrotasks();
    const sent = postedMessages.find(
      (message) => message.method === "showToast",
    );
    assert(sent, "expected a showToast hostCall");
    assertEquals(sent.args[0].timeout, 1000);
    assertEquals(sent.args[0].element.tag, "div");
    assertEquals(sent.args[0].element.text, "Saved!");
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
    assertEquals(hideCalls.length, 1);
  });
});

t.describe("StyleSnippet", (it) => {
  it("posts applyStyleSnippet on next microtask", async () => {
    clearMessages();
    new StyleSnippet(".x { color: red; }");
    await flushMicrotasks();
    const sent = postedMessages.find(
      (message) => message.method === "applyStyleSnippet",
    );
    assert(sent, "expected applyStyleSnippet hostCall");
    assertEquals(sent.args[0].cssText, ".x { color: red; }");
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
    assertEquals(removes.length, 1);
  });
});

t.describe("Modal", (it) => {
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
    assertEquals(sent.type, "hostCall");
    assertEquals(sent.method, "openModal");
    assertEquals(sent.args[0].title.text, "Title");
    assertEquals(sent.args[0].content.text, "Body");
  });

  it("calling open() twice only sends one openModal", () => {
    clearMessages();
    const modal = new Modal();
    modal.open();
    modal.open();
    const opens = postedMessages.filter(
      (message) => message.method === "openModal",
    );
    assertEquals(opens.length, 1);
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
    assertEquals(lastMessage().method, "closeModal");
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

t.describe("message dispatch — call handlers", (it) => {
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
    assertEquals(receivedArgs, [1, 2]);
    const result = postedMessages.find((message) => message.type === "result");
    assertEquals(result.callId, 99);
    assertEquals(result.value, "ok");
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
    assertEquals(result.callId, 7);
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
    assertEquals(result.error, "boom");
  });
});

t.describe("app.on event listeners", (it) => {
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
    assertEquals(register.event, "post-context-menu");

    clearMessages();
    await dispatch({
      type: "call",
      handlerId: register.handlerId,
      callId: 1,
      args: [{ id: 42 }],
    });
    const result = postedMessages.find((message) => message.type === "result");
    assertEquals(result.value.length, 1);
    assertEquals(result.value[0].title, "Open 42");
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
    assertEquals(result.value, null);
  });
});

t.describe("PluginSettingTab.refresh", (it) => {
  it("posts a refreshSettingTab hostCall defaulting reset to false", () => {
    clearMessages();
    const tab = new PluginSettingTab();
    tab.refresh();
    const sent = lastMessage();
    assertEquals(sent.type, "hostCall");
    assertEquals(sent.method, "refreshSettingTab");
    assertEquals(sent.args[0].reset, false);
  });

  it("forwards reset: true when requested", () => {
    clearMessages();
    const tab = new PluginSettingTab();
    tab.refresh({ reset: true });
    const sent = lastMessage();
    assertEquals(sent.method, "refreshSettingTab");
    assertEquals(sent.args[0].reset, true);
  });
});

t.describe("Setting components", (it) => {
  it("addText creates a text input with placeholder and value", () => {
    const container = makeVirtualEl();
    const setting = new Setting(container);
    setting.addText((text) => text.setValue("hello").setPlaceholder("type…"));
    const input = setting.controlEl.children[0];
    assertEquals(input.tag, "input");
    assertEquals(input.attrs.type, "text");
    assertEquals(input.attrs.value, "hello");
    assertEquals(input.attrs.placeholder, "type…");
  });

  it("addToggle reflects checked state on setValue", () => {
    const container = makeVirtualEl();
    const setting = new Setting(container);
    setting.addToggle((toggle) => toggle.setValue(true));
    let toggle = setting.controlEl.children[0];
    assertEquals(toggle.tag, "toggle-switch");
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
    assertEquals(select.children.length, 2);
    assertEquals(select.children[0].attrs.value, "a");
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
    assertEquals(button.tag, "button");
    assertEquals(button.text, "Save");
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
    assertEquals(child.tag, "plugin-profiles-list");
    assertEquals(child.attrs.dids, "did:plc:a,did:plc:b");
    assertEquals(child.attrs["empty-message"], "No one here yet.");
  });

  it("createIcon builds a plugin-icon with the given name", () => {
    const container = makeVirtualEl();
    container.createIcon((icon) => icon.setIcon("alert-circle"));
    const child = container.children[0]._serialize();
    assertEquals(child.tag, "plugin-icon");
    assertEquals(child.attrs.icon, "alert-circle");
  });

  it("createProfilesList accepts a pre-joined string of dids", () => {
    const container = makeVirtualEl();
    container.createProfilesList((list) => list.setDids("did:plc:a,did:plc:b"));
    const child = container.children[0]._serialize();
    assertEquals(child.attrs.dids, "did:plc:a,did:plc:b");
  });
});

t.describe("fetch — header serialization", (it) => {
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
    assertEquals(sent.args[0].url, "https://example.com/");
    assertEquals(sent.args[0].init.method, "POST");
    assertEquals(sent.args[0].init.headers, {
      "X-Foo": "bar",
      "X-Baz": "qux",
    });
    assertEquals(sent.args[0].init.body, "hi");
  });

  it("serializes a Map headers init via forEach(value, name)", () => {
    clearMessages();
    const headers = new Map([
      ["X-One", "1"],
      ["X-Two", "2"],
    ]);
    pluginFetch("https://example.com/", { headers });
    const sent = findFetchCall();
    assertEquals(sent.args[0].init.headers, { "X-One": "1", "X-Two": "2" });
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
    assertEquals(sent.args[0].init.headers, {
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
    assertEquals(sent.args[0].init.headers, {
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

await t.run();
