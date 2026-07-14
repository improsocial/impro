import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";

test.describe("Not Found view", () => {
  test("should display when navigating to an unknown route", async ({
    page,
  }) => {
    await page.goto("/some/nonexistent/route");

    const notFoundView = page.locator(
      '[data-testid="view-column-center"] #not-found-view',
    );
    await expect(
      notFoundView.getByRole("heading", { name: "Page not found" }),
    ).toBeVisible();
    await expect(
      notFoundView.getByRole("link", { name: "Go home" }),
    ).toBeVisible();
  });

  test("should load the current user into the layout when authenticated", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/some/nonexistent/route");

    const profileNavItem = page.locator('[data-testid="sidebar-nav-profile"]');
    await expect(profileNavItem).toHaveAttribute(
      "href",
      "/profile/did:plc:testuser123",
    );
    await expect(profileNavItem).not.toHaveClass(/disabled/);
  });

  test("should navigate home when clicking Go Home", async ({ page }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/some/nonexistent/route");

    await page
      .locator("#not-found-view")
      .getByRole("link", { name: "Go home" })
      .click();

    await expect(page).toHaveURL("/");
  });
});
