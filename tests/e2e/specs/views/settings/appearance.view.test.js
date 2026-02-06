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
    await expect(view.locator('[data-testid="header-title"]')).toContainText(
      "Appearance",
      { timeout: 10000 },
    );

    const sections = view.locator(".settings-section");
    await expect(sections).toHaveCount(3, { timeout: 10000 });

    await expect(view).toContainText("Color scheme");
    await expect(view).toContainText("Highlight color");
    await expect(view).toContainText("Like color");
  });

  test("should display color scheme dropdown with three options", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/appearance");

    const view = page.locator("#settings-appearance-view");
    const select = view.locator(".settings-select");
    await expect(select).toBeVisible({ timeout: 10000 });

    const options = select.locator("option");
    await expect(options).toHaveCount(3);
    await expect(options.nth(0)).toContainText("System");
    await expect(options.nth(1)).toContainText("Light");
    await expect(options.nth(2)).toContainText("Dark");
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
    ).toContainText("Reset");

    await expect(
      colorPickers.nth(1).locator('input[type="color"]'),
    ).toBeVisible();
    await expect(
      colorPickers.nth(1).locator(".settings-color-picker-reset"),
    ).toContainText("Reset");
  });

  test("should change color scheme when selecting a different option", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/settings/appearance");

    const view = page.locator("#settings-appearance-view");
    const select = view.locator(".settings-select");
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
    await expect(view).toContainText("Choose between light and dark mode.", {
      timeout: 10000,
    });
    await expect(view).toContainText(
      "Choose the highlight color for buttons and links.",
    );
    await expect(view).toContainText("Choose the color for liked posts.");
  });
});
