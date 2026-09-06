import { describe, it, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { HandleNotFoundError } from "/js/atproto.js";
import {
  getGifFromPost,
  parseAltFromGifDescription,
  parseRecordLink,
  resolveRecordFromLink,
  getFileSlug,
  gifProxyUrl,
  buildGifExternal,
  createGifDescription,
  parseGifFromUrl,
  buildGifDraftUri,
  restoreGifFromDraftUri,
  isValidGif,
  createMinimalGifObject,
  fetchAndCompressLinkCardImage,
} from "/js/embedHelpers.js";
import { IN_APP_LINK_DOMAINS } from "/js/config.js";
import { makeTestDataLayer, stubRecordLinkResolution } from "../testHelpers.js";
import { createPost, createGif } from "../../shared/factories.js";

describe("fetchAndCompressLinkCardImage", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      blob: async () => new Blob(["image-bytes"], { type: "image/png" }),
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("compresses the fetched image with a 1MB size limit", async () => {
    const compressed = {
      blob: new Blob(["x"], { type: "image/jpeg" }),
      width: 10,
      height: 10,
    };
    const imageCompressor = {
      compressImage: mock.fn(async () => compressed),
    };

    const result = await fetchAndCompressLinkCardImage(
      "https://example.com/preview.png",
      { imageCompressor },
    );

    assert.deepEqual(imageCompressor.compressImage.mock.callCount(), 1);
    const [dataUrl, options] =
      imageCompressor.compressImage.mock.calls[0].arguments;
    assert(dataUrl.startsWith("data:image/png"));
    assert.deepEqual(options, { maxSize: 1000000 });
    assert.deepEqual(result, compressed);
  });
});

describe("parseRecordLink", () => {
  it("parses a post link", () => {
    assert.deepEqual(
      parseRecordLink("https://bsky.app/profile/alice.test/post/3abc"),
      {
        collection: "app.bsky.feed.post",
        didOrHandle: "alice.test",
        rkey: "3abc",
      },
    );
  });

  it("parses a feed link", () => {
    assert.deepEqual(
      parseRecordLink("https://bsky.app/profile/alice.test/feed/cool-feed"),
      {
        collection: "app.bsky.feed.generator",
        didOrHandle: "alice.test",
        rkey: "cool-feed",
      },
    );
  });

  it("parses a list link", () => {
    assert.deepEqual(
      parseRecordLink("https://bsky.app/profile/did:plc:abc/lists/3list"),
      {
        collection: "app.bsky.graph.list",
        didOrHandle: "did:plc:abc",
        rkey: "3list",
      },
    );
  });

  it("parses both starter pack link forms", () => {
    assert.deepEqual(
      parseRecordLink("https://bsky.app/profile/alice.test/starter-pack/3pack"),
      {
        collection: "app.bsky.graph.starterpack",
        didOrHandle: "alice.test",
        rkey: "3pack",
      },
    );
    assert.deepEqual(
      parseRecordLink("https://bsky.app/starter-pack/alice.test/3pack"),
      {
        collection: "app.bsky.graph.starterpack",
        didOrHandle: "alice.test",
        rkey: "3pack",
      },
    );
  });

  it("returns null for hosts outside the in-app link domains", () => {
    assert.deepEqual(
      parseRecordLink("https://example.com/profile/alice.test/post/3abc"),
      null,
    );
  });

  it("parses a link to the current origin even when it's not in the static domain list", () => {
    // window.location.hostname is "localhost" in tests, which happens to
    // already be in IN_APP_LINK_DOMAINS -- remove it so this actually
    // exercises the same-origin fallback rather than the static list.
    const index = IN_APP_LINK_DOMAINS.indexOf("localhost");
    IN_APP_LINK_DOMAINS.splice(index, 1);
    try {
      assert.deepEqual(
        parseRecordLink("http://localhost/profile/alice.test/post/3abc"),
        {
          collection: "app.bsky.feed.post",
          didOrHandle: "alice.test",
          rkey: "3abc",
        },
      );
    } finally {
      IN_APP_LINK_DOMAINS.splice(index, 0, "localhost");
    }
  });

  it("returns null for unrelated in-app paths", () => {
    assert.deepEqual(
      parseRecordLink("https://bsky.app/profile/alice.test"),
      null,
    );
    assert.deepEqual(parseRecordLink("https://bsky.app/settings"), null);
  });

  it("returns null for invalid urls", () => {
    assert.deepEqual(parseRecordLink("not a url"), null);
    assert.deepEqual(parseRecordLink(""), null);
  });
});

describe("resolveRecordFromLink", () => {
  function makeDeps({ resolveHandleCalls = [] } = {}) {
    const dataLayer = makeTestDataLayer();
    stubRecordLinkResolution(dataLayer, {
      ensurePost: async (uri) => ({
        uri,
        cid: "postcid",
        author: { did: "did:plc:resolved1", handle: "alice.test" },
        record: { text: "Original post", createdAt: "2025-01-01T00:00:00Z" },
        indexedAt: "2025-01-01T00:00:00.000Z",
        labels: [],
      }),
    });
    return {
      identityResolver: {
        resolveHandle: async (handle) => {
          resolveHandleCalls.push(handle);
          return "did:plc:resolved1";
        },
      },
      dataLayer,
    };
  }

  it("resolves a post link to a viewRecord embed", async () => {
    const record = await resolveRecordFromLink(
      "https://bsky.app/profile/alice.test/post/3abc",
      makeDeps(),
    );
    assert.deepEqual(record.$type, "app.bsky.embed.record#viewRecord");
    assert.deepEqual(
      record.uri,
      "at://did:plc:resolved1/app.bsky.feed.post/3abc",
    );
    assert.deepEqual(record.cid, "postcid");
  });

  it("does not resolve the handle for DID-form urls", async () => {
    const resolveHandleCalls = [];
    const record = await resolveRecordFromLink(
      "https://bsky.app/profile/did:plc:direct1/post/3abc",
      makeDeps({ resolveHandleCalls }),
    );
    assert.deepEqual(resolveHandleCalls, []);
    assert.deepEqual(
      record.uri,
      "at://did:plc:direct1/app.bsky.feed.post/3abc",
    );
  });

  it("tags a feed generator view", async () => {
    const record = await resolveRecordFromLink(
      "https://bsky.app/profile/alice.test/feed/cool-feed",
      makeDeps(),
    );
    assert.deepEqual(record.$type, "app.bsky.feed.defs#generatorView");
    assert.deepEqual(
      record.uri,
      "at://did:plc:resolved1/app.bsky.feed.generator/cool-feed",
    );
  });

  it("tags a list view", async () => {
    const record = await resolveRecordFromLink(
      "https://bsky.app/profile/alice.test/lists/3list",
      makeDeps(),
    );
    assert.deepEqual(record.$type, "app.bsky.graph.defs#listView");
  });

  it("tags a starter pack view", async () => {
    const record = await resolveRecordFromLink(
      "https://bsky.app/starter-pack/alice.test/3pack",
      makeDeps(),
    );
    assert.deepEqual(record.$type, "app.bsky.graph.defs#starterPackViewBasic");
  });

  it("throws an informative error for urls that are not record links", async () => {
    let thrown = null;
    try {
      await resolveRecordFromLink(
        "https://example.com/profile/alice.test/post/3abc",
        makeDeps(),
      );
    } catch (error) {
      thrown = error;
    }
    assert.deepEqual(
      thrown?.message,
      "Not a record link: https://example.com/profile/alice.test/post/3abc",
    );
  });

  it("throws HandleNotFoundError when the link's handle does not resolve", async () => {
    const deps = makeDeps();
    deps.identityResolver.resolveHandle = async () => null;
    await assert.rejects(
      () =>
        resolveRecordFromLink(
          "https://bsky.app/profile/gone.test/post/3abc",
          deps,
        ),
      (error) => error instanceof HandleNotFoundError,
    );
  });

  it("propagates resolution failures", async () => {
    const deps = makeDeps();
    mock.method(deps.dataLayer.declarative, "ensurePost", async () => {
      throw new Error("not found");
    });
    let thrown = null;
    try {
      await resolveRecordFromLink(
        "https://bsky.app/profile/alice.test/post/3abc",
        deps,
      );
    } catch (error) {
      thrown = error;
    }
    assert.deepEqual(thrown?.message, "not found");
  });
});

describe("parseAltFromGifDescription", () => {
  it("strips the user-authored prefix and marks the alt as preferred", () => {
    assert.deepEqual(parseAltFromGifDescription("Alt: a cat in a chair"), {
      isPreferred: true,
      alt: "a cat in a chair",
    });
  });

  it("strips the vendor prefix without marking the alt as preferred", () => {
    assert.deepEqual(parseAltFromGifDescription("ALT: dancing cat"), {
      isPreferred: false,
      alt: "dancing cat",
    });
  });

  it("returns an unprefixed description unchanged", () => {
    assert.deepEqual(parseAltFromGifDescription("dancing cat"), {
      isPreferred: false,
      alt: "dancing cat",
    });
  });

  it("only strips the prefix at the start of the description", () => {
    assert.deepEqual(parseAltFromGifDescription("a cat, ALT: dancing"), {
      isPreferred: false,
      alt: "a cat, ALT: dancing",
    });
  });

  it("strips only the first prefix occurrence", () => {
    assert.deepEqual(parseAltFromGifDescription("Alt: Alt: dancing cat"), {
      isPreferred: true,
      alt: "Alt: dancing cat",
    });
  });

  it("returns an empty alt for a missing description", () => {
    assert.deepEqual(parseAltFromGifDescription(undefined), {
      isPreferred: false,
      alt: "",
    });
    assert.deepEqual(parseAltFromGifDescription(""), {
      isPreferred: false,
      alt: "",
    });
  });
});

describe("getGifFromPost", () => {
  const gifUri = "https://media.tenor.com/abc123/dance.gif?hh=200&ww=300";
  const thumb = "https://cdn.bsky.app/img/feed_thumbnail/plain/gif@jpeg";

  function makePostWithExternal(external) {
    return createPost({
      uri: "at://did:plc:testuser123/app.bsky.feed.post/gif1",
      text: "look at this",
      authorHandle: "testuser.bsky.social",
      embed: {
        $type: "app.bsky.embed.external#view",
        external,
      },
    });
  }

  it("extracts thumb and alt from a GIF external embed", () => {
    const post = makePostWithExternal({
      uri: gifUri,
      title: "dance.gif",
      description: "Alt: a dancing cat",
      thumb,
    });
    assert.deepEqual(getGifFromPost(post), {
      thumb,
      alt: "a dancing cat",
    });
  });

  it("extracts a GIF from a recordWithMedia embed", () => {
    const post = createPost({
      uri: "at://did:plc:testuser123/app.bsky.feed.post/gif2",
      text: "quote with gif",
      authorHandle: "testuser.bsky.social",
      embed: {
        $type: "app.bsky.embed.recordWithMedia#view",
        record: { record: {} },
        media: {
          $type: "app.bsky.embed.external#view",
          external: {
            uri: gifUri,
            title: "dance.gif",
            description: "ALT: dancing cat",
            thumb,
          },
        },
      },
    });
    assert.deepEqual(getGifFromPost(post), {
      thumb,
      alt: "dancing cat",
    });
  });

  it("returns null for a non-GIF external embed", () => {
    const post = makePostWithExternal({
      uri: "https://example.com/article",
      title: "An article",
      description: "Some article",
      thumb,
    });
    assert.equal(getGifFromPost(post), null);
  });

  it("returns null when the GIF embed has no thumbnail", () => {
    const post = makePostWithExternal({
      uri: gifUri,
      title: "dance.gif",
      description: "ALT: dancing cat",
    });
    assert.equal(getGifFromPost(post), null);
  });

  it("returns null for a post without an embed", () => {
    const post = createPost({
      uri: "at://did:plc:testuser123/app.bsky.feed.post/plain",
      text: "no embed here",
      authorHandle: "testuser.bsky.social",
    });
    assert.equal(getGifFromPost(post), null);
  });
});

describe("createMinimalGifObject", () => {
  it("keeps only the fields the app reads", () => {
    const trimmed = createMinimalGifObject(createGif({ id: "dance" }));
    assert.deepEqual(trimmed, {
      id: "dance",
      title: "dancing cat",
      content_description: "a cat dancing",
      media_formats: {
        gif: {
          url: "https://static.klipy.com/ii/abc/def/dance.gif",
          dims: [498, 280],
        },
        tinygif: {
          url: "https://static.klipy.com/ii/abc/def/dance-tiny.gif",
          dims: [249, 140],
        },
        preview: {
          url: "https://static.klipy.com/ii/abc/def/dance-preview.jpg",
        },
        mp4: { url: "https://static.klipy.com/ii/abc/def/dance-mp4.mp4" },
        webm: { url: "https://static.klipy.com/ii/abc/def/dance-webm.webm" },
      },
    });
    assert(isValidGif(trimmed));
  });

  it("omits formats the gif doesn't have", () => {
    const trimmed = createMinimalGifObject(
      createGif({ id: "g", mp4Slug: null, webmSlug: null }),
    );
    assert.deepEqual(Object.keys(trimmed.media_formats), [
      "gif",
      "tinygif",
      "preview",
    ]);
  });

  it("produces an object buildGifExternal accepts", () => {
    const gif = createGif({ id: "dance" });
    assert.deepEqual(
      buildGifExternal({ gif: createMinimalGifObject(gif), alt: "" }),
      buildGifExternal({ gif, alt: "" }),
    );
  });
});

describe("getFileSlug", () => {
  it("returns the filename without its extension", () => {
    assert.deepEqual(
      getFileSlug("https://static.klipy.com/ii/a/b/happy-dance.mp4"),
      "happy-dance",
    );
  });

  it("returns null for extensionless and leading-dot filenames", () => {
    assert.deepEqual(getFileSlug("https://example.com/path/noext"), null);
    assert.deepEqual(getFileSlug("https://example.com/path/.hidden"), null);
  });

  it("returns null for missing input", () => {
    assert.deepEqual(getFileSlug(null), null);
    assert.deepEqual(getFileSlug(""), null);
  });
});

describe("gifProxyUrl", () => {
  it("rewrites tenor and klipy hosts to the bsky proxies", () => {
    assert.deepEqual(
      gifProxyUrl("https://media.tenor.com/abc/dance.gif"),
      "https://t.gifs.bsky.app/abc/dance.gif",
    );
    assert.deepEqual(
      gifProxyUrl("https://static.klipy.com/ii/a/b/dance.gif"),
      "https://k.gifs.bsky.app/ii/a/b/dance.gif",
    );
  });

  it("leaves other hosts untouched", () => {
    assert.deepEqual(
      gifProxyUrl("https://example.com/dance.gif"),
      "https://example.com/dance.gif",
    );
  });

  it("returns null for missing or invalid urls", () => {
    assert.deepEqual(gifProxyUrl(null), null);
    assert.deepEqual(gifProxyUrl("not a url"), null);
  });
});

describe("createGifDescription", () => {
  it("round-trips a user alt through parseAltFromGifDescription", () => {
    const description = createGifDescription("vendor text", "a cat spinning");
    assert.deepEqual(description, "Alt: a cat spinning");
    assert.deepEqual(parseAltFromGifDescription(description), {
      isPreferred: true,
      alt: "a cat spinning",
    });
  });

  it("round-trips the vendor fallback through parseAltFromGifDescription", () => {
    const description = createGifDescription("vendor text", "   ");
    assert.deepEqual(description, "ALT: vendor text");
    assert.deepEqual(parseAltFromGifDescription(description), {
      isPreferred: false,
      alt: "vendor text",
    });
  });
});

describe("buildGifExternal", () => {
  it("builds the wire uri with hh (height) before ww (width) plus klipy slugs", () => {
    const gif = createGif({ id: "dance", width: 498, height: 280 });
    const external = buildGifExternal({ gif, alt: "" });
    assert.deepEqual(
      external.url,
      "https://static.klipy.com/ii/abc/def/dance.gif?hh=280&ww=498&mp4=dance-mp4&webm=dance-webm",
    );
    assert.deepEqual(external.title, "a cat dancing");
    assert.deepEqual(external.description, "ALT: a cat dancing");
    assert.deepEqual(
      external.image,
      "https://k.gifs.bsky.app/ii/abc/def/dance-preview.jpg",
    );
  });

  it("uses the user alt in the description when set", () => {
    const gif = createGif();
    const external = buildGifExternal({ gif, alt: "my alt" });
    assert.deepEqual(external.description, "Alt: my alt");
  });

  it("omits missing mp4/webm slugs", () => {
    const gif = createGif({ id: "g", mp4Slug: null, webmSlug: null });
    const external = buildGifExternal({ gif, alt: "" });
    assert.deepEqual(
      external.url,
      "https://static.klipy.com/ii/abc/def/g.gif?hh=280&ww=498",
    );
  });

  it("does not add slugs for non-klipy hosts", () => {
    const gif = createGif({
      id: "t",
      url: "https://media.tenor.com/abc/t.gif",
    });
    const external = buildGifExternal({ gif, alt: "" });
    assert.deepEqual(
      external.url,
      "https://media.tenor.com/abc/t.gif?hh=280&ww=498",
    );
  });

  it("falls back to tinygif when the gif format is missing", () => {
    const gif = createGif({ id: "f" });
    delete gif.media_formats.gif;
    const external = buildGifExternal({ gif, alt: "" });
    assert.deepEqual(
      external.url,
      "https://static.klipy.com/ii/abc/def/f-tiny.gif?hh=140&ww=249&mp4=f-mp4&webm=f-webm",
    );
  });

  it("returns null for zero or missing dims", () => {
    const gif = createGif();
    gif.media_formats.gif.dims = [0, 280];
    assert.deepEqual(buildGifExternal({ gif, alt: "" }), null);
    gif.media_formats.gif.dims = null;
    assert.deepEqual(buildGifExternal({ gif, alt: "" }), null);
  });

  it("still builds the uri when the format url is unparseable", () => {
    const gif = createGif();
    gif.media_formats.gif.url = "not a url";
    const external = buildGifExternal({ gif, alt: "" });
    assert.deepEqual(external.url, "not a url?hh=280&ww=498");
  });
});

describe("parseGifFromUrl", () => {
  it("parses gif urls on allowed hosts", () => {
    assert.deepEqual(
      parseGifFromUrl(
        "https://static.klipy.com/ii/a/b/d.gif?hh=280&ww=498&alt=a+cat",
      ),
      {
        url: "https://static.klipy.com/ii/a/b/d.gif?hh=280&ww=498&alt=a+cat",
        width: 498,
        height: 280,
        alt: "a cat",
      },
    );
  });

  it("rejects other hosts and missing dims", () => {
    assert.deepEqual(
      parseGifFromUrl("https://example.com/d.gif?hh=280&ww=498"),
      null,
    );
    assert.deepEqual(
      parseGifFromUrl("https://static.klipy.com/ii/a/b/d.gif?ww=498"),
      null,
    );
    assert.deepEqual(parseGifFromUrl("not a url"), null);
  });
});

describe("buildGifDraftUri / restoreGifFromDraftUri", () => {
  it("serializes ww/hh/alt and restores a stub gif with clean urls", () => {
    const gif = createGif({ id: "dance", width: 498, height: 280 });
    const uri = buildGifDraftUri({ gif, alt: "a cat" });
    assert.deepEqual(
      uri,
      "https://static.klipy.com/ii/abc/def/dance.gif?ww=498&hh=280&alt=a+cat",
    );
    const restored = restoreGifFromDraftUri(uri);
    assert.deepEqual(restored.alt, "a cat");
    assert.deepEqual(
      restored.gif.media_formats.gif.url,
      "https://static.klipy.com/ii/abc/def/dance.gif",
    );
    assert.deepEqual(restored.gif.media_formats.gif.dims, [498, 280]);
    assert.deepEqual(restored.gif.content_description, "a cat");
  });

  it("omits the alt param when empty", () => {
    const gif = createGif({ id: "dance" });
    assert.deepEqual(
      buildGifDraftUri({ gif, alt: "  " }),
      "https://static.klipy.com/ii/abc/def/dance.gif?ww=498&hh=280",
    );
  });

  it("does not stack query strings across save/restore cycles", () => {
    const gif = createGif({ id: "dance", width: 498, height: 280 });
    const firstUri = buildGifDraftUri({ gif, alt: "a cat" });
    const restored = restoreGifFromDraftUri(firstUri);
    const secondUri = buildGifDraftUri(restored);
    assert.deepEqual(secondUri, firstUri);
    const external = buildGifExternal(restored);
    assert.deepEqual(
      external.url,
      "https://static.klipy.com/ii/abc/def/dance.gif?hh=280&ww=498",
    );
  });

  it("returns null for non-gif draft uris", () => {
    assert.deepEqual(restoreGifFromDraftUri("https://example.com/page"), null);
  });
});
