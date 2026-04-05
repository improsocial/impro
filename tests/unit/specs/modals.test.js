import { TestSuite } from "../testSuite.js";
import { assert, assertEquals } from "../testHelpers.js";
import { showSignInModal, showInfoModal, confirm } from "/js/modals.js";

const t = new TestSuite("Modals");

function clearDOM() {
  document.body.innerHTML = "";
}

t.describe("showSignInModal", (it) => {
  it("should create a dialog and open it", () => {
    clearDOM();
    showSignInModal();
    const dialog = document.querySelector("dialog");
    assert(dialog !== null);
    assert(dialog.hasAttribute("open"));
    assert(dialog.classList.contains("modal-dialog"));
    assert(dialog.classList.contains("compact"));
  });

  it("should render sign in content", () => {
    clearDOM();
    showSignInModal();
    const title = document.querySelector(".modal-dialog-title");
    assertEquals(title.textContent, "Sign in");
    const message = document.querySelector(".modal-dialog-message");
    assertEquals(message.textContent, "Sign in to join the conversation!");
    const link = document.querySelector("a.primary-button");
    assert(link !== null);
    assert(link.getAttribute("href") === "/login");
    assertEquals(link.textContent.trim(), "Okay");
  });

  it("should close and remove on backdrop click", () => {
    clearDOM();
    showSignInModal();
    const dialog = document.querySelector("dialog");
    dialog.dispatchEvent(new Event("click", { bubbles: true }));
    assert(document.querySelector("dialog") === null);
  });

  it("should close and remove on link click", () => {
    clearDOM();
    showSignInModal();
    const link = document.querySelector("a.primary-button");
    link.click();
    assert(document.querySelector("dialog") === null);
  });
});

// showInfoModal and confirm create fresh dialogs each time, so we can
// safely clear the DOM between tests.

t.describe("showInfoModal", (it) => {
  it("should create a dialog with info-modal class", () => {
    clearDOM();
    showInfoModal({ title: "Info", message: "Hello" });
    const dialog = document.querySelector("dialog.info-modal");
    assert(dialog !== null);
  });

  it("should render the provided title", () => {
    clearDOM();
    showInfoModal({ title: "My Title", message: "Some message" });
    const title = document.querySelector(".modal-dialog-title");
    assertEquals(title.textContent, "My Title");
  });

  it("should render the provided message", () => {
    clearDOM();
    showInfoModal({ title: "Title", message: "Custom message" });
    const message = document.querySelector(".modal-dialog-message");
    assertEquals(message.textContent, "Custom message");
  });

  it("should use OK as default button text", () => {
    clearDOM();
    showInfoModal({ title: "Title", message: "Msg" });
    const button = document.querySelector(".primary-button");
    assertEquals(button.textContent.trim(), "OK");
  });

  it("should use custom button text when provided", () => {
    clearDOM();
    showInfoModal({ title: "T", message: "M", confirmButtonText: "Got it" });
    const button = document.querySelector(".primary-button");
    assertEquals(button.textContent.trim(), "Got it");
  });

  it("should open the dialog", () => {
    clearDOM();
    showInfoModal({ title: "T", message: "M" });
    const dialog = document.querySelector("dialog");
    assert(dialog.hasAttribute("open"));
  });

  it("should close and remove on button click", () => {
    clearDOM();
    showInfoModal({ title: "T", message: "M" });
    const button = document.querySelector(".primary-button");
    button.click();
    assert(document.querySelector("dialog") === null);
  });

  it("should close and remove on backdrop click", () => {
    clearDOM();
    showInfoModal({ title: "T", message: "M" });
    const dialog = document.querySelector("dialog");
    dialog.dispatchEvent(new Event("click", { bubbles: true }));
    assert(document.querySelector("dialog") === null);
  });

  it("should close and remove on cancel event", () => {
    clearDOM();
    showInfoModal({ title: "T", message: "M" });
    const dialog = document.querySelector("dialog");
    const cancelEvent = new Event("cancel");
    cancelEvent.preventDefault = () => {};
    dialog.dispatchEvent(cancelEvent);
    assert(document.querySelector("dialog") === null);
  });
});

t.describe("confirm", (it) => {
  it("should create a dialog in the DOM", () => {
    clearDOM();
    confirm("Are you sure?");
    const dialog = document.querySelector("dialog.modal-dialog");
    assert(dialog !== null);
  });

  it("should render the message", () => {
    clearDOM();
    confirm("Delete this?");
    const message = document.querySelector(".modal-dialog-message");
    assertEquals(message.textContent, "Delete this?");
  });

  it("should render cancel and confirm buttons", () => {
    clearDOM();
    confirm("Sure?");
    const cancelButton = document.querySelector(".cancel-button");
    const confirmButton = document.querySelector(".confirm-button");
    assert(cancelButton !== null);
    assert(confirmButton !== null);
    assertEquals(cancelButton.textContent.trim(), "Cancel");
    assertEquals(confirmButton.textContent.trim(), "Confirm");
  });

  it("should use custom confirm button text", () => {
    clearDOM();
    confirm("Sure?", { confirmButtonText: "Delete" });
    const confirmButton = document.querySelector(".confirm-button");
    assertEquals(confirmButton.textContent.trim(), "Delete");
  });

  it("should apply custom confirm button style", () => {
    clearDOM();
    confirm("Sure?", { confirmButtonStyle: "danger" });
    const confirmButton = document.querySelector(".confirm-button");
    assert(confirmButton.classList.contains("danger-button"));
  });

  it("should apply primary button style by default", () => {
    clearDOM();
    confirm("Sure?");
    const confirmButton = document.querySelector(".confirm-button");
    assert(confirmButton.classList.contains("primary-button"));
  });

  it("should render title when provided", () => {
    clearDOM();
    confirm("Body text", { title: "Warning" });
    const title = document.querySelector(".modal-dialog-title");
    assert(title !== null);
    assertEquals(title.textContent, "Warning");
  });

  it("should not render title when not provided", () => {
    clearDOM();
    confirm("Body text");
    const title = document.querySelector(".modal-dialog-title");
    assert(title === null);
  });

  it("should open the dialog", () => {
    clearDOM();
    confirm("Sure?");
    const dialog = document.querySelector("dialog");
    assert(dialog.hasAttribute("open"));
  });

  it("should resolve true when confirm is clicked", async () => {
    clearDOM();
    const result = confirm("Sure?");
    document.querySelector(".confirm-button").click();
    assertEquals(await result, true);
  });

  it("should resolve false when cancel is clicked", async () => {
    clearDOM();
    const result = confirm("Sure?");
    document.querySelector(".cancel-button").click();
    assertEquals(await result, false);
  });

  it("should resolve false on backdrop click", async () => {
    clearDOM();
    const result = confirm("Sure?");
    const dialog = document.querySelector("dialog");
    dialog.dispatchEvent(new Event("click", { bubbles: true }));
    assertEquals(await result, false);
  });

  it("should resolve false on cancel event", async () => {
    clearDOM();
    const result = confirm("Sure?");
    const dialog = document.querySelector("dialog");
    const cancelEvent = new Event("cancel");
    cancelEvent.preventDefault = () => {};
    dialog.dispatchEvent(cancelEvent);
    assertEquals(await result, false);
  });

  it("should remove dialog from DOM after confirm", async () => {
    clearDOM();
    const result = confirm("Sure?");
    document.querySelector(".confirm-button").click();
    await result;
    assert(document.querySelector("dialog") === null);
  });

  it("should remove dialog from DOM after cancel", async () => {
    clearDOM();
    const result = confirm("Sure?");
    document.querySelector(".cancel-button").click();
    await result;
    assert(document.querySelector("dialog") === null);
  });
});

await t.run();
