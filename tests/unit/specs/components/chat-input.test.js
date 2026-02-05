import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import "/js/components/chat-input.js";

const t = new TestSuite("ChatInput");

t.beforeEach(() => {
  document.body.innerHTML = "";
});

t.describe("ChatInput - rendering", (it) => {
  it("should render message-input-container", () => {
    const element = document.createElement("chat-input");
    document.body.appendChild(element);
    const container = element.querySelector(".message-input-container");
    assert(container !== null);
  });

  it("should render textarea with message-input-field class", () => {
    const element = document.createElement("chat-input");
    document.body.appendChild(element);
    const textarea = element.querySelector(".message-input-field");
    assert(textarea !== null);
    assertEquals(textarea.tagName, "TEXTAREA");
  });

  it("should render textarea with placeholder", () => {
    const element = document.createElement("chat-input");
    document.body.appendChild(element);
    const textarea = element.querySelector(".message-input-field");
    assertEquals(textarea.placeholder, "Write a message");
  });

  it("should render textarea with maxlength", () => {
    const element = document.createElement("chat-input");
    document.body.appendChild(element);
    const textarea = element.querySelector(".message-input-field");
    assertEquals(textarea.maxLength, 10000);
  });

  it("should render send button", () => {
    const element = document.createElement("chat-input");
    document.body.appendChild(element);
    const button = element.querySelector(".message-input-send-button");
    assert(button !== null);
  });
});

t.describe("ChatInput - disabled state", (it) => {
  it("should not be disabled by default", () => {
    const element = document.createElement("chat-input");
    document.body.appendChild(element);
    assertEquals(element.disabled, false);
  });

  it("should be disabled when disabled attribute is set", () => {
    const element = document.createElement("chat-input");
    element.setAttribute("disabled", "");
    document.body.appendChild(element);
    assertEquals(element.disabled, true);
  });

  it("should disable textarea when disabled", () => {
    const element = document.createElement("chat-input");
    element.setAttribute("disabled", "");
    document.body.appendChild(element);
    const textarea = element.querySelector(".message-input-field");
    assert(textarea.disabled);
  });

  it("should disable send button when disabled", () => {
    const element = document.createElement("chat-input");
    element.setAttribute("disabled", "");
    document.body.appendChild(element);
    const button = element.querySelector(".message-input-send-button");
    assert(button.disabled);
  });

  it("should update disabled state when attribute changes", () => {
    const element = document.createElement("chat-input");
    document.body.appendChild(element);
    assertEquals(element.disabled, false);
    element.setAttribute("disabled", "");
    assertEquals(element.disabled, true);
    element.removeAttribute("disabled");
    assertEquals(element.disabled, false);
  });
});

t.describe("ChatInput - loading state", (it) => {
  it("should not be loading by default", () => {
    const element = document.createElement("chat-input");
    document.body.appendChild(element);
    assertEquals(element.loading, false);
  });

  it("should be loading when loading attribute is set", () => {
    const element = document.createElement("chat-input");
    element.setAttribute("loading", "");
    document.body.appendChild(element);
    assertEquals(element.loading, true);
  });

  it("should show loading spinner when loading", () => {
    const element = document.createElement("chat-input");
    element.setAttribute("loading", "");
    document.body.appendChild(element);
    const spinner = element.querySelector(".loading-spinner");
    assert(spinner !== null);
  });

  it("should not show loading spinner when not loading", () => {
    const element = document.createElement("chat-input");
    document.body.appendChild(element);
    const spinner = element.querySelector(".loading-spinner");
    assertEquals(spinner, null);
  });

  it("should update loading state when attribute changes", () => {
    const element = document.createElement("chat-input");
    document.body.appendChild(element);
    assertEquals(element.loading, false);
    element.setAttribute("loading", "");
    assertEquals(element.loading, true);
    element.removeAttribute("loading");
    assertEquals(element.loading, false);
  });
});

t.describe("ChatInput - focus and blur", (it) => {
  it("should focus textarea when focus() is called", () => {
    const element = document.createElement("chat-input");
    document.body.appendChild(element);
    element.focus();
    const textarea = element.querySelector(".message-input-field");
    assertEquals(document.activeElement, textarea);
  });

  it("should blur textarea when blur() is called", () => {
    const element = document.createElement("chat-input");
    document.body.appendChild(element);
    element.focus();
    element.blur();
    const textarea = element.querySelector(".message-input-field");
    assert(document.activeElement !== textarea);
  });
});

t.describe("ChatInput - send event", (it) => {
  it("should dispatch send event when send button is clicked", () => {
    const element = document.createElement("chat-input");
    document.body.appendChild(element);
    const textarea = element.querySelector(".message-input-field");
    textarea.value = "Hello world";

    let receivedMessage = null;
    element.addEventListener("send", (e) => {
      receivedMessage = e.detail.message;
    });

    const button = element.querySelector(".message-input-send-button");
    button.click();

    assertEquals(receivedMessage, "Hello world");
  });

  it("should clear textarea after sending", () => {
    const element = document.createElement("chat-input");
    document.body.appendChild(element);
    const textarea = element.querySelector(".message-input-field");
    textarea.value = "Hello world";

    const button = element.querySelector(".message-input-send-button");
    button.click();

    assertEquals(textarea.value, "");
  });

  it("should not dispatch send event when message is empty", () => {
    const element = document.createElement("chat-input");
    document.body.appendChild(element);

    let eventFired = false;
    element.addEventListener("send", () => {
      eventFired = true;
    });

    const button = element.querySelector(".message-input-send-button");
    button.click();

    assertEquals(eventFired, false);
  });

  it("should not dispatch send event when message is only whitespace", () => {
    const element = document.createElement("chat-input");
    document.body.appendChild(element);
    const textarea = element.querySelector(".message-input-field");
    textarea.value = "   ";

    let eventFired = false;
    element.addEventListener("send", () => {
      eventFired = true;
    });

    const button = element.querySelector(".message-input-send-button");
    button.click();

    assertEquals(eventFired, false);
  });

  it("should not dispatch send event when disabled", () => {
    const element = document.createElement("chat-input");
    element.setAttribute("disabled", "");
    document.body.appendChild(element);
    const textarea = element.querySelector(".message-input-field");
    textarea.value = "Hello world";

    let eventFired = false;
    element.addEventListener("send", () => {
      eventFired = true;
    });

    element.handleSend();

    assertEquals(eventFired, false);
  });

  it("should trim message before sending", () => {
    const element = document.createElement("chat-input");
    document.body.appendChild(element);
    const textarea = element.querySelector(".message-input-field");
    textarea.value = "  Hello world  ";

    let receivedMessage = null;
    element.addEventListener("send", (e) => {
      receivedMessage = e.detail.message;
    });

    const button = element.querySelector(".message-input-send-button");
    button.click();

    assertEquals(receivedMessage, "Hello world");
  });
});

t.describe("ChatInput - keyboard handling", (it) => {
  it("should send message on Enter key", () => {
    const element = document.createElement("chat-input");
    document.body.appendChild(element);
    const textarea = element.querySelector(".message-input-field");
    textarea.value = "Hello world";

    let receivedMessage = null;
    element.addEventListener("send", (e) => {
      receivedMessage = e.detail.message;
    });

    const event = new window.KeyboardEvent("keydown", {
      key: "Enter",
      shiftKey: false,
    });
    textarea.dispatchEvent(event);

    assertEquals(receivedMessage, "Hello world");
  });

  it("should not send message on Shift+Enter", () => {
    const element = document.createElement("chat-input");
    document.body.appendChild(element);
    const textarea = element.querySelector(".message-input-field");
    textarea.value = "Hello world";

    let eventFired = false;
    element.addEventListener("send", () => {
      eventFired = true;
    });

    const event = new window.KeyboardEvent("keydown", {
      key: "Enter",
      shiftKey: true,
    });
    textarea.dispatchEvent(event);

    assertEquals(eventFired, false);
  });
});

t.describe("ChatInput - reinitialization protection", (it) => {
  it("should not reinitialize when connectedCallback is called multiple times", () => {
    const element = document.createElement("chat-input");
    document.body.appendChild(element);
    const textarea = element.querySelector(".message-input-field");
    textarea.value = "Test message";

    // Manually trigger connectedCallback again
    element.connectedCallback();

    // Textarea should still have the value
    const newTextarea = element.querySelector(".message-input-field");
    assertEquals(newTextarea.value, "Test message");
  });
});

await t.run();
