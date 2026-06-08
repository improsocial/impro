import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import {
  createPost,
  createFeedGenerator,
  createList,
} from "../../factories.js";

const postUri = "at://did:plc:author1/app.bsky.feed.post/embed1";
const postPath = "/profile/author1.bsky.social/post/embed1";

async function setupSinglePostThread(page, post) {
  const mockServer = new MockServer();
  mockServer.addPosts([post]);
  mockServer.setPostThread(post.uri, {
    $type: "app.bsky.feed.defs#threadViewPost",
    post,
    replies: [],
  });
  await mockServer.setup(page);
  await login(page);
  await page.goto(postPath);
}

function imageItem({ alt = "" } = {}) {
  return {
    thumb: "",
    fullsize: "",
    alt,
    aspectRatio: { width: 4, height: 3 },
  };
}

function galleryItem({ alt = "" } = {}) {
  return {
    $type: "app.bsky.embed.gallery#viewImage",
    thumbnail: "",
    fullsize: "",
    alt,
    aspectRatio: { width: 4, height: 3 },
  };
}

function buildPost({ embed, text = "Embed post" }) {
  return createPost({
    uri: postUri,
    text,
    authorHandle: "author1.bsky.social",
    authorDisplayName: "Author One",
    embed,
  });
}

test.describe("Post embeds view — legacy images", () => {
  test("renders 1–4 images as a grid (post-images), not a carousel", async ({
    page,
  }) => {
    const post = buildPost({
      embed: {
        $type: "app.bsky.embed.images#view",
        images: [imageItem(), imageItem(), imageItem(), imageItem()],
      },
    });
    await setupSinglePostThread(page, post);

    const view = page.locator("#post-detail-view");
    await expect(view.locator('[data-testid="post-images"]')).toBeVisible({
      timeout: 10000,
    });
    await expect(view.locator('[data-testid="image-carousel"]')).toHaveCount(0);
    await expect(view.locator(".post-image")).toHaveCount(4);
  });

  test("renders ALT badge on legacy images with alt text", async ({ page }) => {
    const post = buildPost({
      embed: {
        $type: "app.bsky.embed.images#view",
        images: [imageItem({ alt: "first" }), imageItem()],
      },
    });
    await setupSinglePostThread(page, post);

    const view = page.locator("#post-detail-view");
    await expect(view.locator('[data-testid="post-images"]')).toBeVisible({
      timeout: 10000,
    });
    await expect(view.locator(".alt-indicator")).toHaveCount(1);
  });
});

test.describe("Post embeds view — gallery carousel", () => {
  function buildGalleryPost({ count, altIndices = [] }) {
    const items = [];
    for (let i = 0; i < count; i += 1) {
      items.push(
        galleryItem({ alt: altIndices.includes(i) ? `alt ${i}` : "" }),
      );
    }
    return buildPost({
      embed: { $type: "app.bsky.embed.gallery#view", items },
      text: "Look at these photos",
    });
  }

  test("renders 5+ image gallery as a carousel with counter and slides", async ({
    page,
  }) => {
    await setupSinglePostThread(page, buildGalleryPost({ count: 5 }));

    const view = page.locator("#post-detail-view");
    const carousel = view.locator('[data-testid="image-carousel"]');
    await expect(carousel).toBeVisible({ timeout: 10000 });

    await expect(
      carousel.locator('[data-testid="image-carousel-container"]'),
    ).toHaveAttribute("aria-roledescription", "carousel");

    await expect(
      carousel.locator('[data-testid="carousel-slide"]'),
    ).toHaveCount(5);

    const counters = carousel.locator('[data-testid="carousel-counter"]');
    await expect(counters).toHaveCount(5);
    await expect(counters.first()).toHaveText("1/5");
    await expect(counters.last()).toHaveText("5/5");

    await expect(
      carousel.locator('[data-testid="carousel-slide"][tabindex="0"]'),
    ).toHaveCount(1);
    await expect(
      carousel.locator(
        '[data-testid="carousel-slide"][data-teststate="active"]',
      ),
    ).toHaveCount(1);
  });

  test("renders ALT badges only on slides whose item has alt text", async ({
    page,
  }) => {
    await setupSinglePostThread(
      page,
      buildGalleryPost({ count: 5, altIndices: [0, 2] }),
    );

    const carousel = page.locator('[data-testid="image-carousel"]');
    await expect(carousel).toBeVisible({ timeout: 10000 });
    await expect(
      carousel.locator('[data-testid="image-alt-badge"]'),
    ).toHaveCount(2);
  });

  test("arrow-key navigation advances the active slide", async ({ page }) => {
    await setupSinglePostThread(page, buildGalleryPost({ count: 6 }));

    const carousel = page.locator('[data-testid="image-carousel"]');
    await expect(carousel).toBeVisible({ timeout: 10000 });
    const activeSlide = carousel.locator(
      '[data-testid="carousel-slide"][data-teststate="active"]',
    );

    await carousel.locator('[data-testid="carousel-slide"]').first().focus();

    await page.keyboard.press("ArrowRight");
    await expect(activeSlide).toHaveAttribute("data-index", "1");

    await page.keyboard.press("ArrowRight");
    await expect(activeSlide).toHaveAttribute("data-index", "2");

    await page.keyboard.press("ArrowLeft");
    await expect(activeSlide).toHaveAttribute("data-index", "1");
  });

  test("clicking a slide opens the lightbox at that index", async ({
    page,
  }) => {
    await setupSinglePostThread(
      page,
      buildGalleryPost({ count: 5, altIndices: [2] }),
    );

    const carousel = page.locator('[data-testid="image-carousel"]');
    await expect(carousel).toBeVisible({ timeout: 10000 });

    await carousel.locator('[data-testid="carousel-slide"]').nth(2).click();

    const lightbox = page.locator("lightbox-dialog .lightbox");
    await expect(lightbox).toBeVisible();
    await expect(lightbox.locator("img").first()).toHaveAttribute(
      "alt",
      "alt 2",
    );
  });
});

test.describe("Post embeds view — video", () => {
  test("renders a video embed with a streaming-video player", async ({
    page,
  }) => {
    const post = buildPost({
      embed: {
        $type: "app.bsky.embed.video#view",
        playlist: "",
        aspectRatio: { width: 16, height: 9 },
      },
    });
    await setupSinglePostThread(page, post);

    const view = page.locator("#post-detail-view");
    await expect(view.locator(".post-video")).toBeVisible({ timeout: 10000 });
    await expect(view.locator("streaming-video")).toHaveCount(1);
  });
});

test.describe("Post embeds view — external link", () => {
  test("renders title, description, and domain", async ({ page }) => {
    const post = buildPost({
      embed: {
        $type: "app.bsky.embed.external#view",
        external: {
          uri: "https://example.com/article",
          title: "Example Title",
          description: "A short description",
          thumb: "",
        },
      },
    });
    await setupSinglePostThread(page, post);

    const view = page.locator("#post-detail-view");
    await expect(view.locator('[data-testid="external-link"]')).toBeVisible({
      timeout: 10000,
    });
    await expect(
      view.locator('[data-testid="external-link-title"]'),
    ).toHaveText("Example Title");
    await expect(
      view.locator('[data-testid="external-link-domain"]'),
    ).toHaveText("example.com");
    await expect(view).toContainText("A short description");
  });
});

test.describe("Post embeds view — quoted post", () => {
  const quotedUri = "at://did:plc:author2/app.bsky.feed.post/quoted1";

  function quotedRecord({ text, handle = "author2.bsky.social" }) {
    const did = quotedUri.split("/")[2];
    return {
      $type: "app.bsky.embed.record#viewRecord",
      uri: quotedUri,
      cid: "bafyreitestquoted",
      author: {
        did,
        handle,
        displayName: "Quoted Author",
        avatar: "",
        viewer: { muted: false, blockedBy: false },
        labels: [],
        createdAt: "2025-01-01T00:00:00.000Z",
      },
      value: {
        $type: "app.bsky.feed.post",
        text,
        createdAt: "2025-01-01T00:00:00.000Z",
        langs: ["en"],
      },
      labels: [],
      likeCount: 0,
      replyCount: 0,
      repostCount: 0,
      quoteCount: 0,
      indexedAt: "2025-01-01T00:00:00.000Z",
      embeds: [],
    };
  }

  test("renders a quoted post embed with author handle and text", async ({
    page,
  }) => {
    const post = buildPost({
      embed: {
        $type: "app.bsky.embed.record#view",
        record: quotedRecord({ text: "The quoted post body" }),
      },
    });
    await setupSinglePostThread(page, post);

    const view = page.locator("#post-detail-view");
    await expect(view.locator(".quoted-post").first()).toBeVisible({
      timeout: 10000,
    });
    await expect(view).toContainText("The quoted post body");
    await expect(view).toContainText("@author2.bsky.social");
  });

  test("renders blocked-quote indicator for a viewBlocked record", async ({
    page,
  }) => {
    const post = buildPost({
      embed: {
        $type: "app.bsky.embed.record#view",
        record: {
          $type: "app.bsky.embed.record#viewBlocked",
          uri: quotedUri,
          blocked: true,
          author: {
            did: quotedUri.split("/")[2],
            viewer: { blockedBy: true },
          },
        },
      },
    });
    await setupSinglePostThread(page, post);

    const view = page.locator("#post-detail-view");
    await expect(view.locator('[data-testid="blocked-quote"]')).toBeVisible({
      timeout: 10000,
    });
  });

  test("renders not-found-quote indicator for a viewNotFound record", async ({
    page,
  }) => {
    const post = buildPost({
      embed: {
        $type: "app.bsky.embed.record#view",
        record: {
          $type: "app.bsky.embed.record#viewNotFound",
          uri: quotedUri,
          notFound: true,
        },
      },
    });
    await setupSinglePostThread(page, post);

    const view = page.locator("#post-detail-view");
    await expect(view.locator('[data-testid="not-found-quote"]')).toBeVisible({
      timeout: 10000,
    });
  });

  test("renders removed-quote indicator for a viewDetached record", async ({
    page,
  }) => {
    const post = buildPost({
      embed: {
        $type: "app.bsky.embed.record#view",
        record: {
          $type: "app.bsky.embed.record#viewDetached",
          uri: quotedUri,
          detached: true,
        },
      },
    });
    await setupSinglePostThread(page, post);

    const view = page.locator("#post-detail-view");
    await expect(view.locator('[data-testid="removed-quote"]')).toBeVisible({
      timeout: 10000,
    });
  });

  test("recordWithMedia renders both the media and the quoted post", async ({
    page,
  }) => {
    const post = buildPost({
      embed: {
        $type: "app.bsky.embed.recordWithMedia#view",
        media: {
          $type: "app.bsky.embed.external#view",
          external: {
            uri: "https://example.com/article",
            title: "Linked article",
            description: "An article",
            thumb: "",
          },
        },
        record: {
          $type: "app.bsky.embed.record#view",
          record: quotedRecord({ text: "Quoted alongside media" }),
        },
      },
    });
    await setupSinglePostThread(page, post);

    const view = page.locator("#post-detail-view");
    await expect(view.locator('[data-testid="external-link"]')).toBeVisible({
      timeout: 10000,
    });
    await expect(view.locator(".quoted-post").first()).toBeVisible();
    await expect(view).toContainText("Quoted alongside media");
  });
});

test.describe("Post embeds view — feed generator / list", () => {
  test("renders a feed generator embed with display name and creator handle", async ({
    page,
  }) => {
    const feedGenerator = createFeedGenerator({
      uri: "at://did:plc:creator1/app.bsky.feed.generator/feed1",
      displayName: "Cool Feed",
      creatorHandle: "creator1.bsky.social",
    });
    const post = buildPost({
      embed: {
        $type: "app.bsky.embed.record#view",
        record: {
          ...feedGenerator,
          $type: "app.bsky.feed.defs#generatorView",
        },
      },
    });
    await setupSinglePostThread(page, post);

    const view = page.locator("#post-detail-view");
    const feed = view.locator(".feed-generator-embed");
    await expect(feed).toBeVisible({ timeout: 10000 });
    await expect(feed).toContainText("Cool Feed");
    await expect(feed).toContainText("@creator1.bsky.social");
  });

  test("renders a list embed with list name and creator handle", async ({
    page,
  }) => {
    const list = createList({
      uri: "at://did:plc:creator1/app.bsky.graph.list/list1",
      name: "Curated Friends",
      creatorHandle: "creator1.bsky.social",
    });
    const post = buildPost({
      embed: {
        $type: "app.bsky.embed.record#view",
        record: { ...list, $type: "app.bsky.graph.defs#listView" },
      },
    });
    await setupSinglePostThread(page, post);

    const view = page.locator("#post-detail-view");
    const listEmbed = view.locator(".list-embed");
    await expect(listEmbed).toBeVisible({ timeout: 10000 });
    await expect(listEmbed).toContainText("Curated Friends");
    await expect(listEmbed).toContainText("@creator1.bsky.social");
  });
});
