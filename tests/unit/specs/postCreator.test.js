import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PostCreator } from "/js/postCreator.js";
import { computeRecordCid } from "/js/atproto.js";

const mockIdentityResolver = {
  resolveHandle: async () => null,
};

function makeApi() {
  const api = {
    session: { did: "did:plc:user" },
    lastWrites: null,
    lastEmbed: null,
    lastLangs: null,
    lastLabels: null,
    uploadBlob: async () => ({
      ref: { $link: "bafyimg" },
      mimeType: "image/jpeg",
      size: 100,
    }),
    applyWrites: async function (writes) {
      this.lastWrites = writes;
      const postWrite = writes.find(
        (write) => write.collection === "app.bsky.feed.post",
      );
      this.lastEmbed = postWrite.value.embed ?? null;
      this.lastLangs = postWrite.value.langs;
      this.lastLabels = postWrite.value.labels ?? null;
      return {};
    },
    getPostsCalls: 0,
    getPosts: async function (uris) {
      this.getPostsCalls++;
      return uris.map((uri) => ({ uri, cid: "cid1", record: { text: "hi" } }));
    },
  };
  return api;
}

// Publishes a single post through the unified thread path.
function createSinglePost(pc, options = {}) {
  const {
    replyTo,
    replyRoot,
    threadgateAllow = null,
    postgateEmbeddingRules = null,
    ...postFields
  } = options;
  return pc.createThread({
    posts: [postFields],
    replyTo,
    replyRoot,
    threadgateAllow,
    postgateEmbeddingRules,
  });
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
    await createSinglePost(pc, { postText: "hi" });
    assert.deepEqual(api.lastEmbed, null);

    await createSinglePost(pc, { postText: "hi", video: null });
    assert.deepEqual(api.lastEmbed, null);

    await createSinglePost(pc, { postText: "hi", video: {} });
    assert.deepEqual(api.lastEmbed, null);
  });

  it("builds an embed.video record with alt and aspectRatio", async () => {
    const api = makeApi();
    const pc = new PostCreator(api, mockIdentityResolver);
    await createSinglePost(pc, { postText: "hi", video: videoFixture() });
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
    await createSinglePost(pc, {
      postText: "hi",
      video: { ...videoFixture(), aspectRatio: null },
    });
    assert(!("aspectRatio" in api.lastEmbed));
  });

  it("omits aspectRatio when width or height is zero", async () => {
    const api = makeApi();
    const pc = new PostCreator(api, mockIdentityResolver);
    await createSinglePost(pc, {
      postText: "hi",
      video: { ...videoFixture(), aspectRatio: { width: 0, height: 9 } },
    });
    assert(!("aspectRatio" in api.lastEmbed));

    await createSinglePost(pc, {
      postText: "hi",
      video: { ...videoFixture(), aspectRatio: { width: 16, height: 0 } },
    });
    assert(!("aspectRatio" in api.lastEmbed));
  });

  it("preserves raw (unclamped) dimensions", async () => {
    const api = makeApi();
    const pc = new PostCreator(api, mockIdentityResolver);
    await createSinglePost(pc, {
      postText: "hi",
      video: { ...videoFixture(), aspectRatio: { width: 1080, height: 100 } },
    });
    assert.deepEqual(api.lastEmbed.aspectRatio.width, 1080);
    assert.deepEqual(api.lastEmbed.aspectRatio.height, 100);
  });

  it("omits alt when empty", async () => {
    const api = makeApi();
    const pc = new PostCreator(api, mockIdentityResolver);
    await createSinglePost(pc, {
      postText: "hi",
      video: { ...videoFixture(), alt: "" },
    });
    assert(!("alt" in api.lastEmbed));
  });

  it("forwards langs to api.createPost", async () => {
    const api = makeApi();
    const pc = new PostCreator(api, mockIdentityResolver);
    await createSinglePost(pc, { postText: "hi" });
    assert(Array.isArray(api.lastLangs));
    assert(api.lastLangs.length > 0);
  });
});

describe("createPost embed selection", () => {
  it("uses video embed when video is provided", async () => {
    const api = makeApi();
    const pc = new PostCreator(api, mockIdentityResolver);
    await createSinglePost(pc, { postText: "hi", video: videoFixture() });
    assert.deepEqual(api.lastEmbed.$type, "app.bsky.embed.video");
  });

  it("video takes precedence over images", async () => {
    const api = makeApi();
    const pc = new PostCreator(
      api,
      mockIdentityResolver,
      makeImageCompressor(),
    );
    await createSinglePost(pc, {
      postText: "hi",
      video: videoFixture(),
      images: [{ dataUrl: "data:image/jpeg;base64,AAAA", alt: "" }],
    });
    assert.deepEqual(api.lastEmbed.$type, "app.bsky.embed.video");
  });

  it("builds a bare record embed from any quoted record's uri and cid", async () => {
    const api = makeApi();
    const pc = new PostCreator(api, mockIdentityResolver);
    await createSinglePost(pc, {
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
    await createSinglePost(pc, {
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
    await createSinglePost(pc, { postText: "hi", images: [] });
    assert.deepEqual(api.lastEmbed, null);

    await createSinglePost(pc, { postText: "hi", images: null });
    assert.deepEqual(api.lastEmbed, null);
  });

  it("uploads each image and builds an embed.images record", async () => {
    const uploaded = [];
    const api = makeApi();
    api.uploadBlob = async (blob) => {
      uploaded.push(blob);
      return {
        ref: { $link: `bafyimg${uploaded.length + 1}` },
        mimeType: "image/jpeg",
        size: 100 + uploaded.length,
      };
    };
    const imageCompressor = makeImageCompressor();
    const pc = new PostCreator(api, mockIdentityResolver, imageCompressor);
    await createSinglePost(pc, {
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
    assert.deepEqual(embed.images[0].image.ref.$link, "bafyimg2");
    assert.deepEqual(embed.images[0].aspectRatio.width, 10);
    assert.deepEqual(embed.images[0].aspectRatio.height, 10);
    assert.deepEqual(embed.images[1].alt, "");
    assert.deepEqual(embed.images[1].image.ref.$link, "bafyimg3");
  });
});

describe("external embed preparation", () => {
  it("produces no embed when external is missing", async () => {
    const api = makeApi();
    const pc = new PostCreator(api, mockIdentityResolver);
    await createSinglePost(pc, { postText: "hi" });
    assert.deepEqual(api.lastEmbed, null);
  });

  it("builds an embed.external record and renames url to uri", async () => {
    const api = makeApi();
    const pc = new PostCreator(api, mockIdentityResolver);
    await createSinglePost(pc, {
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
      await createSinglePost(pc, {
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
      await createSinglePost(pc, {
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
      await createSinglePost(pc, {
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
    Object.defineProperty(api, "sent", {
      get() {
        return this.lastWrites?.[0]?.value ?? null;
      },
    });
    return api;
  }

  it("leaves well-formed text unchanged", async () => {
    const api = makeCapturingApi();
    await createSinglePost(new PostCreator(api, mockIdentityResolver), {
      postText: "hello world",
    });
    assert.deepEqual(api.sent.text, "hello world");

    await createSinglePost(new PostCreator(api, mockIdentityResolver), {
      postText: "line one\n\nline two",
    });
    assert.deepEqual(api.sent.text, "line one\n\nline two");
  });

  it("strips leading whitespace-only lines", async () => {
    const api = makeCapturingApi();
    await createSinglePost(new PostCreator(api, mockIdentityResolver), {
      postText: "\n\n  \nhello",
    });
    assert.deepEqual(api.sent.text, "hello");
  });

  it("preserves leading spaces on the first content line (ASCII art)", async () => {
    const api = makeCapturingApi();
    await createSinglePost(new PostCreator(api, mockIdentityResolver), {
      postText: "   /\\_/\\\n  ( o.o )",
    });
    assert.deepEqual(api.sent.text, "   /\\_/\\\n  ( o.o )");
  });

  it("trims trailing whitespace", async () => {
    const api = makeCapturingApi();
    await createSinglePost(new PostCreator(api, mockIdentityResolver), {
      postText: "hello   \n\n  ",
    });
    assert.deepEqual(api.sent.text, "hello");
  });

  it("collapses runs of 3+ newlines to 2", async () => {
    const api = makeCapturingApi();
    await createSinglePost(new PostCreator(api, mockIdentityResolver), {
      postText: "a\n\n\nb",
    });
    assert.deepEqual(api.sent.text, "a\n\nb");

    await createSinglePost(new PostCreator(api, mockIdentityResolver), {
      postText: "a\n\n\n\n\nb",
    });
    assert.deepEqual(api.sent.text, "a\n\nb");

    await createSinglePost(new PostCreator(api, mockIdentityResolver), {
      postText: "a\n \n \nb",
    });
    assert.deepEqual(api.sent.text, "a\n\nb");
  });

  it("handles empty text", async () => {
    const api = makeCapturingApi();
    await createSinglePost(new PostCreator(api, mockIdentityResolver), {
      postText: "",
    });
    assert.deepEqual(api.sent.text, "");
  });
});

describe("app view hydration", () => {
  it("returns uris and the hydrated posts on success", async () => {
    const api = makeApi();
    const pc = new PostCreator(api, mockIdentityResolver);
    const result = await createSinglePost(pc, { postText: "hi" });
    assert.deepEqual(result.uris, [
      `at://did:plc:user/app.bsky.feed.post/${api.lastWrites[0].rkey}`,
    ]);
    assert.deepEqual(result.posts[0].cid, "cid1");
    assert.deepEqual(api.getPostsCalls, 1);
  });

  it("returns posts: null when the app view never returns the posts", async () => {
    const originalWait = globalThis.setTimeout;
    globalThis.setTimeout = (fn) => originalWait(fn, 0);
    try {
      const api = makeApi();
      api.getPosts = async () => {
        throw new Error("not found yet");
      };
      const pc = new PostCreator(api, mockIdentityResolver);
      const result = await createSinglePost(pc, { postText: "hi" });
      assert.deepEqual(result.uris.length, 1);
      assert.deepEqual(result.posts, null);
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
      api.getPosts = async () => {
        calls++;
        throw new Error("nope");
      };
      const pc = new PostCreator(api, mockIdentityResolver);
      await createSinglePost(pc, { postText: "hi" });
      assert.deepEqual(calls, 5);
    } finally {
      globalThis.setTimeout = originalWait;
    }
  });
});

describe("draft passthrough fields", () => {
  const labels = {
    $type: "com.atproto.label.defs#selfLabels",
    values: [{ val: "porn" }],
  };

  it("forwards labels to api.createPost", async () => {
    const api = makeApi();
    const pc = new PostCreator(
      api,
      mockIdentityResolver,
      makeImageCompressor(),
    );
    await createSinglePost(pc, { postText: "hi", labels });
    assert.deepEqual(api.lastLabels, labels);
  });

  it("omits labels when not provided", async () => {
    const api = makeApi();
    const pc = new PostCreator(
      api,
      mockIdentityResolver,
      makeImageCompressor(),
    );
    await createSinglePost(pc, { postText: "hi" });
    assert.deepEqual(api.lastLabels, null);
  });

  it("writes threadgate and postgate records in the same batch as the post", async () => {
    const api = makeApi();
    const pc = new PostCreator(
      api,
      mockIdentityResolver,
      makeImageCompressor(),
    );
    const threadgateAllow = [
      { $type: "app.bsky.feed.threadgate#followingRule" },
    ];
    const postgateEmbeddingRules = [
      { $type: "app.bsky.feed.postgate#disableRule" },
    ];
    await createSinglePost(pc, {
      postText: "hi",
      threadgateAllow,
      postgateEmbeddingRules,
    });
    const writes = api.lastWrites;
    assert.deepEqual(
      writes.map((write) => write.collection),
      [
        "app.bsky.feed.post",
        "app.bsky.feed.threadgate",
        "app.bsky.feed.postgate",
      ],
    );
    const postUri = `at://did:plc:user/app.bsky.feed.post/${writes[0].rkey}`;
    assert.deepEqual(writes[1].rkey, writes[0].rkey);
    assert.deepEqual(writes[1].value.post, postUri);
    assert.deepEqual(writes[1].value.allow, threadgateAllow);
    assert.deepEqual(writes[2].rkey, writes[0].rkey);
    assert.deepEqual(writes[2].value.post, postUri);
    assert.deepEqual(writes[2].value.embeddingRules, postgateEmbeddingRules);
  });

  it("writes no gate records when the fields are absent or empty", async () => {
    const api = makeApi();
    const pc = new PostCreator(
      api,
      mockIdentityResolver,
      makeImageCompressor(),
    );
    await createSinglePost(pc, { postText: "hi", postgateEmbeddingRules: [] });
    assert.deepEqual(api.lastWrites.length, 1);
    assert.deepEqual(api.lastWrites[0].collection, "app.bsky.feed.post");
  });
});

describe("createThread", () => {
  function makeThreadApi() {
    const api = {
      session: { did: "did:plc:user" },
      applyWritesCalls: [],
      applyWrites: async function (writes) {
        this.applyWritesCalls.push(writes);
        return {};
      },
      uploadBlob: async () => ({
        ref: { $link: "bafyimg" },
        mimeType: "image/jpeg",
        size: 100,
      }),
      getPostsCalls: [],
      getPosts: async function (uris) {
        this.getPostsCalls.push(uris);
        return uris.map((uri) => ({ uri, record: { text: "hi" } }));
      },
    };
    return api;
  }

  it("publishes a single post as one applyWrites create", async () => {
    const api = makeThreadApi();
    const pc = new PostCreator(api, mockIdentityResolver);
    const res = await pc.createThread({ posts: [{ postText: "solo post" }] });
    assert.deepEqual(api.applyWritesCalls.length, 1);
    const writes = api.applyWritesCalls[0];
    assert.deepEqual(writes.length, 1);
    assert.deepEqual(writes[0].$type, "com.atproto.repo.applyWrites#create");
    assert.deepEqual(writes[0].collection, "app.bsky.feed.post");
    assert.deepEqual(writes[0].rkey.length, 13);
    assert.deepEqual(writes[0].value.$type, "app.bsky.feed.post");
    assert.deepEqual(writes[0].value.text, "solo post");
    assert.deepEqual(writes[0].value.reply, undefined);
    assert.deepEqual(res.uris, [
      `at://did:plc:user/app.bsky.feed.post/${writes[0].rkey}`,
    ]);
    assert.deepEqual(res.posts.length, 1);
  });

  it("chains a 3-post thread with sticky root and bumped createdAt", async () => {
    const api = makeThreadApi();
    const pc = new PostCreator(api, mockIdentityResolver);
    const res = await pc.createThread({
      posts: [{ postText: "one" }, { postText: "two" }, { postText: "three" }],
    });
    const writes = api.applyWritesCalls[0];
    assert.deepEqual(writes.length, 3);
    const uris = writes.map(
      (write) => `at://did:plc:user/app.bsky.feed.post/${write.rkey}`,
    );
    assert.deepEqual(res.uris, uris);

    assert.deepEqual(writes[0].value.reply, undefined);
    assert.deepEqual(writes[1].value.reply.root.uri, uris[0]);
    assert.deepEqual(writes[1].value.reply.parent.uri, uris[0]);
    assert.deepEqual(writes[2].value.reply.root.uri, uris[0]);
    assert.deepEqual(writes[2].value.reply.parent.uri, uris[1]);

    // reply refs carry the client-computed CIDs of the referenced records
    assert.deepEqual(
      writes[1].value.reply.parent.cid,
      await computeRecordCid(writes[0].value),
    );
    assert.deepEqual(
      writes[2].value.reply.parent.cid,
      await computeRecordCid(writes[1].value),
    );

    // rkeys strictly increasing, createdAt bumped +1ms per post
    assert(writes[0].rkey < writes[1].rkey);
    assert(writes[1].rkey < writes[2].rkey);
    const times = writes.map((write) => Date.parse(write.value.createdAt));
    assert.deepEqual(times[1] - times[0], 1);
    assert.deepEqual(times[2] - times[1], 1);
  });

  it("inherits the reply root for a thread posted as a reply", async () => {
    const api = makeThreadApi();
    const pc = new PostCreator(api, mockIdentityResolver);
    const replyRoot = {
      uri: "at://did:plc:other/app.bsky.feed.post/root1",
      cid: "rootcid",
    };
    const replyTo = {
      uri: "at://did:plc:other/app.bsky.feed.post/leaf1",
      cid: "leafcid",
    };
    await pc.createThread({
      posts: [{ postText: "one" }, { postText: "two" }],
      replyTo,
      replyRoot,
    });
    const writes = api.applyWritesCalls[0];
    assert.deepEqual(writes[0].value.reply.root, replyRoot);
    assert.deepEqual(writes[0].value.reply.parent, replyTo);
    // sticky root: later posts keep the original thread root, not post 0
    assert.deepEqual(writes[1].value.reply.root, replyRoot);
    assert.deepEqual(
      writes[1].value.reply.parent.uri,
      `at://did:plc:user/app.bsky.feed.post/${writes[0].rkey}`,
    );
  });

  it("writes the threadgate only at the root and postgates on every post", async () => {
    const api = makeThreadApi();
    const pc = new PostCreator(api, mockIdentityResolver);
    const allow = [{ $type: "app.bsky.feed.threadgate#followingRule" }];
    const embeddingRules = [{ $type: "app.bsky.feed.postgate#disableRule" }];
    await pc.createThread({
      posts: [{ postText: "one" }, { postText: "two" }],
      threadgateAllow: allow,
      postgateEmbeddingRules: embeddingRules,
    });
    const writes = api.applyWritesCalls[0];
    assert.deepEqual(
      writes.map((write) => write.collection),
      [
        "app.bsky.feed.post",
        "app.bsky.feed.threadgate",
        "app.bsky.feed.postgate",
        "app.bsky.feed.post",
        "app.bsky.feed.postgate",
      ],
    );
    // gates share their post's rkey and point at its uri
    assert.deepEqual(writes[1].rkey, writes[0].rkey);
    assert.deepEqual(writes[1].value.allow, allow);
    assert.deepEqual(
      writes[1].value.post,
      `at://did:plc:user/app.bsky.feed.post/${writes[0].rkey}`,
    );
    assert.deepEqual(writes[2].rkey, writes[0].rkey);
    assert.deepEqual(writes[2].value.embeddingRules, embeddingRules);
    assert.deepEqual(writes[4].rkey, writes[3].rkey);
    assert.deepEqual(
      writes[4].value.post,
      `at://did:plc:user/app.bsky.feed.post/${writes[3].rkey}`,
    );
  });

  it("returns posts: null when the app view returns only a subset", async () => {
    const originalWait = globalThis.setTimeout;
    globalThis.setTimeout = (fn) => originalWait(fn, 0);
    try {
      const api = makeThreadApi();
      api.getPosts = async function (uris) {
        this.getPostsCalls.push(uris);
        return uris.slice(1).map((uri) => ({ uri, record: {} }));
      };
      const pc = new PostCreator(api, mockIdentityResolver);
      const res = await pc.createThread({
        posts: [{ postText: "one" }, { postText: "two" }],
      });
      assert.deepEqual(res.posts, null);
      assert.deepEqual(api.getPostsCalls.length, 5);
      assert.deepEqual(api.getPostsCalls[0], res.uris);
    } finally {
      globalThis.setTimeout = originalWait;
    }
  });

  it("throws when no posts are given", async () => {
    const api = makeThreadApi();
    const pc = new PostCreator(api, mockIdentityResolver);
    await assert.rejects(() => pc.createThread({ posts: [] }), /at least one/);
  });
});
