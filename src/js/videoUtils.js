import { wait } from "/js/utils.js";
import { getRKey, getVideoFromPost } from "/js/dataHelpers.js";

export const VIDEO_MAX_BYTES = 100_000_000;
export const VIDEO_MAX_DURATION_S = 180;
export const VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/mpeg",
  "video/webm",
  "video/quicktime",
  "image/gif",
];

export class VideoValidationError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

export function isGifFile(file) {
  return file.type === "image/gif";
}

export function validateVideoFile(file) {
  if (!VIDEO_MIME_TYPES.includes(file.type)) {
    throw new VideoValidationError(
      "Unsupported video format. Please use mp4, webm, mov, mpeg, or gif.",
      "UNSUPPORTED_TYPE",
    );
  }
  if (file.size > VIDEO_MAX_BYTES) {
    throw new VideoValidationError(
      `Video is too large. Maximum size is ${Math.round(VIDEO_MAX_BYTES / 1_000_000)} MB.`,
      "TOO_LARGE",
    );
  }
}

function readGifMetadata(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      URL.revokeObjectURL(url);
      const aspectRatio = width > 0 && height > 0 ? { width, height } : null;
      resolve({ duration: null, width, height, aspectRatio });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(
        new VideoValidationError("Could not read GIF file.", "UNREADABLE"),
      );
    };
    image.src = url;
  });
}

export function readVideoMetadata(file) {
  if (isGifFile(file)) {
    return readGifMetadata(file);
  }
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    const url = URL.createObjectURL(file);
    video.src = url;
    video.onloadedmetadata = () => {
      const duration = video.duration;
      const width = video.videoWidth;
      const height = video.videoHeight;
      URL.revokeObjectURL(url);
      if (duration > VIDEO_MAX_DURATION_S) {
        reject(
          new VideoValidationError(
            `Video is too long. Maximum duration is ${VIDEO_MAX_DURATION_S} seconds.`,
            "TOO_LONG",
          ),
        );
        return;
      }
      // Leave aspectRatio unset when dimensions are missing - matches
      // social-app, which prefers an absent field to a 0 value that would
      // fail lexicon validation.
      const aspectRatio = width > 0 && height > 0 ? { width, height } : null;
      resolve({ duration, width, height, aspectRatio });
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(
        new VideoValidationError("Could not read video file.", "UNREADABLE"),
      );
    };
  });
}

export class VideoUploader {
  constructor(api) {
    this.api = api;
  }

  async upload(file, { onJobStart, onProgress, signal, intervalMs } = {}) {
    const limits = await this.api.getVideoUploadLimits({ signal });
    if (!limits.canUpload) {
      throw new Error(limits.message || "Video uploads are not allowed");
    }
    const job = await this.api.uploadVideoBlob(file, { signal });
    onJobStart?.(job);
    return await this.pollJob(job.jobId, { onProgress, signal, intervalMs });
  }

  async pollJob(jobId, { onProgress, signal, intervalMs = 1500 } = {}) {
    while (true) {
      if (signal) {
        signal.throwIfAborted();
      }
      const status = await this.api.getVideoJobStatus(jobId, { signal });
      onProgress?.(status.state, status.progress ?? 0);
      if (status.state === "JOB_STATE_COMPLETED") {
        if (!status.blob) {
          throw new Error("Video job completed but returned no blob");
        }
        return status.blob;
      }
      if (status.state === "JOB_STATE_FAILED") {
        throw new Error(
          status.error || status.message || "Video processing failed",
        );
      }
      await wait(intervalMs);
    }
  }
}

const VIDEO_FILE_EXTENSIONS = {
  "video/mp4": "mp4",
  "video/mpeg": "mpeg",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "image/gif": "gif",
};

const OBJECT_URL_LIFETIME_MS = 40_000;

export async function fetchPostVideoFile(post, identityResolver, { signal }) {
  const video = getVideoFromPost(post);
  const identity = await identityResolver.resolveEndpoint(post.author.did);
  if (!identity) {
    throw new Error(`Could not resolve PDS for ${post.author.did}`);
  }
  const url = new URL("/xrpc/com.atproto.sync.getBlob", identity.pds);
  url.searchParams.set("did", post.author.did);
  url.searchParams.set("cid", video.cid);
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`getBlob failed: HTTP ${response.status}`);
  }
  const blob = await response.blob();
  const extension = VIDEO_FILE_EXTENSIONS[blob.type] ?? blob.type.split("/")[1];
  const filename = `${post.author.handle}-${getRKey(post)}.${extension}`;
  return new File([blob], filename, { type: blob.type });
}

export function saveFileToDevice(file) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), OBJECT_URL_LIFETIME_MS);
}
