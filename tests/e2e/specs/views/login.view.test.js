import { test, expect } from "../../base.js";
import { MockServer } from "../../mockServer.js";
import { login, loginWithAccounts } from "../../helpers.js";
import { userProfile } from "../../fixtures.js";
import { createProfile } from "../../factories.js";

test.describe("Login view", () => {
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
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await page.goto("/login");

    await page.locator('input[name="handle"]').fill("invalid.test");
    await page.getByRole("button", { name: "Next" }).click();

    await expect(page.locator(".error-message")).toBeVisible({
      timeout: 10000,
    });
  });

  test("advanced section is collapsed by default and reveals the app view dropdown when expanded", async ({
    page,
  }) => {
    await page.goto("/login");

    const advanced = page.locator("#login-advanced");
    const select = advanced.locator('select[name="appview"]');

    await expect(advanced).toBeVisible();
    await expect(select).toBeHidden();

    await advanced.locator("summary").click();
    await expect(select).toBeVisible();
    await expect(select.locator("option")).toHaveText([
      "Bluesky",
      "Blacksky",
      "Custom",
    ]);
  });

  test("custom option reveals DID inputs and toggles off when a default is reselected", async ({
    page,
  }) => {
    await page.goto("/login");

    const advanced = page.locator("#login-advanced");
    await advanced.locator("summary").click();
    const select = advanced.locator('select[name="appview"]');

    await expect(
      advanced.locator('input[name="appViewServiceDid"]'),
    ).toHaveCount(0);

    await select.selectOption("custom");
    await expect(
      advanced.locator('input[name="appViewServiceDid"]'),
    ).toBeVisible();
    await expect(
      advanced.locator('input[name="chatServiceDid"]'),
    ).toBeVisible();

    await select.selectOption("bluesky");
    await expect(
      advanced.locator('input[name="appViewServiceDid"]'),
    ).toHaveCount(0);
  });

  test("prefills the handle input from the handle query param", async ({
    page,
  }) => {
    await page.goto("/login?handle=alice.bsky.social");

    await expect(page.locator('input[name="handle"]')).toHaveValue(
      "alice.bsky.social",
    );
  });

  test("prefills the advanced section from localStorage", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "appview-config",
        JSON.stringify({
          id: "blacksky",
          displayName: "Blacksky",
          appViewServiceDid: "did:web:api.blacksky.community#bsky_appview",
          chatServiceDid: "did:web:api.blacksky.community#bsky_chat",
        }),
      );
    });

    await page.goto("/login");

    const advanced = page.locator("#login-advanced");
    await advanced.locator("summary").click();
    await expect(advanced.locator('select[name="appview"]')).toHaveValue(
      "blacksky",
    );
  });

  test.describe("returnTo", () => {
    test("requireAuth sends the original path as returnTo when bouncing logged-out users", async ({
      page,
    }) => {
      await page.goto("/bookmarks");
      await expect(page).toHaveURL(/\/login\?returnTo=%2Fbookmarks$/, {
        timeout: 10000,
      });
    });

    test("already-authed users hitting /login?returnTo=... are sent to that path", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      await mockServer.setup(page);
      await login(page);
      await page.goto("/login?returnTo=%2Fbookmarks");
      await expect(page).toHaveURL(/\/bookmarks$/, { timeout: 10000 });
    });

    test("already-authed users hitting /login with an unsafe returnTo go home", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      await mockServer.setup(page);
      await login(page);
      await page.goto("/login?returnTo=%2F%2Fevil.com");
      await expect(page).toHaveURL(/\/$/, { timeout: 10000 });
    });
  });

  test.describe("saved accounts list", () => {
    test("is not rendered when no accounts are stored", async ({ page }) => {
      await page.goto("/login");
      await expect(
        page.locator('[data-testid="saved-accounts-list"]'),
      ).toHaveCount(0);
    });

    test("renders a row per saved account and a 'Use another account' row", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      const otherProfile = createProfile({
        did: "did:plc:saveduser",
        handle: "saved.bsky.social",
        displayName: "Saved User",
      });
      mockServer.addProfile(userProfile);
      mockServer.addProfile(otherProfile);
      await mockServer.setup(page);
      await loginWithAccounts(page, [
        { did: userProfile.did, handle: userProfile.handle, needsReauth: true },
        {
          did: otherProfile.did,
          handle: otherProfile.handle,
          needsReauth: true,
        },
      ]);

      await page.goto("/login");

      const list = page.locator('[data-testid="saved-accounts-list"]');
      await expect(list).toBeVisible();
      await expect(
        list.locator('[data-testid="saved-account-row"]'),
      ).toHaveCount(2);
      await expect(
        list.locator('[data-testid="saved-account-add"]'),
      ).toBeVisible();
    });

    test("needsReauth rows show the 'Sign in again' hint and start the OAuth flow on click", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.addProfile(userProfile);
      await mockServer.setup(page);
      await loginWithAccounts(page, [
        { did: userProfile.did, handle: userProfile.handle, needsReauth: true },
      ]);

      await page.goto("/login");

      const row = page.locator(
        `[data-testid="saved-account-row"][data-handle="${userProfile.handle}"]`,
      );
      await expect(row).toHaveAttribute("data-teststate", "reauth");
      await expect(
        row.locator('[data-testid="saved-account-reauth-hint"]'),
      ).toBeVisible();

      await page.route("**/plc.directory/**", (route) =>
        route.fulfill({ status: 500, body: "" }),
      );
      await row.click();
      await expect(page.locator(".error-message")).toBeVisible({
        timeout: 10000,
      });
      await expect(page).not.toHaveURL(/addAccount=1/);
    });

    test("'Use another account' clears and focuses the handle input", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.addProfile(userProfile);
      await mockServer.setup(page);
      await loginWithAccounts(page, [
        { did: userProfile.did, handle: userProfile.handle, needsReauth: true },
      ]);

      await page.goto(
        `/login?handle=${encodeURIComponent(userProfile.handle)}`,
      );
      await expect(
        page.locator('[data-testid="saved-accounts-list"]'),
      ).toBeVisible();
      await expect(page.locator("#login-form")).toBeHidden();

      await page.locator('[data-testid="saved-account-add"]').click();
      await expect(
        page.locator('[data-testid="saved-accounts-list"]'),
      ).toBeHidden();
      await expect(page.locator("#login-form")).toBeVisible();
      await expect(page.locator('input[name="handle"]')).toHaveValue("");
      await expect(page.locator('input[name="handle"]')).toBeFocused();
    });

    test("Back button returns from the form to the accounts list", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.addProfile(userProfile);
      await mockServer.setup(page);
      await loginWithAccounts(page, [
        { did: userProfile.did, handle: userProfile.handle, needsReauth: true },
      ]);

      await page.goto("/login");
      await page.locator('[data-testid="saved-account-add"]').click();
      await expect(page.locator("#login-form")).toBeVisible();

      await page.getByRole("button", { name: "Back" }).click();
      await expect(
        page.locator('[data-testid="saved-accounts-list"]'),
      ).toBeVisible();
      await expect(page.locator("#login-form")).toBeHidden();
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test("prefills custom DID inputs when stored config is custom", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "appview-config",
        JSON.stringify({
          id: "custom",
          displayName: "Custom",
          appViewServiceDid: "did:web:custom.example#bsky_appview",
          chatServiceDid: "did:web:custom.example#bsky_chat",
        }),
      );
    });

    await page.goto("/login");

    const advanced = page.locator("#login-advanced");
    await advanced.locator("summary").click();
    await expect(advanced.locator('select[name="appview"]')).toHaveValue(
      "custom",
    );
    await expect(
      advanced.locator('input[name="appViewServiceDid"]'),
    ).toHaveValue("did:web:custom.example#bsky_appview");
    await expect(advanced.locator('input[name="chatServiceDid"]')).toHaveValue(
      "did:web:custom.example#bsky_chat",
    );
  });
});
