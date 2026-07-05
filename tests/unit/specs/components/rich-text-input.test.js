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

  it("should render an empty line when empty, so the input keeps its one-line height", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);
    const input = element.querySelector(".rich-text-input");
    assert(input.querySelector("div > br") !== null);
    assertEquals(element.text, "");
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

t.describe("RichTextInput - focus and blur methods", (it) => {
  it("should focus the contenteditable div when focus() is called", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);
    element.focus();
    const input = element.querySelector(".rich-text-input");
    assertEquals(document.activeElement, input);
  });

  it("should blur the contenteditable div when blur() is called", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);
    element.focus();
    element.blur();
    const input = element.querySelector(".rich-text-input");
    assert(document.activeElement !== input);
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

  it("reports insertFromPaste in the input detail for pasted text", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);
    const input = element.querySelector(".rich-text-input");

    const details = [];
    element.addEventListener("input", (event) => {
      details.push(event.detail);
    });

    const originalExecCommand = document.execCommand;
    // Like the browser, insert the text and fire input synchronously
    document.execCommand = (name, _ui, value) => {
      input.textContent = input.textContent + value;
      input.dispatchEvent(new window.InputEvent("input"));
      return true;
    };
    try {
      const pasteEvent = new window.Event("paste", {
        bubbles: true,
        cancelable: true,
      });
      pasteEvent.clipboardData = { getData: () => "pasted" };
      input.dispatchEvent(pasteEvent);
    } finally {
      document.execCommand = originalExecCommand;
    }

    assertEquals(details.length, 1);
    assertEquals(details[0].text, "pasted");
    assertEquals(details[0].inputType, "insertFromPaste");
  });

  it("passes the native inputType through in the input detail", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);
    const input = element.querySelector(".rich-text-input");

    const details = [];
    element.addEventListener("input", (event) => {
      details.push(event.detail);
    });

    input.textContent = "a";
    input.dispatchEvent(
      new window.InputEvent("input", { inputType: "insertText" }),
    );
    element.setText("reset");

    assertEquals(details.length, 2);
    assertEquals(details[0].inputType, "insertText");
    assertEquals(details[1].inputType, null);
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

t.describe("RichTextInput - blur", (it) => {
  it("closes the typeahead and clears mention state on blur", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);
    element.setText("Hi @al");
    element.currentMentionStart = 3;
    element.currentMentionEnd = 6;
    element.currentMentionQuery = "al";
    element.mentionSuggestions = [{ handle: "alice.bsky.social" }];
    element.openTypeahead();
    assert(document.querySelector(".mention-typeahead-host") !== null);

    const input = element.querySelector(".rich-text-input");
    input.dispatchEvent(new window.FocusEvent("blur"));

    assertEquals(document.querySelector(".mention-typeahead-host"), null);
    assertEquals(element.mentionSuggestions.length, 0);
    assertEquals(element.currentMentionQuery, null);
  });

  it("prevents default on typeahead mousedown so suggestion clicks don't blur the input", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);
    element.mentionSuggestions = [{ handle: "alice.bsky.social" }];
    element.openTypeahead();

    const typeahead = document.querySelector(
      ".mention-typeahead-host .mention-typeahead",
    );
    const mousedown = new window.MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
    });
    typeahead.dispatchEvent(mousedown);

    assert(mousedown.defaultPrevented);
    element.closeTypeahead();
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

t.describe("RichTextInput - disabled attribute", (it) => {
  it("renders contenteditable=false when disabled is set", () => {
    const element = document.createElement("rich-text-input");
    element.setAttribute("disabled", "");
    document.body.appendChild(element);
    const input = element.querySelector(".rich-text-input");
    assertEquals(input.getAttribute("contenteditable"), "false");
  });

  it("toggles contenteditable when the attribute changes", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);
    const input = element.querySelector(".rich-text-input");
    assertEquals(input.getAttribute("contenteditable"), "true");
    element.setAttribute("disabled", "");
    assertEquals(input.getAttribute("contenteditable"), "false");
    element.removeAttribute("disabled");
    assertEquals(input.getAttribute("contenteditable"), "true");
  });
});

t.describe("RichTextInput - getCursor", (it) => {
  it("returns the caret position within the text", () => {
    const element = document.createElement("rich-text-input");
    document.body.appendChild(element);
    element.setText("abcdef");
    const input = element.querySelector(".rich-text-input");
    const textNode = [...input.querySelector("div").childNodes].find(
      (node) => node.nodeType === Node.TEXT_NODE,
    );

    const originalGetSelection = window.getSelection;
    window.getSelection = () => ({
      rangeCount: 1,
      getRangeAt: () => ({ endContainer: textNode, endOffset: 3 }),
    });
    try {
      assertEquals(element.getCursor(), 3);
    } finally {
      window.getSelection = originalGetSelection;
    }
  });
});

t.describe(
  "RichTextInput - typeahead direction",
  (it, { beforeEach, afterEach }) => {
    let originalRangeRect;

    beforeEach(() => {
      originalRangeRect = window.Range.prototype.getBoundingClientRect;
      window.Range.prototype.getBoundingClientRect = () => ({
        top: 100,
        bottom: 120,
        left: 0,
        right: 0,
        width: 0,
        height: 20,
      });
    });

    afterEach(() => {
      window.Range.prototype.getBoundingClientRect = originalRangeRect;
    });

    function openTypeaheadAt(element) {
      element.setText("Hi @al");
      element.currentMentionStart = 3;
      element.currentMentionEnd = 6;
      element.mentionSuggestions = [{ handle: "alice.bsky.social" }];
      element.querySelector(".rich-text-input").getBoundingClientRect = () => ({
        top: 200,
        bottom: 240,
        left: 10,
        right: 310,
        width: 300,
        height: 40,
      });
      element.openTypeahead();
      element.positionTypeahead();
      return document.querySelector(
        ".mention-typeahead-host .mention-typeahead",
      );
    }

    it("opens downward from the caret by default", () => {
      const element = document.createElement("rich-text-input");
      document.body.appendChild(element);
      const typeahead = openTypeaheadAt(element);
      assert(typeahead !== null);
      assert(!typeahead.classList.contains("mention-typeahead-above"));
      assertEquals(typeahead.style.top, "120px");
      assertEquals(typeahead.style.bottom, "");
      element.closeTypeahead();
    });

    it("opens upward when typeahead-direction is up", () => {
      const element = document.createElement("rich-text-input");
      element.setAttribute("typeahead-direction", "up");
      document.body.appendChild(element);
      const typeahead = openTypeaheadAt(element);
      assert(typeahead !== null);
      assert(typeahead.classList.contains("mention-typeahead-above"));
      assertEquals(typeahead.style.bottom, `${window.innerHeight - 200}px`);
      assertEquals(typeahead.style.top, "");
      element.closeTypeahead();
    });
  },
);

t.describe(
  "RichTextInput - typeahead empty state",
  (it, { beforeEach, afterEach }) => {
    let originalFetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({ actors: [] }),
      });
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it("shows an empty state when the query has no matches", async () => {
      const element = document.createElement("rich-text-input");
      document.body.appendChild(element);
      element.setText("Hi @zz");
      element.detectPendingMention = () => ({ query: "zz", start: 3, end: 6 });

      await element.updateMentionSuggestions();

      const emptyState = document.querySelector(
        '.mention-typeahead [data-testid="empty-state"]',
      );
      assert(emptyState !== null);
      assertEquals(document.querySelectorAll(".mention-suggestion").length, 0);
      element.closeTypeahead();
    });

    it("closes the empty-state typeahead with Escape", async () => {
      const element = document.createElement("rich-text-input");
      document.body.appendChild(element);
      element.setText("Hi @zz");
      element.detectPendingMention = () => ({ query: "zz", start: 3, end: 6 });
      await element.updateMentionSuggestions();
      assert(document.querySelector(".mention-typeahead-host") !== null);

      const event = new window.KeyboardEvent("keydown", {
        key: "Escape",
        cancelable: true,
      });
      element.handleKeydown(event);

      assert(event.defaultPrevented);
      assertEquals(document.querySelector(".mention-typeahead-host"), null);
      assertEquals(element.currentMentionQuery, null);
    });
  },
);

t.describe(
  "RichTextInput - stale suggestion responses",
  (it, { beforeEach, afterEach }) => {
    let originalFetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    function deferredResponse() {
      let resolve;
      const promise = new Promise((promiseResolve) => {
        resolve = promiseResolve;
      });
      return {
        promise,
        resolveWith: (actors) =>
          resolve({ ok: true, json: async () => ({ actors }) }),
      };
    }

    it("ignores a response that arrives after a newer request", async () => {
      const element = document.createElement("rich-text-input");
      document.body.appendChild(element);
      element.setText("Hi @al");

      const first = deferredResponse();
      const second = deferredResponse();
      const pending = [first.promise, second.promise];
      globalThis.fetch = () => pending.shift();

      element.detectPendingMention = () => ({ query: "al", start: 3, end: 6 });
      const firstUpdate = element.updateMentionSuggestions();
      element.detectPendingMention = () => ({ query: "ali", start: 3, end: 7 });
      const secondUpdate = element.updateMentionSuggestions();

      second.resolveWith([{ handle: "ali.bsky.social" }]);
      await secondUpdate;
      assertEquals(element.mentionSuggestions[0].handle, "ali.bsky.social");

      first.resolveWith([{ handle: "al.bsky.social" }]);
      await firstUpdate;
      assertEquals(element.mentionSuggestions.length, 1);
      assertEquals(element.mentionSuggestions[0].handle, "ali.bsky.social");
      element.closeTypeahead();
    });

    it("ignores a response that arrives after the pending mention was cleared", async () => {
      const element = document.createElement("rich-text-input");
      document.body.appendChild(element);
      element.setText("Hi @al");

      const first = deferredResponse();
      globalThis.fetch = () => first.promise;

      element.detectPendingMention = () => ({ query: "al", start: 3, end: 6 });
      const firstUpdate = element.updateMentionSuggestions();
      element.detectPendingMention = () => null;
      await element.updateMentionSuggestions();

      first.resolveWith([{ handle: "al.bsky.social" }]);
      await firstUpdate;
      assertEquals(element.mentionSuggestions.length, 0);
    });
  },
);

await t.run();
