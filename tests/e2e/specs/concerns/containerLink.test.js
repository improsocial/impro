import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createProfile } from "../../factories.js";

const profileUser = createProfile({
  did: "did:plc:profileuser1",
  handle: "profileuser.bsky.social",
  displayName: "Profile User",
  followersCount: 1,
});

const alice = createProfile({
  did: "did:plc:alice1",
  handle: "alice.bsky.social",
  displayName: "Alice",
});

async function setupFollowersList(page) {
  const mockServer = new MockServer();
  mockServer.addProfile(profileUser);
  mockServer.addProfile(alice);
  mockServer.addProfileFollowers(profileUser.did, [alice]);
  await mockServer.setup(page);

  await login(page);
  await page.goto(`/profile/${profileUser.did}/followers`);

  const view = page.locator("#profile-followers-view");
  await expect(view.locator(".profile-list-item")).toHaveCount(1, {
    timeout: 10000,
  });
  return view;
}

test.describe("container-link", () => {
  test("should not navigate in-app on modifier-key click", async ({ page }) => {
    const view = await setupFollowersList(page);
    const startUrl = page.url();

    const modifier = process.platform === "darwin" ? "Meta" : "Control";
    await view
      .locator(".profile-list-item")
      .first()
      .click({ modifiers: [modifier] });

    // SPA navigation should have been skipped — URL stays on the followers list
    await expect(page).toHaveURL(startUrl);
    await expect(page.locator("#profile-followers-view")).toBeVisible();
  });

  test("should open a new tab on middle-click", async ({ page, context }) => {
    const view = await setupFollowersList(page);
    const startUrl = page.url();

    const newPagePromise = context.waitForEvent("page");
    await view
      .locator(".profile-list-item")
      .first()
      .click({ button: "middle" });
    const newPage = await newPagePromise;
    await newPage.waitForLoadState("domcontentloaded");

    expect(newPage.url()).toContain(`/profile/${alice.handle}`);
    // The original page stays on the followers list
    await expect(page).toHaveURL(startUrl);
    await newPage.close();
  });

  test("should navigate in-app on a plain left-click", async ({ page }) => {
    const view = await setupFollowersList(page);

    await view.locator(".profile-list-item").first().click();

    await expect(page).toHaveURL(`/profile/${alice.handle}`, {
      timeout: 10000,
    });
  });
});
