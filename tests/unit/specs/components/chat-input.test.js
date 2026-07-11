import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

await import("/js/components/chat-input.js");

describe("chat-input", () => {
  beforeEach(() => {
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

  describe("ChatInput - rendering", () => {
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
      assert.deepEqual(
        getRichTextInput(element).getAttribute("placeholder"),
        "Write a message",
      );
    });

    it("should render the rich-text-input with upward typeahead", () => {
      const element = createChatInput();
      assert.deepEqual(
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

  describe("ChatInput - disabled state", () => {
    it("should not be disabled by default", () => {
      const element = createChatInput();
      assert.deepEqual(element.disabled, false);
    });

    it("should be disabled when disabled attribute is set", () => {
      const element = createChatInput({ disabled: "" });
      assert.deepEqual(element.disabled, true);
    });

    it("should disable the rich-text-input when disabled", () => {
      const element = createChatInput({ disabled: "" });
      assert.deepEqual(
        getEditable(element).getAttribute("contenteditable"),
        "false",
      );
    });

    it("should disable send button when disabled", () => {
      const element = createChatInput({ disabled: "" });
      const button = element.querySelector(".message-input-send-button");
      assert(button.disabled);
    });

    it("should update disabled state when attribute changes", () => {
      const element = createChatInput();
      assert.deepEqual(element.disabled, false);
      element.setAttribute("disabled", "");
      assert.deepEqual(element.disabled, true);
      assert.deepEqual(
        getEditable(element).getAttribute("contenteditable"),
        "false",
      );
      element.removeAttribute("disabled");
      assert.deepEqual(element.disabled, false);
      assert.deepEqual(
        getEditable(element).getAttribute("contenteditable"),
        "true",
      );
    });
  });

  describe("ChatInput - loading state", () => {
    it("should not be loading by default", () => {
      const element = createChatInput();
      assert.deepEqual(element.loading, false);
    });

    it("should be loading when loading attribute is set", () => {
      const element = createChatInput({ loading: "" });
      assert.deepEqual(element.loading, true);
    });

    it("should show loading spinner when loading", () => {
      const element = createChatInput({ loading: "" });
      const spinner = element.querySelector(".loading-spinner");
      assert(spinner !== null);
    });

    it("should not show loading spinner when not loading", () => {
      const element = createChatInput();
      const spinner = element.querySelector(".loading-spinner");
      assert.deepEqual(spinner, null);
    });

    it("should update loading state when attribute changes", () => {
      const element = createChatInput();
      assert.deepEqual(element.loading, false);
      element.setAttribute("loading", "");
      assert.deepEqual(element.loading, true);
      element.removeAttribute("loading");
      assert.deepEqual(element.loading, false);
    });
  });

  describe("ChatInput - focus and blur", () => {
    it("should focus the rich-text-input when focus() is called", () => {
      const element = createChatInput();
      element.focus();
      assert.deepEqual(document.activeElement, getEditable(element));
    });

    it("should blur the rich-text-input when blur() is called", () => {
      const element = createChatInput();
      element.focus();
      element.blur();
      assert(document.activeElement !== getEditable(element));
    });
  });

  describe("ChatInput - send event", () => {
    it("should dispatch send event when send button is clicked", () => {
      const element = createChatInput();
      getRichTextInput(element).setText("Hello world");

      let receivedMessage = null;
      element.addEventListener("send", (e) => {
        receivedMessage = e.detail.message;
      });

      const button = element.querySelector(".message-input-send-button");
      button.click();

      assert.deepEqual(receivedMessage, "Hello world");
    });

    it("should clear the input when the send handler reports success", () => {
      const element = createChatInput();
      getRichTextInput(element).setText("Hello world");

      element.addEventListener("send", (e) => {
        e.detail.onSuccess();
      });

      const button = element.querySelector(".message-input-send-button");
      button.click();

      assert.deepEqual(getRichTextInput(element).text, "");
      assert.deepEqual(element.messageText, "");
    });

    it("should keep the input text when the send handler does not report success", () => {
      const element = createChatInput();
      getRichTextInput(element).setText("Hello world");

      const button = element.querySelector(".message-input-send-button");
      button.click();

      assert.deepEqual(getRichTextInput(element).text, "Hello world");
      assert.deepEqual(element.messageText, "Hello world");
    });

    it("should not dispatch send event when message is empty", () => {
      const element = createChatInput();

      let eventFired = false;
      element.addEventListener("send", () => {
        eventFired = true;
      });

      const button = element.querySelector(".message-input-send-button");
      button.click();

      assert.deepEqual(eventFired, false);
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

      assert.deepEqual(eventFired, false);
    });

    it("should not dispatch send event when loading", () => {
      const element = createChatInput();
      getRichTextInput(element).setText("Hello world");
      element.setAttribute("loading", "");

      let eventFired = false;
      element.addEventListener("send", () => {
        eventFired = true;
      });

      const button = element.querySelector(".message-input-send-button");
      button.click();

      assert.deepEqual(eventFired, false);
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

      assert.deepEqual(eventFired, false);
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

      assert.deepEqual(receivedMessage, "Hello world");
    });
  });

  describe("ChatInput - message length limit", () => {
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
      assert.deepEqual(sendButton(element).disabled, false);
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

      assert.deepEqual(eventFired, false);
    });

    it("should re-enable the send button when the text shrinks below the limit", () => {
      const element = createChatInput();
      getRichTextInput(element).setText("a".repeat(1001));
      getRichTextInput(element).setText("short again");
      assert.deepEqual(sendButton(element).disabled, false);
    });
  });

  describe("ChatInput - send button disabled state", () => {
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
      assert.deepEqual(sendButton(element).disabled, false);
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
      assert.deepEqual(sendButton(element).disabled, false);
      element.removeAttribute("has-embed");
      assert(sendButton(element).disabled);
    });
  });

  describe("ChatInput - embed-only send", () => {
    it("should dispatch send with an empty message when has-embed is set", () => {
      const element = createChatInput({ "has-embed": "" });

      let receivedMessage = null;
      element.addEventListener("send", (e) => {
        receivedMessage = e.detail.message;
      });

      const button = element.querySelector(".message-input-send-button");
      button.click();

      assert.deepEqual(receivedMessage, "");
    });
  });

  describe("ChatInput - input-change event", () => {
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

      assert.deepEqual(events.length, 1);
      assert.deepEqual(events[0].text, "hello world");
      assert.deepEqual(events[0].inputType, null);
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

      assert.deepEqual(events.length, 2);
      assert.deepEqual(events[0].text, "pasted text");
      assert.deepEqual(events[0].inputType, "insertFromPaste");
      assert.deepEqual(events[1].inputType, null);
    });
  });

  describe("ChatInput - keyboard handling", () => {
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

      assert.deepEqual(receivedMessage, "Hello world");
    });

    it("should not send message on Shift+Enter", () => {
      const element = createChatInput();
      getRichTextInput(element).setText("Hello world");

      let eventFired = false;
      element.addEventListener("send", () => {
        eventFired = true;
      });

      getEditable(element).dispatchEvent(enterEvent({ shiftKey: true }));

      assert.deepEqual(eventFired, false);
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

      assert.deepEqual(sendFired, false);
      assert.deepEqual(execCommandCalls.length, 1);
      assert.deepEqual(execCommandCalls[0].value, "@alice.bsky.social ");
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
      assert.deepEqual(receivedMessage, null);

      getEditable(element).dispatchEvent(enterEvent());
      assert.deepEqual(receivedMessage, "Hi @al");
    });
  });

  describe("ChatInput - emoji insertion", () => {
    it("captures the caret before opening the emoji picker", () => {
      const element = createChatInput();
      const richTextInput = getRichTextInput(element);
      richTextInput.setText("hello");
      richTextInput.getCursor = () => 2;

      const dialog = element.querySelector("emoji-picker-dialog");
      dialog.open = () => {};

      const button = element.querySelector(".message-input-emoji-button");
      element.handleEmojiButtonClick({ currentTarget: button });

      assert.deepEqual(element._emojiCursor, 2);
    });

    it("inserts the emoji at the captured caret position", () => {
      const element = createChatInput();
      const richTextInput = getRichTextInput(element);
      richTextInput.setText("hello");
      element._emojiCursor = 2;

      element.handleEmojiSelect("🎉");

      assert.deepEqual(richTextInput.text, "he🎉llo");
      assert.deepEqual(element.messageText, "he🎉llo");
    });

    it("appends the emoji when no caret was captured", () => {
      const element = createChatInput();
      const richTextInput = getRichTextInput(element);
      richTextInput.setText("hello");
      element._emojiCursor = null;

      element.handleEmojiSelect("🎉");

      assert.deepEqual(richTextInput.text, "hello🎉");
    });
  });

  describe("ChatInput - height reporting", () => {
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

      assert.deepEqual(reportedHeight, 42);
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

      assert.deepEqual(eventFired, false);
    });
  });

  describe("ChatInput - reinitialization protection", () => {
    it("should not reinitialize when connectedCallback is called multiple times", () => {
      const element = createChatInput();
      getRichTextInput(element).setText("Test message");

      element.connectedCallback();

      assert.deepEqual(getRichTextInput(element).text, "Test message");
      assert.deepEqual(element.messageText, "Test message");
    });
  });
});
