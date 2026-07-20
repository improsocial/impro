import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { userProfile } from "../../testData.js";
import { MockServer } from "../../mockServer.js";
import { createPost } from "../../../shared/factories.js";

async function openComposer(page) {
  const homeView = page.locator("#home-view");
  await expect(homeView).toBeVisible({ timeout: 10000 });
  await page.locator('[data-testid="sidebar-compose-button"]').click();
  const composer = page.locator("post-composer .post-composer");
  await expect(composer).toBeVisible({ timeout: 10000 });
  return composer;
}

test.describe("Create thread flow", () => {
  test("publishes a 3-post thread as one applyWrites batch with reply chaining", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/");
    const composer = await openComposer(page);

    await composer.locator(".rich-text-input").first().click();
    await composer.locator(".rich-text-input").first().type("First post");

    const addButton = composer.locator(
      '[data-testid="composer-add-post-button"]',
    );
    await addButton.click();
    await expect(composer.locator(".rich-text-input")).toHaveCount(2);
    await composer.locator(".rich-text-input").nth(1).type("Second post");

    await addButton.click();
    await expect(composer.locator(".rich-text-input")).toHaveCount(3);
    await composer.locator(".rich-text-input").nth(2).type("Third post");

    const submitButton = composer.locator(
      '[data-testid="composer-submit-button"]',
    );
    await expect(submitButton).toHaveAttribute("data-teststate", "post-all");
    await submitButton.click();
    await expect(composer).not.toBeVisible({ timeout: 10000 });

    expect(mockServer.applyWritesCalls.length).toBe(1);
    const writes = mockServer.applyWritesCalls[0];
    expect(writes.length).toBe(3);
    expect(
      writes.every(
        (write) =>
          write.$type === "com.atproto.repo.applyWrites#create" &&
          write.collection === "app.bsky.feed.post",
      ),
    ).toBe(true);
    expect(writes.map((write) => write.value.text)).toEqual([
      "First post",
      "Second post",
      "Third post",
    ]);
    const uris = writes.map(
      (write) => `at://${userProfile.did}/app.bsky.feed.post/${write.rkey}`,
    );
    expect(writes[0].value.reply).toBe(undefined);
    expect(writes[1].value.reply.root.uri).toBe(uris[0]);
    expect(writes[1].value.reply.parent.uri).toBe(uris[0]);
    expect(writes[2].value.reply.root.uri).toBe(uris[0]);
    expect(writes[2].value.reply.parent.uri).toBe(uris[1]);
    // strictly increasing rkeys and createdAt
    expect(writes[0].rkey < writes[1].rkey).toBe(true);
    expect(writes[1].rkey < writes[2].rkey).toBe(true);
    expect(
      Date.parse(writes[2].value.createdAt) -
        Date.parse(writes[0].value.createdAt),
    ).toBe(2);

    // all three posts land on the profile's posts & replies feed
    await page.goto(`/profile/${userProfile.did}`);
    const profileView = page.locator("#profile-view");
    await expect(profileView.locator('[data-testid="feed-item"]')).toHaveCount(
      3,
      { timeout: 10000 },
    );
  });

  test("publishes a multi-post reply thread rooted at the target's thread", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const rootPost = createPost({
      uri: "at://did:plc:author1/app.bsky.feed.post/rootpost1",
      text: "The original post",
      authorHandle: "author1.bsky.social",
      authorDisplayName: "Author One",
      replyCount: 0,
    });
    mockServer.addPosts([rootPost]);
    mockServer.setPostThread(rootPost.uri, {
      $type: "app.bsky.feed.defs#threadViewPost",
      post: rootPost,
      parent: null,
      replies: [],
    });
    await mockServer.setup(page);

    await login(page);

    // Open the reply composer from the thread view's reply prompt
    await page.goto("/profile/author1.bsky.social/post/rootpost1");
    const view = page.locator("#post-detail-view");
    await expect(view.locator('[data-testid="large-post"]')).toBeVisible({
      timeout: 10000,
    });
    await view.locator(".post-thread-reply-prompt").click();
    const composer = page.locator("post-composer .post-composer");
    await expect(composer).toBeVisible({ timeout: 10000 });

    await composer.locator(".rich-text-input").first().click();
    await composer.locator(".rich-text-input").first().type("Reply one");
    await composer.locator('[data-testid="composer-add-post-button"]').click();
    await composer.locator(".rich-text-input").nth(1).type("Reply two");

    await composer.locator('[data-testid="composer-submit-button"]').click();
    await expect(composer).not.toBeVisible({ timeout: 10000 });

    const writes = mockServer.applyWritesCalls[0];
    expect(writes.length).toBe(2);
    expect(writes[0].value.reply.root.uri).toBe(rootPost.uri);
    expect(writes[0].value.reply.parent.uri).toBe(rootPost.uri);
    // sticky root: the second post chains onto the first but keeps the root
    expect(writes[1].value.reply.root.uri).toBe(rootPost.uri);
    expect(writes[1].value.reply.parent.uri).toBe(
      `at://${userProfile.did}/app.bsky.feed.post/${writes[0].rkey}`,
    );
  });

  test("prompts to skip a mid-thread empty post before publishing", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/");
    const composer = await openComposer(page);

    await composer.locator(".rich-text-input").first().click();
    await composer.locator(".rich-text-input").first().type("First post");
    const addButton = composer.locator(
      '[data-testid="composer-add-post-button"]',
    );
    await addButton.click();
    await composer.locator(".rich-text-input").nth(1).type("Last post");

    // Re-activate the first post and insert an empty post between the two
    await composer.locator(".rich-text-input").first().click();
    await addButton.click();
    await expect(composer.locator(".rich-text-input")).toHaveCount(3);

    await composer.locator('[data-testid="composer-submit-button"]').click();
    await expect(
      page.locator('[data-testid="modal-confirm-button"]'),
    ).toBeVisible({ timeout: 10000 });
    await page.locator('[data-testid="modal-confirm-button"]').click();
    await expect(composer).not.toBeVisible({ timeout: 10000 });

    const writes = mockServer.applyWritesCalls[0];
    expect(writes.map((write) => write.value.text)).toEqual([
      "First post",
      "Last post",
    ]);
  });
});
