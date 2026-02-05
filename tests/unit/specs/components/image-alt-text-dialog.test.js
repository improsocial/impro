import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import "/js/components/image-alt-text-dialog.js";

const t = new TestSuite("ImageAltTextDialog");

t.beforeEach(() => {
  document.body.innerHTML = "";
});

function connectElement(element) {
  const container = document.createElement("div");
  container.className = "page-visible";
  container.appendChild(element);
  document.body.appendChild(container);
}

t.describe("ImageAltTextDialog - rendering", (it) => {
  it("should render dialog element", () => {
    const element = document.createElement("image-alt-text-dialog");
    connectElement(element);
    const dialog = element.querySelector(".image-alt-text-dialog");
    assert(dialog !== null);
    assertEquals(dialog.tagName, "DIALOG");
  });

  it("should render header with title", () => {
    const element = document.createElement("image-alt-text-dialog");
    connectElement(element);
    const header = element.querySelector(".image-alt-text-dialog-header h2");
    assert(header !== null);
    assertEquals(header.textContent, "Add alt text");
  });

  it("should render textarea", () => {
    const element = document.createElement("image-alt-text-dialog");
    connectElement(element);
    const textarea = element.querySelector(".image-alt-text-dialog-textarea");
    assert(textarea !== null);
    assertEquals(textarea.placeholder, "Alt text");
  });

  it("should render cancel button", () => {
    const element = document.createElement("image-alt-text-dialog");
    connectElement(element);
    const cancelButton = element.querySelector(".rounded-button-secondary");
    assert(cancelButton !== null);
    assertEquals(cancelButton.textContent.trim(), "Cancel");
  });

  it("should render save button", () => {
    const element = document.createElement("image-alt-text-dialog");
    connectElement(element);
    const saveButton = element.querySelector(".rounded-button-primary");
    assert(saveButton !== null);
    assertEquals(saveButton.textContent.trim(), "Save");
  });

  it("should render character count", () => {
    const element = document.createElement("image-alt-text-dialog");
    connectElement(element);
    const wordCount = element.querySelector(".word-count-text");
    assert(wordCount !== null);
  });
});

t.describe("ImageAltTextDialog - value property", (it) => {
  it("should return empty string by default", () => {
    const element = document.createElement("image-alt-text-dialog");
    connectElement(element);
    assertEquals(element.value, "");
  });

  it("should set and get value", () => {
    const element = document.createElement("image-alt-text-dialog");
    connectElement(element);
    element.value = "Test alt text";
    assertEquals(element.value, "Test alt text");
  });

  it("should update character count when value changes", () => {
    const element = document.createElement("image-alt-text-dialog");
    connectElement(element);
    element.value = "Hello";
    const wordCount = element.querySelector(".word-count-text");
    assertEquals(wordCount.textContent, "1995"); // 2000 - 5
  });
});

t.describe("ImageAltTextDialog - character limit", (it) => {
  it("should show remaining characters", () => {
    const element = document.createElement("image-alt-text-dialog");
    connectElement(element);
    element.value = "";
    const wordCount = element.querySelector(".word-count-text");
    assertEquals(wordCount.textContent, "2000");
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

t.describe("ImageAltTextDialog - open method", (it) => {
  it("should show the dialog when open() is called", () => {
    const element = document.createElement("image-alt-text-dialog");
    connectElement(element);
    element.open();
    const dialog = element.querySelector(".image-alt-text-dialog");
    assert(dialog.open);
  });
});

t.describe("ImageAltTextDialog - close method", (it) => {
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

t.describe("ImageAltTextDialog - save method", (it) => {
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
    assertEquals(receivedAltText, "My alt text");
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

t.describe("ImageAltTextDialog - cancel button", (it) => {
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

t.describe("ImageAltTextDialog - reinitialization protection", (it) => {
  it("should not reinitialize when connectedCallback is called multiple times", () => {
    const element = document.createElement("image-alt-text-dialog");
    connectElement(element);
    element.value = "Test value";

    element.connectedCallback();

    assertEquals(element.value, "Test value");
  });
});

await t.run();
