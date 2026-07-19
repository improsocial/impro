import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import "/js/components/rich-text-input.js";

describe("rich-text-input", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    CSS.highlights.clear();
  });

  describe("RichTextInput - rendering", () => {
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
      assert.deepEqual(input.getAttribute("contenteditable"), "true");
    });

    it("should render an empty line when empty, so the input keeps its one-line height", () => {
      const element = document.createElement("rich-text-input");
      document.body.appendChild(element);
      const input = element.querySelector(".rich-text-input");
      assert(input.querySelector("div > br") !== null);
      assert.deepEqual(element.text, "");
    });

    it("should reflect autofocus onto the contenteditable div", () => {
      const element = document.createElement("rich-text-input");
      element.setAttribute("autofocus", "");
      document.body.appendChild(element);
      const input = element.querySelector(".rich-text-input");
      assert(input.hasAttribute("autofocus"));
    });

    it("should not set autofocus on the contenteditable div by default", () => {
      const element = document.createElement("rich-text-input");
      document.body.appendChild(element);
      const input = element.querySelector(".rich-text-input");
      assert(!input.hasAttribute("autofocus"));
    });

    it("should update the contenteditable autofocus when the attribute changes", () => {
      const element = document.createElement("rich-text-input");
      document.body.appendChild(element);
      element.setAttribute("autofocus", "");
      const input = element.querySelector(".rich-text-input");
      assert(input.hasAttribute("autofocus"));
      element.removeAttribute("autofocus");
      assert(!input.hasAttribute("autofocus"));
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
      assert.deepEqual(placeholder.textContent.trim(), "What's on your mind?");
    });
  });

  describe("RichTextInput - initial state", () => {
    it("should start with empty text", () => {
      const element = document.createElement("rich-text-input");
      document.body.appendChild(element);
      assert.deepEqual(element.text, "");
    });

    it("should start with empty facets", () => {
      const element = document.createElement("rich-text-input");
      document.body.appendChild(element);
      assert.deepEqual(element.facets.length, 0);
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
      assert.deepEqual(element.mentionSuggestions.length, 0);
    });
  });

  describe("RichTextInput - placeholder visibility", () => {
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

  describe("RichTextInput - focus and blur methods", () => {
    it("should focus the contenteditable div when focus() is called", () => {
      const element = document.createElement("rich-text-input");
      document.body.appendChild(element);
      element.focus();
      const input = element.querySelector(".rich-text-input");
      assert.deepEqual(document.activeElement, input);
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

  describe("RichTextInput - input handling", () => {
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

      assert.deepEqual(receivedText, "Hello world");
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

      assert.deepEqual(details.length, 1);
      assert.deepEqual(details[0].text, "pasted");
      assert.deepEqual(details[0].inputType, "insertFromPaste");
    });

    it("falls back to text/uri-list when text/plain is empty on paste", () => {
      const element = document.createElement("rich-text-input");
      document.body.appendChild(element);
      const input = element.querySelector(".rich-text-input");

      const details = [];
      element.addEventListener("input", (event) => {
        details.push(event.detail);
      });

      const originalExecCommand = document.execCommand;
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
        pasteEvent.clipboardData = {
          getData: (type) =>
            type === "text/uri-list"
              ? "# copied from share sheet\r\nhttps://example.com/a\r\nhttps://example.com/b"
              : "",
        };
        input.dispatchEvent(pasteEvent);
      } finally {
        document.execCommand = originalExecCommand;
      }

      assert.deepEqual(details.length, 1);
      assert.deepEqual(
        details[0].text,
        "https://example.com/a\nhttps://example.com/b",
      );
      assert.deepEqual(details[0].inputType, "insertFromPaste");
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

      assert.deepEqual(details.length, 2);
      assert.deepEqual(details[0].inputType, "insertText");
      assert.deepEqual(details[1].inputType, null);
    });

    it("updates text and dispatches input during IME composition without repainting facets", () => {
      const element = document.createElement("rich-text-input");
      document.body.appendChild(element);

      const details = [];
      element.addEventListener("input", (event) => {
        details.push(event.detail);
      });

      const input = element.querySelector(".rich-text-input");
      input.dispatchEvent(new window.CompositionEvent("compositionstart"));
      input.textContent = "https://example.com";
      input.dispatchEvent(new Event("input"));

      assert.deepEqual(element.text, "https://example.com");
      assert.deepEqual(details.length, 1);
      assert.deepEqual(details[0].text, "https://example.com");
      const placeholder = element.querySelector(".rich-text-input-placeholder");
      assert(placeholder.classList.contains("hidden"));
      assert.deepEqual(input.querySelectorAll(".facet").length, 0);
    });

    it("paints facets when composition ends", () => {
      const element = document.createElement("rich-text-input");
      document.body.appendChild(element);

      const input = element.querySelector(".rich-text-input");
      input.dispatchEvent(new window.CompositionEvent("compositionstart"));
      input.textContent = "https://example.com";
      input.dispatchEvent(new Event("input"));
      input.dispatchEvent(new window.CompositionEvent("compositionend"));

      assert.deepEqual(element.text, "https://example.com");
      assert.deepEqual(input.querySelectorAll(".facet").length, 1);
    });
  });

  describe("RichTextInput - facet highlights", () => {
    it("paints a facet span for a link", () => {
      const element = document.createElement("rich-text-input");
      document.body.appendChild(element);
      element.setText("Check https://example.com today");
      const input = element.querySelector(".rich-text-input");
      const facets = input.querySelectorAll(".facet");
      assert.deepEqual(facets.length, 1);
      assert.deepEqual(facets[0].textContent, "https://example.com");
    });

    it("paints a facet span for a hashtag", () => {
      const element = document.createElement("rich-text-input");
      document.body.appendChild(element);
      element.setText("hello #news");
      const input = element.querySelector(".rich-text-input");
      const facets = input.querySelectorAll(".facet");
      assert.deepEqual(facets.length, 1);
      assert.deepEqual(facets[0].textContent, "#news");
    });

    it("clears facet spans when text has no facets", () => {
      const element = document.createElement("rich-text-input");
      document.body.appendChild(element);
      element.setText("hello #news");
      const input = element.querySelector(".rich-text-input");
      assert.deepEqual(input.querySelectorAll(".facet").length, 1);
      element.setText("hello world");
      assert.deepEqual(input.querySelectorAll(".facet").length, 0);
    });

    it("preserves the text content across facet rendering", () => {
      const element = document.createElement("rich-text-input");
      document.body.appendChild(element);
      element.setText("hello #news today");
      const input = element.querySelector(".rich-text-input");
      assert.deepEqual(input.textContent, "hello #news today");
    });
  });

  describe("RichTextInput - mention suggestions navigation", () => {
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

      assert.deepEqual(element.selectedSuggestionIndex, 1);
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

      assert.deepEqual(element.selectedSuggestionIndex, 1);
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

      assert.deepEqual(element.mentionSuggestions.length, 0);
      assert.deepEqual(element.selectedSuggestionIndex, null);
    });
  });

  describe("RichTextInput - blur", () => {
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

      assert.deepEqual(document.querySelector(".mention-typeahead-host"), null);
      assert.deepEqual(element.mentionSuggestions.length, 0);
      assert.deepEqual(element.currentMentionQuery, null);
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

  describe("RichTextInput - selectMention", () => {
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
        element.selectMention({
          handle: "alice.bsky.social",
          did: "did:alice",
        });
        assert.deepEqual(calls.length, 1);
        assert.deepEqual(calls[0].name, "insertText");
        assert.deepEqual(calls[0].value, "@alice.bsky.social ");
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
        element.selectMention({
          handle: "alice.bsky.social",
          did: "did:alice",
        });
      });

      assert.deepEqual(element.mentionSuggestions.length, 0);
      assert.deepEqual(element.selectedSuggestionIndex, null);
      assert.deepEqual(element.currentMentionStart, null);
      assert.deepEqual(element.currentMentionEnd, null);
      assert.deepEqual(element.currentMentionQuery, null);
    });

    it("no-ops when there is no pending mention", () => {
      const element = document.createElement("rich-text-input");
      document.body.appendChild(element);
      element.currentMentionStart = null;

      withExecCommandStub((calls) => {
        element.selectMention({ handle: "alice.bsky.social" });
        assert.deepEqual(calls.length, 0);
      });
    });
  });

  describe("RichTextInput - reinitialization protection", () => {
    it("should not reinitialize when connectedCallback is called multiple times", () => {
      const element = document.createElement("rich-text-input");
      document.body.appendChild(element);
      element.text = "Test content";

      element.connectedCallback();

      assert.deepEqual(element.text, "Test content");
    });
  });

  describe("RichTextInput - setText", () => {
    it("updates text and writes it into the contenteditable", () => {
      const element = document.createElement("rich-text-input");
      document.body.appendChild(element);
      element.setText("Hello world");
      assert.deepEqual(element.text, "Hello world");
      const input = element.querySelector(".rich-text-input");
      assert.deepEqual(input.textContent, "Hello world");
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
      assert.deepEqual(detail.text, "hi");
      assert.deepEqual(detail.facets, element.facets);
    });
  });

  describe("RichTextInput - setCursor", () => {
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
      assert.deepEqual(lastCursorOffset(element, 0), 0);
    });

    it("places the cursor at a positive index", () => {
      const element = document.createElement("rich-text-input");
      document.body.appendChild(element);
      element.setText("abcdef");
      assert.deepEqual(lastCursorOffset(element, 3), 3);
    });

    it("clamps positive indexes past the end to the text length", () => {
      const element = document.createElement("rich-text-input");
      document.body.appendChild(element);
      element.setText("abc");
      assert.deepEqual(lastCursorOffset(element, 99), 3);
    });

    it("clamps negative indexes to 0", () => {
      const element = document.createElement("rich-text-input");
      document.body.appendChild(element);
      element.setText("abc");
      assert.deepEqual(lastCursorOffset(element, -5), 0);
    });
  });

  describe("RichTextInput - disabled attribute", () => {
    it("renders contenteditable=false when disabled is set", () => {
      const element = document.createElement("rich-text-input");
      element.setAttribute("disabled", "");
      document.body.appendChild(element);
      const input = element.querySelector(".rich-text-input");
      assert.deepEqual(input.getAttribute("contenteditable"), "false");
    });

    it("toggles contenteditable when the attribute changes", () => {
      const element = document.createElement("rich-text-input");
      document.body.appendChild(element);
      const input = element.querySelector(".rich-text-input");
      assert.deepEqual(input.getAttribute("contenteditable"), "true");
      element.setAttribute("disabled", "");
      assert.deepEqual(input.getAttribute("contenteditable"), "false");
      element.removeAttribute("disabled");
      assert.deepEqual(input.getAttribute("contenteditable"), "true");
    });
  });

  describe("RichTextInput - getCursor", () => {
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
        assert.deepEqual(element.getCursor(), 3);
      } finally {
        window.getSelection = originalGetSelection;
      }
    });
  });

  describe("RichTextInput - insertText", () => {
    it("inserts at the given position and moves the caret past the inserted text", () => {
      const element = document.createElement("rich-text-input");
      document.body.appendChild(element);
      element.setText("abcdef");
      element.insertText("XY", 2);
      assert.deepEqual(element.text, "abXYcdef");
    });

    it("falls back to the current cursor when position is null", () => {
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
        removeAllRanges: () => {},
        addRange: () => {},
      });
      try {
        element.insertText("Z", null);
      } finally {
        window.getSelection = originalGetSelection;
      }
      assert.deepEqual(element.text, "abcZdef");
    });
  });

  describe("RichTextInput - typeahead direction", () => {
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
      assert.deepEqual(typeahead.style.top, "120px");
      assert.deepEqual(typeahead.style.bottom, "");
      element.closeTypeahead();
    });

    it("opens upward when typeahead-direction is up", () => {
      const element = document.createElement("rich-text-input");
      element.setAttribute("typeahead-direction", "up");
      document.body.appendChild(element);
      const typeahead = openTypeaheadAt(element);
      assert(typeahead !== null);
      assert(typeahead.classList.contains("mention-typeahead-above"));
      assert.deepEqual(typeahead.style.bottom, `${window.innerHeight - 100}px`);
      assert.deepEqual(typeahead.style.top, "");
      element.closeTypeahead();
    });
  });

  describe("RichTextInput - typeahead empty state", () => {
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
      assert.deepEqual(
        document.querySelectorAll(".mention-suggestion").length,
        0,
      );
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
      assert.deepEqual(document.querySelector(".mention-typeahead-host"), null);
      assert.deepEqual(element.currentMentionQuery, null);
    });
  });

  describe("RichTextInput - stale suggestion responses", () => {
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
      assert.deepEqual(element.mentionSuggestions[0].handle, "ali.bsky.social");

      first.resolveWith([{ handle: "al.bsky.social" }]);
      await firstUpdate;
      assert.deepEqual(element.mentionSuggestions.length, 1);
      assert.deepEqual(element.mentionSuggestions[0].handle, "ali.bsky.social");
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
      assert.deepEqual(element.mentionSuggestions.length, 0);
    });
  });
});
