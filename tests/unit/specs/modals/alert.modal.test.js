import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import { alertModal } from "/js/modals/alert.modal.js";

const t = new TestSuite("alertModal");

t.describe("alertModal", (it, { beforeEach }) => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("should create a dialog with the alert-modal testid", () => {
    alertModal("Hello", { title: "Info" });
    const dialog = document.querySelector('[data-testid="alert-modal"]');
    assert(dialog !== null);
  });

  it("should render the provided title", () => {
    alertModal("Some message", { title: "My Title" });
    const title = document.querySelector('[data-testid="modal-title"]');
    assertEquals(title.textContent.trim(), "My Title");
  });

  it("should render the provided message", () => {
    alertModal("Custom message", { title: "Title" });
    const message = document.querySelector('[data-testid="modal-message"]');
    assertEquals(message.textContent.trim(), "Custom message");
  });

  it("should render a primary button by default", () => {
    alertModal("Msg", { title: "Title" });
    const button = document.querySelector(
      '[data-testid="modal-primary-button"]',
    );
    assert(button !== null);
  });

  it("should use custom button text when provided", () => {
    alertModal("M", { title: "T", confirmButtonText: "Got it" });
    const button = document.querySelector(
      '[data-testid="modal-primary-button"]',
    );
    assertEquals(button.textContent.trim(), "Got it");
  });

  it("should open the dialog", () => {
    alertModal("M", { title: "T" });
    const dialog = document.querySelector('[data-testid="alert-modal"]');
    assert(dialog.hasAttribute("open"));
  });

  it("should close and remove on button click", () => {
    alertModal("M", { title: "T" });
    const button = document.querySelector(
      '[data-testid="modal-primary-button"]',
    );
    button.click();
    assert(document.querySelector('[data-testid="alert-modal"]') === null);
  });

  it("should close and remove on backdrop click", () => {
    alertModal("M", { title: "T" });
    const dialog = document.querySelector('[data-testid="alert-modal"]');
    dialog.dispatchEvent(new Event("click", { bubbles: true }));
    assert(document.querySelector('[data-testid="alert-modal"]') === null);
  });

  it("should close and remove on cancel event", () => {
    alertModal("M", { title: "T" });
    const dialog = document.querySelector('[data-testid="alert-modal"]');
    const cancelEvent = new Event("cancel");
    cancelEvent.preventDefault = () => {};
    dialog.dispatchEvent(cancelEvent);
    assert(document.querySelector('[data-testid="alert-modal"]') === null);
  });
});

await t.run();
