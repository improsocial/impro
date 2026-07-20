import { test, expect } from "../../base.js";

test.describe("Global error state", () => {
  test("renders a retry action that reloads the app", async ({ page }) => {
    let navigationRequests = 0;
    page.on("request", (request) => {
      if (
        request.isNavigationRequest() &&
        request.frame() === page.mainFrame()
      ) {
        navigationRequests += 1;
      }
    });

    await page.goto("/login");
    await page.evaluate(() => window.showGlobalErrorState());

    const errorState = page.locator(".app-error-state");
    await expect(errorState).toContainText(
      "There was an error loading the app.",
    );

    const tryAgainButton = errorState.getByRole("button", {
      name: "Try again",
    });
    await expect(tryAgainButton).toBeVisible();
    await tryAgainButton.click();

    await expect.poll(() => navigationRequests).toBe(2);
  });
});
