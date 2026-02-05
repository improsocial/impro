import { test, expect } from "@playwright/test";

test.describe("Login page", () => {
  test("should display the login form", async ({ page }) => {
    await page.goto("/login");

    const loginView = page.locator("#login-view");
    await expect(
      loginView.getByRole("heading", { name: "Sign in" }),
    ).toBeVisible();
    await expect(loginView.locator("h2")).toContainText("IMPRO");

    const handleInput = page.locator('input[name="handle"]');
    await expect(handleInput).toBeVisible();
    await expect(handleInput).toHaveAttribute(
      "placeholder",
      "example.bsky.social",
    );

    await expect(page.getByRole("button", { name: "Next" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
  });

  test("should show error for invalid username", async ({ page }) => {
    // Intercept the handle resolution request to simulate an invalid handle
    await page.route("**/.well-known/atproto-did*", (route) =>
      route.fulfill({ status: 404, body: "Not Found" }),
    );
    await page.route("**/xrpc/com.atproto.identity.resolveHandle*", (route) =>
      route.fulfill({
        status: 400,
        body: JSON.stringify({ error: "InvalidHandle" }),
      }),
    );

    await page.goto("/login");

    await page.locator('input[name="handle"]').fill("invalid.test");
    await page.getByRole("button", { name: "Next" }).click();

    await expect(page.locator(".error-message")).toBeVisible({
      timeout: 10000,
    });
  });
});
