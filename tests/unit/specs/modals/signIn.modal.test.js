import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { SignInModal } from "/js/modals/signIn.modal.js";

describe("SignInModal", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("should create a dialog and open it", () => {
    SignInModal.open();
    const dialog = document.querySelector('[data-testid="sign-in-modal"]');
    assert(dialog !== null);
    assert(dialog.hasAttribute("open"));
  });

  it("should render sign in content", () => {
    SignInModal.open();
    assert(document.querySelector('[data-testid="modal-title"]') !== null);
    assert(document.querySelector('[data-testid="modal-message"]') !== null);
    const link = document.querySelector('[data-testid="modal-primary-button"]');
    assert(link !== null);
    assert(link.getAttribute("href").startsWith("/login"));
  });

  it("should close and remove on backdrop click", () => {
    SignInModal.open();
    const dialog = document.querySelector('[data-testid="sign-in-modal"]');
    dialog.dispatchEvent(new Event("click", { bubbles: true }));
    assert(document.querySelector('[data-testid="sign-in-modal"]') === null);
  });

  it("should close and remove on link click", () => {
    SignInModal.open();
    const link = document.querySelector('[data-testid="modal-primary-button"]');
    link.click();
    assert(document.querySelector('[data-testid="sign-in-modal"]') === null);
  });
});
