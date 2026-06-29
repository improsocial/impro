import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import "/js/components/rich-text-input.js";

const t = new TestSuite("RichTextInput");

t.beforeEach(() => {
  document.body.innerHTML = "";
  CSS.highlights.clear();
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
    element.setText("Hello");
    const placeholder = element.querySelector(".rich-text-input-placeholder");
    assert(placeholder.classList.contains("hidden"));
  });

  it("should show placeholder when text is cleared", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);
    element.setText("Hello");
    element.setText("");
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

  it("skips updates while IME composition is in progress", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);
    element.setText("hello");

    let inputEvents = 0;
    element.addEventListener("input", () => {
      inputEvents++;
    });

    const input = element.querySelector(".rich-text-input");
    input.dispatchEvent(new window.CompositionEvent("compositionstart"));
    input.textContent = "hello でも";
    input.dispatchEvent(new Event("input"));

    assertEquals(element.text, "hello");
    assertEquals(inputEvents, 0);
  });

  it("resumes updates after composition ends", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);
    element.setText("hello");

    const input = element.querySelector(".rich-text-input");
    input.dispatchEvent(new window.CompositionEvent("compositionstart"));
    input.textContent = "hello でも";
    input.dispatchEvent(new window.CompositionEvent("compositionend"));

    assertEquals(element.text, "hello でも");
  });
});

t.describe("RichTextInput - facet highlights", (it) => {
  it("paints a facet span for a link", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);
    element.setText("Check https://example.com today");
    const input = element.querySelector(".rich-text-input");
    const facets = input.querySelectorAll(".facet");
    assertEquals(facets.length, 1);
    assertEquals(facets[0].textContent, "https://example.com");
  });

  it("paints a facet span for a hashtag", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);
    element.setText("hello #news");
    const input = element.querySelector(".rich-text-input");
    const facets = input.querySelectorAll(".facet");
    assertEquals(facets.length, 1);
    assertEquals(facets[0].textContent, "#news");
  });

  it("clears facet spans when text has no facets", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);
    element.setText("hello #news");
    const input = element.querySelector(".rich-text-input");
    assertEquals(input.querySelectorAll(".facet").length, 1);
    element.setText("hello world");
    assertEquals(input.querySelectorAll(".facet").length, 0);
  });

  it("preserves the text content across facet rendering", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);
    element.setText("hello #news today");
    const input = element.querySelector(".rich-text-input");
    assertEquals(input.textContent, "hello #news today");
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

t.describe("RichTextInput - selectMention", (it) => {
  function withExecCommandStub(fn) {
    const calls = [];
    const original = document.execCommand;
    document.execCommand = (name, _ui, value) => {
      calls.push({ name, value });
      return true;
    };
    try {
      fn(calls);
    } finally {
      document.execCommand = original;
    }
  }

  it("inserts @handle followed by a trailing space via execCommand", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);
    element.setText("Hi @al");
    element.currentMentionStart = 3;
    element.currentMentionEnd = 6;
    element.mentionSuggestions = [{ handle: "alice.bsky.social" }];

    withExecCommandStub((calls) => {
      element.selectMention({ handle: "alice.bsky.social", did: "did:alice" });
      assertEquals(calls.length, 1);
      assertEquals(calls[0].name, "insertText");
      assertEquals(calls[0].value, "@alice.bsky.social ");
    });
  });

  it("clears typeahead state after selecting a mention", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);
    element.setText("Hi @al");
    element.currentMentionStart = 3;
    element.currentMentionEnd = 6;
    element.currentMentionQuery = "al";
    element.mentionSuggestions = [{ handle: "alice.bsky.social" }];
    element.selectedSuggestionIndex = 0;

    withExecCommandStub(() => {
      element.selectMention({ handle: "alice.bsky.social", did: "did:alice" });
    });

    assertEquals(element.mentionSuggestions.length, 0);
    assertEquals(element.selectedSuggestionIndex, null);
    assertEquals(element.currentMentionStart, null);
    assertEquals(element.currentMentionEnd, null);
    assertEquals(element.currentMentionQuery, null);
  });

  it("no-ops when there is no pending mention", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);
    element.currentMentionStart = null;

    withExecCommandStub((calls) => {
      element.selectMention({ handle: "alice.bsky.social" });
      assertEquals(calls.length, 0);
    });
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

t.describe("RichTextInput - setText", (it) => {
  it("updates text and writes it into the contenteditable", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);
    element.setText("Hello world");
    assertEquals(element.text, "Hello world");
    const input = element.querySelector(".rich-text-input");
    assertEquals(input.textContent, "Hello world");
  });

  it("hides the placeholder after setting non-empty text", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);
    element.setText("anything");
    const placeholder = element.querySelector(".rich-text-input-placeholder");
    assert(placeholder.classList.contains("hidden"));
  });

  it("recomputes facets for the new text", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);
    element.setText("check out #news today");
    assert(
      element.facets.some(
        (facet) =>
          facet.features[0].$type === "app.bsky.richtext.facet#tag" &&
          facet.features[0].tag === "news",
      ),
      "should detect a #news tag facet",
    );
  });

  it("dispatches an input event with the new text and facets", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);
    let detail = null;
    element.addEventListener("input", (event) => {
      detail = event.detail;
    });
    element.setText("hi");
    assert(detail !== null, "input event should fire");
    assertEquals(detail.text, "hi");
    assertEquals(detail.facets, element.facets);
  });
});

t.describe("RichTextInput - setCursor", (it) => {
  // JSDOM doesn't track selection state inside contenteditable, so verify the
  // resolved offset by spying on the Range passed to selection.addRange().
  function withSelectionSpy(fn) {
    const captured = [];
    const stub = {
      rangeCount: 0,
      removeAllRanges: () => {},
      addRange: (range) => {
        captured.push({
          startContainer: range.startContainer,
          startOffset: range.startOffset,
        });
      },
    };
    const original = window.getSelection;
    window.getSelection = () => stub;
    try {
      fn();
    } finally {
      window.getSelection = original;
    }
    return captured;
  }

  function lastCursorOffset(element, cursor) {
    const captured = withSelectionSpy(() => element.setCursor(cursor));
    if (captured.length === 0) return null;
    return captured.at(-1).startOffset;
  }

  it("places the cursor at index 0 for setCursor(0)", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);
    element.setText("abcdef");
    assertEquals(lastCursorOffset(element, 0), 0);
  });

  it("places the cursor at a positive index", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);
    element.setText("abcdef");
    assertEquals(lastCursorOffset(element, 3), 3);
  });

  it("clamps positive indexes past the end to the text length", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);
    element.setText("abc");
    assertEquals(lastCursorOffset(element, 99), 3);
  });

  it("clamps negative indexes to 0", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);
    element.setText("abc");
    assertEquals(lastCursorOffset(element, -5), 0);
  });
});

await t.run();
