import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createPost } from "../../factories.js";

test.use({
  hasTouch: true,
  viewport: { width: 390, height: 844 },
});

// Dispatches a touchstart→touchmove→touchend sequence on eventSourceSelector.
// startTouchTarget optionally specifies a child element for touchstart (to test ignoreTouchTarget).
async function drag(page, { eventSourceSelector, startTouchTargetSelector, startY, endY }) {
  await page.evaluate(
    ({ eventSourceSelector, startTouchTargetSelector, startY, endY }) => {
      const eventSource = document.querySelector(eventSourceSelector);
      const startTarget = startTouchTargetSelector
        ? document.querySelector(startTouchTargetSelector)
        : eventSource;
      const rect = eventSource.getBoundingClientRect();
      const clientX = rect.left + rect.width / 2;

      startTarget.dispatchEvent(
        new TouchEvent("touchstart", {
          touches: [new Touch({ identifier: 1, target: startTarget, clientX, clientY: startY })],
          bubbles: true,
          cancelable: true,
        }),
      );
      eventSource.dispatchEvent(
        new TouchEvent("touchmove", {
          touches: [new Touch({ identifier: 1, target: startTarget, clientX, clientY: endY })],
          bubbles: true,
          cancelable: true,
        }),
      );
      eventSource.dispatchEvent(
        new TouchEvent("touchend", {
          changedTouches: [
            new Touch({ identifier: 1, target: startTarget, clientX, clientY: endY }),
          ],
          bubbles: true,
          cancelable: true,
        }),
      );
    },
    { eventSourceSelector, startTouchTargetSelector, startY, endY },
  );
}

async function setupFeedWithPost(page) {
  const mockServer = new MockServer();
  const post = createPost({
    uri: "at://did:plc:author1/app.bsky.feed.post/post1",
    text: "A post",
    authorHandle: "author1.bsky.social",
    authorDisplayName: "Author One",
  });
  mockServer.addTimelinePosts([post]);
  await mockServer.setup(page);
  await login(page);
  await page.goto("/");
  await expect(
    page.locator("#home-view").locator('[data-testid="feed-item"]'),
  ).toHaveCount(1, { timeout: 10000 });
}

test.describe("Drag-to-dismiss", () => {
  test.describe("report dialog", () => {
    async function openReportDialog(page) {
      await setupFeedWithPost(page);
      await page.locator('#home-view [data-testid="feed-item"] .text-button').click();
      await page.locator("context-menu-item", { hasText: "Report post" }).click();
      const reportDialog = page.locator("report-dialog .report-dialog");
      await expect(reportDialog).toBeVisible({ timeout: 5000 });
      return reportDialog;
    }

    test("dragging past threshold dismisses it", async ({ page }) => {
      await openReportDialog(page);
      await drag(page, {
        eventSourceSelector: "report-dialog .report-dialog",
        startY: 300,
        endY: 400,
      });
      await expect(page.locator("report-dialog .report-dialog")).not.toBeVisible({
        timeout: 2000,
      });
    });

    test("dragging below threshold snaps back", async ({ page }) => {
      const reportDialog = await openReportDialog(page);
      await drag(page, {
        eventSourceSelector: "report-dialog .report-dialog",
        startY: 300,
        endY: 330,
      });
      await expect(reportDialog).toBeVisible();
    });

    test("drag starting on a button does not dismiss", async ({ page }) => {
      const reportDialog = await openReportDialog(page);
      await drag(page, {
        eventSourceSelector: "report-dialog .report-dialog",
        startTouchTargetSelector: "report-dialog .report-option-card",
        startY: 300,
        endY: 430,
      });
      await expect(reportDialog).toBeVisible();
    });
  });

  test.describe("context menu", () => {
    async function openContextMenu(page) {
      await setupFeedWithPost(page);
      await page.locator('#home-view [data-testid="feed-item"] .text-button').click();
      const contextMenu = page.locator("context-menu .context-menu[open]");
      await expect(contextMenu).toBeVisible({ timeout: 5000 });
      return contextMenu;
    }

    test("dragging past threshold dismisses it", async ({ page }) => {
      await openContextMenu(page);
      await drag(page, {
        eventSourceSelector: "context-menu .context-menu-container.open",
        startY: 300,
        endY: 400,
      });
      await expect(page.locator("context-menu .context-menu[open]")).not.toBeVisible({
        timeout: 2000,
      });
    });

    test("dragging below threshold snaps back", async ({ page }) => {
      const contextMenu = await openContextMenu(page);
      await drag(page, {
        eventSourceSelector: "context-menu .context-menu-container.open",
        startY: 300,
        endY: 330,
      });
      await expect(contextMenu).toBeVisible();
    });

    test("drag starting on a button does not dismiss", async ({ page }) => {
      const contextMenu = await openContextMenu(page);
      await drag(page, {
        eventSourceSelector: "context-menu .context-menu-container.open",
        startTouchTargetSelector: "context-menu context-menu-item button",
        startY: 300,
        endY: 430,
      });
      await expect(contextMenu).toBeVisible();
    });
  });

  test.describe("post composer", () => {
    async function openPostComposer(page) {
      const mockServer = new MockServer();
      await mockServer.setup(page);
      await login(page);
      await page.goto("/");
      await expect(page.locator("#home-view")).toBeVisible({ timeout: 10000 });
      await page.locator('[data-testid="floating-compose-button"]').click();
      const composer = page.locator("post-composer .post-composer");
      await expect(composer).toBeVisible({ timeout: 5000 });
      return composer;
    }

    test("dragging past threshold dismisses it", async ({ page }) => {
      await openPostComposer(page);
      await drag(page, {
        eventSourceSelector: "post-composer .post-composer",
        startY: 300,
        endY: 400,
      });
      await expect(page.locator("post-composer .post-composer")).not.toBeVisible({
        timeout: 2000,
      });
    });

    test("dragging below threshold snaps back", async ({ page }) => {
      const composer = await openPostComposer(page);
      await drag(page, {
        eventSourceSelector: "post-composer .post-composer",
        startY: 300,
        endY: 330,
      });
      await expect(composer).toBeVisible();
    });

    test("drag starting on a button does not dismiss", async ({ page }) => {
      const composer = await openPostComposer(page);
      await drag(page, {
        eventSourceSelector: "post-composer .post-composer",
        startTouchTargetSelector: "post-composer .post-composer button",
        startY: 300,
        endY: 430,
      });
      await expect(composer).toBeVisible();
    });
  });
});
