import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "/js/components/emoji-picker-dialog.js";

describe("emoji-picker-dialog", () => {
  function connectElement(element) {
    const container = document.createElement("div");
    container.className = "page-visible";
    container.appendChild(element);
    document.body.appendChild(container);
    return container;
  }

  function getHostDialog() {
    return document.body.querySelector("dialog.emoji-picker-dialog-host");
  }

  beforeEach(() => {
    document.body.innerHTML = "";
  });

  describe("EmojiPickerDialog - initial state", () => {
    it("should start closed with no host dialog in the DOM", () => {
      const element = document.createElement("emoji-picker-dialog");
      connectElement(element);
      assert.deepEqual(element.isOpen, false);
      assert.deepEqual(getHostDialog(), null);
    });
  });

  describe("EmojiPickerDialog - open / close", () => {
    it("should append a top-level host dialog containing an emoji-picker on open()", () => {
      const element = document.createElement("emoji-picker-dialog");
      connectElement(element);
      element.open();
      assert.deepEqual(element.isOpen, true);
      const host = getHostDialog();
      assert(host !== null, "host dialog should be in the body");
      assert.deepEqual(host.parentElement, document.body);
      assert(host.querySelector("emoji-picker") !== null);
      // The picker should NOT live inside the <emoji-picker-dialog> element.
      assert.deepEqual(element.querySelector("emoji-picker"), null);
    });

    it("should remove the host dialog and flip isOpen on close()", async () => {
      const element = document.createElement("emoji-picker-dialog");
      connectElement(element);
      element.open();
      await element.close();
      assert.deepEqual(element.isOpen, false);
      assert.deepEqual(getHostDialog(), null);
    });

    it("should be a no-op when open() is called twice in a row", () => {
      const element = document.createElement("emoji-picker-dialog");
      connectElement(element);
      element.open();
      element.open();
      assert.deepEqual(
        document.body.querySelectorAll("dialog.emoji-picker-dialog-host")
          .length,
        1,
      );
    });
  });

  describe("EmojiPickerDialog - emoji-click forwarding", () => {
    it("should re-dispatch emoji-click as a 'select' event with the unicode", () => {
      const element = document.createElement("emoji-picker-dialog");
      connectElement(element);
      element.open();

      let received = null;
      element.addEventListener("select", (event) => {
        received = event.detail;
      });

      const picker = getHostDialog().querySelector("emoji-picker");
      picker.dispatchEvent(
        new CustomEvent("emoji-click", {
          detail: { unicode: "🎉" },
          bubbles: true,
        }),
      );

      assert(received !== null, "select event should fire");
      assert.deepEqual(received.emoji, "🎉");
    });
  });

  describe("EmojiPickerDialog - backdrop click", () => {
    it("should close when the host dialog itself is clicked (backdrop)", async () => {
      const element = document.createElement("emoji-picker-dialog");
      connectElement(element);
      element.open();

      const host = getHostDialog();
      host.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();

      assert.deepEqual(element.isOpen, false);
      assert.deepEqual(getHostDialog(), null);
    });

    it("should NOT close when a click originates inside the picker", () => {
      const element = document.createElement("emoji-picker-dialog");
      connectElement(element);
      element.open();

      const picker = getHostDialog().querySelector("emoji-picker");
      picker.dispatchEvent(new MouseEvent("click", { bubbles: true }));

      assert.deepEqual(element.isOpen, true);
      assert(getHostDialog() !== null);
    });
  });

  describe("EmojiPickerDialog - disconnection cleanup", () => {
    it("should close (remove host dialog, clear isOpen) when removed from the DOM", async () => {
      const element = document.createElement("emoji-picker-dialog");
      const container = connectElement(element);
      element.open();
      assert.deepEqual(element.isOpen, true);

      container.removeChild(element);
      await Promise.resolve();

      assert.deepEqual(element.isOpen, false);
      assert.deepEqual(getHostDialog(), null);
    });
  });
});
