import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import {
  fetchPostVideoFile,
  saveFileToDevice,
  validateVideoFile,
  VideoUploader,
  VideoValidationError,
  VIDEO_MAX_BYTES,
} from "/js/videoUtils.js";
import { createPost } from "../../shared/factories.js";

const videoView = {
  $type: "app.bsky.embed.video#view",
  cid: "bafkreivideo",
  playlist: "https://video.bsky.app/watch/did/cid/playlist.m3u8",
};

function createVideoPost(embed = videoView) {
  return createPost({
    uri: "at://did:plc:alice/app.bsky.feed.post/3kvideopost",
    text: "",
    authorHandle: "alice.test",
    embed,
  });
}

describe("fetchPostVideoFile", () => {
  const identityResolver = {
    resolveEndpoint: async (did) => ({ did, pds: "https://pds.example.com" }),
  };
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function stubFetch(response) {
    globalThis.fetch = mock.fn(async () => response);
    return globalThis.fetch;
  }

  function videoResponse(type) {
    return new Response("video-bytes", { headers: { "content-type": type } });
  }

  it("fetches the original blob from the author's PDS", async () => {
    const fetchStub = stubFetch(videoResponse("video/mp4"));
    await fetchPostVideoFile(createVideoPost(), identityResolver, {
      signal: null,
    });
    const [url] = fetchStub.mock.calls[0].arguments;
    assert.deepEqual(
      url.href,
      "https://pds.example.com/xrpc/com.atproto.sync.getBlob?did=did%3Aplc%3Aalice&cid=bafkreivideo",
    );
  });

  it("names the file after the author handle and post rkey", async () => {
    stubFetch(videoResponse("video/mp4"));
    const file = await fetchPostVideoFile(createVideoPost(), identityResolver, {
      signal: null,
    });
    assert.deepEqual(file.name, "alice.test-3kvideopost.mp4");
    assert.deepEqual(file.type, "video/mp4");
  });

  it("derives the extension from the blob's mime type", async () => {
    stubFetch(videoResponse("video/quicktime"));
    const file = await fetchPostVideoFile(createVideoPost(), identityResolver, {
      signal: null,
    });
    assert.deepEqual(file.name, "alice.test-3kvideopost.mov");
  });

  it("reads the video from a record-with-media embed", async () => {
    const fetchStub = stubFetch(videoResponse("video/mp4"));
    await fetchPostVideoFile(
      createVideoPost({
        $type: "app.bsky.embed.recordWithMedia#view",
        media: { ...videoView, cid: "bafkreimedia" },
        record: { record: {} },
      }),
      identityResolver,
      { signal: null },
    );
    const [url] = fetchStub.mock.calls[0].arguments;
    assert.deepEqual(url.searchParams.get("cid"), "bafkreimedia");
  });

  it("passes the abort signal to fetch", async () => {
    const fetchStub = stubFetch(videoResponse("video/mp4"));
    const controller = new AbortController();
    await fetchPostVideoFile(createVideoPost(), identityResolver, {
      signal: controller.signal,
    });
    assert.deepEqual(
      fetchStub.mock.calls[0].arguments[1].signal,
      controller.signal,
    );
  });

  it("throws when the PDS responds with an error", async () => {
    stubFetch(new Response("", { status: 400 }));
    await assert.rejects(
      fetchPostVideoFile(createVideoPost(), identityResolver, { signal: null }),
      /HTTP 400/,
    );
  });

  it("throws when the author's PDS can't be resolved", async () => {
    stubFetch(videoResponse("video/mp4"));
    await assert.rejects(
      fetchPostVideoFile(
        createVideoPost(),
        { resolveEndpoint: async () => null },
        { signal: null },
      ),
      /Could not resolve PDS/,
    );
  });
});

describe("saveFileToDevice", () => {
  let originalCreateObjectURL;
  let originalRevokeObjectURL;
  let revokedUrls;

  beforeEach(() => {
    mock.timers.enable({ apis: ["setTimeout"] });
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    revokedUrls = [];
    URL.createObjectURL = () => "blob:video";
    URL.revokeObjectURL = (url) => revokedUrls.push(url);
  });

  afterEach(() => {
    mock.timers.reset();
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it("clicks a download link for the file, then revokes its URL", (t) => {
    const clickedLinks = [];
    t.mock.method(window.HTMLAnchorElement.prototype, "click", function () {
      clickedLinks.push({ href: this.href, download: this.download });
    });
    saveFileToDevice(new File(["video"], "alice.test-3kvideopost.mp4"));
    assert.deepEqual(clickedLinks, [
      { href: "blob:video", download: "alice.test-3kvideopost.mp4" },
    ]);
    assert.deepEqual(revokedUrls, []);
    mock.timers.tick(40_000);
    assert.deepEqual(revokedUrls, ["blob:video"]);
  });
});

function fakeFile({ type = "video/mp4", size = 1024 } = {}) {
  return { type, size, name: "clip.mp4" };
}

describe("validateVideoFile", () => {
  it("accepts a supported mp4 under the size limit", () => {
    validateVideoFile(fakeFile());
  });

  it("rejects unsupported mime types", () => {
    let err = null;
    try {
      validateVideoFile(fakeFile({ type: "application/zip" }));
    } catch (e) {
      err = e;
    }
    assert(err instanceof VideoValidationError);
    assert.deepEqual(err.code, "UNSUPPORTED_TYPE");
  });

  it("rejects files larger than the cap", () => {
    let err = null;
    try {
      validateVideoFile(fakeFile({ size: VIDEO_MAX_BYTES + 1 }));
    } catch (e) {
      err = e;
    }
    assert(err instanceof VideoValidationError);
    assert.deepEqual(err.code, "TOO_LARGE");
  });
});

describe("VideoUploader.pollJob", () => {
  it("resolves with blob when job completes", async () => {
    const blob = { ref: { $link: "bafy" }, mimeType: "video/mp4", size: 1 };
    const states = [
      { state: "JOB_STATE_PROCESSING", progress: 0.25 },
      { state: "JOB_STATE_PROCESSING", progress: 0.75 },
      { state: "JOB_STATE_COMPLETED", progress: 1, blob },
    ];
    const progressCalls = [];
    const api = {
      getVideoJobStatus: async () => states.shift(),
    };
    const uploader = new VideoUploader(api);
    const result = await uploader.pollJob("job-1", {
      intervalMs: 0,
      onProgress: (state, progress) => progressCalls.push([state, progress]),
    });
    assert.deepEqual(result, blob);
    assert.deepEqual(progressCalls.length, 3);
    assert.deepEqual(progressCalls[0][0], "JOB_STATE_PROCESSING");
  });

  it("rejects when job fails", async () => {
    const api = {
      getVideoJobStatus: async () => ({
        state: "JOB_STATE_FAILED",
        error: "bad video",
      }),
    };
    const uploader = new VideoUploader(api);
    let err = null;
    try {
      await uploader.pollJob("job-1", { intervalMs: 0 });
    } catch (e) {
      err = e;
    }
    assert(err);
    assert.deepEqual(err.message, "bad video");
  });

  it("respects abort signal", async () => {
    const controller = new AbortController();
    controller.abort();
    const api = {
      getVideoJobStatus: async () => ({ state: "JOB_STATE_PROCESSING" }),
    };
    const uploader = new VideoUploader(api);
    let err = null;
    try {
      await uploader.pollJob("job-1", {
        intervalMs: 0,
        signal: controller.signal,
      });
    } catch (e) {
      err = e;
    }
    assert(err);
    assert.deepEqual(err.name, "AbortError");
  });
});

describe("VideoUploader.upload", () => {
  it("checks limits, uploads, and polls to completion", async () => {
    const blob = { ref: { $link: "bafy" }, mimeType: "video/mp4", size: 1 };
    const calls = [];
    const api = {
      getVideoUploadLimits: async () => {
        calls.push("limits");
        return { canUpload: true };
      },
      uploadVideoBlob: async () => {
        calls.push("upload");
        return { jobId: "job-1" };
      },
      getVideoJobStatus: async () => {
        calls.push("poll");
        return { state: "JOB_STATE_COMPLETED", blob };
      },
    };
    const uploader = new VideoUploader(api);
    let observedJob = null;
    const result = await uploader.upload(
      {},
      {
        intervalMs: 0,
        onJobStart: (job) => {
          observedJob = job;
        },
      },
    );
    assert.deepEqual(result, blob);
    assert.deepEqual(calls, ["limits", "upload", "poll"]);
    assert.deepEqual(observedJob.jobId, "job-1");
  });

  it("passes the abort signal to every request it makes", async () => {
    const blob = { ref: { $link: "bafy" }, mimeType: "video/mp4", size: 1 };
    const controller = new AbortController();
    const seenSignals = [];
    const api = {
      getVideoUploadLimits: async ({ signal }) => {
        seenSignals.push(signal);
        return { canUpload: true };
      },
      uploadVideoBlob: async (_file, { signal }) => {
        seenSignals.push(signal);
        return { jobId: "job-1" };
      },
      getVideoJobStatus: async (_jobId, { signal }) => {
        seenSignals.push(signal);
        return { state: "JOB_STATE_COMPLETED", blob };
      },
    };
    const uploader = new VideoUploader(api);
    await uploader.upload({}, { intervalMs: 0, signal: controller.signal });
    assert.deepEqual(seenSignals.length, 3);
    for (const signal of seenSignals) {
      assert.deepEqual(signal, controller.signal);
    }
  });

  it("throws when limits service rejects upload", async () => {
    const api = {
      getVideoUploadLimits: async () => ({
        canUpload: false,
        message: "Daily limit reached",
      }),
      uploadVideoBlob: async () => {
        throw new Error("should not be called");
      },
      getVideoJobStatus: async () => {
        throw new Error("should not be called");
      },
    };
    const uploader = new VideoUploader(api);
    let err = null;
    try {
      await uploader.upload({});
    } catch (e) {
      err = e;
    }
    assert(err);
    assert.deepEqual(err.message, "Daily limit reached");
  });
});
