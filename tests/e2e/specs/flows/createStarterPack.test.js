import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { userProfile } from "../../testData.js";
import {
  createFeedGenerator,
  createProfile,
} from "../../../shared/factories.js";

function makeFollows(count) {
  return Array.from({ length: count }, (_, i) =>
    createProfile({
      did: `did:plc:follow${i}`,
      handle: `follow${i}.bsky.social`,
      displayName: `Follow ${i}`,
    }),
  );
}

test.describe("Profile → create starter pack flow", () => {
  test("creates a starter pack from the profile tab and lands on its page", async ({
    page,
  }) => {
    const follows = makeFollows(9);
    const feed = createFeedGenerator({
      uri: "at://did:plc:feedowner/app.bsky.feed.generator/cats",
      displayName: "Cats",
      creatorHandle: "feeds.bsky.social",
    });
    const mockServer = new MockServer();
    mockServer.addProfile(userProfile);
    for (const profile of follows) mockServer.addProfile(profile);
    mockServer.addProfileFollows(userProfile.did, follows);
    mockServer.addFeedGenerators([feed]);
    mockServer.addSearchFeedGenerators([feed]);
    await mockServer.setup(page);

    await login(page);
    await page.goto(`/profile/${userProfile.handle}`);

    const profileView = page.locator("#profile-view");
    const tab = profileView.locator('[data-testid="tab-starter-packs"]');
    await expect(tab).toBeVisible({ timeout: 10000 });
    await tab.click();

    const createButton = profileView.locator(
      '[data-testid="starter-pack-create-button"]',
    );
    await expect(createButton).toBeVisible({ timeout: 10000 });
    await createButton.click();

    const wizard = page.locator('[data-testid="starter-pack-wizard"]');
    await expect(wizard).toHaveAttribute("data-teststate", "details");
    await wizard
      .locator('[data-testid="starter-pack-name-input"]')
      .fill("Cool People");
    await wizard
      .locator('[data-testid="starter-pack-description-input"]')
      .fill("Some cool people");
    await wizard.locator('[data-testid="starter-pack-wizard-next"]').click();
    await expect(wizard).toHaveAttribute("data-teststate", "profiles");

    const toggles = wizard.locator(
      '[data-testid="starter-pack-profile-toggle"][data-teststate="not-included"]',
    );
    await expect(toggles).toHaveCount(9, { timeout: 10000 });
    const nextButton = wizard.locator(
      '[data-testid="starter-pack-wizard-next"]',
    );
    await expect(nextButton).toBeDisabled();
    const allToggles = wizard.locator(
      '[data-testid="starter-pack-profile-toggle"]',
    );
    for (let i = 0; i < 7; i++) {
      await allToggles.nth(i).click();
      await expect(allToggles.nth(i)).toHaveAttribute(
        "data-teststate",
        "included",
      );
    }
    await expect(
      wizard.locator(
        '[data-testid="starter-pack-profile-toggle"][data-teststate="included"]',
      ),
    ).toHaveCount(7);
    await expect(nextButton).toBeEnabled();
    await nextButton.click();
    await expect(wizard).toHaveAttribute("data-teststate", "feeds");

    const feedToggle = wizard.locator(
      '[data-testid="starter-pack-feed-toggle"][data-teststate="not-included"]',
    );
    await expect(feedToggle).toHaveCount(1, { timeout: 10000 });
    await feedToggle.click();
    await expect(nextButton).toHaveText("Finish");
    await nextButton.click();

    await expect(page).toHaveURL(
      new RegExp(`/profile/${userProfile.handle}/starter-pack/[^/]+$`),
      { timeout: 10000 },
    );
    const detail = page.locator("#starter-pack-detail-view");
    await expect(
      detail.locator('[data-testid="starter-pack-name"]'),
    ).toHaveText("Cool People", { timeout: 10000 });
    await expect(
      detail.locator('[data-testid="starter-pack-description"]'),
    ).toContainText("Some cool people");
    await expect(page.locator('[data-testid="toast"]')).toBeVisible();

    expect(mockServer.applyWritesCalls).toHaveLength(1);
    const writes = mockServer.applyWritesCalls[0];
    expect(writes.map((write) => write.collection)).toEqual([
      "app.bsky.graph.list",
      ...Array(8).fill("app.bsky.graph.listitem"),
      "app.bsky.graph.starterpack",
    ]);
    expect(writes[0].value.purpose).toBe("app.bsky.graph.defs#referencelist");
    expect(writes[1].value.subject).toBe(userProfile.did);
    const pack = writes[writes.length - 1].value;
    expect(pack.name).toBe("Cool People");
    expect(pack.feeds).toEqual([{ uri: feed.uri }]);
    expect(pack.list).toBe(
      `at://${userProfile.did}/app.bsky.graph.list/${writes[0].rkey}`,
    );
  });
});
