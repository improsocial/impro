import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createProfile } from "../../factories.js";

test.describe("Report profile flow", () => {
  test("should submit a report for a profile through the report dialog", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const otherUser = createProfile({
      did: "did:plc:otheruser1",
      handle: "otheruser.bsky.social",
      displayName: "Other User",
      followersCount: 10,
      followsCount: 5,
      postsCount: 3,
    });
    mockServer.addProfile(otherUser);
    await mockServer.setup(page);

    await login(page);
    await page.goto(`/profile/${otherUser.did}`);

    // Wait for profile to load
    const profileView = page.locator("#profile-view");
    await expect(
      profileView.locator('[data-testid="profile-name"]'),
    ).toContainText("Other User", { timeout: 10000 });

    // Open the profile "..." menu
    await profileView.locator(".ellipsis-button").click();

    // Click "Report account"
    await page
      .locator("context-menu-item", { hasText: "Report account" })
      .click();

    // Report dialog should open
    const reportDialog = page.locator("report-dialog");
    await expect(reportDialog.locator(".report-dialog")).toBeVisible({
      timeout: 5000,
    });

    // Step 1: Select category "Harassment or hate"
    await reportDialog
      .locator(".report-option-card", { hasText: "Harassment or hate" })
      .click();

    // Step 2: Select reason "Trolling"
    await reportDialog
      .locator(".report-option-card", { hasText: "Trolling" })
      .click();

    // Step 3: Select labeler "Bluesky Moderation"
    await reportDialog
      .locator(".report-labeler-card", { hasText: "Bluesky Moderation" })
      .click();

    // Step 4: Submit the report
    await reportDialog.locator(".report-submit-button").click();

    // Verify the toast shows success
    await expect(page.locator(".toast")).toContainText("Report submitted", {
      timeout: 5000,
    });

    // Verify the dialog is closed
    await expect(reportDialog).toHaveCount(0, { timeout: 5000 });

    // Verify the API was called with correct payload
    expect(mockServer.reportPayloads).toHaveLength(1);
    expect(mockServer.reportPayloads[0].reasonType).toBe(
      "tools.ozone.report.defs#reasonHarassmentTroll",
    );
    expect(mockServer.reportPayloads[0].subject).toEqual({
      $type: "com.atproto.admin.defs#repoRef",
      did: otherUser.did,
    });
  });
});
