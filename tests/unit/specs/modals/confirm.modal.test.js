import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import { confirmModal } from "/js/modals/confirm.modal.js";

const t = new TestSuite("confirmModal");

t.describe("confirmModal", (it, { beforeEach }) => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("should create a dialog in the DOM", () => {
    confirmModal("Are you sure?");
    const dialog = document.querySelector('[data-testid="confirm-modal"]');
    assert(dialog !== null);
  });

  it("should render the message", () => {
    confirmModal("Delete this?");
    const message = document.querySelector('[data-testid="modal-message"]');
    assertEquals(message.textContent.trim(), "Delete this?");
  });

  it("should render cancel and confirm buttons", () => {
    confirmModal("Sure?");
    const cancelButton = document.querySelector(
      '[data-testid="modal-cancel-button"]',
    );
    const confirmButton = document.querySelector(
      '[data-testid="modal-confirm-button"]',
    );
    assert(cancelButton !== null);
    assert(confirmButton !== null);
  });

  it("should use custom confirm button text", () => {
    confirmModal("Sure?", { confirmButtonText: "Delete" });
    const confirmButton = document.querySelector(
      '[data-testid="modal-confirm-button"]',
    );
    assertEquals(confirmButton.textContent.trim(), "Delete");
  });

  it("should apply custom confirm button style", () => {
    confirmModal("Sure?", { confirmButtonStyle: "danger" });
    const confirmButton = document.querySelector(
      '[data-testid="modal-confirm-button"]',
    );
    assert(confirmButton.classList.contains("danger-button"));
  });

  it("should apply primary button style by default", () => {
    confirmModal("Sure?");
    const confirmButton = document.querySelector(
      '[data-testid="modal-confirm-button"]',
    );
    assert(confirmButton.classList.contains("primary-button"));
  });

  it("should render title when provided", () => {
    confirmModal("Body text", { title: "Warning" });
    const title = document.querySelector('[data-testid="modal-title"]');
    assert(title !== null);
    assertEquals(title.textContent.trim(), "Warning");
  });

  it("should not render title when not provided", () => {
    confirmModal("Body text");
    const title = document.querySelector('[data-testid="modal-title"]');
    assert(title === null);
  });

  it("should open the dialog", () => {
    confirmModal("Sure?");
    const dialog = document.querySelector('[data-testid="confirm-modal"]');
    assert(dialog.hasAttribute("open"));
  });

  it("should resolve true when confirm is clicked", async () => {
    const result = confirmModal("Sure?");
    document.querySelector('[data-testid="modal-confirm-button"]').click();
    assertEquals(await result, true);
  });

  it("should resolve false when cancel is clicked", async () => {
    const result = confirmModal("Sure?");
    document.querySelector('[data-testid="modal-cancel-button"]').click();
    assertEquals(await result, false);
  });

  it("should resolve false on backdrop click", async () => {
    const result = confirmModal("Sure?");
    const dialog = document.querySelector('[data-testid="confirm-modal"]');
    dialog.dispatchEvent(new Event("click", { bubbles: true }));
    assertEquals(await result, false);
  });

  it("should resolve false on cancel event", async () => {
    const result = confirmModal("Sure?");
    const dialog = document.querySelector('[data-testid="confirm-modal"]');
    const cancelEvent = new Event("cancel");
    cancelEvent.preventDefault = () => {};
    dialog.dispatchEvent(cancelEvent);
    assertEquals(await result, false);
  });

  it("should remove dialog from DOM after confirm", async () => {
    const result = confirmModal("Sure?");
    document.querySelector('[data-testid="modal-confirm-button"]').click();
    await result;
    assert(document.querySelector('[data-testid="confirm-modal"]') === null);
  });

  it("should remove dialog from DOM after cancel", async () => {
    const result = confirmModal("Sure?");
    document.querySelector('[data-testid="modal-cancel-button"]').click();
    await result;
    assert(document.querySelector('[data-testid="confirm-modal"]') === null);
  });
});

await t.run();
