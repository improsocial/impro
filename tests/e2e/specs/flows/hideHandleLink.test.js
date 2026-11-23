import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createProfile } from "../../../shared/factories.js";

test.describe("Hide handle link flow", () => {
  test("should hide the custom handle link after turning the setting off", async ({
    page,
  }) => {
    const customHandleUser = createProfile({
      did: "did:plc:customhandle1",
      handle: "alice.example.com",
      displayName: "Alice",
    });
    const mockServer = new MockServer();
    mockServer.addProfile(customHandleUser);
    await mockServer.setup(page);
    await login(page);

    await page.goto(`/profile/${customHandleUser.did}`);
    await expect(
      page.locator('#profile-view [data-testid="profile-handle-link"]'),
    ).toBeVisible({ timeout: 10000 });

    await page.goto("/settings/content-and-media");
    const toggle = page.locator(
      '#settings-content-and-media-view [data-testid="handle-link-toggle"]',
    );
    await expect(toggle).toHaveAttribute("checked", "", { timeout: 10000 });
    await toggle.click();
    await expect(toggle).not.toHaveAttribute("checked");

    await page.goto(`/profile/${customHandleUser.did}`);
    await expect(
      page.locator('#profile-view [data-testid="profile-name"]'),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator('#profile-view [data-testid="profile-handle-link"]'),
    ).toHaveCount(0);
  });
});
