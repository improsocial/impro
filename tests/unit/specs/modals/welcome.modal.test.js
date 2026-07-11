import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { WelcomeModal } from "/js/modals/welcome.modal.js";

describe("WelcomeModal", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("should create a dialog and open it", () => {
    WelcomeModal.open();
    const dialog = document.querySelector('[data-testid="welcome-modal"]');
    assert(dialog !== null);
    assert(dialog.hasAttribute("open"));
    const title = document.querySelector('[data-testid="modal-title"]');
    assert.deepEqual(title.textContent.trim(), "Welcome to Impro!");
  });

  it("should render a sign in link to the login page", () => {
    WelcomeModal.open();
    const link = document.querySelector('[data-testid="modal-primary-button"]');
    assert(link !== null);
    assert.deepEqual(link.textContent.trim(), "Sign in");
    assert(link.getAttribute("href").startsWith("/login"));
    assert(link.hasAttribute("autofocus"));
  });

  it("should close and remove on sign in link click", () => {
    WelcomeModal.open();
    document.querySelector('[data-testid="modal-primary-button"]').click();
    assert(document.querySelector('[data-testid="welcome-modal"]') === null);
  });

  it("should close and remove on explore button click", () => {
    WelcomeModal.open();
    const exploreButton = document.querySelector(
      '[data-testid="modal-secondary-button"]',
    );
    assert.deepEqual(exploreButton.textContent.trim(), "Explore");
    exploreButton.click();
    assert(document.querySelector('[data-testid="welcome-modal"]') === null);
  });

  it("should close and remove on backdrop click", () => {
    WelcomeModal.open();
    const dialog = document.querySelector('[data-testid="welcome-modal"]');
    dialog.dispatchEvent(new Event("click", { bubbles: true }));
    assert(document.querySelector('[data-testid="welcome-modal"]') === null);
  });
});
