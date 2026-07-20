import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "/js/components/image-alt-text-dialog.js";

describe("image-alt-text-dialog", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  function connectElement(element) {
    const container = document.createElement("div");
    container.className = "page-visible";
    container.appendChild(element);
    document.body.appendChild(container);
  }

  describe("ImageAltTextDialog - rendering", () => {
    it("should render dialog element", () => {
      const element = document.createElement("image-alt-text-dialog");
      connectElement(element);
      const dialog = element.querySelector(".image-alt-text-dialog");
      assert(dialog !== null);
      assert.deepEqual(dialog.tagName, "DIALOG");
    });

    it("should render header with title", () => {
      const element = document.createElement("image-alt-text-dialog");
      connectElement(element);
      const header = element.querySelector(".image-alt-text-dialog-header h2");
      assert(header !== null);
      assert.deepEqual(header.textContent, "Add alt text");
    });

    it("should render textarea", () => {
      const element = document.createElement("image-alt-text-dialog");
      connectElement(element);
      const textarea = element.querySelector(".image-alt-text-dialog-textarea");
      assert(textarea !== null);
      assert.deepEqual(textarea.placeholder, "Alt text");
    });

    it("should render cancel button", () => {
      const element = document.createElement("image-alt-text-dialog");
      connectElement(element);
      const cancelButton = element.querySelector(
        '[data-testid="alt-text-cancel"]',
      );
      assert(cancelButton !== null);
    });

    it("should render save button", () => {
      const element = document.createElement("image-alt-text-dialog");
      connectElement(element);
      const saveButton = element.querySelector('[data-testid="alt-text-save"]');
      assert(saveButton !== null);
    });

    it("should render character count", () => {
      const element = document.createElement("image-alt-text-dialog");
      connectElement(element);
      const wordCount = element.querySelector(".word-count-text");
      assert(wordCount !== null);
    });
  });

  describe("ImageAltTextDialog - value property", () => {
    it("should return empty string by default", () => {
      const element = document.createElement("image-alt-text-dialog");
      connectElement(element);
      assert.deepEqual(element.value, "");
    });

    it("should set and get value", () => {
      const element = document.createElement("image-alt-text-dialog");
      connectElement(element);
      element.value = "Test alt text";
      assert.deepEqual(element.value, "Test alt text");
    });

    it("should update character count when value changes", () => {
      const element = document.createElement("image-alt-text-dialog");
      connectElement(element);
      element.value = "Hello";
      const wordCount = element.querySelector(".word-count-text");
      assert.deepEqual(wordCount.textContent, "1995"); // 2000 - 5
    });
  });

  describe("ImageAltTextDialog - character limit", () => {
    it("should show remaining characters", () => {
      const element = document.createElement("image-alt-text-dialog");
      connectElement(element);
      element.value = "";
      const wordCount = element.querySelector(".word-count-text");
      assert.deepEqual(wordCount.textContent, "2000");
    });

    it("should add overflow class when over limit", () => {
      const element = document.createElement("image-alt-text-dialog");
      connectElement(element);
      element.value = "x".repeat(2001);
      const wordCountContainer = element.querySelector(".word-count");
      assert(wordCountContainer.classList.contains("overflow"));
    });

    it("should disable save button when over limit", () => {
      const element = document.createElement("image-alt-text-dialog");
      connectElement(element);
      element.value = "x".repeat(2001);
      const saveButton = element.querySelector(".rounded-button-primary");
      assert(saveButton.disabled);
    });
  });

  describe("ImageAltTextDialog - open method", () => {
    it("should show the dialog when open() is called", () => {
      const element = document.createElement("image-alt-text-dialog");
      connectElement(element);
      element.open();
      const dialog = element.querySelector(".image-alt-text-dialog");
      assert(dialog.open);
    });

    it("focuses the textarea without scrolling when opened", (t) => {
      const element = document.createElement("image-alt-text-dialog");
      connectElement(element);
      const textarea = element.querySelector(".image-alt-text-dialog-textarea");
      const focusMock = t.mock.method(textarea, "focus");

      element.open();

      assert.equal(document.activeElement, textarea);
      assert.deepEqual(focusMock.mock.calls[0].arguments, [
        { preventScroll: true },
      ]);
      assert(
        element
          .querySelector(".image-alt-text-dialog")
          .hasAttribute("autofocus"),
      );
    });
  });

  describe("ImageAltTextDialog - close method", () => {
    it("should close the dialog when close() is called", () => {
      const element = document.createElement("image-alt-text-dialog");
      connectElement(element);
      element.open();
      element.close();
      const dialog = element.querySelector(".image-alt-text-dialog");
      assert(!dialog.open);
    });

    it("should dispatch alt-text-dialog-closed event when close() is called", () => {
      const element = document.createElement("image-alt-text-dialog");
      connectElement(element);
      element.open();

      let eventFired = false;
      element.addEventListener("alt-text-dialog-closed", () => {
        eventFired = true;
      });

      element.close();
      assert(eventFired);
    });
  });

  describe("ImageAltTextDialog - save method", () => {
    it("should dispatch alt-text-saved event with alt text", () => {
      const element = document.createElement("image-alt-text-dialog");
      connectElement(element);
      element.value = "My alt text";
      element.open();

      let receivedAltText = null;
      element.addEventListener("alt-text-saved", (e) => {
        receivedAltText = e.detail.altText;
      });

      element.save();
      assert.deepEqual(receivedAltText, "My alt text");
    });

    it("should close the dialog after save", () => {
      const element = document.createElement("image-alt-text-dialog");
      connectElement(element);
      element.open();
      element.save();
      const dialog = element.querySelector(".image-alt-text-dialog");
      assert(!dialog.open);
    });
  });

  describe("ImageAltTextDialog - cancel button", () => {
    it("should close dialog when cancel button is clicked", () => {
      const element = document.createElement("image-alt-text-dialog");
      connectElement(element);
      element.open();

      const cancelButton = element.querySelector(".rounded-button-secondary");
      cancelButton.click();

      const dialog = element.querySelector(".image-alt-text-dialog");
      assert(!dialog.open);
    });
  });

  describe("ImageAltTextDialog - reinitialization protection", () => {
    it("should not reinitialize when connectedCallback is called multiple times", () => {
      const element = document.createElement("image-alt-text-dialog");
      connectElement(element);
      element.value = "Test value";

      element.connectedCallback();

      assert.deepEqual(element.value, "Test value");
    });
  });
});
