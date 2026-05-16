import { wait } from "/js/utils.js";

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

export function readVideoMetadata(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    const url = URL.createObjectURL(file);
    video.src = url;
    video.onloadedmetadata = () => {
      const duration = video.duration;
      const width = video.videoWidth || 1;
      const height = video.videoHeight || 1;
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
      resolve({
        duration,
        width,
        height,
        aspectRatio: clampAspectRatio(width, height),
      });
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(
        new VideoValidationError("Could not read video file.", "UNREADABLE"),
      );
    };
  });
}

// Clamp aspect ratio between 1:1 and 3:1 to match social-app
function clampAspectRatio(width, height) {
  if (width <= 0 || height <= 0) {
    return { width: 1, height: 1 };
  }
  const ratio = width / height;
  if (ratio > 3) {
    return { width: 3, height: 1 };
  }
  if (ratio < 1 / 3) {
    return { width: 1, height: 3 };
  }
  return { width, height };
}

export class VideoUploader {
  constructor(api) {
    this.api = api;
  }

  async upload(file, { onJobStart, onProgress, signal, intervalMs } = {}) {
    const limits = await this.api.getVideoUploadLimits();
    if (!limits.canUpload) {
      throw new Error(limits.message || "Video uploads are not allowed");
    }
    const job = await this.api.uploadVideoBlob(file);
    onJobStart?.(job);
    return await this.pollJob(job.jobId, { onProgress, signal, intervalMs });
  }

  async pollJob(jobId, { onProgress, signal, intervalMs = 1500 } = {}) {
    while (true) {
      if (signal?.aborted) {
        throw new Error("Video upload aborted");
      }
      const status = await this.api.getVideoJobStatus(jobId);
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
