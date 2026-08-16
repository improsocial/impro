import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { createPost } from "../../../shared/factories.js";

test.describe("Labeler service outage", () => {
  test("should still load the app and warn when getServices fails", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const post = createPost({
      uri: "at://did:plc:author1/app.bsky.feed.post/post1",
      text: "Hello from the timeline",
      authorHandle: "author1.bsky.social",
    });
    mockServer.addTimelinePosts([post]);
    await mockServer.setup(page);

    await page.route("**/xrpc/app.bsky.labeler.getServices*", (route) =>
      route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ error: "UpstreamFailure" }),
      }),
    );

    await login(page);
    await page.goto("/");

    await expect(page.locator('[data-testid="toast"]')).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator("#home-view")).toContainText(post.record.text, {
      timeout: 10000,
    });
  });
});
