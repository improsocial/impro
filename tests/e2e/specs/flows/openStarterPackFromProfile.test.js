import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { userProfile } from "../../testData.js";
import { createStarterPack } from "../../../shared/factories.js";

const PACK_URI = `at://${userProfile.did}/app.bsky.graph.starterpack/mine`;

test.describe("Open starter pack from profile flow", () => {
  test("shows the loading state, not the not-found state, while the full pack loads", async ({
    page,
  }) => {
    const basicPack = createStarterPack({
      uri: PACK_URI,
      name: "My Pack",
      creatorHandle: userProfile.handle,
    });
    const fullPack = createStarterPack({
      uri: PACK_URI,
      name: "My Pack",
      creatorHandle: userProfile.handle,
      list: true,
    });
    const mockServer = new MockServer();
    mockServer.addProfile({ ...userProfile, associated: { starterPacks: 1 } });
    mockServer.addActorStarterPacks(userProfile.did, [basicPack]);
    mockServer.addStarterPacks([fullPack]);
    mockServer.addLists([fullPack.list]);
    mockServer.setGetStarterPackDelay(1500);
    await mockServer.setup(page);

    await login(page);
    await page.goto(`/profile/${userProfile.handle}`);
    const profileView = page.locator("#profile-view");
    const tab = profileView.locator('[data-testid="tab-starter-packs"]');
    await expect(tab).toBeVisible({ timeout: 10000 });
    await tab.click();
    const packItem = profileView.locator(
      '.feed-container:not([hidden]) [data-testid="starter-pack-list-item"]',
    );
    await expect(packItem).toHaveCount(1, { timeout: 10000 });
    await packItem.click();

    const detail = page.locator("#starter-pack-detail-view");
    await expect(
      detail.locator('[data-testid="starter-pack-detail-loading"]'),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      detail.locator('[data-testid="starter-pack-not-found"]'),
    ).toHaveCount(0);
    await expect(
      detail.locator('[data-testid="starter-pack-name"]'),
    ).toHaveText("My Pack", { timeout: 10000 });
    await expect(
      detail.locator('[data-testid="starter-pack-not-found"]'),
    ).toHaveCount(0);
  });
});
