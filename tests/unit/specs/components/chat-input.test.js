import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";

await import("/js/components/chat-input.js");

const t = new TestSuite("ChatInput");

t.beforeEach(() => {
  document.body.innerHTML = "";
});

function createChatInput(attributes = {}) {
  const element = document.createElement("chat-input");
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  document.body.appendChild(element);
  return element;
}

function getRichTextInput(element) {
  return element.querySelector("rich-text-input");
}

function getEditable(element) {
  return element.querySelector(".rich-text-input");
}

t.describe("ChatInput - rendering", (it) => {
  it("should render message-input-container", () => {
    const element = createChatInput();
    const container = element.querySelector(".message-input-container");
    assert(container !== null);
  });

  it("should render a rich-text-input", () => {
    const element = createChatInput();
    const richTextInput = getRichTextInput(element);
    assert(richTextInput !== null);
    assert(getEditable(element) !== null);
  });

  it("should render the rich-text-input with placeholder", () => {
    const element = createChatInput();
    assertEquals(
      getRichTextInput(element).getAttribute("placeholder"),
      "Write a message",
    );
  });

  it("should render the rich-text-input with upward typeahead", () => {
    const element = createChatInput();
    assertEquals(
      getRichTextInput(element).getAttribute("typeahead-direction"),
      "up",
    );
  });

  it("should render send button", () => {
    const element = createChatInput();
    const button = element.querySelector(".message-input-send-button");
    assert(button !== null);
  });
});

t.describe("ChatInput - disabled state", (it) => {
  it("should not be disabled by default", () => {
    const element = createChatInput();
    assertEquals(element.disabled, false);
  });

  it("should be disabled when disabled attribute is set", () => {
    const element = createChatInput({ disabled: "" });
    assertEquals(element.disabled, true);
  });

  it("should disable the rich-text-input when disabled", () => {
    const element = createChatInput({ disabled: "" });
    assertEquals(getEditable(element).getAttribute("contenteditable"), "false");
  });

  it("should disable send button when disabled", () => {
    const element = createChatInput({ disabled: "" });
    const button = element.querySelector(".message-input-send-button");
    assert(button.disabled);
  });

  it("should update disabled state when attribute changes", () => {
    const element = createChatInput();
    assertEquals(element.disabled, false);
    element.setAttribute("disabled", "");
    assertEquals(element.disabled, true);
    assertEquals(getEditable(element).getAttribute("contenteditable"), "false");
    element.removeAttribute("disabled");
    assertEquals(element.disabled, false);
    assertEquals(getEditable(element).getAttribute("contenteditable"), "true");
  });
});

t.describe("ChatInput - loading state", (it) => {
  it("should not be loading by default", () => {
    const element = createChatInput();
    assertEquals(element.loading, false);
  });

  it("should be loading when loading attribute is set", () => {
    const element = createChatInput({ loading: "" });
    assertEquals(element.loading, true);
  });

  it("should show loading spinner when loading", () => {
    const element = createChatInput({ loading: "" });
    const spinner = element.querySelector(".loading-spinner");
    assert(spinner !== null);
  });

  it("should not show loading spinner when not loading", () => {
    const element = createChatInput();
    const spinner = element.querySelector(".loading-spinner");
    assertEquals(spinner, null);
  });

  it("should update loading state when attribute changes", () => {
    const element = createChatInput();
    assertEquals(element.loading, false);
    element.setAttribute("loading", "");
    assertEquals(element.loading, true);
    element.removeAttribute("loading");
    assertEquals(element.loading, false);
  });
});

t.describe("ChatInput - focus and blur", (it) => {
  it("should focus the rich-text-input when focus() is called", () => {
    const element = createChatInput();
    element.focus();
    assertEquals(document.activeElement, getEditable(element));
  });

  it("should blur the rich-text-input when blur() is called", () => {
    const element = createChatInput();
    element.focus();
    element.blur();
    assert(document.activeElement !== getEditable(element));
  });
});

t.describe("ChatInput - send event", (it) => {
  it("should dispatch send event when send button is clicked", () => {
    const element = createChatInput();
    getRichTextInput(element).setText("Hello world");

    let receivedMessage = null;
    element.addEventListener("send", (e) => {
      receivedMessage = e.detail.message;
    });

    const button = element.querySelector(".message-input-send-button");
    button.click();

    assertEquals(receivedMessage, "Hello world");
  });

  it("should clear the input after sending", () => {
    const element = createChatInput();
    getRichTextInput(element).setText("Hello world");

    const button = element.querySelector(".message-input-send-button");
    button.click();

    assertEquals(getRichTextInput(element).text, "");
    assertEquals(element.messageText, "");
  });

  it("should not dispatch send event when message is empty", () => {
    const element = createChatInput();

    let eventFired = false;
    element.addEventListener("send", () => {
      eventFired = true;
    });

    const button = element.querySelector(".message-input-send-button");
    button.click();

    assertEquals(eventFired, false);
  });

  it("should not dispatch send event when message is only whitespace", () => {
    const element = createChatInput();
    getRichTextInput(element).setText("   ");

    let eventFired = false;
    element.addEventListener("send", () => {
      eventFired = true;
    });

    const button = element.querySelector(".message-input-send-button");
    button.click();

    assertEquals(eventFired, false);
  });

  it("should not dispatch send event when disabled", () => {
    const element = createChatInput();
    getRichTextInput(element).setText("Hello world");
    element.setAttribute("disabled", "");

    let eventFired = false;
    element.addEventListener("send", () => {
      eventFired = true;
    });

    element.handleSend();

    assertEquals(eventFired, false);
  });

  it("should trim message before sending", () => {
    const element = createChatInput();
    getRichTextInput(element).setText("  Hello world  ");

    let receivedMessage = null;
    element.addEventListener("send", (e) => {
      receivedMessage = e.detail.message;
    });

    const button = element.querySelector(".message-input-send-button");
    button.click();

    assertEquals(receivedMessage, "Hello world");
  });
});

t.describe("ChatInput - message length limit", (it) => {
  function sendButton(element) {
    return element.querySelector(".message-input-send-button");
  }

  it("should disable the send button when the text exceeds 1000 graphemes", () => {
    const element = createChatInput();
    getRichTextInput(element).setText("a".repeat(1001));
    assert(sendButton(element).disabled);
  });

  it("should count graphemes rather than code units", () => {
    const element = createChatInput();
    // 1000 graphemes but 2000 code units — within the lexicon limits
    getRichTextInput(element).setText("👍".repeat(1000));
    assertEquals(sendButton(element).disabled, false);
  });

  it("should disable the send button when the text exceeds 10000 bytes", () => {
    const element = createChatInput();
    // 500 graphemes, but 25 UTF-8 bytes each (12500 bytes total)
    getRichTextInput(element).setText("👨‍👩‍👧‍👦".repeat(500));
    assert(sendButton(element).disabled);
  });

  it("should not dispatch send while over the limit", () => {
    const element = createChatInput();
    getRichTextInput(element).setText("a".repeat(1001));

    let eventFired = false;
    element.addEventListener("send", () => {
      eventFired = true;
    });

    element.handleSend();

    assertEquals(eventFired, false);
  });

  it("should re-enable the send button when the text shrinks below the limit", () => {
    const element = createChatInput();
    getRichTextInput(element).setText("a".repeat(1001));
    getRichTextInput(element).setText("short again");
    assertEquals(sendButton(element).disabled, false);
  });
});

t.describe("ChatInput - send button disabled state", (it) => {
  function sendButton(element) {
    return element.querySelector(".message-input-send-button");
  }

  it("should disable the send button when there is nothing to send", () => {
    const element = createChatInput();
    assert(sendButton(element).disabled);
  });

  it("should enable the send button once text is entered", () => {
    const element = createChatInput();
    getRichTextInput(element).setText("hello");
    assertEquals(sendButton(element).disabled, false);
  });

  it("should keep the send button disabled for whitespace-only text", () => {
    const element = createChatInput();
    getRichTextInput(element).setText("   ");
    assert(sendButton(element).disabled);
  });

  it("should disable the send button again when the text is cleared", () => {
    const element = createChatInput();
    getRichTextInput(element).setText("hello");
    getRichTextInput(element).setText("");
    assert(sendButton(element).disabled);
  });

  it("should enable the send button for an embed with no text", () => {
    const element = createChatInput();
    assert(sendButton(element).disabled);
    element.setAttribute("has-embed", "");
    assertEquals(sendButton(element).disabled, false);
    element.removeAttribute("has-embed");
    assert(sendButton(element).disabled);
  });
});

t.describe("ChatInput - embed-only send", (it) => {
  it("should dispatch send with an empty message when has-embed is set", () => {
    const element = createChatInput({ "has-embed": "" });

    let receivedMessage = null;
    element.addEventListener("send", (e) => {
      receivedMessage = e.detail.message;
    });

    const button = element.querySelector(".message-input-send-button");
    button.click();

    assertEquals(receivedMessage, "");
  });
});

t.describe("ChatInput - input-change event", (it) => {
  function setup() {
    const element = createChatInput();
    const events = [];
    element.addEventListener("input-change", (e) => {
      events.push(e.detail);
    });
    return { element, events };
  }

  it("emits the current text on input", () => {
    const { element, events } = setup();
    const editable = getEditable(element);
    editable.textContent = "hello world";
    editable.dispatchEvent(new window.InputEvent("input"));

    assertEquals(events.length, 1);
    assertEquals(events[0].text, "hello world");
    assertEquals(events[0].inputType, null);
  });

  it("reports insertFromPaste for pasted input", () => {
    const { element, events } = setup();
    const editable = getEditable(element);

    const originalExecCommand = document.execCommand;
    // Like the browser, insert the text and fire input synchronously
    document.execCommand = (name, _ui, value) => {
      editable.textContent = editable.textContent + value;
      editable.dispatchEvent(new window.InputEvent("input"));
      return true;
    };
    try {
      const pasteEvent = new window.Event("paste", {
        bubbles: true,
        cancelable: true,
      });
      pasteEvent.clipboardData = { getData: () => "pasted text" };
      editable.dispatchEvent(pasteEvent);
    } finally {
      document.execCommand = originalExecCommand;
    }

    editable.textContent = "pasted text!";
    editable.dispatchEvent(new window.InputEvent("input"));

    assertEquals(events.length, 2);
    assertEquals(events[0].text, "pasted text");
    assertEquals(events[0].inputType, "insertFromPaste");
    assertEquals(events[1].inputType, null);
  });
});

t.describe("ChatInput - keyboard handling", (it) => {
  function enterEvent(options = {}) {
    return new window.KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
      ...options,
    });
  }

  it("should send message on Enter key", () => {
    const element = createChatInput();
    getRichTextInput(element).setText("Hello world");

    let receivedMessage = null;
    element.addEventListener("send", (e) => {
      receivedMessage = e.detail.message;
    });

    getEditable(element).dispatchEvent(enterEvent());

    assertEquals(receivedMessage, "Hello world");
  });

  it("should not send message on Shift+Enter", () => {
    const element = createChatInput();
    getRichTextInput(element).setText("Hello world");

    let eventFired = false;
    element.addEventListener("send", () => {
      eventFired = true;
    });

    getEditable(element).dispatchEvent(enterEvent({ shiftKey: true }));

    assertEquals(eventFired, false);
  });

  it("should select a mention instead of sending when the typeahead is open", () => {
    const element = createChatInput();
    const richTextInput = getRichTextInput(element);
    richTextInput.setText("Hi @al");
    richTextInput.currentMentionStart = 3;
    richTextInput.currentMentionEnd = 6;
    richTextInput.mentionSuggestions = [{ handle: "alice.bsky.social" }];

    let sendFired = false;
    element.addEventListener("send", () => {
      sendFired = true;
    });

    const execCommandCalls = [];
    const originalExecCommand = document.execCommand;
    document.execCommand = (name, _ui, value) => {
      execCommandCalls.push({ name, value });
      return true;
    };
    try {
      getEditable(element).dispatchEvent(enterEvent());
    } finally {
      document.execCommand = originalExecCommand;
    }

    assertEquals(sendFired, false);
    assertEquals(execCommandCalls.length, 1);
    assertEquals(execCommandCalls[0].value, "@alice.bsky.social ");
  });

  it("should send on Enter after the typeahead was dismissed with Escape", () => {
    const element = createChatInput();
    const richTextInput = getRichTextInput(element);
    richTextInput.setText("Hi @al");
    richTextInput.mentionSuggestions = [{ handle: "alice.bsky.social" }];

    let receivedMessage = null;
    element.addEventListener("send", (e) => {
      receivedMessage = e.detail.message;
    });

    getEditable(element).dispatchEvent(
      new window.KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );
    assertEquals(receivedMessage, null);

    getEditable(element).dispatchEvent(enterEvent());
    assertEquals(receivedMessage, "Hi @al");
  });
});

t.describe("ChatInput - emoji insertion", (it) => {
  it("captures the caret before opening the emoji picker", () => {
    const element = createChatInput();
    const richTextInput = getRichTextInput(element);
    richTextInput.setText("hello");
    richTextInput.getCursor = () => 2;

    const dialog = element.querySelector("emoji-picker-dialog");
    dialog.open = () => {};

    const button = element.querySelector(".message-input-emoji-button");
    element.handleEmojiButtonClick({ currentTarget: button });

    assertEquals(element._emojiCursor, 2);
  });

  it("inserts the emoji at the captured caret position", () => {
    const element = createChatInput();
    const richTextInput = getRichTextInput(element);
    richTextInput.setText("hello");
    element._emojiCursor = 2;

    element.handleEmojiSelect("🎉");

    assertEquals(richTextInput.text, "he🎉llo");
    assertEquals(element.messageText, "he🎉llo");
  });

  it("appends the emoji when no caret was captured", () => {
    const element = createChatInput();
    const richTextInput = getRichTextInput(element);
    richTextInput.setText("hello");
    element._emojiCursor = null;

    element.handleEmojiSelect("🎉");

    assertEquals(richTextInput.text, "hello🎉");
  });
});

t.describe("ChatInput - height reporting", (it) => {
  it("dispatches height-change when the reported height changes", () => {
    const element = createChatInput();

    let reportedHeight = null;
    element.addEventListener("height-change", (e) => {
      reportedHeight = e.detail.height;
    });

    Object.defineProperty(element, "offsetHeight", {
      get: () => 42,
      configurable: true,
    });
    element.reportHeight();

    assertEquals(reportedHeight, 42);
  });

  it("does not dispatch height-change when the height is unchanged", () => {
    const element = createChatInput();
    Object.defineProperty(element, "offsetHeight", {
      get: () => 42,
      configurable: true,
    });
    element.reportHeight();

    let eventFired = false;
    element.addEventListener("height-change", () => {
      eventFired = true;
    });
    element.reportHeight();

    assertEquals(eventFired, false);
  });
});

t.describe("ChatInput - reinitialization protection", (it) => {
  it("should not reinitialize when connectedCallback is called multiple times", () => {
    const element = createChatInput();
    getRichTextInput(element).setText("Test message");

    element.connectedCallback();

    assertEquals(getRichTextInput(element).text, "Test message");
    assertEquals(element.messageText, "Test message");
  });
});

await t.run();
