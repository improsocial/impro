import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "/js/components/reaction-palette.js";

describe("reaction-palette", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  function connectPalette() {
    const palette = document.createElement("reaction-palette");
    document.body.appendChild(palette);
    return palette;
  }

  function openPicker(palette) {
    const moreButton = palette.querySelector(".reaction-palette-button-more");
    moreButton.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    return document.body.querySelector("dialog.emoji-picker-dialog-host");
  }

  describe("outside-click handling", () => {
    it("should dispatch close when clicking outside the palette", () => {
      const palette = connectPalette();
      let closeEvent = null;
      palette.addEventListener("close", (event) => {
        closeEvent = event;
      });

      document.body.dispatchEvent(
        new window.MouseEvent("click", { bubbles: true }),
      );

      assert(closeEvent !== null, "close event should fire");
      assert.deepEqual(closeEvent.detail.reason, "outside");
    });

    it("should not dispatch close when clicking inside the emoji picker", () => {
      const palette = connectPalette();
      let closeEvent = null;
      palette.addEventListener("close", (event) => {
        closeEvent = event;
      });

      const host = openPicker(palette);
      assert(host !== null, "picker host dialog should open");
      const picker = host.querySelector("emoji-picker");
      picker.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));

      assert.deepEqual(closeEvent, null);
      assert(
        document.body.querySelector("dialog.emoji-picker-dialog-host") !== null,
        "picker should stay open",
      );
    });

    it("should still dispatch close on a picker backdrop click", () => {
      const palette = connectPalette();
      let closeEvent = null;
      palette.addEventListener("close", (event) => {
        closeEvent = event;
      });

      const host = openPicker(palette);
      host.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));

      assert(closeEvent !== null, "close event should fire");
      assert.deepEqual(closeEvent.detail.reason, "outside");
    });
  });
});
