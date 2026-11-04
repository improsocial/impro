import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createPost } from "../../../shared/factories.js";

for (const [layout, viewport] of Object.entries({
  mobile: { width: 390, height: 844 },
  desktop: { width: 1280, height: 900 },
})) {
  test.describe(`Composer writing area (${layout})`, () => {
    test.use({ viewport });

    test("keeps blank reply space outside the focused editor and accepts taps there", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      const post = createPost({
        uri: "at://did:plc:author1/app.bsky.feed.post/post1",
        text: "Original post",
        authorHandle: "author1.bsky.social",
      });
      mockServer.addPosts([post]);
      mockServer.setPostThread(post.uri, {
        $type: "app.bsky.feed.defs#threadViewPost",
        post,
        parent: null,
        replies: [],
      });
      await mockServer.setup(page);
      await login(page);
      await page.addInitScript(() => {
        document.addEventListener("focusin", (event) => {
          const dialog = event.target.closest("dialog.post-composer");
          if (!dialog || !event.target.isContentEditable) return;
          window.composerFocusGeometry ??= {
            top: dialog.getBoundingClientRect().top,
            transform: getComputedStyle(dialog).transform,
          };
        });
      });
      await page.goto("/profile/author1.bsky.social/post/post1");
      await page.locator(".post-thread-reply-prompt").click();

      const composer = page.locator("dialog.post-composer[open]");
      const editor = composer.locator(".rich-text-input");
      const writingArea = composer.locator(".rich-text-input-container");
      await expect(editor).toBeFocused();
      if (layout === "mobile") {
        // Inspect the instant focus occurs, not the settled layout after an
        // entrance animation: Safari uses that geometry to open the keyboard.
        expect(await page.evaluate(() => window.composerFocusGeometry)).toEqual(
          {
            top: 16,
            transform: "none",
          },
        );
      }
      // A software keyboard is not available in browser automation. Protect
      // the geometry verified on iPhone: unused space must not enlarge the
      // focus rectangle that Safari may center above the keyboard.
      const bounds = await editor.boundingBox();
      const areaBounds = await writingArea.boundingBox();
      expect(bounds.height).toBeLessThan(40);
      expect(areaBounds.height).toBeGreaterThanOrEqual(140);

      await editor.blur();
      await writingArea.click({ position: { x: 20, y: 110 } });
      await expect(editor).toBeFocused();
      await page.keyboard.type("Reply from the blank writing area");
      await expect(editor).toHaveText("Reply from the blank writing area");

      // The contenteditable must still grow with real text, without clipping.
      await editor.fill(Array(12).fill("A line of text").join("\n"));
      expect((await editor.boundingBox()).height).toBeGreaterThan(140);
      expect((await writingArea.boundingBox()).height).toBeGreaterThan(140);
    });

    test("retains compact blank areas when adding posts to a thread", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      await mockServer.setup(page);
      await login(page);
      await page.goto("/");
      await page
        .locator(
          `[data-testid="${layout === "mobile" ? "floating" : "sidebar"}-compose-button"]`,
        )
        .click();
      const composer = page.locator("dialog.post-composer[open]");
      await composer.locator(".rich-text-input").fill("First post");
      await composer.locator(".post-composer-add-post-button").click();

      const editors = composer.locator(".rich-text-input");
      const areas = composer.locator(".rich-text-input-container");
      await expect(editors).toHaveCount(2);
      await expect(editors.nth(1)).toBeFocused();
      expect((await editors.nth(1).boundingBox()).height).toBeLessThan(40);
      for (const area of await areas.all()) {
        expect((await area.boundingBox()).height).toBe(60);
      }
      await editors.nth(1).blur();
      await areas.nth(1).click({ position: { x: 20, y: 45 } });
      await page.keyboard.type("Second post");
      await expect(editors.nth(1)).toHaveText("Second post");
    });

    test("stays hidden after closing while teardown restores the feed", async ({
      page,
    }) => {
      const mockServer = new MockServer();
      mockServer.addTimelinePosts(
        Array.from({ length: 30 }, (_, index) =>
          createPost({
            uri: `at://did:plc:author${index}/app.bsky.feed.post/post${index}`,
            text: `Feed post ${index}`,
          }),
        ),
      );
      await mockServer.setup(page);
      await login(page);
      await page.goto("/");
      await expect(
        page.locator('[data-testid="feed-item"]').first(),
      ).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, 500));
      const savedScroll = await page.evaluate(() => window.scrollY);
      await page
        .locator(
          `[data-testid="${layout === "mobile" ? "floating" : "sidebar"}-compose-button"]`,
        )
        .click();
      await expect(page.locator("dialog.post-composer[open]")).toBeVisible();

      const closedState = await page.evaluate(async () => {
        const composer = document.querySelector("post-composer");
        const dialog = composer.querySelector("dialog");
        await composer.close();
        // The native close event may not have removed the host yet. The
        // dialog must already be hidden when its exit animation is cleared.
        return {
          open: dialog.open,
          hasLayout: dialog.getClientRects().length > 0,
        };
      });
      expect(closedState).toEqual({ open: false, hasLayout: false });
      await expect(page.locator("post-composer")).toHaveCount(0);
      await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBe(savedScroll);
    });
  });
}
