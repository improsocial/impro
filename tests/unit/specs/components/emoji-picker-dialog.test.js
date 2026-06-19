import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import "/js/components/emoji-picker-dialog.js";

const t = new TestSuite("EmojiPickerDialog");

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

t.beforeEach(() => {
  document.body.innerHTML = "";
});

t.describe("EmojiPickerDialog - initial state", (it) => {
  it("should start closed with no host dialog in the DOM", () => {
    const element = document.createElement("emoji-picker-dialog");
    connectElement(element);
    assertEquals(element.isOpen, false);
    assertEquals(getHostDialog(), null);
  });
});

t.describe("EmojiPickerDialog - open / close", (it) => {
  it("should append a top-level host dialog containing an emoji-picker on open()", () => {
    const element = document.createElement("emoji-picker-dialog");
    connectElement(element);
    element.open();
    assertEquals(element.isOpen, true);
    const host = getHostDialog();
    assert(host !== null, "host dialog should be in the body");
    assertEquals(host.parentElement, document.body);
    assert(host.querySelector("emoji-picker") !== null);
    // The picker should NOT live inside the <emoji-picker-dialog> element.
    assertEquals(element.querySelector("emoji-picker"), null);
  });

  it("should remove the host dialog and flip isOpen on close()", () => {
    const element = document.createElement("emoji-picker-dialog");
    connectElement(element);
    element.open();
    element.close();
    assertEquals(element.isOpen, false);
    assertEquals(getHostDialog(), null);
  });

  it("should be a no-op when open() is called twice in a row", () => {
    const element = document.createElement("emoji-picker-dialog");
    connectElement(element);
    element.open();
    element.open();
    assertEquals(
      document.body.querySelectorAll("dialog.emoji-picker-dialog-host").length,
      1,
    );
  });
});

t.describe("EmojiPickerDialog - emoji-click forwarding", (it) => {
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
    assertEquals(received.emoji, "🎉");
  });
});

t.describe("EmojiPickerDialog - backdrop click", (it) => {
  it("should close when the host dialog itself is clicked (backdrop)", () => {
    const element = document.createElement("emoji-picker-dialog");
    connectElement(element);
    element.open();

    const host = getHostDialog();
    host.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    assertEquals(element.isOpen, false);
    assertEquals(getHostDialog(), null);
  });

  it("should NOT close when a click originates inside the picker", () => {
    const element = document.createElement("emoji-picker-dialog");
    connectElement(element);
    element.open();

    const picker = getHostDialog().querySelector("emoji-picker");
    picker.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    assertEquals(element.isOpen, true);
    assert(getHostDialog() !== null);
  });
});

t.describe("EmojiPickerDialog - disconnection cleanup", (it) => {
  it("should close (remove host dialog, clear isOpen) when removed from the DOM", () => {
    const element = document.createElement("emoji-picker-dialog");
    const container = connectElement(element);
    element.open();
    assertEquals(element.isOpen, true);

    container.removeChild(element);

    assertEquals(element.isOpen, false);
    assertEquals(getHostDialog(), null);
  });
});

await t.run();
