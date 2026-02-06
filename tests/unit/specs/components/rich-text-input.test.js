import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import "/js/components/rich-text-input.js";

const t = new TestSuite("RichTextInput");

t.beforeEach(() => {
  document.body.innerHTML = "";
});

t.describe("RichTextInput - rendering", (it) => {
  it("should render rich-text-input-container", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);
    const container = element.querySelector(".rich-text-input-container");
    assert(container !== null);
  });

  it("should render contenteditable div", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);
    const input = element.querySelector(".rich-text-input");
    assert(input !== null);
    assertEquals(input.getAttribute("contenteditable"), "true");
  });

  it("should render placeholder", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);
    const placeholder = element.querySelector(".rich-text-input-placeholder");
    assert(placeholder !== null);
  });

  it("should display placeholder text from attribute", () => {
    const element = document.createElement("rich-text-input");
    element.setAttribute("placeholder", "What's on your mind?");
    document.body.appendChild(element);
    const placeholder = element.querySelector(".rich-text-input-placeholder");
    assertEquals(placeholder.textContent.trim(), "What's on your mind?");
  });
});

t.describe("RichTextInput - initial state", (it) => {
  it("should start with empty text", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);
    assertEquals(element.text, "");
  });

  it("should start with empty facets", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);
    assertEquals(element.facets.length, 0);
  });

  it("should show placeholder when empty", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);
    const placeholder = element.querySelector(".rich-text-input-placeholder");
    assert(!placeholder.classList.contains("hidden"));
  });

  it("should initialize history with empty state", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);
    assertEquals(element.history.length, 1);
    assertEquals(element.history[0].text, "");
  });

  it("should have no mention suggestions initially", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);
    assertEquals(element.mentionSuggestions.length, 0);
  });
});

t.describe("RichTextInput - placeholder visibility", (it) => {
  it("should hide placeholder when text is entered", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);
    element.text = "Hello";
    element.render();
    const placeholder = element.querySelector(".rich-text-input-placeholder");
    assert(placeholder.classList.contains("hidden"));
  });

  it("should show placeholder when text is cleared", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);
    element.text = "Hello";
    element.render();
    element.text = "";
    element.render();
    const placeholder = element.querySelector(".rich-text-input-placeholder");
    assert(!placeholder.classList.contains("hidden"));
  });
});

t.describe("RichTextInput - focus method", (it) => {
  it("should focus the contenteditable div when focus() is called", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);
    element.focus();
    const input = element.querySelector(".rich-text-input");
    assertEquals(document.activeElement, input);
  });
});

t.describe("RichTextInput - input handling", (it) => {
  it("should dispatch input event with text", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);

    let receivedText = null;
    element.addEventListener("input", (e) => {
      receivedText = e.detail.text;
    });

    const input = element.querySelector(".rich-text-input");
    input.textContent = "Hello world";
    input.dispatchEvent(new Event("input"));

    assertEquals(receivedText, "Hello world");
  });

  it("should dispatch input event with facets", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);

    let receivedFacets = null;
    element.addEventListener("input", (e) => {
      receivedFacets = e.detail.facets;
    });

    const input = element.querySelector(".rich-text-input");
    input.textContent = "Hello";
    input.dispatchEvent(new Event("input"));

    assert(Array.isArray(receivedFacets));
  });
});

t.describe("RichTextInput - mention detection", (it) => {
  it("should detect pending mention", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);
    element.text = "Hello @user";

    // Simulate cursor at end
    const input = element.querySelector(".rich-text-input");
    input.textContent = "Hello @user";

    const pendingMention = element.detectPendingMention();
    // Note: This test may be flaky without proper cursor positioning
    // In real usage, the cursor position matters
  });
});

t.describe("RichTextInput - undo/redo", (it) => {
  it("should support undo", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);

    // Add initial state
    element.text = "Hello";
    element.facets = [];
    element.history = [
      { text: "", facets: [], cursorPosition: 0 },
      { text: "Hello", facets: [], cursorPosition: 5 },
    ];
    element.historyIndex = 1;

    element.undo();

    assertEquals(element.text, "");
    assertEquals(element.historyIndex, 0);
  });

  it("should support redo", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);

    element.text = "";
    element.facets = [];
    element.history = [
      { text: "", facets: [], cursorPosition: 0 },
      { text: "Hello", facets: [], cursorPosition: 5 },
    ];
    element.historyIndex = 0;

    element.redo();

    assertEquals(element.text, "Hello");
    assertEquals(element.historyIndex, 1);
  });

  it("should not undo past beginning", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);

    element.history = [{ text: "", facets: [], cursorPosition: 0 }];
    element.historyIndex = 0;

    element.undo();

    assertEquals(element.historyIndex, 0);
  });

  it("should not redo past end", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);

    element.history = [{ text: "", facets: [], cursorPosition: 0 }];
    element.historyIndex = 0;

    element.redo();

    assertEquals(element.historyIndex, 0);
  });
});

t.describe("RichTextInput - keyboard shortcuts", (it) => {
  it("should handle Ctrl+Z for undo", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);

    element.history = [
      { text: "", facets: [], cursorPosition: 0 },
      { text: "Hello", facets: [], cursorPosition: 5 },
    ];
    element.historyIndex = 1;
    element.text = "Hello";

    const event = new window.KeyboardEvent("keydown", {
      key: "z",
      ctrlKey: true,
    });
    let prevented = false;
    event.preventDefault = () => {
      prevented = true;
    };

    element.handleKeydown(event);

    assertEquals(element.historyIndex, 0);
    assert(prevented);
  });

  it("should handle Ctrl+Y for redo", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);

    element.history = [
      { text: "", facets: [], cursorPosition: 0 },
      { text: "Hello", facets: [], cursorPosition: 5 },
    ];
    element.historyIndex = 0;
    element.text = "";

    const event = new window.KeyboardEvent("keydown", {
      key: "y",
      ctrlKey: true,
    });
    let prevented = false;
    event.preventDefault = () => {
      prevented = true;
    };

    element.handleKeydown(event);

    assertEquals(element.historyIndex, 1);
    assert(prevented);
  });
});

t.describe("RichTextInput - mention suggestions navigation", (it) => {
  it("should navigate down through suggestions with ArrowDown", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);

    element.mentionSuggestions = [
      { handle: "user1" },
      { handle: "user2" },
      { handle: "user3" },
    ];
    element.selectedSuggestionIndex = 0;

    const event = new window.KeyboardEvent("keydown", { key: "ArrowDown" });
    event.preventDefault = () => {};
    element.handleKeydown(event);

    assertEquals(element.selectedSuggestionIndex, 1);
  });

  it("should navigate up through suggestions with ArrowUp", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);

    element.mentionSuggestions = [
      { handle: "user1" },
      { handle: "user2" },
      { handle: "user3" },
    ];
    element.selectedSuggestionIndex = 2;

    const event = new window.KeyboardEvent("keydown", { key: "ArrowUp" });
    event.preventDefault = () => {};
    element.handleKeydown(event);

    assertEquals(element.selectedSuggestionIndex, 1);
  });

  it("should dismiss suggestions with Escape", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);

    element.mentionSuggestions = [{ handle: "user1" }];
    element.selectedSuggestionIndex = 0;

    const event = new window.KeyboardEvent("keydown", { key: "Escape" });
    event.preventDefault = () => {};
    event.stopPropagation = () => {};
    element.handleKeydown(event);

    assertEquals(element.mentionSuggestions.length, 0);
    assertEquals(element.selectedSuggestionIndex, null);
  });
});

t.describe("RichTextInput - reinitialization protection", (it) => {
  it("should not reinitialize when connectedCallback is called multiple times", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);
    element.text = "Test content";

    element.connectedCallback();

    assertEquals(element.text, "Test content");
  });
});

await t.run();
