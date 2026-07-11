import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PostCreator } from "/js/postCreator.js";

const mockIdentityResolver = {
  resolveHandle: async () => null,
};

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
      return {
        uri: "at://did:plc:user/app.bsky.feed.post/abc",
        cid: "cid1",
      };
    },
    getPostCalls: 0,
    getPost: async function () {
      this.getPostCalls++;
      return {
        uri: "at://did:plc:user/app.bsky.feed.post/abc",
        cid: "cid1",
        record: { text: "hi" },
      };
    },
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

describe("video embed preparation", () => {
  it("produces no embed when video is missing", async () => {
    const api = makeApi();
    const pc = new PostCreator(api, mockIdentityResolver);
    await pc.createPost({ postText: "hi" });
    assert.deepEqual(api.lastEmbed, null);

    await pc.createPost({ postText: "hi", video: null });
    assert.deepEqual(api.lastEmbed, null);

    await pc.createPost({ postText: "hi", video: {} });
    assert.deepEqual(api.lastEmbed, null);
  });

  it("builds an embed.video record with alt and aspectRatio", async () => {
    const api = makeApi();
    const pc = new PostCreator(api, mockIdentityResolver);
    await pc.createPost({ postText: "hi", video: videoFixture() });
    const embed = api.lastEmbed;
    assert.deepEqual(embed.$type, "app.bsky.embed.video");
    assert.deepEqual(embed.alt, "a clip");
    assert.deepEqual(embed.video.$type, "blob");
    assert.deepEqual(embed.video.ref.$link, "bafyvideo");
    assert.deepEqual(embed.video.mimeType, "video/mp4");
    assert.deepEqual(embed.video.size, 12345);
    assert.deepEqual(embed.aspectRatio.width, 16);
    assert.deepEqual(embed.aspectRatio.height, 9);
  });

  it("omits aspectRatio when missing", async () => {
    const api = makeApi();
    const pc = new PostCreator(api, mockIdentityResolver);
    await pc.createPost({
      postText: "hi",
      video: { ...videoFixture(), aspectRatio: null },
    });
    assert(!("aspectRatio" in api.lastEmbed));
  });

  it("omits aspectRatio when width or height is zero", async () => {
    const api = makeApi();
    const pc = new PostCreator(api, mockIdentityResolver);
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
    const pc = new PostCreator(api, mockIdentityResolver);
    await pc.createPost({
      postText: "hi",
      video: { ...videoFixture(), aspectRatio: { width: 1080, height: 100 } },
    });
    assert.deepEqual(api.lastEmbed.aspectRatio.width, 1080);
    assert.deepEqual(api.lastEmbed.aspectRatio.height, 100);
  });

  it("omits alt when empty", async () => {
    const api = makeApi();
    const pc = new PostCreator(api, mockIdentityResolver);
    await pc.createPost({
      postText: "hi",
      video: { ...videoFixture(), alt: "" },
    });
    assert(!("alt" in api.lastEmbed));
  });

  it("forwards langs to api.createPost", async () => {
    const api = makeApi();
    const pc = new PostCreator(api, mockIdentityResolver);
    await pc.createPost({ postText: "hi" });
    assert(Array.isArray(api.lastLangs));
    assert(api.lastLangs.length > 0);
  });
});

describe("createPost embed selection", () => {
  it("uses video embed when video is provided", async () => {
    const api = makeApi();
    const pc = new PostCreator(api, mockIdentityResolver);
    await pc.createPost({ postText: "hi", video: videoFixture() });
    assert.deepEqual(api.lastEmbed.$type, "app.bsky.embed.video");
  });

  it("video takes precedence over images", async () => {
    const api = makeApi();
    const pc = new PostCreator(
      api,
      mockIdentityResolver,
      makeImageCompressor(),
    );
    await pc.createPost({
      postText: "hi",
      video: videoFixture(),
      images: [{ dataUrl: "data:image/jpeg;base64,AAAA", alt: "" }],
    });
    assert.deepEqual(api.lastEmbed.$type, "app.bsky.embed.video");
  });

  it("builds a bare record embed from any quoted record's uri and cid", async () => {
    const api = makeApi();
    const pc = new PostCreator(api, mockIdentityResolver);
    await pc.createPost({
      postText: "hi",
      quotedRecord: {
        uri: "at://did:plc:creator/app.bsky.feed.generator/cool-feed",
        cid: "feedcid",
      },
    });
    assert.deepEqual(api.lastEmbed.$type, "app.bsky.embed.record");
    assert.deepEqual(
      api.lastEmbed.record.uri,
      "at://did:plc:creator/app.bsky.feed.generator/cool-feed",
    );
    assert.deepEqual(api.lastEmbed.record.cid, "feedcid");
  });

  it("wraps video in recordWithMedia when there is a quoted record", async () => {
    const api = makeApi();
    const pc = new PostCreator(api, mockIdentityResolver);
    await pc.createPost({
      postText: "hi",
      video: videoFixture(),
      quotedRecord: { uri: "at://x", cid: "c" },
    });
    assert.deepEqual(api.lastEmbed.$type, "app.bsky.embed.recordWithMedia");
    assert.deepEqual(api.lastEmbed.media.$type, "app.bsky.embed.video");
    assert.deepEqual(api.lastEmbed.record.$type, "app.bsky.embed.record");
  });
});

describe("images embed preparation", () => {
  it("produces no embed when images is missing or empty", async () => {
    const api = makeApi();
    const pc = new PostCreator(api, mockIdentityResolver);
    await pc.createPost({ postText: "hi", images: [] });
    assert.deepEqual(api.lastEmbed, null);

    await pc.createPost({ postText: "hi", images: null });
    assert.deepEqual(api.lastEmbed, null);
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
    const pc = new PostCreator(api, mockIdentityResolver, imageCompressor);
    await pc.createPost({
      postText: "hi",
      images: [
        { dataUrl: "data:image/jpeg;base64,AAAA", alt: "first" },
        { dataUrl: "data:image/jpeg;base64,BBBB", alt: "" },
      ],
    });
    assert.deepEqual(imageCompressor.compressed.length, 2);
    assert.deepEqual(uploaded.length, 2);
    const embed = api.lastEmbed;
    assert.deepEqual(embed.$type, "app.bsky.embed.images");
    assert.deepEqual(embed.images.length, 2);
    assert.deepEqual(embed.images[0].alt, "first");
    assert.deepEqual(embed.images[0].image.ref.$link, "bafyimg1");
    assert.deepEqual(embed.images[0].aspectRatio.width, 10);
    assert.deepEqual(embed.images[0].aspectRatio.height, 10);
    assert.deepEqual(embed.images[1].alt, "");
    assert.deepEqual(embed.images[1].image.ref.$link, "bafyimg2");
  });
});

describe("external embed preparation", () => {
  it("produces no embed when external is missing", async () => {
    const api = makeApi();
    const pc = new PostCreator(api, mockIdentityResolver);
    await pc.createPost({ postText: "hi" });
    assert.deepEqual(api.lastEmbed, null);
  });

  it("builds an embed.external record and renames url to uri", async () => {
    const api = makeApi();
    const pc = new PostCreator(api, mockIdentityResolver);
    await pc.createPost({
      postText: "hi",
      external: {
        title: "Example",
        description: "An example link",
        url: "https://example.com",
      },
    });
    const embed = api.lastEmbed;
    assert.deepEqual(embed.$type, "app.bsky.embed.external");
    assert.deepEqual(embed.external.title, "Example");
    assert.deepEqual(embed.external.description, "An example link");
    assert.deepEqual(embed.external.uri, "https://example.com");
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
        mimeType: "image/jpeg",
        size: 42,
      });
      const pc = new PostCreator(
        api,
        mockIdentityResolver,
        makeImageCompressor(),
      );
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
      assert.deepEqual(thumb.$type, "blob");
      assert.deepEqual(thumb.ref.$link, "bafythumb");
      assert.deepEqual(thumb.mimeType, "image/jpeg");
      assert.deepEqual(thumb.size, 42);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("compresses the preview image before uploading", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      blob: async () => new Blob(["original-bytes"], { type: "image/png" }),
    });
    try {
      const api = makeApi();
      const uploadedBlobs = [];
      api.uploadBlob = async (blob) => {
        uploadedBlobs.push(blob);
        return {
          ref: { $link: "bafythumb" },
          mimeType: "image/jpeg",
          size: 1,
        };
      };
      const imageCompressor = makeImageCompressor();
      const pc = new PostCreator(api, mockIdentityResolver, imageCompressor);
      await pc.createPost({
        postText: "hi",
        external: {
          title: "Example",
          description: "An example link",
          url: "https://example.com",
          image: "https://example.com/preview.png",
        },
      });
      assert.deepEqual(imageCompressor.compressed.length, 1);
      assert(imageCompressor.compressed[0].startsWith("data:image/png"));
      assert.deepEqual(uploadedBlobs.length, 1);
      assert.deepEqual(uploadedBlobs[0].type, "image/jpeg");
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
      const pc = new PostCreator(api, mockIdentityResolver);
      await pc.createPost({
        postText: "hi",
        external: {
          title: "Example",
          description: "An example link",
          url: "https://example.com",
          image: "https://example.com/preview.png",
        },
      });
      assert.deepEqual(api.lastEmbed.$type, "app.bsky.embed.external");
      assert(!("thumb" in api.lastEmbed.external));
    } finally {
      globalThis.fetch = originalFetch;
      console.error = originalError;
    }
  });
});

describe("post text trimming", () => {
  function makeCapturingApi() {
    const api = makeApi();
    api.sent = null;
    api.createPost = async (record) => {
      api.sent = record;
      return { uri: "at://did:plc:user/app.bsky.feed.post/abc", cid: "cid1" };
    };
    return api;
  }

  it("leaves well-formed text unchanged", async () => {
    const api = makeCapturingApi();
    await new PostCreator(api, mockIdentityResolver).createPost({
      postText: "hello world",
    });
    assert.deepEqual(api.sent.text, "hello world");

    await new PostCreator(api, mockIdentityResolver).createPost({
      postText: "line one\n\nline two",
    });
    assert.deepEqual(api.sent.text, "line one\n\nline two");
  });

  it("strips leading whitespace-only lines", async () => {
    const api = makeCapturingApi();
    await new PostCreator(api, mockIdentityResolver).createPost({
      postText: "\n\n  \nhello",
    });
    assert.deepEqual(api.sent.text, "hello");
  });

  it("preserves leading spaces on the first content line (ASCII art)", async () => {
    const api = makeCapturingApi();
    await new PostCreator(api, mockIdentityResolver).createPost({
      postText: "   /\\_/\\\n  ( o.o )",
    });
    assert.deepEqual(api.sent.text, "   /\\_/\\\n  ( o.o )");
  });

  it("trims trailing whitespace", async () => {
    const api = makeCapturingApi();
    await new PostCreator(api, mockIdentityResolver).createPost({
      postText: "hello   \n\n  ",
    });
    assert.deepEqual(api.sent.text, "hello");
  });

  it("collapses runs of 3+ newlines to 2", async () => {
    const api = makeCapturingApi();
    await new PostCreator(api, mockIdentityResolver).createPost({
      postText: "a\n\n\nb",
    });
    assert.deepEqual(api.sent.text, "a\n\nb");

    await new PostCreator(api, mockIdentityResolver).createPost({
      postText: "a\n\n\n\n\nb",
    });
    assert.deepEqual(api.sent.text, "a\n\nb");

    await new PostCreator(api, mockIdentityResolver).createPost({
      postText: "a\n \n \nb",
    });
    assert.deepEqual(api.sent.text, "a\n\nb");
  });

  it("handles empty text", async () => {
    const api = makeCapturingApi();
    await new PostCreator(api, mockIdentityResolver).createPost({
      postText: "",
    });
    assert.deepEqual(api.sent.text, "");
  });
});

describe("app view hydration", () => {
  it("returns uri, cid, and the hydrated post on success", async () => {
    const api = makeApi();
    const pc = new PostCreator(api, mockIdentityResolver);
    const result = await pc.createPost({ postText: "hi" });
    assert.deepEqual(result.uri, "at://did:plc:user/app.bsky.feed.post/abc");
    assert.deepEqual(result.cid, "cid1");
    assert.deepEqual(result.post.cid, "cid1");
    assert.deepEqual(api.getPostCalls, 1);
  });

  it("returns post: null when app view never returns the post", async () => {
    const originalWait = globalThis.setTimeout;
    globalThis.setTimeout = (fn) => originalWait(fn, 0);
    try {
      const api = makeApi();
      api.getPost = async () => {
        throw new Error("not found yet");
      };
      const pc = new PostCreator(api, mockIdentityResolver);
      const result = await pc.createPost({ postText: "hi" });
      assert.deepEqual(result.uri, "at://did:plc:user/app.bsky.feed.post/abc");
      assert.deepEqual(result.cid, "cid1");
      assert.deepEqual(result.post, null);
    } finally {
      globalThis.setTimeout = originalWait;
    }
  });

  it("retries up to 5 times before giving up", async () => {
    const originalWait = globalThis.setTimeout;
    globalThis.setTimeout = (fn) => originalWait(fn, 0);
    try {
      const api = makeApi();
      let calls = 0;
      api.getPost = async () => {
        calls++;
        throw new Error("nope");
      };
      const pc = new PostCreator(api, mockIdentityResolver);
      await pc.createPost({ postText: "hi" });
      assert.deepEqual(calls, 5);
    } finally {
      globalThis.setTimeout = originalWait;
    }
  });
});
