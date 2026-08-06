import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { ImageCompressor } from "/js/imageCompressor.js";

describe("imageCompressor", () => {
  const imageCompressor = new ImageCompressor();
  const {
    constrainImageSize,
    estimateDataUrlSize,
    dataUrlToBlob,
    compressImage,
  } = {
    constrainImageSize:
      imageCompressor.constrainImageSize.bind(imageCompressor),
    estimateDataUrlSize:
      imageCompressor.estimateDataUrlSize.bind(imageCompressor),
    dataUrlToBlob: imageCompressor.dataUrlToBlob.bind(imageCompressor),
    compressImage: imageCompressor.compressImage.bind(imageCompressor),
  };

  const originalImage = globalThis.Image;
  const originalCreateElement = document.createElement;

  function installImageStubs(toDataURL = () => "data:image/jpeg;base64,") {
    const calls = { contexts: [], drawnSizes: [], encodeCount: 0 };
    globalThis.Image = class {
      /** @param {string} _ */
      set src(_) {
        this.width = 8000;
        this.height = 8000;
        queueMicrotask(() => this.onload?.());
      }
    };
    document.createElement = function (tag) {
      if (tag === "canvas") {
        const canvas = {
          width: 0,
          height: 0,
          getContext: () => {
            const ctx = {
              fillStyle: "",
              imageSmoothingEnabled: false,
              imageSmoothingQuality: "low",
              fillRect: () => {},
              drawImage: (img, x, y, width, height) =>
                calls.drawnSizes.push({ width, height }),
            };
            calls.contexts.push(ctx);
            return ctx;
          },
          toDataURL: () => {
            calls.encodeCount++;
            return toDataURL();
          },
        };
        return canvas;
      }
      return originalCreateElement.call(document, tag);
    };
    return calls;
  }

  afterEach(() => {
    // Clean up any stubs
    globalThis.Image = originalImage;
    document.createElement = originalCreateElement;
  });

  describe("constrainImageSize", () => {
    it("should return original size when within bounds", () => {
      const result = constrainImageSize({
        width: 500,
        height: 400,
        maxWidth: 2000,
        maxHeight: 2000,
      });
      assert.deepEqual(result.width, 500);
      assert.deepEqual(result.height, 400);
    });

    it("should scale down when width exceeds max", () => {
      const result = constrainImageSize({
        width: 4000,
        height: 2000,
        maxWidth: 2000,
        maxHeight: 2000,
      });
      assert.deepEqual(result.width, 2000);
      assert.deepEqual(result.height, 1000);
    });

    it("should scale down when height exceeds max", () => {
      const result = constrainImageSize({
        width: 1000,
        height: 4000,
        maxWidth: 2000,
        maxHeight: 2000,
      });
      assert.deepEqual(result.width, 500);
      assert.deepEqual(result.height, 2000);
    });

    it("should scale down when both dimensions exceed max", () => {
      const result = constrainImageSize({
        width: 6000,
        height: 4000,
        maxWidth: 2000,
        maxHeight: 2000,
      });
      assert(result.width <= 2000, `Width ${result.width} should be <= 2000`);
      assert(
        result.height <= 2000,
        `Height ${result.height} should be <= 2000`,
      );
    });

    it("should preserve aspect ratio when scaling down", () => {
      const result = constrainImageSize({
        width: 4000,
        height: 2000,
        maxWidth: 2000,
        maxHeight: 2000,
      });
      const originalRatio = 4000 / 2000;
      const resultRatio = result.width / result.height;
      assert(
        Math.abs(originalRatio - resultRatio) < 0.01,
        `Aspect ratio should be preserved: expected ${originalRatio}, got ${resultRatio}`,
      );
    });

    it("should handle square images", () => {
      const result = constrainImageSize({
        width: 3000,
        height: 3000,
        maxWidth: 2000,
        maxHeight: 2000,
      });
      assert.deepEqual(result.width, 2000);
      assert.deepEqual(result.height, 2000);
    });

    it("should handle different max width and height", () => {
      const result = constrainImageSize({
        width: 4000,
        height: 2000,
        maxWidth: 1000,
        maxHeight: 2000,
      });
      assert.deepEqual(result.width, 1000);
      assert.deepEqual(result.height, 500);
    });
  });

  describe("estimateDataUrlSize", () => {
    it("should estimate size of a base64 data URL", () => {
      // 4 base64 chars = 3 bytes
      const dataUrl = "data:image/jpeg;base64,AAAA";
      const size = estimateDataUrlSize(dataUrl);
      assert.deepEqual(size, 3);
    });

    it("should estimate larger data URLs", () => {
      const base64 = "A".repeat(1000);
      const dataUrl = `data:image/jpeg;base64,${base64}`;
      const size = estimateDataUrlSize(dataUrl);
      assert.deepEqual(size, 750);
    });
  });

  describe("dataUrlToBlob", () => {
    it("should convert a JPEG data URL to a Blob", () => {
      const dataUrl = "data:image/jpeg;base64,/9j/4AAQ";
      const blob = dataUrlToBlob(dataUrl);
      assert.deepEqual(blob.type, "image/jpeg");
      assert(blob.size > 0, "Blob should have content");
    });

    it("should convert a PNG data URL to a Blob", () => {
      const dataUrl = "data:image/png;base64,iVBORw0KGgo=";
      const blob = dataUrlToBlob(dataUrl);
      assert.deepEqual(blob.type, "image/png");
      assert(blob.size > 0, "Blob should have content");
    });

    it("should produce a blob with the correct byte length", () => {
      // "AQID" is base64 for bytes [1, 2, 3]
      const dataUrl = "data:image/jpeg;base64,AQID";
      const blob = dataUrlToBlob(dataUrl);
      assert.deepEqual(blob.size, 3);
    });
  });

  describe("compressImage", () => {
    it("throws when output always exceeds the size limit", async () => {
      // A base64 string ~3MB decoded — over the 2MB limit at any quality.
      const oversized = `data:image/jpeg;base64,${"A".repeat(3_000_000)}`;
      installImageStubs(() => oversized);

      let thrown = null;
      try {
        await compressImage("data:image/jpeg;base64,AAAA");
      } catch (error) {
        thrown = error;
      }
      assert(thrown instanceof Error, "expected an Error to be thrown");
      assert.deepEqual(thrown.message, "Unable to compress image");
    });

    it("returns a blob when output fits under the size limit", async () => {
      const small = `data:image/jpeg;base64,${"A".repeat(16)}`;
      installImageStubs(() => small);

      const result = await compressImage("data:image/jpeg;base64,AAAA");
      assert(result.blob instanceof Blob, "expected a Blob");
      assert.deepEqual(result.blob.type, "image/jpeg");
      assert(result.width > 0 && result.width <= 4000);
      assert(result.height > 0 && result.height <= 4000);
    });

    it("resamples with high-quality smoothing", async () => {
      const small = `data:image/jpeg;base64,${"A".repeat(16)}`;
      const calls = installImageStubs(() => small);

      await compressImage("data:image/jpeg;base64,AAAA");
      assert(calls.contexts.length > 0, "expected a canvas context");
      for (const ctx of calls.contexts) {
        assert.deepEqual(ctx.imageSmoothingEnabled, true);
        assert.deepEqual(ctx.imageSmoothingQuality, "high");
      }
    });

    it("resamples once per output size, not once per quality probe", async () => {
      const small = `data:image/jpeg;base64,${"A".repeat(16)}`;
      const calls = installImageStubs(() => small);

      await compressImage("data:image/jpeg;base64,AAAA");
      // Every probe fits, so dimensions never shrink: one resample, many encodes.
      assert.deepEqual(calls.drawnSizes, [{ width: 4000, height: 4000 }]);
      assert(
        calls.encodeCount > 1,
        `expected multiple quality probes, got ${calls.encodeCount}`,
      );
    });
  });
});
