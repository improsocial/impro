import { test, expect } from "../../../base.js";
import { login } from "../../../helpers.js";
import { MockServer } from "../../../mockServer.js";

test.describe("Settings Appearance view", () => {
  test("should display header and all settings sections", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/appearance");

    const view = page.locator("#settings-appearance-view");
    await expect(view.locator('[data-testid="header-title"]')).toBeVisible({
      timeout: 10000,
    });

    await expect(
      view.locator('[data-testid="settings-section-color-scheme"]'),
    ).toBeVisible();
    await expect(
      view.locator('[data-testid="settings-section-highlight-color"]'),
    ).toBeVisible();
    await expect(
      view.locator('[data-testid="settings-section-like-color"]'),
    ).toBeVisible();
  });

  test("should display color scheme dropdown with three options", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/appearance");

    const view = page.locator("#settings-appearance-view");
    const select = view.locator('[data-testid="color-scheme-select"]');
    await expect(select).toBeVisible({ timeout: 10000 });

    const options = select.locator("option");
    await expect(options).toHaveCount(3);
    await expect(options.nth(0)).toHaveAttribute("value", "system");
    await expect(options.nth(1)).toHaveAttribute("value", "light");
    await expect(options.nth(2)).toHaveAttribute("value", "dark");
  });

  test("should display color pickers with reset buttons", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/appearance");

    const view = page.locator("#settings-appearance-view");
    const colorPickers = view.locator(".settings-color-picker");
    await expect(colorPickers).toHaveCount(2, { timeout: 10000 });

    await expect(
      colorPickers.nth(0).locator('input[type="color"]'),
    ).toBeVisible();
    await expect(
      colorPickers.nth(0).locator(".settings-color-picker-reset"),
    ).toBeVisible();

    await expect(
      colorPickers.nth(1).locator('input[type="color"]'),
    ).toBeVisible();
    await expect(
      colorPickers.nth(1).locator(".settings-color-picker-reset"),
    ).toBeVisible();
  });

  test("should change color scheme when selecting a different option", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/appearance");

    const view = page.locator("#settings-appearance-view");
    const select = view.locator('[data-testid="color-scheme-select"]');
    await expect(select).toBeVisible({ timeout: 10000 });

    await select.selectOption("dark");
    await expect(select).toHaveValue("dark");

    await select.selectOption("light");
    await expect(select).toHaveValue("light");

    await select.selectOption("system");
    await expect(select).toHaveValue("system");
  });

  test("should display description text for each section", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/appearance");

    const view = page.locator("#settings-appearance-view");
    for (const sectionTestid of [
      "settings-section-color-scheme",
      "settings-section-highlight-color",
      "settings-section-like-color",
    ]) {
      await expect(
        view.locator(`[data-testid="${sectionTestid}"] .setting-item-desc`),
      ).toBeVisible({ timeout: 10000 });
    }
  });
});
