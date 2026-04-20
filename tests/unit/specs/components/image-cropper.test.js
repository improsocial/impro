import { createCanvas, Image as CanvasImage } from "canvas";
import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import "/js/components/image-cropper.js";

const t = new TestSuite("ImageCropper");

function connectElement(element) {
  const container = document.createElement("div");
  container.className = "page-visible";
  container.appendChild(element);
  document.body.appendChild(container);
}

// Create a test image using node-canvas. Returns a canvas Image instance
// that can be assigned directly to cropper._img.
function createTestImage(width, height, color = "red") {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  const img = new CanvasImage();
  img.src = canvas.toBuffer("image/png");
  return img;
}

// Mock getBoundingClientRect since jsdom doesn't do layout.
function mockElementSize(element, width, height) {
  const rect = {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    width,
    height,
  };
  element.getBoundingClientRect = () => rect;
  if (element._canvas) {
    element._canvas.getBoundingClientRect = () => rect;
  }
}

// Inject a test image into the cropper, bypassing the browser Image loading
// path which doesn't work in jsdom.
function injectTestImage(element, width, height) {
  const img = createTestImage(width, height);
  element._img = img;
  element._fitInitialScale();
  element._draw();
  return img;
}

t.beforeEach(() => {
  document.body.innerHTML = "";
});

t.describe("ImageCropper - rendering", (it) => {
  it("should render canvas element when connected", () => {
    const element = document.createElement("image-cropper");
    connectElement(element);
    const canvas = element.querySelector(".image-cropper-canvas");
    assert(canvas !== null, "Canvas should be rendered");
    assertEquals(canvas.tagName, "CANVAS");
  });

  it("should accept aspect-ratio attribute", () => {
    const element = document.createElement("image-cropper");
    element.setAttribute("aspect-ratio", "3");
    connectElement(element);
    assertEquals(element.aspectRatio, 3);
  });

  it("should default aspect-ratio to 1", () => {
    const element = document.createElement("image-cropper");
    connectElement(element);
    assertEquals(element.aspectRatio, 1);
  });

  it("should accept circular attribute", () => {
    const element = document.createElement("image-cropper");
    element.setAttribute("circular", "");
    connectElement(element);
    assertEquals(element.circular, true);
  });

  it("should not be circular by default", () => {
    const element = document.createElement("image-cropper");
    connectElement(element);
    assertEquals(element.circular, false);
  });

  it("should initialize with default state", () => {
    const element = document.createElement("image-cropper");
    connectElement(element);
    assertEquals(element._scale, 1);
    assertEquals(element._offsetX, 0);
    assertEquals(element._offsetY, 0);
    assertEquals(element._dragging, false);
    assertEquals(element._img, null);
  });
});

t.describe("ImageCropper - image loading", (it) => {
  it("should accept an image via _img assignment", () => {
    const element = document.createElement("image-cropper");
    connectElement(element);
    mockElementSize(element, 300, 300);

    injectTestImage(element, 100, 100);
    assert(element._img !== null, "Image should be set");
    assertEquals(element._img.width, 100);
    assertEquals(element._img.height, 100);
  });

  it("should fit initial scale so image covers crop area", () => {
    const element = document.createElement("image-cropper");
    connectElement(element);
    mockElementSize(element, 300, 300);

    // Small image into large cropper — scale must be > 1
    injectTestImage(element, 50, 50);
    assert(element._scale >= 1, "Scale should be >= 1 to fill crop area");
  });
});

t.describe("ImageCropper - cropImage", (it) => {
  it("should return a data URL after cropping", () => {
    const element = document.createElement("image-cropper");
    element.setAttribute("aspect-ratio", "1");
    connectElement(element);
    mockElementSize(element, 200, 200);

    injectTestImage(element, 100, 100);
    const result = element.cropImage();
    assert(result !== null, "cropImage should return a value");
    assert(
      result.startsWith("data:image/jpeg"),
      "cropImage should return a JPEG data URL",
    );
  });

  it("should return null when no image is loaded", () => {
    const element = document.createElement("image-cropper");
    connectElement(element);
    const result = element.cropImage();
    assertEquals(result, null);
  });

  it("should produce output with correct aspect ratio for 1:1 crop", () => {
    const element = document.createElement("image-cropper");
    element.setAttribute("aspect-ratio", "1");
    connectElement(element);
    mockElementSize(element, 200, 200);

    // Wide image — crop should be square
    injectTestImage(element, 200, 100);
    const result = element.cropImage();
    assert(result !== null, "Should produce output");

    // Decode the result to check dimensions
    const outputImg = new CanvasImage();
    const base64 = result.split(",")[1];
    outputImg.src = Buffer.from(base64, "base64");
    assertEquals(outputImg.width, outputImg.height);
  });

  it("should produce output with correct aspect ratio for 3:1 crop", () => {
    const element = document.createElement("image-cropper");
    element.setAttribute("aspect-ratio", "3");
    connectElement(element);
    mockElementSize(element, 300, 200);

    injectTestImage(element, 300, 300);
    const result = element.cropImage();
    assert(result !== null, "Should produce output");

    const outputImg = new CanvasImage();
    const base64 = result.split(",")[1];
    outputImg.src = Buffer.from(base64, "base64");
    // Width should be 3x height
    const ratio = outputImg.width / outputImg.height;
    assert(
      Math.abs(ratio - 3) < 0.1,
      `Aspect ratio should be ~3, got ${ratio}`,
    );
  });

  it("should crop a wide image to square", () => {
    const element = document.createElement("image-cropper");
    element.setAttribute("aspect-ratio", "1");
    connectElement(element);
    mockElementSize(element, 200, 200);

    // Very wide image
    injectTestImage(element, 400, 100);
    const result = element.cropImage();
    assert(result !== null, "Should produce output");

    const outputImg = new CanvasImage();
    const base64 = result.split(",")[1];
    outputImg.src = Buffer.from(base64, "base64");
    assertEquals(outputImg.width, outputImg.height);
  });

  it("should crop a tall image to square", () => {
    const element = document.createElement("image-cropper");
    element.setAttribute("aspect-ratio", "1");
    connectElement(element);
    mockElementSize(element, 200, 200);

    // Very tall image
    injectTestImage(element, 100, 400);
    const result = element.cropImage();
    assert(result !== null, "Should produce output");

    const outputImg = new CanvasImage();
    const base64 = result.split(",")[1];
    outputImg.src = Buffer.from(base64, "base64");
    assertEquals(outputImg.width, outputImg.height);
  });
});

t.describe("ImageCropper - pointer events", (it) => {
  it("should set dragging to true on pointerdown", () => {
    const element = document.createElement("image-cropper");
    connectElement(element);
    const canvas = element.querySelector(".image-cropper-canvas");

    const event = new Event("pointerdown", { bubbles: true });
    event.clientX = 100;
    event.clientY = 100;
    event.pointerId = 1;
    canvas.setPointerCapture = () => {};
    canvas.dispatchEvent(event);

    assertEquals(element._dragging, true);
  });

  it("should set dragging to false on pointerup", () => {
    const element = document.createElement("image-cropper");
    connectElement(element);
    const canvas = element.querySelector(".image-cropper-canvas");

    const downEvent = new Event("pointerdown", { bubbles: true });
    downEvent.clientX = 100;
    downEvent.clientY = 100;
    downEvent.pointerId = 1;
    canvas.setPointerCapture = () => {};
    canvas.dispatchEvent(downEvent);

    canvas.dispatchEvent(new Event("pointerup", { bubbles: true }));
    assertEquals(element._dragging, false);
  });

  it("should set dragging to false on pointercancel", () => {
    const element = document.createElement("image-cropper");
    connectElement(element);
    const canvas = element.querySelector(".image-cropper-canvas");

    const downEvent = new Event("pointerdown", { bubbles: true });
    downEvent.clientX = 100;
    downEvent.clientY = 100;
    downEvent.pointerId = 1;
    canvas.setPointerCapture = () => {};
    canvas.dispatchEvent(downEvent);

    canvas.dispatchEvent(new Event("pointercancel", { bubbles: true }));
    assertEquals(element._dragging, false);
  });

  it("should track drag start position", () => {
    const element = document.createElement("image-cropper");
    connectElement(element);
    const canvas = element.querySelector(".image-cropper-canvas");

    const event = new Event("pointerdown", { bubbles: true });
    event.clientX = 150;
    event.clientY = 200;
    event.pointerId = 1;
    canvas.setPointerCapture = () => {};
    canvas.dispatchEvent(event);

    assertEquals(element._dragStartX, 150);
    assertEquals(element._dragStartY, 200);
  });

  it("should update offset on pointermove while dragging", () => {
    const element = document.createElement("image-cropper");
    connectElement(element);
    mockElementSize(element, 200, 200);

    injectTestImage(element, 1000, 1000);

    // Zoom in first so there's room to pan
    element._scale = 3;
    element._clampOffset();
    element._draw();

    const canvas = element.querySelector(".image-cropper-canvas");

    const downEvent = new Event("pointerdown", { bubbles: true });
    downEvent.clientX = 100;
    downEvent.clientY = 100;
    downEvent.pointerId = 1;
    canvas.setPointerCapture = () => {};
    canvas.dispatchEvent(downEvent);

    const moveEvent = new Event("pointermove", { bubbles: true });
    moveEvent.clientX = 130;
    moveEvent.clientY = 120;
    canvas.dispatchEvent(moveEvent);

    assert(
      element._offsetX !== 0 || element._offsetY !== 0,
      "Offset should change after drag when zoomed in",
    );
  });
});

t.describe("ImageCropper - slider zoom", (it) => {
  it("should render a zoom slider", () => {
    const element = document.createElement("image-cropper");
    connectElement(element);
    const slider = element.querySelector(".image-cropper-slider");
    assert(slider !== null, "Slider should be rendered");
    assertEquals(slider.type, "range");
  });

  it("should increase scale when slider is moved right", () => {
    const element = document.createElement("image-cropper");
    connectElement(element);
    mockElementSize(element, 200, 200);

    injectTestImage(element, 100, 100);
    const initialScale = element._scale;

    const slider = element.querySelector(".image-cropper-slider");
    slider.value = "50";
    slider.dispatchEvent(new Event("input", { bubbles: true }));

    assert(
      element._scale > initialScale,
      `Scale should increase from ${initialScale}, got ${element._scale}`,
    );
  });

  it("should reach maximum scale at slider value 100", () => {
    const element = document.createElement("image-cropper");
    connectElement(element);
    mockElementSize(element, 200, 200);

    injectTestImage(element, 100, 100);

    const slider = element.querySelector(".image-cropper-slider");
    slider.value = "100";
    slider.dispatchEvent(new Event("input", { bubbles: true }));

    assertEquals(element._scale, 5);
  });

  it("should be at minimum scale at slider value 0", () => {
    const element = document.createElement("image-cropper");
    connectElement(element);
    mockElementSize(element, 200, 200);

    injectTestImage(element, 100, 100);
    const minScale = element._getMinScale();

    const slider = element.querySelector(".image-cropper-slider");
    slider.value = "0";
    slider.dispatchEvent(new Event("input", { bubbles: true }));

    assertEquals(element._scale, minScale);
  });

  it("should sync slider position when image is loaded", () => {
    const element = document.createElement("image-cropper");
    connectElement(element);
    mockElementSize(element, 200, 200);

    injectTestImage(element, 100, 100);

    const slider = element.querySelector(".image-cropper-slider");
    assertEquals(slider.value, "0");
  });
});

t.describe("ImageCropper - attribute changes", (it) => {
  it("should update aspect ratio when attribute changes", () => {
    const element = document.createElement("image-cropper");
    connectElement(element);
    assertEquals(element.aspectRatio, 1);

    element.setAttribute("aspect-ratio", "3");
    assertEquals(element.aspectRatio, 3);
  });

  it("should handle non-numeric aspect ratio gracefully", () => {
    const element = document.createElement("image-cropper");
    element.setAttribute("aspect-ratio", "invalid");
    connectElement(element);
    assertEquals(element.aspectRatio, 1);
  });
});

await t.run();
