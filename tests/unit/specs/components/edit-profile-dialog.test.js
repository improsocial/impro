import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "/js/components/edit-profile-dialog.js";

describe("edit-profile-dialog", () => {
  const mockProfile = {
    did: "did:plc:test123",
    displayName: "Test User",
    description: "A test bio",
    handle: "testuser.bsky.social",
    avatar: "https://example.com/avatar.jpg",
    banner: "https://example.com/banner.jpg",
    viewer: {},
  };

  function connectElement(element) {
    const container = document.createElement("div");
    container.className = "page-visible";
    container.appendChild(element);
    document.body.appendChild(container);
  }

  beforeEach(() => {
    document.body.innerHTML = "";
  });

  describe("EditProfileDialog - rendering", () => {
    it("should render dialog element", () => {
      const element = document.createElement("edit-profile-dialog");
      connectElement(element);
      const dialog = element.querySelector(".form-dialog");
      assert(dialog !== null, "Dialog should be rendered");
      assert.deepEqual(dialog.tagName, "DIALOG");
    });

    it("should render header with title", () => {
      const element = document.createElement("edit-profile-dialog");
      connectElement(element);
      const header = element.querySelector(".form-dialog-header h2");
      assert(header !== null, "Header should be rendered");
      assert.deepEqual(header.textContent, "Edit profile");
    });

    it("should render display name input", () => {
      const element = document.createElement("edit-profile-dialog");
      connectElement(element);
      const input = element.querySelector(
        "[data-testid='edit-profile-display-name']",
      );
      assert(input !== null, "Display name input should be rendered");
      assert.deepEqual(input.tagName, "INPUT");
    });

    it("should render description textarea", () => {
      const element = document.createElement("edit-profile-dialog");
      connectElement(element);
      const textarea = element.querySelector(
        "[data-testid='edit-profile-description']",
      );
      assert(textarea !== null, "Description textarea should be rendered");
      assert.deepEqual(textarea.tagName, "TEXTAREA");
    });

    it("should render save button", () => {
      const element = document.createElement("edit-profile-dialog");
      connectElement(element);
      const saveButton = element.querySelector(
        "[data-testid='edit-profile-save-button']",
      );
      assert(saveButton !== null, "Save button should be rendered");
    });

    it("should render cancel button", () => {
      const element = document.createElement("edit-profile-dialog");
      connectElement(element);
      const cancelButton = element.querySelector(".form-dialog-header-button");
      assert(cancelButton !== null, "Cancel button should be rendered");
      assert.deepEqual(cancelButton.textContent.trim(), "Cancel");
    });
  });

  describe("EditProfileDialog - pre-filling", () => {
    it("should pre-fill display name from profile", () => {
      const element = document.createElement("edit-profile-dialog");
      connectElement(element);
      element.setProfile(mockProfile);
      const input = element.querySelector(
        "[data-testid='edit-profile-display-name']",
      );
      assert.deepEqual(input.value, "Test User");
    });

    it("should pre-fill description from profile", () => {
      const element = document.createElement("edit-profile-dialog");
      connectElement(element);
      element.setProfile(mockProfile);
      const textarea = element.querySelector(
        "[data-testid='edit-profile-description']",
      );
      assert.deepEqual(textarea.value, "A test bio");
    });

    it("should show avatar preview from profile", () => {
      const element = document.createElement("edit-profile-dialog");
      connectElement(element);
      element.setProfile(mockProfile);
      const avatarImg = element.querySelector(
        ".form-dialog-avatar-preview img",
      );
      assert(avatarImg !== null, "Avatar image should be rendered");
      assert.deepEqual(avatarImg.src, "https://example.com/avatar.jpg");
    });

    it("should show banner preview from profile", () => {
      const element = document.createElement("edit-profile-dialog");
      connectElement(element);
      element.setProfile(mockProfile);
      const bannerImg = element.querySelector(
        ".edit-profile-banner-preview img",
      );
      assert(bannerImg !== null, "Banner image should be rendered");
      assert.deepEqual(bannerImg.src, "https://example.com/banner.jpg");
    });

    it("should handle profile with no display name", () => {
      const element = document.createElement("edit-profile-dialog");
      connectElement(element);
      element.setProfile({ ...mockProfile, displayName: "" });
      const input = element.querySelector(
        "[data-testid='edit-profile-display-name']",
      );
      assert.deepEqual(input.value, "");
    });

    it("should handle profile with no avatar", () => {
      const element = document.createElement("edit-profile-dialog");
      connectElement(element);
      element.setProfile({ ...mockProfile, avatar: null });
      const avatarImg = element.querySelector(
        ".form-dialog-avatar-preview img:not(.form-dialog-avatar-placeholder)",
      );
      assert.deepEqual(avatarImg, null);
      const placeholder = element.querySelector(
        ".form-dialog-avatar-placeholder",
      );
      assert(placeholder !== null, "Avatar placeholder should be shown");
      assert.deepEqual(placeholder.tagName, "IMG");
      assert(
        placeholder.src.includes("avatar-fallback.svg"),
        "Placeholder should use avatar fallback SVG",
      );
    });
  });

  describe("EditProfileDialog - character counts", () => {
    it("should show character count for display name", () => {
      const element = document.createElement("edit-profile-dialog");
      connectElement(element);
      element.setProfile(mockProfile);
      const charCount = element.querySelectorAll(".form-dialog-char-count")[0];
      assert(charCount !== null, "Char count should be rendered");
      assert(charCount.textContent.includes("/64"), "Should show max of 64");
    });

    it("should show character count for description", () => {
      const element = document.createElement("edit-profile-dialog");
      connectElement(element);
      element.setProfile(mockProfile);
      const charCounts = element.querySelectorAll(".form-dialog-char-count");
      assert(charCounts.length >= 2, "Should have at least 2 char counts");
      assert(
        charCounts[1].textContent.includes("/256"),
        "Should show max of 256",
      );
    });
  });

  describe("EditProfileDialog - validation", () => {
    it("should disable save button when no changes made", () => {
      const element = document.createElement("edit-profile-dialog");
      connectElement(element);
      element.setProfile(mockProfile);
      const saveButton = element.querySelector(
        "[data-testid='edit-profile-save-button']",
      );
      assert.deepEqual(saveButton.disabled, true);
    });

    it("should enable save button when display name changes", () => {
      const element = document.createElement("edit-profile-dialog");
      connectElement(element);
      element.setProfile(mockProfile);

      const input = element.querySelector(
        "[data-testid='edit-profile-display-name']",
      );
      input.value = "New Name";
      input.dispatchEvent(new Event("input", { bubbles: true }));

      const saveButton = element.querySelector(
        "[data-testid='edit-profile-save-button']",
      );
      assert.deepEqual(saveButton.disabled, false);
    });

    it("should disable save when display name exceeds 64 characters", () => {
      const element = document.createElement("edit-profile-dialog");
      connectElement(element);
      element.setProfile({ ...mockProfile, displayName: "" });

      const input = element.querySelector(
        "[data-testid='edit-profile-display-name']",
      );
      input.value = "a".repeat(65);
      input.dispatchEvent(new Event("input", { bubbles: true }));

      const saveButton = element.querySelector(
        "[data-testid='edit-profile-save-button']",
      );
      assert.deepEqual(saveButton.disabled, true);
    });

    it("should show overflow class when display name too long", () => {
      const element = document.createElement("edit-profile-dialog");
      connectElement(element);
      element.setProfile({ ...mockProfile, displayName: "" });

      const input = element.querySelector(
        "[data-testid='edit-profile-display-name']",
      );
      input.value = "a".repeat(65);
      input.dispatchEvent(new Event("input", { bubbles: true }));

      const charCount = element.querySelectorAll(".form-dialog-char-count")[0];
      assert(
        charCount.classList.contains("overflow"),
        "Should have overflow class",
      );
    });

    it("should disable save when description exceeds 256 characters", () => {
      const element = document.createElement("edit-profile-dialog");
      connectElement(element);
      element.setProfile({ ...mockProfile, description: "" });

      const textarea = element.querySelector(
        "[data-testid='edit-profile-description']",
      );
      textarea.value = "a".repeat(257);
      textarea.dispatchEvent(new Event("input", { bubbles: true }));

      const saveButton = element.querySelector(
        "[data-testid='edit-profile-save-button']",
      );
      assert.deepEqual(saveButton.disabled, true);
    });
  });

  describe("EditProfileDialog - image context menu", () => {
    it("should render avatar context menu", () => {
      const element = document.createElement("edit-profile-dialog");
      connectElement(element);
      element.setProfile(mockProfile);

      const menu = element.querySelector(".edit-profile-avatar-menu");
      assert(menu !== null, "Avatar context menu should exist");
    });

    it("should include remove option when avatar exists", () => {
      const element = document.createElement("edit-profile-dialog");
      connectElement(element);
      element.setProfile(mockProfile);

      const menu = element.querySelector(".edit-profile-avatar-menu");
      const items = menu.querySelectorAll("context-menu-item");
      assert.deepEqual(items.length, 2);
      assert(
        items[0].textContent.includes("Upload from Files"),
        "First item should be upload",
      );
      assert(
        items[1].textContent.includes("Remove Avatar"),
        "Second item should be remove",
      );
    });

    it("should not include remove option when no avatar", () => {
      const element = document.createElement("edit-profile-dialog");
      connectElement(element);
      element.setProfile({ ...mockProfile, avatar: null });

      const menu = element.querySelector(".edit-profile-avatar-menu");
      const items = menu.querySelectorAll("context-menu-item");
      assert.deepEqual(items.length, 1);
      assert(
        items[0].textContent.includes("Upload from Files"),
        "Only upload option should exist",
      );
    });

    it("should remove avatar when remove option clicked", () => {
      const element = document.createElement("edit-profile-dialog");
      connectElement(element);
      element.setProfile(mockProfile);

      const menu = element.querySelector(".edit-profile-avatar-menu");
      const items = menu.querySelectorAll("context-menu-item");
      items[1].click();

      const avatarImg = element.querySelector(
        ".form-dialog-avatar-preview img:not(.form-dialog-avatar-placeholder)",
      );
      assert.deepEqual(avatarImg, null);
      const placeholder = element.querySelector(
        ".form-dialog-avatar-placeholder",
      );
      assert(
        placeholder !== null,
        "Avatar placeholder should be shown after removal",
      );
    });
  });

  describe("EditProfileDialog - profile-save event", () => {
    it("should include profileUpdates with correct attributes", async () => {
      const element = document.createElement("edit-profile-dialog");
      connectElement(element);
      element.setProfile(mockProfile);

      const displayNameInput = element.querySelector(
        "[data-testid='edit-profile-display-name']",
      );
      displayNameInput.value = "Updated Name";
      displayNameInput.dispatchEvent(new Event("input", { bubbles: true }));

      const descriptionTextarea = element.querySelector(
        "[data-testid='edit-profile-description']",
      );
      descriptionTextarea.value = "Updated bio";
      descriptionTextarea.dispatchEvent(new Event("input", { bubbles: true }));

      const eventPromise = new Promise((resolve) => {
        element.addEventListener("profile-save", (event) => {
          resolve(event.detail);
        });
      });

      const saveButton = element.querySelector(
        "[data-testid='edit-profile-save-button']",
      );
      saveButton.click();

      const detail = await eventPromise;
      assert(
        detail.profileUpdates !== undefined,
        "detail should have profileUpdates",
      );
      assert.deepEqual(detail.profileUpdates.displayName, "Updated Name");
      assert.deepEqual(detail.profileUpdates.description, "Updated bio");
      assert.deepEqual(detail.profileUpdates.avatarBlob, null);
      assert.deepEqual(detail.profileUpdates.bannerBlob, null);
      assert.deepEqual(detail.profileUpdates.removeAvatar, false);
      assert.deepEqual(detail.profileUpdates.removeBanner, false);
    });

    it("should set removeAvatar when avatar is removed", async () => {
      const element = document.createElement("edit-profile-dialog");
      connectElement(element);
      element.setProfile(mockProfile);

      const avatarMenu = element.querySelector(".edit-profile-avatar-menu");
      const avatarItems = avatarMenu.querySelectorAll("context-menu-item");
      avatarItems[1].click();

      const eventPromise = new Promise((resolve) => {
        element.addEventListener("profile-save", (event) => {
          resolve(event.detail);
        });
      });

      const saveButton = element.querySelector(
        "[data-testid='edit-profile-save-button']",
      );
      saveButton.click();

      const detail = await eventPromise;
      assert.deepEqual(detail.profileUpdates.removeAvatar, true);
      assert.deepEqual(detail.profileUpdates.removeBanner, false);
    });

    it("should set removeBanner when banner is removed", async () => {
      const element = document.createElement("edit-profile-dialog");
      connectElement(element);
      element.setProfile(mockProfile);

      const bannerMenu = element.querySelector(".edit-profile-banner-menu");
      const bannerItems = bannerMenu.querySelectorAll("context-menu-item");
      bannerItems[1].click();

      const eventPromise = new Promise((resolve) => {
        element.addEventListener("profile-save", (event) => {
          resolve(event.detail);
        });
      });

      const saveButton = element.querySelector(
        "[data-testid='edit-profile-save-button']",
      );
      saveButton.click();

      const detail = await eventPromise;
      assert.deepEqual(detail.profileUpdates.removeBanner, true);
      assert.deepEqual(detail.profileUpdates.removeAvatar, false);
    });
  });

  describe("EditProfileDialog - close", () => {
    it("should dispatch edit-profile-closed event on close", async () => {
      const element = document.createElement("edit-profile-dialog");
      connectElement(element);
      element.setProfile(mockProfile);
      element.open();

      let closedEventFired = false;
      element.addEventListener("edit-profile-closed", () => {
        closedEventFired = true;
      });

      await element.close();
      assert.deepEqual(closedEventFired, true);
    });

    it("should prompt for confirmation when cancel is clicked with unsaved changes", async () => {
      const element = document.createElement("edit-profile-dialog");
      connectElement(element);
      element.setProfile(mockProfile);

      const displayNameInput = element.querySelector(
        "[data-testid='edit-profile-display-name']",
      );
      displayNameInput.value = "Updated Name";
      displayNameInput.dispatchEvent(new Event("input", { bubbles: true }));

      let closedEventFired = false;
      element.addEventListener("edit-profile-closed", () => {
        closedEventFired = true;
      });

      const cancelButton = element.querySelector(
        "[data-testid='edit-profile-cancel-button']",
      );
      cancelButton.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const confirmDialog = document.body.querySelector(".confirm-modal");
      assert(
        confirmDialog !== null,
        "Discard confirmation should be shown when there are unsaved changes",
      );
      assert.deepEqual(closedEventFired, false);
    });

    it("should not prompt for confirmation when dismissed while saving", async () => {
      const element = document.createElement("edit-profile-dialog");
      connectElement(element);
      element.setProfile(mockProfile);
      element.open();

      const displayNameInput = element.querySelector(
        "[data-testid='edit-profile-display-name']",
      );
      displayNameInput.value = "Updated Name";
      displayNameInput.dispatchEvent(new Event("input", { bubbles: true }));

      const saveButton = element.querySelector(
        "[data-testid='edit-profile-save-button']",
      );
      saveButton.click();

      let closedEventFired = false;
      element.addEventListener("edit-profile-closed", () => {
        closedEventFired = true;
      });

      // Cancel button is disabled while saving; Escape key (cancel event) is the
      // available dismiss path during save.
      const dialog = element.querySelector(".form-dialog");
      dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));

      const confirmDialog = document.body.querySelector(".confirm-modal");
      assert.deepEqual(
        confirmDialog,
        null,
        "No discard confirmation should be shown while saving",
      );
      assert.deepEqual(closedEventFired, true);
    });
  });
});
