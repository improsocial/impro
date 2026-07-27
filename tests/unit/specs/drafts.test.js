import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { installFakeIndexedDB } from "../testHelpers.js";
import {
  DraftMediaStore,
  buildDraftFromComposerSnapshot,
  getDraftDeviceId,
} from "/js/drafts.js";

describe("getDraftDeviceId", () => {
  it("mints a device id once and returns the same value after", () => {
    const first = getDraftDeviceId();
    assert(first.length > 0);
    assert.deepEqual(getDraftDeviceId(), first);
  });
});

describe("DraftMediaStore.parseVideoMimeType", () => {
  it("parses the mime type out of a video key", () => {
    assert.deepEqual(
      DraftMediaStore.parseVideoMimeType("video:video/quicktime:abc123.mov"),
      "video/quicktime",
    );
  });

  it("parses legacy keys without a mime segment as mp4", () => {
    assert.deepEqual(
      DraftMediaStore.parseVideoMimeType("video:abc123"),
      "video/mp4",
    );
  });

  it("falls back to mp4 for unknown mime segments", () => {
    assert.deepEqual(
      DraftMediaStore.parseVideoMimeType("video:video/x-unknown:abc123.bin"),
      "video/mp4",
    );
  });
});

describe("DraftMediaStore", () => {
  let records;
  let store;
  let originalCreateObjectURL;
  let originalRevokeObjectURL;
  let mintedUrls;
  let revokedUrls;

  beforeEach(() => {
    ({ records } = installFakeIndexedDB());
    store = new DraftMediaStore("test-media");
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    let urlCounter = 0;
    mintedUrls = [];
    revokedUrls = [];
    URL.createObjectURL = () => {
      const url = `blob:fake-${urlCounter++}`;
      mintedUrls.push(url);
      return url;
    };
    URL.revokeObjectURL = (url) => revokedUrls.push(url);
  });

  afterEach(() => {
    delete globalThis.indexedDB;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  describe("load", () => {
    it("records url entries for present images and null for missing paths", async () => {
      records.set("image:a", { blob: new Blob(["bytes"]) });
      await store.load(["image:a", "image:gone"]);
      const media = store.$media.get();
      assert(media["image:a"].url.startsWith("blob:fake-"));
      assert.deepEqual(media["image:gone"], null);
    });

    it("checks video presence without minting URLs", async () => {
      records.set("video:video/mp4:a.mp4", { blob: new Blob(["big"]) });
      await store.load(["video:video/mp4:a.mp4", "video:video/mp4:b.mp4"]);
      assert.deepEqual(store.$media.get(), {
        "video:video/mp4:a.mp4": { url: null },
        "video:video/mp4:b.mp4": null,
      });
      assert.deepEqual(mintedUrls, []);
    });

    it("does not re-read paths that already have entries", async () => {
      records.set("image:a", { blob: new Blob(["bytes"]) });
      await store.load(["image:a"]);
      const firstUrl = store.$media.get()["image:a"].url;
      await store.load(["image:a", "image:a"]);
      assert.deepEqual(store.$media.get()["image:a"].url, firstUrl);
      assert.deepEqual(mintedUrls.length, 1);
      assert.deepEqual(revokedUrls, []);
    });

    it("does not re-check paths already recorded as missing", async () => {
      await store.load(["image:gone"]);
      assert.deepEqual(store.$media.get()["image:gone"], null);
      // Bytes appearing later are not picked up - the null entry stands
      // until a save() records them
      records.set("image:gone", { blob: new Blob(["late"]) });
      await store.load(["image:gone"]);
      assert.deepEqual(store.$media.get()["image:gone"], null);
    });
  });

  it("save writes bytes with a timestamp and records an entry with a URL for images", async () => {
    await store.save("image:a", new Blob(["bytes"]));
    assert(records.get("image:a").blob instanceof Blob);
    assert(typeof records.get("image:a").createdAt === "string");
    assert(store.$media.get()["image:a"].url.startsWith("blob:fake-"));
  });

  it("save records video paths without minting a URL", async () => {
    await store.save("video:video/mp4:a.mp4", new Blob(["x"]));
    assert(records.has("video:video/mp4:a.mp4"));
    assert.deepEqual(store.$media.get()["video:video/mp4:a.mp4"], {
      url: null,
    });
    assert.deepEqual(mintedUrls, []);
  });

  it("re-saving an image replaces the entry and revokes the old URL", async () => {
    await store.save("image:a", new Blob(["one"]));
    const firstUrl = store.$media.get()["image:a"].url;
    await store.save("image:a", new Blob(["two"]));
    assert(store.$media.get()["image:a"].url !== firstUrl);
    assert.deepEqual(revokedUrls, [firstUrl]);
  });

  it("readBlob returns raw bytes without minting a URL, null when missing", async () => {
    const blob = new Blob(["bytes"]);
    await store.save("video:video/mp4:a.mp4", blob);
    assert.deepEqual(await store.readBlob("video:video/mp4:a.mp4"), blob);
    assert.deepEqual(await store.readBlob("image:missing"), null);
    assert.deepEqual(mintedUrls, []);
  });

  it("delete removes bytes, marks the path missing, and revokes its URL", async () => {
    await store.save("image:a", new Blob(["bytes"]));
    const url = store.$media.get()["image:a"].url;
    await store.delete("image:a");
    assert(!records.has("image:a"));
    assert.deepEqual(store.$media.get()["image:a"], null);
    assert.deepEqual(revokedUrls, [url]);
  });

  it("propagates write failures without recording an entry", async () => {
    installFakeIndexedDB({ failWrites: true });
    const failingStore = new DraftMediaStore("test-media");
    await assert.rejects(() => failingStore.save("image:a", new Blob(["x"])));
    assert.deepEqual(failingStore.$media.get(), {});
  });

  it("fetches string sources (data URLs) into blobs", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      blob: async () => new Blob(["fetched"]),
    });
    try {
      await store.save("image:from-url", "blob:some-url");
      assert(records.get("image:from-url").blob instanceof Blob);
    } finally {
      if (originalFetch) {
        globalThis.fetch = originalFetch;
      } else {
        delete globalThis.fetch;
      }
    }
  });
});

describe("buildDraftFromComposerSnapshot", () => {
  function makeDraftSnapshot(overrides = {}) {
    const {
      threadgateAllow = null,
      postgateEmbeddingRules = null,
      ...postOverrides
    } = overrides;
    return {
      posts: [
        {
          postText: "hello world",
          images: [],
          video: null,
          external: null,
          quotedRecord: null,
          labels: null,
          ...postOverrides,
        },
      ],
      threadgateAllow,
      postgateEmbeddingRules,
    };
  }

  it("serializes a text-only snapshot into a single-post draft", () => {
    const { draft, media } =
      buildDraftFromComposerSnapshot(makeDraftSnapshot());
    assert.deepEqual(draft.$type, "app.bsky.draft.defs#draft");
    assert.deepEqual(draft.deviceId, getDraftDeviceId());
    assert.deepEqual(draft.deviceName, "Web");
    assert.deepEqual(draft.posts.length, 1);
    assert.deepEqual(draft.posts[0].text, "hello world");
    assert.deepEqual(draft.posts[0].embedGallery, undefined);
    assert.deepEqual(media, []);
  });

  it("reuses image localRefPath keys and mints keys for new images", () => {
    const fileA = {};
    const fileB = {};
    const { draft, media } = buildDraftFromComposerSnapshot(
      makeDraftSnapshot({
        images: [
          { file: fileA, dataUrl: "data:a", localRefPath: "image:existing" },
          { file: fileB, dataUrl: "data:b", alt: "a bird" },
          { file: {}, dataUrl: "data:c" },
        ],
      }),
    );
    const items = draft.posts[0].embedGallery.items;
    assert.deepEqual(items.length, 3);
    assert.deepEqual(items[0].localRef.path, "image:existing");
    assert.deepEqual(items[0].alt, undefined);
    assert(items[1].localRef.path.startsWith("image:"));
    assert.deepEqual(items[1].alt, "a bird");
    assert(items[2].localRef.path !== items[1].localRef.path);
    assert.deepEqual(media.length, 3);
    assert.deepEqual(media[0], { path: "image:existing", source: fileA });
    assert.deepEqual(media[1].source, fileB);
  });

  it("always mints a fresh video key", () => {
    const file = { type: "video/webm" };
    const first = buildDraftFromComposerSnapshot(
      makeDraftSnapshot({ video: { file, alt: "clip", captions: null } }),
    );
    const second = buildDraftFromComposerSnapshot(
      makeDraftSnapshot({ video: { file, alt: "clip", captions: null } }),
    );
    const firstPath = first.draft.posts[0].embedVideos[0].localRef.path;
    const secondPath = second.draft.posts[0].embedVideos[0].localRef.path;
    assert(firstPath.startsWith("video:video/webm:"));
    assert(firstPath.endsWith(".webm"));
    assert(firstPath !== secondPath);
    assert.deepEqual(first.draft.posts[0].embedVideos[0].alt, "clip");
    assert.deepEqual(first.media, [{ path: firstPath, source: file }]);
  });

  it("mints mp4 video keys for unknown mime types", () => {
    const { draft } = buildDraftFromComposerSnapshot(
      makeDraftSnapshot({ video: { file: { type: "video/x-unknown" } } }),
    );
    const path = draft.posts[0].embedVideos[0].localRef.path;
    assert(path.startsWith("video:video/mp4:"));
    assert(path.endsWith(".mp4"));
  });

  it("carries video captions through verbatim", () => {
    const captions = [
      {
        $type: "app.bsky.draft.defs#draftEmbedCaption",
        lang: "en",
        content: "hello",
      },
    ];
    const { draft } = buildDraftFromComposerSnapshot(
      makeDraftSnapshot({ video: { file: { type: "video/mp4" }, captions } }),
    );
    assert.deepEqual(draft.posts[0].embedVideos[0].captions, captions);
  });

  it("serializes external links and quotes without media entries", () => {
    const { draft, media } = buildDraftFromComposerSnapshot(
      makeDraftSnapshot({
        external: { url: "https://example.com/article", title: "t" },
        quotedRecord: {
          uri: "at://did:plc:a/app.bsky.feed.post/1",
          cid: "c1",
        },
      }),
    );
    assert.deepEqual(draft.posts[0].embedExternals, [
      {
        $type: "app.bsky.draft.defs#draftEmbedExternal",
        uri: "https://example.com/article",
      },
    ]);
    assert.deepEqual(draft.posts[0].embedRecords, [
      {
        $type: "app.bsky.draft.defs#draftEmbedRecord",
        record: { uri: "at://did:plc:a/app.bsky.feed.post/1", cid: "c1" },
      },
    ]);
    assert.deepEqual(media, []);
  });

  it("carries labels, threadgate, and postgate passthrough fields", () => {
    const labels = {
      $type: "com.atproto.label.defs#selfLabels",
      values: [{ val: "porn" }],
    };
    const { draft } = buildDraftFromComposerSnapshot(
      makeDraftSnapshot({
        labels,
        threadgateAllow: [{ $type: "app.bsky.feed.threadgate#followingRule" }],
        postgateEmbeddingRules: [
          { $type: "app.bsky.feed.postgate#disableRule" },
        ],
      }),
    );
    assert.deepEqual(draft.posts[0].labels, labels);
    assert.deepEqual(draft.threadgateAllow.length, 1);
    assert.deepEqual(draft.postgateEmbeddingRules.length, 1);
  });

  it("omits empty postgate rules", () => {
    const { draft } = buildDraftFromComposerSnapshot(
      makeDraftSnapshot({ postgateEmbeddingRules: [] }),
    );
    assert.deepEqual(draft.postgateEmbeddingRules, undefined);
  });

  it("carries unrestored media embeds through verbatim", () => {
    const unrestoredImages = [
      {
        $type: "app.bsky.draft.defs#draftEmbedImage",
        alt: "kept",
        localRef: {
          $type: "app.bsky.draft.defs#draftEmbedLocalRef",
          path: "image:foreign",
        },
      },
    ];
    const unrestoredVideo = {
      $type: "app.bsky.draft.defs#draftEmbedVideo",
      localRef: {
        $type: "app.bsky.draft.defs#draftEmbedLocalRef",
        path: "video:video/mp4:foreign.mp4",
      },
    };
    const { draft, media } = buildDraftFromComposerSnapshot(
      makeDraftSnapshot({ unrestoredImages, unrestoredVideo }),
    );
    assert.deepEqual(draft.posts[0].embedGallery.items, unrestoredImages);
    assert.deepEqual(draft.posts[0].embedVideos, [unrestoredVideo]);
    assert.deepEqual(media, []);
  });

  it("composer media wins over unrestored media", () => {
    const videoFile = { type: "video/mp4" };
    const { draft, media } = buildDraftFromComposerSnapshot(
      makeDraftSnapshot({
        images: [{ file: {}, dataUrl: "data:a" }],
        video: { file: videoFile, alt: "", captions: null },
        unrestoredImages: [
          {
            $type: "app.bsky.draft.defs#draftEmbedImage",
            localRef: {
              $type: "app.bsky.draft.defs#draftEmbedLocalRef",
              path: "image:foreign",
            },
          },
        ],
        unrestoredVideo: {
          $type: "app.bsky.draft.defs#draftEmbedVideo",
          localRef: {
            $type: "app.bsky.draft.defs#draftEmbedLocalRef",
            path: "video:video/mp4:foreign.mp4",
          },
        },
      }),
    );
    const items = draft.posts[0].embedGallery.items;
    assert.deepEqual(items.length, 1);
    assert(items[0].localRef.path !== "image:foreign");
    assert.deepEqual(draft.posts[0].embedVideos.length, 1);
    assert(
      draft.posts[0].embedVideos[0].localRef.path !==
        "video:video/mp4:foreign.mp4",
    );
    assert.deepEqual(media.length, 2);
  });
});

describe("DraftMediaStore.parseVideoExtension", () => {
  it("derives the extension from the key's mime type", () => {
    assert.deepEqual(
      DraftMediaStore.parseVideoExtension("video:video/quicktime:abc.mov"),
      "mov",
    );
  });

  it("defaults to mp4 for legacy keys without a mime segment", () => {
    assert.deepEqual(
      DraftMediaStore.parseVideoExtension("video:abc123"),
      "mp4",
    );
  });
});
