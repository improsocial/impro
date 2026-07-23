import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createList } from "../../../shared/factories.js";
import { userProfile } from "../../testData.js";

const OWN_LIST_URI = `at://${userProfile.did}/app.bsky.graph.list/ownlist`;

function setupOwnList(mockServer, overrides = {}) {
  const list = createList({
    uri: OWN_LIST_URI,
    name: "My Own List",
    creatorHandle: userProfile.handle,
    ...overrides,
  });
  if (overrides.description !== undefined) {
    list.description = overrides.description;
  }
  mockServer.addLists([list]);
  return list;
}

async function openCreateListDialog(page) {
  await page.goto("/lists");
  const listsView = page.locator("#lists-view");
  const newButton = listsView.locator('[data-testid="new-list-button"]');
  await expect(newButton).toBeVisible({ timeout: 10000 });
  await newButton.click();
  const dialog = page.locator("create-list-dialog");
  await expect(dialog.locator('[data-testid="create-list-name"]')).toBeVisible({
    timeout: 10000,
  });
  return dialog;
}

async function openEditListDialog(page) {
  await page.goto(`/profile/${userProfile.handle}/lists/ownlist`);
  const view = page.locator("#list-detail-view");
  await expect(view.locator(".context-menu-button")).toBeVisible({
    timeout: 10000,
  });
  await view.locator(".context-menu-button").click();
  await view.locator('[data-testid="menu-action-list-edit"]').click();
  const dialog = page.locator("edit-list-details-dialog");
  await expect(
    dialog.locator('[data-testid="edit-list-details-name"]'),
  ).toBeVisible({ timeout: 10000 });
  return dialog;
}

test.describe("List creation edge cases", () => {
  test("name character limit — counter overflow disables Create past 64 chars", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    const dialog = await openCreateListDialog(page);

    const nameInput = dialog.locator('[data-testid="create-list-name"]');
    const saveButton = dialog.locator(
      '[data-testid="create-list-save-button"]',
    );
    const nameCount = dialog
      .locator('[data-testid="create-list-name"]')
      .locator("..")
      .locator(".form-dialog-char-count");

    await nameInput.fill("a".repeat(60));
    await expect(nameCount).toContainText("60/64");
    await expect(nameCount).not.toHaveClass(/overflow/);
    await expect(saveButton).toBeEnabled();

    await nameInput.fill("a".repeat(65));
    await expect(nameCount).toContainText("65/64");
    await expect(nameCount).toHaveClass(/overflow/);
    await expect(saveButton).toBeDisabled();

    await nameInput.fill("a".repeat(64));
    await expect(nameCount).toContainText("64/64");
    await expect(nameCount).not.toHaveClass(/overflow/);
    await expect(saveButton).toBeEnabled();
  });

  test("description character limit — counter overflow disables Create past 300 chars", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    const dialog = await openCreateListDialog(page);

    await dialog.locator('[data-testid="create-list-name"]').fill("Valid name");
    const descInput = dialog.locator('[data-testid="create-list-description"]');
    const saveButton = dialog.locator(
      '[data-testid="create-list-save-button"]',
    );
    const descCount = descInput
      .locator("..")
      .locator(".form-dialog-char-count");

    await descInput.fill("d".repeat(305));
    await expect(descCount).toContainText("305/300");
    await expect(descCount).toHaveClass(/overflow/);
    await expect(saveButton).toBeDisabled();

    await descInput.fill("d".repeat(300));
    await expect(descCount).toContainText("300/300");
    await expect(descCount).not.toHaveClass(/overflow/);
    await expect(saveButton).toBeEnabled();
  });

  test("empty name keeps Create disabled — even after typing then clearing", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    const dialog = await openCreateListDialog(page);

    const nameInput = dialog.locator('[data-testid="create-list-name"]');
    const saveButton = dialog.locator(
      '[data-testid="create-list-save-button"]',
    );

    await expect(saveButton).toBeDisabled();

    await nameInput.fill("Temporary");
    await expect(saveButton).toBeEnabled();

    await nameInput.fill("   ");
    await expect(saveButton).toBeDisabled();

    await nameInput.fill("");
    await expect(saveButton).toBeDisabled();
  });

  test("creation error — failed createRecord shows inline error and keeps dialog open", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    // LIFO — override the createRecord handler for graph.list only.
    await page.route("**/xrpc/com.atproto.repo.createRecord*", (route) => {
      const body = route.request().postDataJSON();
      if (body?.collection === "app.bsky.graph.list") {
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            error: "InternalServerError",
            message: "boom",
          }),
        });
      }
      return route.fallback();
    });

    await login(page);
    const dialog = await openCreateListDialog(page);

    await dialog.locator('[data-testid="create-list-name"]').fill("Will Fail");
    await dialog.locator('[data-testid="create-list-save-button"]').click();

    const errorBanner = dialog.locator(".form-dialog-error");
    await expect(errorBanner).toBeVisible({ timeout: 10000 });
    await expect(errorBanner).toContainText("Failed to create list");

    // Dialog stays open and the user is not navigated away.
    await expect(dialog.locator(".create-list-dialog")).toBeVisible();
    await expect(page).toHaveURL(/\/lists$/);

    // Save button re-enables so the user can retry.
    await expect(
      dialog.locator('[data-testid="create-list-save-button"]'),
    ).toBeEnabled();
  });

  test("cancel with dirty form prompts discard confirmation — cancelling keeps dialog open", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    const dialog = await openCreateListDialog(page);

    await dialog.locator('[data-testid="create-list-name"]').fill("Draft name");

    await dialog.locator('[data-testid="create-list-cancel-button"]').click();

    const confirmModal = page.locator('[data-testid="confirm-modal"]');
    await expect(confirmModal).toBeVisible({ timeout: 10000 });

    await page.locator('[data-testid="modal-cancel-button"]').click();

    await expect(confirmModal).toHaveCount(0);
    await expect(dialog.locator(".create-list-dialog")).toBeVisible();
    await expect(
      dialog.locator('[data-testid="create-list-name"]'),
    ).toHaveValue("Draft name");
  });

  test("cancel with empty form closes immediately without confirmation", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    const dialog = await openCreateListDialog(page);

    await dialog
      .locator(
        '[data-testid="create-list-purpose"] input[value="app.bsky.graph.defs#modlist"]',
      )
      .check();

    await dialog.locator('[data-testid="create-list-cancel-button"]').click();

    await expect(page.locator('[data-testid="confirm-modal"]')).toHaveCount(0);
    await expect(dialog.locator(".create-list-dialog")).toHaveCount(0, {
      timeout: 10000,
    });
  });
});

test.describe("List edit edge cases", () => {
  test("save button is disabled when name is edited to whitespace only", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    setupOwnList(mockServer);
    await mockServer.setup(page);

    await login(page);
    const dialog = await openEditListDialog(page);

    const nameInput = dialog.locator('[data-testid="edit-list-details-name"]');
    const saveButton = dialog.locator(
      '[data-testid="edit-list-details-save-button"]',
    );

    await nameInput.fill("   ");
    await expect(saveButton).toBeDisabled();
  });

  test("description character limit — counter overflow disables Save past 300 chars", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    setupOwnList(mockServer);
    await mockServer.setup(page);

    await login(page);
    const dialog = await openEditListDialog(page);

    const descInput = dialog.locator(
      '[data-testid="edit-list-details-description"]',
    );
    const saveButton = dialog.locator(
      '[data-testid="edit-list-details-save-button"]',
    );
    const descCount = descInput
      .locator("..")
      .locator(".form-dialog-char-count");

    await descInput.fill("d".repeat(305));
    await expect(descCount).toContainText("305/300");
    await expect(descCount).toHaveClass(/overflow/);
    await expect(saveButton).toBeDisabled();

    await descInput.fill("d".repeat(300));
    await expect(descCount).toContainText("300/300");
    await expect(descCount).not.toHaveClass(/overflow/);
    await expect(saveButton).toBeEnabled();
  });

  test("name character limit — counter overflow disables Save past 64 chars", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    setupOwnList(mockServer);
    await mockServer.setup(page);

    await login(page);
    const dialog = await openEditListDialog(page);

    const nameInput = dialog.locator('[data-testid="edit-list-details-name"]');
    const saveButton = dialog.locator(
      '[data-testid="edit-list-details-save-button"]',
    );
    const nameCount = nameInput
      .locator("..")
      .locator(".form-dialog-char-count");

    await nameInput.fill("a".repeat(65));
    await expect(nameCount).toContainText("65/64");
    await expect(nameCount).toHaveClass(/overflow/);
    await expect(saveButton).toBeDisabled();

    await nameInput.fill("a".repeat(64));
    await expect(nameCount).not.toHaveClass(/overflow/);
    await expect(saveButton).toBeEnabled();
  });

  test("save error — failed putRecord shows inline error and keeps dialog open", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    setupOwnList(mockServer, { description: "Original description" });
    await mockServer.setup(page);

    await page.route("**/xrpc/com.atproto.repo.putRecord*", (route) => {
      const body = route.request().postDataJSON();
      if (body?.collection === "app.bsky.graph.list") {
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            error: "InternalServerError",
            message: "boom",
          }),
        });
      }
      return route.fallback();
    });

    await login(page);
    const dialog = await openEditListDialog(page);

    await dialog
      .locator('[data-testid="edit-list-details-name"]')
      .fill("Renamed");
    await dialog
      .locator('[data-testid="edit-list-details-save-button"]')
      .click();

    const errorBanner = dialog.locator(".form-dialog-error");
    await expect(errorBanner).toBeVisible({ timeout: 10000 });
    await expect(errorBanner).toContainText("Failed to save list");

    await expect(dialog.locator(".edit-list-details-dialog")).toBeVisible();
    await expect(
      dialog.locator('[data-testid="edit-list-details-save-button"]'),
    ).toBeEnabled();

    // On-page name is unchanged because the write failed.
    await expect(
      page.locator('#list-detail-view [data-testid="list-detail-name"]'),
    ).toContainText("My Own List");
  });

  test("cancel with dirty edit prompts discard confirmation — cancelling keeps dialog open", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    setupOwnList(mockServer);
    await mockServer.setup(page);

    await login(page);
    const dialog = await openEditListDialog(page);

    await dialog
      .locator('[data-testid="edit-list-details-name"]')
      .fill("Renamed");

    await dialog
      .locator('[data-testid="edit-list-details-cancel-button"]')
      .click();

    const confirmModal = page.locator('[data-testid="confirm-modal"]');
    await expect(confirmModal).toBeVisible({ timeout: 10000 });

    await page.locator('[data-testid="modal-cancel-button"]').click();

    await expect(confirmModal).toHaveCount(0);
    await expect(dialog.locator(".edit-list-details-dialog")).toBeVisible();
    await expect(
      dialog.locator('[data-testid="edit-list-details-name"]'),
    ).toHaveValue("Renamed");
  });

  test("cancel without changes closes immediately without confirmation", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    setupOwnList(mockServer);
    await mockServer.setup(page);

    await login(page);
    const dialog = await openEditListDialog(page);

    await dialog
      .locator('[data-testid="edit-list-details-cancel-button"]')
      .click();

    await expect(page.locator('[data-testid="confirm-modal"]')).toHaveCount(0);
    await expect(dialog.locator(".edit-list-details-dialog")).toHaveCount(0, {
      timeout: 10000,
    });
  });

  test("confirming discard on dirty edit closes the dialog and drops changes", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    setupOwnList(mockServer);
    await mockServer.setup(page);

    await login(page);
    const dialog = await openEditListDialog(page);

    await dialog
      .locator('[data-testid="edit-list-details-name"]')
      .fill("Renamed");

    await dialog
      .locator('[data-testid="edit-list-details-cancel-button"]')
      .click();

    await expect(page.locator('[data-testid="confirm-modal"]')).toBeVisible({
      timeout: 10000,
    });
    await page.locator('[data-testid="modal-confirm-button"]').click();

    await expect(dialog.locator(".edit-list-details-dialog")).toHaveCount(0, {
      timeout: 10000,
    });
    await expect(
      page.locator('#list-detail-view [data-testid="list-detail-name"]'),
    ).toContainText("My Own List");
  });
});
