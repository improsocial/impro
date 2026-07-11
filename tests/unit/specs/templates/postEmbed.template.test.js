import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  postEmbedTemplate,
  recordEmbedTemplate,
} from "/js/templates/postEmbed.template.js";
import { post } from "../../testData.js";
import { render } from "/js/lib/lit-html.js";

describe("postEmbedTemplate - images", () => {
  it("should render image embed", () => {
    const embed = {
      $type: "app.bsky.embed.images#view",
      images: [
        {
          thumb: "https://example.com/image.jpg",
          alt: "Test image",
        },
      ],
    };
    const result = postEmbedTemplate({
      embed,
      labels: [],
      isAuthenticated: true,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='post-images']") !== null);
  });

  it("should render multiple images", () => {
    const embed = {
      $type: "app.bsky.embed.images#view",
      images: [
        { thumb: "https://example.com/image1.jpg", alt: "Image 1" },
        { thumb: "https://example.com/image2.jpg", alt: "Image 2" },
      ],
    };
    const result = postEmbedTemplate({
      embed,
      labels: [],
      isAuthenticated: true,
    });
    const container = document.createElement("div");
    render(result, container);
    const images = container.querySelectorAll(".post-image");
    assert.deepEqual(images.length, 2);
  });

  it("should show ALT indicator when image has alt text", () => {
    const embed = {
      $type: "app.bsky.embed.images#view",
      images: [{ thumb: "https://example.com/image.jpg", alt: "Test image" }],
    };
    const result = postEmbedTemplate({
      embed,
      labels: [],
      isAuthenticated: true,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector(".alt-indicator") !== null);
  });

  it("should not show ALT indicator when image has no alt text", () => {
    const embed = {
      $type: "app.bsky.embed.images#view",
      images: [{ thumb: "https://example.com/image.jpg", alt: "" }],
    };
    const result = postEmbedTemplate({
      embed,
      labels: [],
      isAuthenticated: true,
    });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(container.querySelector(".alt-indicator"), null);
  });
});

function renderEmbed(embed) {
  const container = document.createElement("div");
  render(
    postEmbedTemplate({ embed, labels: [], isAuthenticated: true }),
    container,
  );
  return container;
}

describe("postEmbedTemplate - gallery", () => {
  function galleryEmbed(count) {
    const items = [];
    for (let i = 0; i < count; i += 1) {
      items.push({
        $type: "app.bsky.embed.gallery#viewImage",
        thumbnail: `https://example.com/g${i}.jpg`,
        fullsize: `https://example.com/g${i}-full.jpg`,
        alt: "",
        aspectRatio: { width: 4, height: 3 },
      });
    }
    return { $type: "app.bsky.embed.gallery#view", items };
  }

  it("renders a 5+ image gallery as <image-carousel>", () => {
    const container = renderEmbed(galleryEmbed(5));
    assert(container.querySelector('[data-testid="image-carousel"]') !== null);
    assert(container.querySelector('[data-testid="post-images"]') === null);
  });

  it("renders the 10-image gallery cap as a carousel", () => {
    const container = renderEmbed(galleryEmbed(10));
    const carousel = container.querySelector('[data-testid="image-carousel"]');
    assert(carousel !== null);
    assert.deepEqual(carousel.images.length, 10);
  });

  it("routes a single gallery image to the single-image grid, not the carousel", () => {
    const container = renderEmbed(galleryEmbed(1));
    assert(container.querySelector('[data-testid="image-carousel"]') === null);
    assert(container.querySelector('[data-testid="post-images"]') !== null);
  });

  it("does not render a carousel for a legacy 2-image post", () => {
    const embed = {
      $type: "app.bsky.embed.images#view",
      images: [
        { thumb: "https://example.com/a.jpg", alt: "" },
        { thumb: "https://example.com/b.jpg", alt: "" },
      ],
    };
    const container = renderEmbed(embed);
    assert(container.querySelector('[data-testid="image-carousel"]') === null);
    assert(container.querySelector('[data-testid="post-images"]') !== null);
  });

  it("renders nothing for an empty gallery", () => {
    const container = renderEmbed({
      $type: "app.bsky.embed.gallery#view",
      items: [],
    });
    assert.deepEqual(
      container.querySelector('[data-testid="image-carousel"]'),
      null,
    );
    assert.deepEqual(
      container.querySelector('[data-testid="post-images"]'),
      null,
    );
  });

  it("filters non-image gallery items out of the carousel slides", () => {
    const container = renderEmbed({
      $type: "app.bsky.embed.gallery#view",
      items: [
        {
          $type: "app.bsky.embed.gallery#viewImage",
          thumbnail: "https://example.com/g0.jpg",
          fullsize: "https://example.com/g0-full.jpg",
          alt: "",
          aspectRatio: { width: 4, height: 3 },
        },
        {
          $type: "app.bsky.embed.gallery#viewSomethingElse",
          thumbnail: "https://example.com/skip.jpg",
        },
        {
          $type: "app.bsky.embed.gallery#viewImage",
          thumbnail: "https://example.com/g1.jpg",
          fullsize: "https://example.com/g1-full.jpg",
          alt: "",
          aspectRatio: { width: 4, height: 3 },
        },
      ],
    });
    const carousel = container.querySelector('[data-testid="image-carousel"]');
    assert.deepEqual(carousel.images.length, 2);
    assert.deepEqual(carousel.images[0].thumb, "https://example.com/g0.jpg");
    assert.deepEqual(carousel.images[1].thumb, "https://example.com/g1.jpg");
  });

  it("maps gallery item `thumbnail` → carousel image `thumb` and passes other fields through", () => {
    const container = renderEmbed({
      $type: "app.bsky.embed.gallery#view",
      items: [
        {
          $type: "app.bsky.embed.gallery#viewImage",
          thumbnail: "https://example.com/g0-thumb.jpg",
          fullsize: "https://example.com/g0-full.jpg",
          alt: "labeled",
          aspectRatio: { width: 4, height: 3 },
        },
        {
          $type: "app.bsky.embed.gallery#viewImage",
          thumbnail: "https://example.com/g1-only.jpg",
        },
      ],
    });
    const carousel = container.querySelector('[data-testid="image-carousel"]');
    assert.deepEqual(
      carousel.images[0].thumb,
      "https://example.com/g0-thumb.jpg",
    );
    assert.deepEqual(
      carousel.images[0].fullsize,
      "https://example.com/g0-full.jpg",
    );
    assert.deepEqual(carousel.images[0].alt, "labeled");
    assert.deepEqual(
      carousel.images[1].thumb,
      "https://example.com/g1-only.jpg",
    );
  });
});

describe("postEmbedTemplate - video", () => {
  function videoEmbed(aspectRatio) {
    return {
      $type: "app.bsky.embed.video#view",
      playlist: "https://example.com/video.m3u8",
      aspectRatio,
    };
  }

  function renderVideo(aspectRatio) {
    const result = postEmbedTemplate({
      embed: videoEmbed(aspectRatio),
      labels: [],
      isAuthenticated: true,
    });
    const container = document.createElement("div");
    render(result, container);
    return container.querySelector(".post-video");
  }

  it("renders the aspect ratio inline on .post-video", () => {
    const el = renderVideo({ width: 16, height: 9 });
    assert(el !== null);
    assert.deepEqual(el.style.aspectRatio, String(16 / 9));
  });

  it("caps tall videos at a 1:2 ratio", () => {
    const el = renderVideo({ width: 1, height: 4 });
    assert.deepEqual(el.style.aspectRatio, String(1 / 2));
  });

  it("passes through wide videos without clamping", () => {
    const el = renderVideo({ width: 5, height: 1 });
    assert.deepEqual(el.style.aspectRatio, "5");
  });

  it("omits aspect-ratio when missing", () => {
    const el = renderVideo(undefined);
    assert.deepEqual(el.style.aspectRatio, "");
  });

  it("omits aspect-ratio when invalid", () => {
    const el = renderVideo({ width: 0, height: 0 });
    assert.deepEqual(el.style.aspectRatio, "");
  });

  it("renders a video with controls and no looping by default", () => {
    const el = renderVideo({ width: 16, height: 9 });
    const player = el.querySelector("streaming-video");
    assert(player.hasAttribute("controls"));
    assert(!player.hasAttribute("loop"));
    assert(!player.hasAttribute("autoplay"));
  });
});

describe("postEmbedTemplate - gif presentation video", () => {
  function renderGifVideo({ alt, aspectRatio } = {}) {
    const result = postEmbedTemplate({
      embed: {
        $type: "app.bsky.embed.video#view",
        playlist: "https://example.com/video.m3u8",
        presentation: "gif",
        alt,
        aspectRatio,
      },
      labels: [],
      isAuthenticated: true,
    });
    const container = document.createElement("div");
    render(result, container);
    return container.querySelector(".post-video");
  }

  it("renders a looping autoplaying muted player without controls", () => {
    const el = renderGifVideo();
    const player = el.querySelector("streaming-video");
    assert(player !== null);
    assert(player.hasAttribute("loop"));
    assert(player.hasAttribute("autoplay"));
    assert(player.hasAttribute("muted"));
    assert(player.hasAttribute("playsinline"));
    assert(!player.hasAttribute("controls"));
    assert.deepEqual(
      player.getAttribute("src"),
      "https://example.com/video.m3u8",
    );
  });

  it("renders the aspect ratio inline on .post-video", () => {
    const el = renderGifVideo({ aspectRatio: { width: 16, height: 9 } });
    assert.deepEqual(el.style.aspectRatio, String(16 / 9));
  });

  it("shows the ALT badge when alt text is present", () => {
    const el = renderGifVideo({ alt: "A cat gif" });
    assert(el.querySelector("[data-testid='video-alt-badge']") !== null);
  });

  it("omits the ALT badge when alt text is missing", () => {
    const el = renderGifVideo();
    assert.deepEqual(el.querySelector("[data-testid='video-alt-badge']"), null);
  });
});

describe("postEmbedTemplate - external links", () => {
  it("should render external link embed", () => {
    const embed = {
      $type: "app.bsky.embed.external#view",
      external: {
        uri: "https://example.com",
        title: "Example",
        description: "Test description",
        thumb: "https://example.com/thumb.jpg",
      },
    };
    const result = postEmbedTemplate({
      embed,
      labels: [],
      isAuthenticated: true,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='external-link']") !== null);
  });

  it("should render external link with title", () => {
    const embed = {
      $type: "app.bsky.embed.external#view",
      external: {
        uri: "https://example.com",
        title: "Example Title",
        description: "Test description",
      },
    };
    const result = postEmbedTemplate({
      embed,
      labels: [],
      isAuthenticated: true,
    });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(
      container
        .querySelector("[data-testid='external-link-title']")
        .textContent.trim(),
      "Example Title",
    );
  });

  it("should render external link with domain", () => {
    const embed = {
      $type: "app.bsky.embed.external#view",
      external: {
        uri: "https://example.com/page",
        title: "Example",
        description: "Test description",
      },
    };
    const result = postEmbedTemplate({
      embed,
      labels: [],
      isAuthenticated: true,
    });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(
      container
        .querySelector("[data-testid='external-link-domain']")
        .textContent.trim(),
      "example.com",
    );
  });
});

describe("postEmbedTemplate - external YouTube", () => {
  function youtubeExternalEmbed(uri) {
    return {
      $type: "app.bsky.embed.external#view",
      external: {
        uri,
        title: "A video",
        description: "A description",
        thumb: "https://example.com/thumb.jpg",
      },
    };
  }

  it("renders a youtube-embed for a watch URL", () => {
    const container = renderEmbed(
      youtubeExternalEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=32s"),
    );
    const embedElement = container.querySelector(
      "[data-testid='youtube-embed']",
    );
    assert(embedElement !== null);
    assert.deepEqual(embedElement.getAttribute("video-id"), "dQw4w9WgXcQ");
    assert.deepEqual(embedElement.getAttribute("start"), "32");
    assert.deepEqual(
      embedElement.getAttribute("thumb"),
      "https://example.com/thumb.jpg",
    );
    assert.deepEqual(
      embedElement.getAttribute("url"),
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=32s",
    );
    assert.deepEqual(embedElement.getAttribute("description"), "A description");
  });

  it("uses a 16:9 aspect ratio for regular videos", () => {
    const container = renderEmbed(
      youtubeExternalEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    );
    const embedElement = container.querySelector(
      "[data-testid='youtube-embed']",
    );
    assert.deepEqual(embedElement.getAttribute("aspect-ratio"), String(16 / 9));
  });

  it("uses a portrait aspect ratio for shorts", () => {
    const container = renderEmbed(
      youtubeExternalEmbed("https://youtube.com/shorts/dQw4w9WgXcQ"),
    );
    const embedElement = container.querySelector(
      "[data-testid='youtube-embed']",
    );
    assert.deepEqual(embedElement.getAttribute("aspect-ratio"), String(9 / 16));
  });

  it("renders watch URLs on all YouTube hostnames", () => {
    const hostnames = [
      "www.youtube.com",
      "youtube.com",
      "m.youtube.com",
      "music.youtube.com",
    ];
    for (const hostname of hostnames) {
      const container = renderEmbed(
        youtubeExternalEmbed(`https://${hostname}/watch?v=dQw4w9WgXcQ`),
      );
      const embedElement = container.querySelector(
        "[data-testid='youtube-embed']",
      );
      assert(embedElement !== null);
      assert.deepEqual(embedElement.getAttribute("video-id"), "dQw4w9WgXcQ");
    }
  });

  it("renders youtu.be links", () => {
    const container = renderEmbed(
      youtubeExternalEmbed("https://youtu.be/dQw4w9WgXcQ"),
    );
    const embedElement = container.querySelector(
      "[data-testid='youtube-embed']",
    );
    assert(embedElement !== null);
    assert.deepEqual(embedElement.getAttribute("video-id"), "dQw4w9WgXcQ");
    assert.deepEqual(embedElement.getAttribute("start"), "0");
  });

  it("renders live URLs as regular videos", () => {
    const container = renderEmbed(
      youtubeExternalEmbed("https://youtube.com/live/dQw4w9WgXcQ"),
    );
    const embedElement = container.querySelector(
      "[data-testid='youtube-embed']",
    );
    assert(embedElement !== null);
    assert.deepEqual(embedElement.getAttribute("video-id"), "dQw4w9WgXcQ");
    assert.deepEqual(embedElement.getAttribute("aspect-ratio"), String(16 / 9));
  });

  it("converts hour/minute/second start times to seconds", () => {
    const cases = [
      ["1m30s", "90"],
      ["1h2m3s", "3723"],
      ["1h", "3600"],
      ["45s", "45"],
    ];
    for (const [rawStartTime, expectedSeconds] of cases) {
      const container = renderEmbed(
        youtubeExternalEmbed(`https://youtu.be/dQw4w9WgXcQ?t=${rawStartTime}`),
      );
      const embedElement = container.querySelector(
        "[data-testid='youtube-embed']",
      );
      assert.deepEqual(embedElement.getAttribute("start"), expectedSeconds);
    }
  });

  it("degrades unparseable start times to 0", () => {
    for (const rawStartTime of ["abc", "1x30s", "m"]) {
      const container = renderEmbed(
        youtubeExternalEmbed(`https://youtu.be/dQw4w9WgXcQ?t=${rawStartTime}`),
      );
      const embedElement = container.querySelector(
        "[data-testid='youtube-embed']",
      );
      assert.deepEqual(embedElement.getAttribute("start"), "0");
    }
  });

  it("falls back to the external link card for non-video YouTube URLs", () => {
    const uris = [
      "https://youtube.com/",
      "https://youtube.com/shorts/",
      "https://youtube.com/live/",
      "https://youtube.com/random",
    ];
    for (const uri of uris) {
      const container = renderEmbed(youtubeExternalEmbed(uri));
      assert(container.querySelector("[data-testid='external-link']") !== null);
      assert.deepEqual(
        container.querySelector("[data-testid='youtube-embed']"),
        null,
      );
    }
  });

  it("falls back to the external link card for non-YouTube and spoofed hosts", () => {
    const uris = [
      "https://example.com/watch?v=dQw4w9WgXcQ",
      "https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ",
    ];
    for (const uri of uris) {
      const container = renderEmbed(youtubeExternalEmbed(uri));
      assert(container.querySelector("[data-testid='external-link']") !== null);
      assert.deepEqual(
        container.querySelector("[data-testid='youtube-embed']"),
        null,
      );
    }
  });

  it("falls back to the external link card for video ids with illegal characters", () => {
    const container = renderEmbed(
      youtubeExternalEmbed('https://www.youtube.com/watch?v=abc"def'),
    );
    assert(container.querySelector("[data-testid='external-link']") !== null);
    assert.deepEqual(
      container.querySelector("[data-testid='youtube-embed']"),
      null,
    );
  });
});

describe("postEmbedTemplate - quoted posts", () => {
  it("should render quoted post embed", () => {
    const embed = {
      $type: "app.bsky.embed.record#view",
      record: {
        $type: "app.bsky.embed.record#viewRecord",
        author: post.author,
        value: post.record,
        uri: post.uri,
      },
    };
    const result = postEmbedTemplate({
      embed,
      labels: [],
      isAuthenticated: true,
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector(".quoted-post") !== null);
  });

  it("should render blocked quote embed", () => {
    const embed = {
      $type: "app.bsky.embed.record#view",
      record: {
        $type: "app.bsky.embed.record#viewBlocked",
        uri: "blocked-uri",
        blocked: true,
      },
    };
    const result = postEmbedTemplate({
      embed,
      labels: [],
      isAuthenticated: true,
    });
    const container = document.createElement("div");
    render(result, container);
    const blockedQuote = container.querySelector(
      "[data-testid='blocked-quote']",
    );
    assert(blockedQuote !== null);
    assert(blockedQuote.querySelector(".info-icon") !== null);
  });

  it("should render not found quote embed", () => {
    const embed = {
      $type: "app.bsky.embed.record#view",
      record: {
        $type: "app.bsky.embed.record#viewNotFound",
        uri: "not-found-uri",
      },
    };
    const result = postEmbedTemplate({
      embed,
      labels: [],
      isAuthenticated: true,
    });
    const container = document.createElement("div");
    render(result, container);
    const notFoundQuote = container.querySelector(
      "[data-testid='not-found-quote']",
    );
    assert(notFoundQuote !== null);
    assert(notFoundQuote.querySelector(".info-icon") !== null);
  });

  it("should render detached/removed quote embed", () => {
    const embed = {
      $type: "app.bsky.embed.record#view",
      record: {
        $type: "app.bsky.embed.record#viewDetached",
        uri: "detached-uri",
      },
    };
    const result = postEmbedTemplate({
      embed,
      labels: [],
      isAuthenticated: true,
    });
    const container = document.createElement("div");
    render(result, container);
    const removedQuote = container.querySelector(
      "[data-testid='removed-quote']",
    );
    assert(removedQuote !== null);
    assert(removedQuote.querySelector(".info-icon") !== null);
  });

  it("should use closed-eye icon-style for a muted-account quoted post", () => {
    const embed = {
      $type: "app.bsky.embed.record#view",
      record: {
        $type: "app.bsky.embed.record#viewRecord",
        author: { ...post.author, viewer: { muted: true } },
        value: post.record,
        uri: post.uri,
      },
    };
    const result = postEmbedTemplate({
      embed,
      labels: [],
      isAuthenticated: true,
    });
    const container = document.createElement("div");
    render(result, container);
    const warning = container.querySelector(
      "moderation-warning.quoted-account-muted-warning",
    );
    assert(warning !== null);
    assert.deepEqual(warning.getAttribute("icon-style"), "closed-eye");
  });

  it("should use closed-eye icon-style for a muted-word quoted post", () => {
    const embed = {
      $type: "app.bsky.embed.record#view",
      record: {
        $type: "app.bsky.embed.record#viewRecord",
        author: post.author,
        value: post.record,
        uri: post.uri,
        hasMutedWord: true,
      },
    };
    const result = postEmbedTemplate({
      embed,
      labels: [],
      isAuthenticated: true,
    });
    const container = document.createElement("div");
    render(result, container);
    const warning = container.querySelector(
      "moderation-warning.quoted-account-muted-warning",
    );
    assert(warning !== null);
    assert.deepEqual(warning.getAttribute("icon-style"), "closed-eye");
  });

  it("should use closed-eye icon-style for a hidden quoted post", () => {
    const embed = {
      $type: "app.bsky.embed.record#view",
      record: {
        $type: "app.bsky.embed.record#viewRecord",
        author: post.author,
        value: post.record,
        uri: post.uri,
        isHidden: true,
      },
    };
    const result = postEmbedTemplate({
      embed,
      labels: [],
      isAuthenticated: true,
    });
    const container = document.createElement("div");
    render(result, container);
    const warning = container.querySelector(
      "moderation-warning.quoted-account-muted-warning",
    );
    assert(warning !== null);
    assert.deepEqual(warning.getAttribute("label"), "Post hidden by you");
    assert.deepEqual(warning.getAttribute("icon-style"), "closed-eye");
  });

  it("should prefer muted-account label over hidden for a quoted post", () => {
    const embed = {
      $type: "app.bsky.embed.record#view",
      record: {
        $type: "app.bsky.embed.record#viewRecord",
        author: { ...post.author, viewer: { muted: true } },
        value: post.record,
        uri: post.uri,
        isHidden: true,
      },
    };
    const result = postEmbedTemplate({
      embed,
      labels: [],
      isAuthenticated: true,
    });
    const container = document.createElement("div");
    render(result, container);
    const warning = container.querySelector(
      "moderation-warning.quoted-account-muted-warning",
    );
    assert(warning !== null);
    assert.deepEqual(warning.getAttribute("label"), "Muted Account");
  });

  it("should prefer hidden label over muted-word for a quoted post", () => {
    const embed = {
      $type: "app.bsky.embed.record#view",
      record: {
        $type: "app.bsky.embed.record#viewRecord",
        author: post.author,
        value: post.record,
        uri: post.uri,
        hasMutedWord: true,
        isHidden: true,
      },
    };
    const result = postEmbedTemplate({
      embed,
      labels: [],
      isAuthenticated: true,
    });
    const container = document.createElement("div");
    render(result, container);
    const warning = container.querySelector(
      "moderation-warning.quoted-account-muted-warning",
    );
    assert(warning !== null);
    assert.deepEqual(warning.getAttribute("label"), "Post hidden by you");
  });

  it("should use info icon-style for a content-labeled quoted post", () => {
    const embed = {
      $type: "app.bsky.embed.record#view",
      record: {
        $type: "app.bsky.embed.record#viewRecord",
        author: post.author,
        value: post.record,
        uri: post.uri,
        contentLabel: {
          visibility: "blur",
          label: { uri: "did:plc:other", val: "nsfw" },
          labelDefinition: {
            identifier: "nsfw",
            blurs: "content",
            severity: "alert",
            locales: [
              { lang: "en", name: "NSFW", description: "Adult content" },
            ],
          },
        },
      },
    };
    const result = postEmbedTemplate({
      embed,
      labels: [],
      isAuthenticated: true,
    });
    const container = document.createElement("div");
    render(result, container);
    const warning = container.querySelector(
      "moderation-warning.quoted-account-muted-warning",
    );
    assert(warning !== null);
    assert.deepEqual(warning.getAttribute("icon-style"), "info");
  });

  it("should truncate long URLs in quoted post text", () => {
    const url = "https://example.com/very/long/path/to/some/page";
    const text = "See " + url;
    const embed = {
      $type: "app.bsky.embed.record#view",
      record: {
        $type: "app.bsky.embed.record#viewRecord",
        author: post.author,
        value: {
          ...post.record,
          text,
          facets: [
            {
              index: { byteStart: 4, byteEnd: 4 + url.length },
              features: [{ $type: "app.bsky.richtext.facet#link", uri: url }],
            },
          ],
        },
        uri: post.uri,
      },
    };
    const result = postEmbedTemplate({
      embed,
      labels: [],
      isAuthenticated: true,
    });
    const container = document.createElement("div");
    render(result, container);
    const link = container.querySelector(".quoted-post a[href='" + url + "']");
    assert(link !== null);
    assert(link.textContent.endsWith("..."));
    assert(link.textContent.length < url.length);
  });
});

describe("recordEmbedTemplate - condensed quoted posts", () => {
  function makeViewRecord({ embeds } = {}) {
    return {
      $type: "app.bsky.embed.record#viewRecord",
      author: post.author,
      value: post.record,
      uri: post.uri,
      cid: "quotedcid",
      ...(embeds ? { embeds } : {}),
    };
  }

  function renderRecord(record, { condensed } = {}) {
    const container = document.createElement("div");
    render(
      recordEmbedTemplate({ record, isAuthenticated: true, condensed }),
      container,
    );
    return container;
  }

  it("renders without the condensed class by default", () => {
    const container = renderRecord(makeViewRecord());
    assert(container.querySelector(".quoted-post") !== null);
    assert.deepEqual(container.querySelector(".quoted-post-condensed"), null);
  });

  it("adds the condensed class when condensed", () => {
    const container = renderRecord(makeViewRecord(), { condensed: true });
    assert(container.querySelector(".quoted-post-condensed") !== null);
  });

  it("renders image thumbnails instead of the full embed when condensed", () => {
    const record = makeViewRecord({
      embeds: [
        {
          $type: "app.bsky.embed.images#view",
          images: [
            { thumb: "thumb1.jpg", fullsize: "full1.jpg", alt: "first" },
            { thumb: "thumb2.jpg", fullsize: "full2.jpg", alt: "" },
          ],
        },
      ],
    });
    const container = renderRecord(record, { condensed: true });
    const thumbs = container.querySelectorAll(".quoted-post-media-thumb");
    assert.deepEqual(thumbs.length, 2);
    assert.deepEqual(thumbs[0].getAttribute("src"), "thumb1.jpg");
    assert.deepEqual(thumbs[0].getAttribute("alt"), "first");
    assert.deepEqual(container.querySelector(".post-embed"), null);
  });

  it("caps condensed image thumbnails at four", () => {
    const images = Array.from({ length: 6 }, (unused, index) => ({
      thumb: `thumb${index}.jpg`,
      fullsize: `full${index}.jpg`,
      alt: "",
    }));
    const record = makeViewRecord({
      embeds: [{ $type: "app.bsky.embed.images#view", images }],
    });
    const container = renderRecord(record, { condensed: true });
    assert.deepEqual(
      container.querySelectorAll(".quoted-post-media-thumb").length,
      4,
    );
  });

  it("renders a video thumbnail with a play button when condensed", () => {
    const record = makeViewRecord({
      embeds: [
        {
          $type: "app.bsky.embed.video#view",
          cid: "videocid",
          playlist: "playlist.m3u8",
          thumbnail: "poster.jpg",
          alt: "a video",
        },
      ],
    });
    const container = renderRecord(record, { condensed: true });
    const thumb = container.querySelector(
      ".quoted-post-media-video .quoted-post-media-thumb",
    );
    assert(thumb !== null);
    assert.deepEqual(thumb.getAttribute("src"), "poster.jpg");
    assert(container.querySelector(".video-preview-play-button") !== null);
  });

  it("skips non-media embeds entirely when condensed", () => {
    const record = makeViewRecord({
      embeds: [
        {
          $type: "app.bsky.embed.external#view",
          external: {
            uri: "https://example.com",
            title: "Example",
            description: "An example site",
          },
        },
      ],
    });
    const container = renderRecord(record, { condensed: true });
    assert.deepEqual(container.querySelector(".post-embed"), null);
    assert.deepEqual(
      container.querySelector(".quoted-post-media-thumbs"),
      null,
    );
    assert.deepEqual(container.querySelector(".external-link-embed"), null);
  });
});

describe("postEmbedTemplate - record embeds", () => {
  it("renders a feed generator embed", () => {
    const container = renderEmbed({
      $type: "app.bsky.embed.record#view",
      record: {
        $type: "app.bsky.feed.defs#generatorView",
        uri: "at://did:plc:creator/app.bsky.feed.generator/cool-feed",
        cid: "feedcid",
        displayName: "Cool Feed",
        creator: { did: "did:plc:creator", handle: "creator.bsky.social" },
      },
    });
    const card = container.querySelector(".feed-generator-embed");
    assert(card !== null);
    assert(card.textContent.includes("Cool Feed"));
    assert(card.textContent.includes("@creator.bsky.social"));
  });

  it("renders a list embed", () => {
    const container = renderEmbed({
      $type: "app.bsky.embed.record#view",
      record: {
        $type: "app.bsky.graph.defs#listView",
        uri: "at://did:plc:creator/app.bsky.graph.list/cool-list",
        cid: "listcid",
        name: "Cool List",
        creator: { did: "did:plc:creator", handle: "creator.bsky.social" },
      },
    });
    const card = container.querySelector(".list-embed");
    assert(card !== null);
    assert(card.textContent.includes("Cool List"));
    assert(card.textContent.includes("@creator.bsky.social"));
  });

  it("renders a starter pack embed", () => {
    const container = renderEmbed({
      $type: "app.bsky.embed.record#view",
      record: {
        $type: "app.bsky.graph.defs#starterPackViewBasic",
        uri: "at://did:plc:creator/app.bsky.graph.starterpack/cool-pack",
        cid: "packcid",
        record: {
          name: "Cool Pack",
          description: "People to follow",
        },
        creator: { did: "did:plc:creator", handle: "creator.bsky.social" },
      },
    });
    const card = container.querySelector(".starter-pack-embed");
    assert(card !== null);
    assert(card.textContent.includes("Cool Pack"));
    assert(card.textContent.includes("People to follow"));
    assert(card.textContent.includes("@creator.bsky.social"));
  });
});
