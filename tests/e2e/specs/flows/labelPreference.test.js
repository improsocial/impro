import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import {
  createProfile,
  createPost,
  createLabelerView,
} from "../../factories.js";

const LABELER_DID = "did:plc:testlabeler1";

function setupLabelerProfile() {
  return createProfile({
    did: LABELER_DID,
    handle: "testlabeler.bsky.social",
    displayName: "Test Labeler",
    associated: { labeler: true },
  });
}

function setupLabelerView() {
  return createLabelerView({
    did: LABELER_DID,
    handle: "testlabeler.bsky.social",
    displayName: "Test Labeler",
    labelDefinitions: [
      {
        identifier: "custom-warning",
        severity: "alert",
        blurs: "content",
        defaultSetting: "warn",
        locales: [
          {
            lang: "en",
            name: "Custom Warning",
            description: "A custom warning label",
          },
        ],
      },
    ],
  });
}

function setupLabeledPost() {
  return createPost({
    uri: "at://did:plc:postauthor1/app.bsky.feed.post/post1",
    text: "This post has a custom warning label",
    authorHandle: "postauthor.bsky.social",
    authorDisplayName: "Post Author",
    labels: [
      {
        src: LABELER_DID,
        uri: "at://did:plc:postauthor1/app.bsky.feed.post/post1",
        val: "custom-warning",
        cts: "2025-01-01T00:00:00.000Z",
      },
    ],
  });
}

test.describe("Label preference flow", () => {
  test("should hide posts when label is set to Hide and show them when set to Off", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const labelerProfile = setupLabelerProfile();
    const labelerView = setupLabelerView();
    const labeledPost = setupLabeledPost();
    const normalPost = createPost({
      uri: "at://did:plc:postauthor2/app.bsky.feed.post/post2",
      text: "This is a normal post",
      authorHandle: "postauthor2.bsky.social",
      authorDisplayName: "Post Author 2",
    });

    mockServer.addLabelerSubscription(LABELER_DID);
    mockServer.addProfile(labelerProfile);
    mockServer.addLabelerViews([labelerView]);
    mockServer.addTimelinePosts([labeledPost, normalPost]);
    await mockServer.setup(page);

    await login(page);

    // Navigate to the subscribed labeler's profile
    await page.goto(`/profile/${LABELER_DID}`);

    const profileView = page.locator("#profile-view");
    await expect(
      profileView.locator('[data-testid="profile-name"]'),
    ).toContainText("Test Labeler", { timeout: 10000 });

    // Labels tab is active by default; verify settings are visible
    await expect(
      profileView.locator('[data-testid="label-preference-list"]'),
    ).toBeVisible({ timeout: 10000 });

    // Find the "Custom Warning" label row
    const labelRow = profileView.locator(
      '[data-testid="label-preference-row"]',
      { hasText: "Custom Warning" },
    );
    await expect(labelRow).toBeVisible();

    // The default is "Warn", so the Warn button should be active
    const warnButton = labelRow
      .locator('[data-testid="label-pref-button"]')
      .filter({ hasText: "Warn" });
    await expect(warnButton).toHaveClass(/active/);

    // Change from "Warn" to "Hide"
    const hideButton = labelRow
      .locator('[data-testid="label-pref-button"]')
      .filter({ hasText: "Hide" });
    await hideButton.click();
    await expect(hideButton).toHaveClass(/active/);

    // Navigate to home feed: post with that label is hidden
    await page.goto("/");

    const homeView = page.locator("#home-view");
    await expect(homeView.locator('[data-testid="feed-item"]')).toHaveCount(1, {
      timeout: 10000,
    });
    await expect(homeView).toContainText("This is a normal post");

    // Go back to labeler profile and change from "Hide" to "Off"
    await page.goto(`/profile/${LABELER_DID}`);

    await expect(
      profileView.locator('[data-testid="label-preference-list"]'),
    ).toBeVisible({ timeout: 10000 });

    const labelRow2 = profileView.locator(
      '[data-testid="label-preference-row"]',
      { hasText: "Custom Warning" },
    );
    const offButton = labelRow2
      .locator('[data-testid="label-pref-button"]')
      .filter({ hasText: "Off" });
    await offButton.click();
    await expect(offButton).toHaveClass(/active/);

    // Navigate to home feed: post now appears without any warning
    await page.goto("/");

    await expect(homeView.locator('[data-testid="feed-item"]')).toHaveCount(2, {
      timeout: 10000,
    });
    await expect(homeView).toContainText(
      "This post has a custom warning label",
    );
    await expect(homeView.locator("moderation-warning")).toHaveCount(0);
  });

  test("should subscribe to a labeler and have its labels affect content display", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const labelerProfile = setupLabelerProfile();
    const labelerView = setupLabelerView();
    const labeledPost = setupLabeledPost();

    // User is NOT subscribed initially
    mockServer.addProfile(labelerProfile);
    mockServer.addLabelerViews([labelerView]);
    mockServer.addTimelinePosts([labeledPost]);
    await mockServer.setup(page);

    await login(page);

    // Navigate to the labeler's profile
    await page.goto(`/profile/${LABELER_DID}`);

    const profileView = page.locator("#profile-view");
    await expect(
      profileView.locator('[data-testid="profile-name"]'),
    ).toContainText("Test Labeler", { timeout: 10000 });

    // Should show "+ Subscribe" button
    await expect(
      profileView.locator('[data-testid="subscribe-button"]'),
    ).toContainText("+ Subscribe");

    // Label preference buttons should NOT be visible (not subscribed)
    await expect(
      profileView.locator('[data-testid="label-preference-buttons"]'),
    ).toHaveCount(0);

    // Click Subscribe
    await profileView.locator('[data-testid="subscribe-button"]').click();

    // Button should change to "Subscribed"
    await expect(
      profileView.locator('[data-testid="subscribe-button"]'),
    ).toContainText("Subscribed", { timeout: 10000 });

    // Toast should confirm subscription
    await expect(page.locator(".toast")).toContainText(
      "Subscribed to labeler",
      { timeout: 5000 },
    );

    // Label preference buttons should now be visible
    await expect(
      profileView.locator('[data-testid="label-preference-buttons"]'),
    ).toBeVisible();

    // Navigate to home feed: labels from this labeler now affect content display
    await page.goto("/");

    const homeView = page.locator("#home-view");
    await expect(homeView.locator('[data-testid="feed-item"]')).toHaveCount(1, {
      timeout: 10000,
    });
    // Default label setting is "warn", so moderation warning should be shown
    await expect(homeView.locator("moderation-warning")).toBeVisible();
  });

  test("should unsubscribe from a labeler and have its labels no longer affect content display", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const labelerProfile = setupLabelerProfile();
    const labelerView = setupLabelerView();
    const labeledPost = setupLabeledPost();

    // User IS subscribed initially
    mockServer.addLabelerSubscription(LABELER_DID);
    mockServer.addProfile(labelerProfile);
    mockServer.addLabelerViews([labelerView]);
    mockServer.addTimelinePosts([labeledPost]);
    await mockServer.setup(page);

    await login(page);

    // Navigate to the subscribed labeler's profile
    await page.goto(`/profile/${LABELER_DID}`);

    const profileView = page.locator("#profile-view");
    await expect(
      profileView.locator('[data-testid="profile-name"]'),
    ).toContainText("Test Labeler", { timeout: 10000 });

    // Should show "Subscribed" button
    await expect(
      profileView.locator('[data-testid="subscribe-button"]'),
    ).toContainText("Subscribed");

    // Label preference buttons should be visible (subscribed)
    await expect(
      profileView.locator('[data-testid="label-preference-buttons"]'),
    ).toBeVisible({ timeout: 10000 });

    // Click "Subscribed" to unsubscribe
    await profileView.locator('[data-testid="subscribe-button"]').click();

    // Button should change to "+ Subscribe"
    await expect(
      profileView.locator('[data-testid="subscribe-button"]'),
    ).toContainText("+ Subscribe", { timeout: 10000 });

    // Toast should confirm unsubscription
    await expect(page.locator(".toast")).toContainText(
      "Unsubscribed from labeler",
      { timeout: 5000 },
    );

    // Label preference buttons should no longer be visible
    await expect(
      profileView.locator('[data-testid="label-preference-buttons"]'),
    ).toHaveCount(0);

    // Navigate to home feed: labels from this labeler no longer affect content display
    await page.goto("/");

    const homeView = page.locator("#home-view");
    await expect(homeView.locator('[data-testid="feed-item"]')).toHaveCount(1, {
      timeout: 10000,
    });
    // Post should show without any moderation warning
    await expect(homeView.locator("moderation-warning")).toHaveCount(0);
  });
});
