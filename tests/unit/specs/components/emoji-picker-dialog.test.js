import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";

// The emoji-picker-element library reads `Element.prototype` at module load,
// so expose JSDOM's Element on the global before the dialog module is imported.
globalThis.Element = globalThis.window.Element;

// Pre-register a stub `emoji-picker` so the real library does not try to
// define itself (it depends on browser features JSDOM doesn't implement).
class EmojiPickerStub extends globalThis.window.HTMLElement {}
globalThis.customElements.define("emoji-picker", EmojiPickerStub);

await import("/js/components/emoji-picker-dialog.js");

const t = new TestSuite("EmojiPickerDialog");

function connectElement(element) {
  const container = document.createElement("div");
  container.className = "page-visible";
  container.appendChild(element);
  document.body.appendChild(container);
  return container;
}

t.beforeEach(() => {
  document.body.innerHTML = "";
});

t.describe("EmojiPickerDialog - initial state", (it) => {
  it("should start closed with no picker child", () => {
    const element = document.createElement("emoji-picker-dialog");
    connectElement(element);
    assertEquals(element.isOpen, false);
    assertEquals(element.querySelector("emoji-picker"), null);
  });
});

t.describe("EmojiPickerDialog - open / close", (it) => {
  it("should append an emoji-picker child and flip isOpen on open()", () => {
    const element = document.createElement("emoji-picker-dialog");
    connectElement(element);
    element.open();
    assertEquals(element.isOpen, true);
    assert(element.querySelector("emoji-picker") !== null);
  });

  it("should remove the picker and flip isOpen on close()", () => {
    const element = document.createElement("emoji-picker-dialog");
    connectElement(element);
    element.open();
    element.close();
    assertEquals(element.isOpen, false);
    assertEquals(element.querySelector("emoji-picker"), null);
  });

  it("should be a no-op when open() is called twice in a row", () => {
    const element = document.createElement("emoji-picker-dialog");
    connectElement(element);
    element.open();
    element.open();
    assertEquals(element.querySelectorAll("emoji-picker").length, 1);
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

    const picker = element.querySelector("emoji-picker");
    picker.dispatchEvent(
      new CustomEvent("emoji-click", {
        detail: { unicode: "🎉" },
        bubbles: true,
      }),
    );

    assert(received !== null, "select event should fire");
    assertEquals(received.emoji, "🎉");
  });

  it("should stop click propagation past the dialog", () => {
    const element = document.createElement("emoji-picker-dialog");
    const container = connectElement(element);
    element.open();

    let containerClicked = false;
    container.addEventListener("click", () => {
      containerClicked = true;
    });

    element
      .querySelector("emoji-picker")
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));

    assertEquals(containerClicked, false);
  });
});

t.describe("EmojiPickerDialog - disconnection cleanup", (it) => {
  it("should close (remove picker, clear isOpen) when removed from the DOM", () => {
    const element = document.createElement("emoji-picker-dialog");
    const container = connectElement(element);
    element.open();
    assertEquals(element.isOpen, true);

    container.removeChild(element);

    assertEquals(element.isOpen, false);
    assertEquals(element.querySelector("emoji-picker"), null);
  });
});

await t.run();
