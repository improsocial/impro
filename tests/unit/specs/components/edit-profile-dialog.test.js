import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import "/js/components/edit-profile-dialog.js";

const t = new TestSuite("EditProfileDialog");

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

t.beforeEach(() => {
  document.body.innerHTML = "";
});

t.describe("EditProfileDialog - rendering", (it) => {
  it("should render dialog element", () => {
    const element = document.createElement("edit-profile-dialog");
    connectElement(element);
    const dialog = element.querySelector(".edit-profile-dialog");
    assert(dialog !== null, "Dialog should be rendered");
    assertEquals(dialog.tagName, "DIALOG");
  });

  it("should render header with title", () => {
    const element = document.createElement("edit-profile-dialog");
    connectElement(element);
    const header = element.querySelector(".edit-profile-dialog-header h2");
    assert(header !== null, "Header should be rendered");
    assertEquals(header.textContent, "Edit profile");
  });

  it("should render display name input", () => {
    const element = document.createElement("edit-profile-dialog");
    connectElement(element);
    const input = element.querySelector(
      "[data-testid='edit-profile-display-name']",
    );
    assert(input !== null, "Display name input should be rendered");
    assertEquals(input.tagName, "INPUT");
  });

  it("should render description textarea", () => {
    const element = document.createElement("edit-profile-dialog");
    connectElement(element);
    const textarea = element.querySelector(
      "[data-testid='edit-profile-description']",
    );
    assert(textarea !== null, "Description textarea should be rendered");
    assertEquals(textarea.tagName, "TEXTAREA");
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
    const cancelButton = element.querySelector(
      ".edit-profile-dialog-header-button",
    );
    assert(cancelButton !== null, "Cancel button should be rendered");
    assertEquals(cancelButton.textContent.trim(), "Cancel");
  });
});

t.describe("EditProfileDialog - pre-filling", (it) => {
  it("should pre-fill display name from profile", () => {
    const element = document.createElement("edit-profile-dialog");
    connectElement(element);
    element.setProfile(mockProfile);
    const input = element.querySelector(
      "[data-testid='edit-profile-display-name']",
    );
    assertEquals(input.value, "Test User");
  });

  it("should pre-fill description from profile", () => {
    const element = document.createElement("edit-profile-dialog");
    connectElement(element);
    element.setProfile(mockProfile);
    const textarea = element.querySelector(
      "[data-testid='edit-profile-description']",
    );
    assertEquals(textarea.value, "A test bio");
  });

  it("should show avatar preview from profile", () => {
    const element = document.createElement("edit-profile-dialog");
    connectElement(element);
    element.setProfile(mockProfile);
    const avatarImg = element.querySelector(".edit-profile-avatar-preview img");
    assert(avatarImg !== null, "Avatar image should be rendered");
    assertEquals(avatarImg.src, "https://example.com/avatar.jpg");
  });

  it("should show banner preview from profile", () => {
    const element = document.createElement("edit-profile-dialog");
    connectElement(element);
    element.setProfile(mockProfile);
    const bannerImg = element.querySelector(".edit-profile-banner-preview img");
    assert(bannerImg !== null, "Banner image should be rendered");
    assertEquals(bannerImg.src, "https://example.com/banner.jpg");
  });

  it("should handle profile with no display name", () => {
    const element = document.createElement("edit-profile-dialog");
    connectElement(element);
    element.setProfile({ ...mockProfile, displayName: "" });
    const input = element.querySelector(
      "[data-testid='edit-profile-display-name']",
    );
    assertEquals(input.value, "");
  });

  it("should handle profile with no avatar", () => {
    const element = document.createElement("edit-profile-dialog");
    connectElement(element);
    element.setProfile({ ...mockProfile, avatar: null });
    const avatarImg = element.querySelector(
      ".edit-profile-avatar-preview img:not(.edit-profile-avatar-placeholder)",
    );
    assertEquals(avatarImg, null);
    const placeholder = element.querySelector(
      ".edit-profile-avatar-placeholder",
    );
    assert(placeholder !== null, "Avatar placeholder should be shown");
    assertEquals(placeholder.tagName, "IMG");
    assert(
      placeholder.src.includes("avatar-fallback.svg"),
      "Placeholder should use avatar fallback SVG",
    );
  });
});

t.describe("EditProfileDialog - character counts", (it) => {
  it("should show character count for display name", () => {
    const element = document.createElement("edit-profile-dialog");
    connectElement(element);
    element.setProfile(mockProfile);
    const charCount = element.querySelectorAll(".edit-profile-char-count")[0];
    assert(charCount !== null, "Char count should be rendered");
    assert(charCount.textContent.includes("/64"), "Should show max of 64");
  });

  it("should show character count for description", () => {
    const element = document.createElement("edit-profile-dialog");
    connectElement(element);
    element.setProfile(mockProfile);
    const charCounts = element.querySelectorAll(".edit-profile-char-count");
    assert(charCounts.length >= 2, "Should have at least 2 char counts");
    assert(
      charCounts[1].textContent.includes("/256"),
      "Should show max of 256",
    );
  });
});

t.describe("EditProfileDialog - validation", (it) => {
  it("should disable save button when no changes made", () => {
    const element = document.createElement("edit-profile-dialog");
    connectElement(element);
    element.setProfile(mockProfile);
    const saveButton = element.querySelector(
      "[data-testid='edit-profile-save-button']",
    );
    assertEquals(saveButton.disabled, true);
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
    assertEquals(saveButton.disabled, false);
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
    assertEquals(saveButton.disabled, true);
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

    const charCount = element.querySelectorAll(".edit-profile-char-count")[0];
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
    assertEquals(saveButton.disabled, true);
  });
});

t.describe("EditProfileDialog - image context menu", (it) => {
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
    assertEquals(items.length, 2);
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
    assertEquals(items.length, 1);
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
      ".edit-profile-avatar-preview img:not(.edit-profile-avatar-placeholder)",
    );
    assertEquals(avatarImg, null);
    const placeholder = element.querySelector(
      ".edit-profile-avatar-placeholder",
    );
    assert(
      placeholder !== null,
      "Avatar placeholder should be shown after removal",
    );
  });
});

t.describe("EditProfileDialog - profile-save event", (it) => {
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
    assertEquals(detail.profileUpdates.displayName, "Updated Name");
    assertEquals(detail.profileUpdates.description, "Updated bio");
    assertEquals(detail.profileUpdates.avatarBlob, null);
    assertEquals(detail.profileUpdates.bannerBlob, null);
    assertEquals(detail.profileUpdates.removeAvatar, false);
    assertEquals(detail.profileUpdates.removeBanner, false);
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
    assertEquals(detail.profileUpdates.removeAvatar, true);
    assertEquals(detail.profileUpdates.removeBanner, false);
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
    assertEquals(detail.profileUpdates.removeBanner, true);
    assertEquals(detail.profileUpdates.removeAvatar, false);
  });
});

t.describe("EditProfileDialog - close", (it) => {
  it("should dispatch edit-profile-closed event on close", async () => {
    const element = document.createElement("edit-profile-dialog");
    connectElement(element);
    element.setProfile(mockProfile);

    let closedEventFired = false;
    element.addEventListener("edit-profile-closed", () => {
      closedEventFired = true;
    });

    await element.close();
    assertEquals(closedEventFired, true);
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

    const confirmDialog = document.body.querySelector(".modal-dialog");
    assert(
      confirmDialog !== null,
      "Discard confirmation should be shown when there are unsaved changes",
    );
    assertEquals(closedEventFired, false);
  });

  it("should not prompt for confirmation when dismissed while saving", async () => {
    const element = document.createElement("edit-profile-dialog");
    connectElement(element);
    element.setProfile(mockProfile);

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
    const dialog = element.querySelector(".edit-profile-dialog");
    dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const confirmDialog = document.body.querySelector(".modal-dialog");
    assertEquals(
      confirmDialog,
      null,
      "No discard confirmation should be shown while saving",
    );
    assertEquals(closedEventFired, true);
  });
});

await t.run();
