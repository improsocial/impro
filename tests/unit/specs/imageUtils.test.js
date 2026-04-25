import { TestSuite } from "../testSuite.js";
import { assert, assertEquals } from "../testHelpers.js";
import {
  constrainImageSize,
  estimateDataUrlSize,
  dataUrlToBlob,
  compressImage,
} from "/js/imageUtils.js";

const t = new TestSuite("imageUtils");

const originalImage = globalThis.Image;
const originalCreateElement = document.createElement;

function installImageStubs(toDataURL = () => "data:image/jpeg;base64,") {
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
      return {
        width: 0,
        height: 0,
        getContext: () => ({
          fillStyle: "",
          fillRect: () => {},
          drawImage: () => {},
        }),
        toDataURL: () => toDataURL(),
      };
    }
    return originalCreateElement.call(document, tag);
  };
}

t.afterEach(() => {
  // Clean up any stubs
  globalThis.Image = originalImage;
  document.createElement = originalCreateElement;
});

t.describe("constrainImageSize", (it) => {
  it("should return original size when within bounds", () => {
    const result = constrainImageSize({
      width: 500,
      height: 400,
      maxWidth: 2000,
      maxHeight: 2000,
    });
    assertEquals(result.width, 500);
    assertEquals(result.height, 400);
  });

  it("should scale down when width exceeds max", () => {
    const result = constrainImageSize({
      width: 4000,
      height: 2000,
      maxWidth: 2000,
      maxHeight: 2000,
    });
    assertEquals(result.width, 2000);
    assertEquals(result.height, 1000);
  });

  it("should scale down when height exceeds max", () => {
    const result = constrainImageSize({
      width: 1000,
      height: 4000,
      maxWidth: 2000,
      maxHeight: 2000,
    });
    assertEquals(result.width, 500);
    assertEquals(result.height, 2000);
  });

  it("should scale down when both dimensions exceed max", () => {
    const result = constrainImageSize({
      width: 6000,
      height: 4000,
      maxWidth: 2000,
      maxHeight: 2000,
    });
    assert(result.width <= 2000, `Width ${result.width} should be <= 2000`);
    assert(result.height <= 2000, `Height ${result.height} should be <= 2000`);
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
    assertEquals(result.width, 2000);
    assertEquals(result.height, 2000);
  });

  it("should handle different max width and height", () => {
    const result = constrainImageSize({
      width: 4000,
      height: 2000,
      maxWidth: 1000,
      maxHeight: 2000,
    });
    assertEquals(result.width, 1000);
    assertEquals(result.height, 500);
  });
});

t.describe("estimateDataUrlSize", (it) => {
  it("should estimate size of a base64 data URL", () => {
    // 4 base64 chars = 3 bytes
    const dataUrl = "data:image/jpeg;base64,AAAA";
    const size = estimateDataUrlSize(dataUrl);
    assertEquals(size, 3);
  });

  it("should estimate larger data URLs", () => {
    const base64 = "A".repeat(1000);
    const dataUrl = `data:image/jpeg;base64,${base64}`;
    const size = estimateDataUrlSize(dataUrl);
    assertEquals(size, 750);
  });
});

t.describe("dataUrlToBlob", (it) => {
  it("should convert a JPEG data URL to a Blob", () => {
    const dataUrl = "data:image/jpeg;base64,/9j/4AAQ";
    const blob = dataUrlToBlob(dataUrl);
    assertEquals(blob.type, "image/jpeg");
    assert(blob.size > 0, "Blob should have content");
  });

  it("should convert a PNG data URL to a Blob", () => {
    const dataUrl = "data:image/png;base64,iVBORw0KGgo=";
    const blob = dataUrlToBlob(dataUrl);
    assertEquals(blob.type, "image/png");
    assert(blob.size > 0, "Blob should have content");
  });

  it("should produce a blob with the correct byte length", () => {
    // "AQID" is base64 for bytes [1, 2, 3]
    const dataUrl = "data:image/jpeg;base64,AQID";
    const blob = dataUrlToBlob(dataUrl);
    assertEquals(blob.size, 3);
  });
});

t.describe("compressImage", (it) => {
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
    assertEquals(thrown.message, "Unable to compress image");
  });

  it("returns a blob when output fits under the size limit", async () => {
    const small = `data:image/jpeg;base64,${"A".repeat(16)}`;
    installImageStubs(() => small);

    const result = await compressImage("data:image/jpeg;base64,AAAA");
    assert(result.blob instanceof Blob, "expected a Blob");
    assertEquals(result.blob.type, "image/jpeg");
    assert(result.width > 0 && result.width <= 4000);
    assert(result.height > 0 && result.height <= 4000);
  });
});

await t.run();
