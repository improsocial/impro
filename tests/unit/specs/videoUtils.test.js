import { TestSuite } from "../testSuite.js";
import { assert, assertEquals } from "../testHelpers.js";
import {
  validateVideoFile,
  VideoUploader,
  VideoValidationError,
  VIDEO_MAX_BYTES,
} from "/js/videoUtils.js";

const t = new TestSuite("videoUtils");

function fakeFile({ type = "video/mp4", size = 1024 } = {}) {
  return { type, size, name: "clip.mp4" };
}

t.describe("validateVideoFile", (it) => {
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
    assertEquals(err.code, "UNSUPPORTED_TYPE");
  });

  it("rejects files larger than the cap", () => {
    let err = null;
    try {
      validateVideoFile(fakeFile({ size: VIDEO_MAX_BYTES + 1 }));
    } catch (e) {
      err = e;
    }
    assert(err instanceof VideoValidationError);
    assertEquals(err.code, "TOO_LARGE");
  });
});

t.describe("VideoUploader.pollJob", (it) => {
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
    assertEquals(result, blob);
    assertEquals(progressCalls.length, 3);
    assertEquals(progressCalls[0][0], "JOB_STATE_PROCESSING");
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
    assertEquals(err.message, "bad video");
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
  });
});

t.describe("VideoUploader.upload", (it) => {
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
    assertEquals(result, blob);
    assertEquals(calls, ["limits", "upload", "poll"]);
    assertEquals(observedJob.jobId, "job-1");
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
    assertEquals(err.message, "Daily limit reached");
  });
});

await t.run();
