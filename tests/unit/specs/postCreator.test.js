import { TestSuite } from "../testSuite.js";
import { assert, assertEquals } from "../testHelpers.js";
import { PostCreator } from "/js/postCreator.js";

const t = new TestSuite("postCreator");

function makeApi() {
  const api = {
    lastEmbed: null,
    uploadBlob: async () => ({
      ref: { $link: "bafyimg" },
      mimeType: "image/jpeg",
      size: 100,
    }),
    createPost: async ({ embed, langs }) => {
      api.lastEmbed = embed;
      api.lastLangs = langs;
      return { uri: "at://did:plc:user/app.bsky.feed.post/abc" };
    },
    getPost: async () => ({
      uri: "at://did:plc:user/app.bsky.feed.post/abc",
      cid: "cid1",
      record: { text: "hi" },
    }),
  };
  return api;
}

function makeImageCompressor() {
  return {
    compressed: [],
    compressImage: async function (dataUrl) {
      this.compressed.push(dataUrl);
      return {
        blob: new Blob(["x"], { type: "image/jpeg" }),
        width: 10,
        height: 10,
      };
    },
  };
}

function videoFixture() {
  return {
    blob: {
      ref: { $link: "bafyvideo" },
      mimeType: "video/mp4",
      size: 12345,
    },
    alt: "a clip",
    aspectRatio: { width: 16, height: 9 },
  };
}

t.describe("video embed preparation", (it) => {
  it("produces no embed when video is missing", async () => {
    const api = makeApi();
    const pc = new PostCreator(api);
    await pc.createPost({ postText: "hi" });
    assertEquals(api.lastEmbed, null);

    await pc.createPost({ postText: "hi", video: null });
    assertEquals(api.lastEmbed, null);

    await pc.createPost({ postText: "hi", video: {} });
    assertEquals(api.lastEmbed, null);
  });

  it("builds an embed.video record with alt and aspectRatio", async () => {
    const api = makeApi();
    const pc = new PostCreator(api);
    await pc.createPost({ postText: "hi", video: videoFixture() });
    const embed = api.lastEmbed;
    assertEquals(embed.$type, "app.bsky.embed.video");
    assertEquals(embed.alt, "a clip");
    assertEquals(embed.video.$type, "blob");
    assertEquals(embed.video.ref.$link, "bafyvideo");
    assertEquals(embed.video.mimeType, "video/mp4");
    assertEquals(embed.video.size, 12345);
    assertEquals(embed.aspectRatio.width, 16);
    assertEquals(embed.aspectRatio.height, 9);
  });

  it("omits aspectRatio when missing", async () => {
    const api = makeApi();
    const pc = new PostCreator(api);
    await pc.createPost({
      postText: "hi",
      video: { ...videoFixture(), aspectRatio: null },
    });
    assert(!("aspectRatio" in api.lastEmbed));
  });

  it("omits aspectRatio when width or height is zero", async () => {
    const api = makeApi();
    const pc = new PostCreator(api);
    await pc.createPost({
      postText: "hi",
      video: { ...videoFixture(), aspectRatio: { width: 0, height: 9 } },
    });
    assert(!("aspectRatio" in api.lastEmbed));

    await pc.createPost({
      postText: "hi",
      video: { ...videoFixture(), aspectRatio: { width: 16, height: 0 } },
    });
    assert(!("aspectRatio" in api.lastEmbed));
  });

  it("preserves raw (unclamped) dimensions", async () => {
    const api = makeApi();
    const pc = new PostCreator(api);
    await pc.createPost({
      postText: "hi",
      video: { ...videoFixture(), aspectRatio: { width: 1080, height: 100 } },
    });
    assertEquals(api.lastEmbed.aspectRatio.width, 1080);
    assertEquals(api.lastEmbed.aspectRatio.height, 100);
  });

  it("omits alt when empty", async () => {
    const api = makeApi();
    const pc = new PostCreator(api);
    await pc.createPost({
      postText: "hi",
      video: { ...videoFixture(), alt: "" },
    });
    assert(!("alt" in api.lastEmbed));
  });

  it("forwards langs to api.createPost", async () => {
    const api = makeApi();
    const pc = new PostCreator(api);
    await pc.createPost({ postText: "hi" });
    assert(Array.isArray(api.lastLangs));
    assert(api.lastLangs.length > 0);
  });
});

t.describe("createPost embed selection", (it) => {
  it("uses video embed when video is provided", async () => {
    const api = makeApi();
    const pc = new PostCreator(api);
    await pc.createPost({ postText: "hi", video: videoFixture() });
    assertEquals(api.lastEmbed.$type, "app.bsky.embed.video");
  });

  it("video takes precedence over images", async () => {
    const api = makeApi();
    const pc = new PostCreator(api, makeImageCompressor());
    await pc.createPost({
      postText: "hi",
      video: videoFixture(),
      images: [{ dataUrl: "data:image/jpeg;base64,AAAA", alt: "" }],
    });
    assertEquals(api.lastEmbed.$type, "app.bsky.embed.video");
  });

  it("wraps video in recordWithMedia when there is a quoted post", async () => {
    const api = makeApi();
    const pc = new PostCreator(api);
    await pc.createPost({
      postText: "hi",
      video: videoFixture(),
      quotedPost: { uri: "at://x", cid: "c" },
    });
    assertEquals(api.lastEmbed.$type, "app.bsky.embed.recordWithMedia");
    assertEquals(api.lastEmbed.media.$type, "app.bsky.embed.video");
    assertEquals(api.lastEmbed.record.$type, "app.bsky.embed.record");
  });
});

t.describe("images embed preparation", (it) => {
  it("produces no embed when images is missing or empty", async () => {
    const api = makeApi();
    const pc = new PostCreator(api);
    await pc.createPost({ postText: "hi", images: [] });
    assertEquals(api.lastEmbed, null);

    await pc.createPost({ postText: "hi", images: null });
    assertEquals(api.lastEmbed, null);
  });

  it("uploads each image and builds an embed.images record", async () => {
    const uploaded = [];
    const api = makeApi();
    api.uploadBlob = async (blob) => {
      uploaded.push(blob);
      return {
        ref: { $link: `bafyimg${uploaded.length}` },
        mimeType: "image/jpeg",
        size: 100 + uploaded.length,
      };
    };
    const imageCompressor = makeImageCompressor();
    const pc = new PostCreator(api, imageCompressor);
    await pc.createPost({
      postText: "hi",
      images: [
        { dataUrl: "data:image/jpeg;base64,AAAA", alt: "first" },
        { dataUrl: "data:image/jpeg;base64,BBBB", alt: "" },
      ],
    });
    assertEquals(imageCompressor.compressed.length, 2);
    assertEquals(uploaded.length, 2);
    const embed = api.lastEmbed;
    assertEquals(embed.$type, "app.bsky.embed.images");
    assertEquals(embed.images.length, 2);
    assertEquals(embed.images[0].alt, "first");
    assertEquals(embed.images[0].image.ref.$link, "bafyimg1");
    assertEquals(embed.images[0].aspectRatio.width, 10);
    assertEquals(embed.images[0].aspectRatio.height, 10);
    assertEquals(embed.images[1].alt, "");
    assertEquals(embed.images[1].image.ref.$link, "bafyimg2");
  });
});

t.describe("external embed preparation", (it) => {
  it("produces no embed when external is missing", async () => {
    const api = makeApi();
    const pc = new PostCreator(api);
    await pc.createPost({ postText: "hi" });
    assertEquals(api.lastEmbed, null);
  });

  it("builds an embed.external record and renames url to uri", async () => {
    const api = makeApi();
    const pc = new PostCreator(api);
    await pc.createPost({
      postText: "hi",
      external: {
        title: "Example",
        description: "An example link",
        url: "https://example.com",
      },
    });
    const embed = api.lastEmbed;
    assertEquals(embed.$type, "app.bsky.embed.external");
    assertEquals(embed.external.title, "Example");
    assertEquals(embed.external.description, "An example link");
    assertEquals(embed.external.uri, "https://example.com");
    assert(!("thumb" in embed.external));
  });

  it("uploads a preview image when provided", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      blob: async () => new Blob(["x"], { type: "image/png" }),
    });
    try {
      const api = makeApi();
      api.uploadBlob = async () => ({
        ref: { $link: "bafythumb" },
        mimeType: "image/png",
        size: 42,
      });
      const pc = new PostCreator(api);
      await pc.createPost({
        postText: "hi",
        external: {
          title: "Example",
          description: "An example link",
          url: "https://example.com",
          image: "https://example.com/preview.png",
        },
      });
      const thumb = api.lastEmbed.external.thumb;
      assertEquals(thumb.$type, "blob");
      assertEquals(thumb.ref.$link, "bafythumb");
      assertEquals(thumb.mimeType, "image/png");
      assertEquals(thumb.size, 42);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("still creates the post when preview image upload fails", async () => {
    const originalFetch = globalThis.fetch;
    const originalError = console.error;
    globalThis.fetch = async () => {
      throw new Error("network down");
    };
    console.error = () => {};
    try {
      const api = makeApi();
      const pc = new PostCreator(api);
      await pc.createPost({
        postText: "hi",
        external: {
          title: "Example",
          description: "An example link",
          url: "https://example.com",
          image: "https://example.com/preview.png",
        },
      });
      assertEquals(api.lastEmbed.$type, "app.bsky.embed.external");
      assert(!("thumb" in api.lastEmbed.external));
    } finally {
      globalThis.fetch = originalFetch;
      console.error = originalError;
    }
  });
});

await t.run();
