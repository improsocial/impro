import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";

test.describe("Not Found view", () => {
  test("should display when navigating to an unknown route", async ({
    page,
  }) => {
    await page.goto("/some/nonexistent/route");

    const notFoundView = page.locator("#not-found-view");
    await expect(
      notFoundView.getByRole("heading", { name: "Not Found" }),
    ).toBeVisible();
    await expect(
      notFoundView.getByRole("link", { name: "Go Home" }),
    ).toBeVisible();
  });

  test("should navigate home when clicking Go Home", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/some/nonexistent/route");

    await page
      .locator("#not-found-view")
      .getByRole("link", { name: "Go Home" })
      .click();

    await expect(page).toHaveURL("/");
  });
});
