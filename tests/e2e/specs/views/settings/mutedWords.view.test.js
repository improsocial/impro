import { test, expect } from "../../../base.js";
import { login } from "../../../helpers.js";
import { MockServer } from "../../../mockServer.js";

test.describe("Settings Muted Words view", () => {
  test("should display header and form sections", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/muted-words");

    const view = page.locator("#settings-muted-words-view");
    await expect(view.locator('[data-testid="header-title"]')).toContainText(
      "Muted words",
      { timeout: 10000 },
    );

    await expect(view).toContainText("Add muted words and tags");
    await expect(view).toContainText(
      "Posts can be muted based on their text, their tags, or both.",
    );

    await expect(
      view.locator('[data-testid="muted-word-input"]'),
    ).toBeVisible();
    await expect(view.locator('[data-testid="duration-group"]')).toBeVisible();
    await expect(view.locator('[data-testid="target-group"]')).toBeVisible();
    await expect(
      view.locator('[data-testid="exclude-following"]'),
    ).toBeVisible();
    await expect(view.locator('[data-testid="muted-word-add"]')).toBeVisible();
  });

  test("should display empty state when no muted words exist", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/muted-words");

    const view = page.locator("#settings-muted-words-view");
    await expect(
      view.locator('[data-testid="muted-word-empty"]'),
    ).toContainText("You haven't muted any words or tags yet", {
      timeout: 10000,
    });
  });

  test("should display existing muted words", async ({ page }) => {
    const mockServer = new MockServer();
    mockServer.mutedWords = [
      {
        id: "word-1",
        value: "spoiler",
        targets: ["content", "tag"],
        actorTarget: "all",
      },
      {
        id: "word-2",
        value: "politics",
        targets: ["tag"],
        actorTarget: "all",
      },
    ];
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/muted-words");

    const view = page.locator("#settings-muted-words-view");
    const items = view.locator('[data-testid="muted-word-item"]');
    await expect(items).toHaveCount(2, { timeout: 10000 });

    // List is reversed (newest first)
    await expect(items.nth(0)).toContainText("politics");
    await expect(items.nth(0)).toContainText("in tags");
    await expect(items.nth(1)).toContainText("spoiler");
    await expect(items.nth(1)).toContainText("in text & tags");
  });

  test("should add a muted word", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/muted-words");

    const view = page.locator("#settings-muted-words-view");
    await expect(view.locator('[data-testid="muted-word-empty"]')).toBeVisible({
      timeout: 10000,
    });

    await view.locator('[data-testid="muted-word-input"]').fill("test-word");
    await view.locator('[data-testid="muted-word-add"]').click();

    await expect(view.locator('[data-testid="muted-word-item"]')).toHaveCount(
      1,
      { timeout: 10000 },
    );
    await expect(
      view.locator('[data-testid="muted-word-item"]').first(),
    ).toContainText("test-word");
    await expect(
      view.locator('[data-testid="muted-word-empty"]'),
    ).not.toBeVisible();
  });

  test("should remove a muted word", async ({ page }) => {
    const mockServer = new MockServer();
    mockServer.mutedWords = [
      {
        id: "word-1",
        value: "removeme",
        targets: ["content", "tag"],
        actorTarget: "all",
      },
    ];
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/muted-words");

    const view = page.locator("#settings-muted-words-view");
    await expect(view.locator('[data-testid="muted-word-item"]')).toHaveCount(
      1,
      { timeout: 10000 },
    );

    await view.locator('[data-testid="muted-word-delete"]').click();

    // Confirm dialog should appear
    const dialog = page.locator("dialog.modal-dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog).toContainText("Are you sure?");
    await expect(dialog).toContainText(
      'This will delete "removeme" from your muted words',
    );

    // Click Remove to confirm
    await dialog.locator(".confirm-button").click();

    await expect(view.locator('[data-testid="muted-word-item"]')).toHaveCount(
      0,
      { timeout: 10000 },
    );
    await expect(
      view.locator('[data-testid="muted-word-empty"]'),
    ).toBeVisible();
  });

  test("should show error for empty input", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/muted-words");

    const view = page.locator("#settings-muted-words-view");
    const addButton = view.locator('[data-testid="muted-word-add"]');
    await expect(addButton).toBeVisible({ timeout: 10000 });

    // Button should be disabled when input is empty
    await expect(addButton).toBeDisabled();

    // Type a word, button should become enabled
    await view.locator('[data-testid="muted-word-input"]').fill("test");
    await expect(addButton).toBeEnabled();

    // Clear input, button should be disabled again
    await view.locator('[data-testid="muted-word-input"]').fill("");
    await expect(addButton).toBeDisabled();
  });

  test("should display expiry information", async ({ page }) => {
    const mockServer = new MockServer();
    const futureDate = new Date(
      Date.now() + 3 * 24 * 60 * 60 * 1000,
    ).toISOString();
    mockServer.mutedWords = [
      {
        id: "word-1",
        value: "temporary",
        targets: ["content", "tag"],
        actorTarget: "all",
        expiresAt: futureDate,
      },
    ];
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/muted-words");

    const view = page.locator("#settings-muted-words-view");
    const item = view.locator('[data-testid="muted-word-item"]');
    await expect(item).toBeVisible({ timeout: 10000 });
    await expect(item.locator(".muted-word-item-meta")).toContainText(
      "Expires in",
    );
  });

  test("should add a muted word with duration", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/muted-words");

    const view = page.locator("#settings-muted-words-view");
    await expect(view.locator('[data-testid="muted-word-empty"]')).toBeVisible({
      timeout: 10000,
    });

    await view.locator('[data-testid="muted-word-input"]').fill("spoiler");
    await view
      .locator('[data-testid="duration-group"] input[value="7_days"]')
      .check();
    await view.locator('[data-testid="muted-word-add"]').click();

    const item = view.locator('[data-testid="muted-word-item"]');
    await expect(item).toHaveCount(1, { timeout: 10000 });
    await expect(item).toContainText("spoiler");
    await expect(item.locator(".muted-word-item-meta")).toContainText(
      "Expires in",
    );
  });

  test("should add a muted word with tags-only target", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/muted-words");

    const view = page.locator("#settings-muted-words-view");
    await expect(view.locator('[data-testid="muted-word-empty"]')).toBeVisible({
      timeout: 10000,
    });

    await view.locator('[data-testid="muted-word-input"]').fill("politics");
    await view
      .locator('[data-testid="target-group"] input[value="tag"]')
      .check();
    await view.locator('[data-testid="muted-word-add"]').click();

    const item = view.locator('[data-testid="muted-word-item"]');
    await expect(item).toHaveCount(1, { timeout: 10000 });
    await expect(item).toContainText("politics");
    await expect(item).toContainText("in tags");
  });

  test("should add a muted word with exclude-following", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/muted-words");

    const view = page.locator("#settings-muted-words-view");
    await expect(view.locator('[data-testid="muted-word-empty"]')).toBeVisible({
      timeout: 10000,
    });

    await view.locator('[data-testid="muted-word-input"]').fill("discourse");
    await view
      .locator('[data-testid="exclude-following"] input[type="checkbox"]')
      .check();
    await view.locator('[data-testid="muted-word-add"]').click();

    const item = view.locator('[data-testid="muted-word-item"]');
    await expect(item).toHaveCount(1, { timeout: 10000 });
    await expect(item).toContainText("discourse");
    await expect(item.locator(".muted-word-item-meta")).toContainText(
      "Excludes users you follow",
    );
  });

  test("should add a muted word with all options set", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/muted-words");

    const view = page.locator("#settings-muted-words-view");
    await expect(view.locator('[data-testid="muted-word-empty"]')).toBeVisible({
      timeout: 10000,
    });

    await view.locator('[data-testid="muted-word-input"]').fill("drama");
    await view
      .locator('[data-testid="duration-group"] input[value="24_hours"]')
      .check();
    await view
      .locator('[data-testid="target-group"] input[value="tag"]')
      .check();
    await view
      .locator('[data-testid="exclude-following"] input[type="checkbox"]')
      .check();
    await view.locator('[data-testid="muted-word-add"]').click();

    const item = view.locator('[data-testid="muted-word-item"]');
    await expect(item).toHaveCount(1, { timeout: 10000 });
    await expect(item).toContainText("drama");
    await expect(item).toContainText("in tags");
    await expect(item.locator(".muted-word-item-meta")).toContainText(
      "Expires in",
    );
    await expect(item.locator(".muted-word-item-meta")).toContainText(
      "Excludes users you follow",
    );
  });

  test("should reset form options after adding a word", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/muted-words");

    const view = page.locator("#settings-muted-words-view");
    await expect(view.locator('[data-testid="muted-word-empty"]')).toBeVisible({
      timeout: 10000,
    });

    // Set non-default options
    await view.locator('[data-testid="muted-word-input"]').fill("first");
    await view
      .locator('[data-testid="duration-group"] input[value="30_days"]')
      .check();
    await view
      .locator('[data-testid="target-group"] input[value="tag"]')
      .check();
    await view
      .locator('[data-testid="exclude-following"] input[type="checkbox"]')
      .check();
    await view.locator('[data-testid="muted-word-add"]').click();

    await expect(view.locator('[data-testid="muted-word-item"]')).toHaveCount(
      1,
      { timeout: 10000 },
    );

    // Verify form reset to defaults
    await expect(
      view.locator('[data-testid="duration-group"] input[value="forever"]'),
    ).toBeChecked();
    await expect(
      view.locator('[data-testid="target-group"] input[value="content"]'),
    ).toBeChecked();
    await expect(
      view.locator('[data-testid="exclude-following"] input[type="checkbox"]'),
    ).not.toBeChecked();
    await expect(view.locator('[data-testid="muted-word-input"]')).toHaveValue(
      "",
    );
  });

  test("should display exclude-following label", async ({ page }) => {
    const mockServer = new MockServer();
    mockServer.mutedWords = [
      {
        id: "word-1",
        value: "filtered",
        targets: ["content", "tag"],
        actorTarget: "exclude-following",
      },
    ];
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/muted-words");

    const view = page.locator("#settings-muted-words-view");
    const item = view.locator('[data-testid="muted-word-item"]');
    await expect(item).toBeVisible({ timeout: 10000 });
    await expect(item.locator(".muted-word-item-meta")).toContainText(
      "Excludes users you follow",
    );
  });

  test("should show renew button for expired muted words", async ({ page }) => {
    const mockServer = new MockServer();
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    mockServer.mutedWords = [
      {
        id: "word-1",
        value: "expired-word",
        targets: ["content", "tag"],
        actorTarget: "all",
        expiresAt: pastDate,
      },
    ];
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/muted-words");

    const view = page.locator("#settings-muted-words-view");
    const item = view.locator('[data-testid="muted-word-item"]');
    await expect(item).toBeVisible({ timeout: 10000 });
    await expect(item.locator(".muted-word-item-meta")).toContainText(
      "Expired",
    );
    await expect(
      item.locator('[data-testid="muted-word-renew"]'),
    ).toBeVisible();
  });

  test("should not show renew button for non-expired muted words", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const futureDate = new Date(
      Date.now() + 3 * 24 * 60 * 60 * 1000,
    ).toISOString();
    mockServer.mutedWords = [
      {
        id: "word-1",
        value: "active-word",
        targets: ["content", "tag"],
        actorTarget: "all",
        expiresAt: futureDate,
      },
    ];
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/muted-words");

    const view = page.locator("#settings-muted-words-view");
    const item = view.locator('[data-testid="muted-word-item"]');
    await expect(item).toBeVisible({ timeout: 10000 });
    await expect(item.locator(".muted-word-item-meta")).toContainText(
      "Expires in",
    );
    await expect(
      item.locator('[data-testid="muted-word-renew"]'),
    ).not.toBeVisible();
  });

  test("should renew an expired muted word via context menu", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    mockServer.mutedWords = [
      {
        id: "word-1",
        value: "expired-word",
        targets: ["content", "tag"],
        actorTarget: "all",
        expiresAt: pastDate,
      },
    ];
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/muted-words");

    const view = page.locator("#settings-muted-words-view");
    const item = view.locator('[data-testid="muted-word-item"]');
    await expect(item).toBeVisible({ timeout: 10000 });

    await item.locator('[data-testid="muted-word-renew"]').click();

    const contextMenu = item.locator("context-menu");
    await expect(contextMenu.locator("dialog")).toBeVisible({ timeout: 5000 });

    await contextMenu.locator("context-menu-item").nth(1).click();

    await expect(item.locator(".muted-word-item-meta")).toContainText(
      "Expires in",
      { timeout: 10000 },
    );
  });
});
