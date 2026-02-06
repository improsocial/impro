import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createPost } from "../../factories.js";

test.describe("Report post flow", () => {
  test("should submit a report for a post through the report dialog", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const post = createPost({
      uri: "at://did:plc:author1/app.bsky.feed.post/post1",
      text: "Post to report",
      authorHandle: "author1.bsky.social",
      authorDisplayName: "Author One",
    });
    mockServer.addTimelinePosts([post]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/");

    // Wait for the post to appear on home
    const homeView = page.locator("#home-view");
    const feedItem = homeView.locator('[data-testid="feed-item"]');
    await expect(feedItem).toHaveCount(1, { timeout: 10000 });

    // Open the post action "..." menu
    await feedItem.locator(".text-button").click();

    // Click "Report post"
    await page.locator("context-menu-item", { hasText: "Report post" }).click();

    // Report dialog should open
    const reportDialog = page.locator("report-dialog");
    await expect(reportDialog.locator(".report-dialog")).toBeVisible({
      timeout: 5000,
    });

    // Step 1: Select category "Misleading"
    await reportDialog
      .locator(".report-option-card", { hasText: "Misleading" })
      .click();

    // Step 2: Select reason "Spam"
    await reportDialog
      .locator(".report-option-card", { hasText: "Spam" })
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
      "tools.ozone.report.defs#reasonMisleadingSpam",
    );
    expect(mockServer.reportPayloads[0].subject).toEqual({
      $type: "com.atproto.repo.strongRef",
      uri: post.uri,
      cid: post.cid,
    });
  });
});
