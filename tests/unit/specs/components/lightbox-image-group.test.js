import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "/js/components/lightbox-image-group.js";

describe("lightbox-image-group", () => {
  function createTestImage(src, alt) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = alt;
    return img;
  }

  class MockImageLoader {
    constructor() {
      this.loadedSet = new Set();
      this.failedSet = new Set();
      this.loadCalls = [];
      this.abortCalls = 0;
    }
    isLoaded(src) {
      return this.loadedSet.has(src);
    }
    hasFailed(src) {
      return this.failedSet.has(src);
    }
    load(src) {
      this.loadCalls.push(src);
      return new Promise(() => {}); // never resolves; tests drive state directly
    }
    abort() {
      this.abortCalls += 1;
    }
  }

  beforeEach(() => {
    document.body.innerHTML = "";
  });

  describe("LightboxDialog - rendering", () => {
    it("should render empty when not open", () => {
      const element = document.createElement("lightbox-dialog");
      document.body.appendChild(element);
      assert.deepEqual(element.innerHTML, "");
    });

    it("should render lightbox when open", () => {
      const element = document.createElement("lightbox-dialog");
      element.images = [createTestImage("test.jpg", "Test")];
      document.body.appendChild(element);
      element.open();
      const lightbox = element.querySelector(".lightbox");
      assert(lightbox !== null);
    });

    it("should render close button", () => {
      const element = document.createElement("lightbox-dialog");
      element.images = [createTestImage("test.jpg", "Test")];
      document.body.appendChild(element);
      element.open();
      const closeBtn = element.querySelector(".lightbox-close");
      assert(closeBtn !== null);
    });

    it("should render image with correct src", () => {
      const element = document.createElement("lightbox-dialog");
      element.images = [createTestImage("test.jpg", "Test image")];
      document.body.appendChild(element);
      element.open();
      const img = element.querySelector("img");
      assert(img !== null);
      assert(img.src.includes("test.jpg"));
    });

    it("should show thumb as placeholder while fullsize loads, then swap", () => {
      const image = createTestImage("thumbnail.jpg", "Test image");
      image.dataset.lightboxSrc = "fullsize.jpg";
      const element = document.createElement("lightbox-dialog");
      element._imageLoader = new MockImageLoader();
      element.images = [image];
      document.body.appendChild(element);
      element.open();

      const initialImg = element.querySelector("img");
      assert(initialImg.src.includes("thumbnail.jpg"));
      assert.deepEqual(element._imageLoader.loadCalls, ["fullsize.jpg"]);

      element._imageLoader.loadedSet.add("fullsize.jpg");
      element.render();
      const swappedImg = element.querySelector("img");
      assert(swappedImg.src.includes("fullsize.jpg"));
    });

    it("should use src directly when fullsize equals thumb (no preload needed)", () => {
      const image = createTestImage("http://localhost/same.jpg", "Test image");
      image.dataset.lightboxSrc = "http://localhost/same.jpg";
      const element = document.createElement("lightbox-dialog");
      element._imageLoader = new MockImageLoader();
      element.images = [image];
      document.body.appendChild(element);
      element.open();

      const img = element.querySelector("img");
      assert(img.src.includes("same.jpg"));
      assert.deepEqual(element._imageLoader.loadCalls, []);
    });

    it("aborts in-flight image loads on close", () => {
      const image = createTestImage("thumbnail.jpg", "Test image");
      image.dataset.lightboxSrc = "fullsize.jpg";
      const element = document.createElement("lightbox-dialog");
      element._imageLoader = new MockImageLoader();
      element.images = [image];
      document.body.appendChild(element);
      element.open();
      assert.deepEqual(element._imageLoader.loadCalls, ["fullsize.jpg"]);

      element.close();
      assert.deepEqual(element._imageLoader.abortCalls, 1);
    });

    it("does not retry a fullsize that previously failed", () => {
      const image = createTestImage("thumbnail.jpg", "Test image");
      image.dataset.lightboxSrc = "fullsize.jpg";
      const element = document.createElement("lightbox-dialog");
      element._imageLoader = new MockImageLoader();
      element._imageLoader.failedSet.add("fullsize.jpg");
      element.images = [image];
      document.body.appendChild(element);
      element.open();

      const img = element.querySelector("img");
      assert(img.src.includes("thumbnail.jpg"));
      assert.deepEqual(element._imageLoader.loadCalls, []);
    });

    it("should fall back to src when data-lightbox-src is not set", () => {
      const element = document.createElement("lightbox-dialog");
      element.images = [createTestImage("thumbnail.jpg", "Test image")];
      document.body.appendChild(element);
      element.open();
      const img = element.querySelector("img");
      assert(img.src.includes("thumbnail.jpg"));
    });

    it("should render alt text when available", () => {
      const element = document.createElement("lightbox-dialog");
      element.images = [createTestImage("test.jpg", "Test alt text")];
      document.body.appendChild(element);
      element.open();
      const altText = element.querySelector(".lightbox-alt-text");
      assert(altText !== null);
      assert.deepEqual(altText.textContent, "Test alt text");
    });

    it("should hide alt text when hide-alt-text attribute is set", () => {
      const element = document.createElement("lightbox-dialog");
      element.setAttribute("hide-alt-text", "true");
      element.images = [createTestImage("test.jpg", "Test alt text")];
      document.body.appendChild(element);
      element.open();
      const altText = element.querySelector(".lightbox-alt-text");
      assert.deepEqual(altText, null);
    });

    it("should apply circle class when image-shape is circle", () => {
      const element = document.createElement("lightbox-dialog");
      element.setAttribute("image-shape", "circle");
      element.images = [createTestImage("test.jpg", "Test")];
      document.body.appendChild(element);
      element.open();
      const img = element.querySelector("img");
      assert(img.classList.contains("lightbox-image-circle"));
    });

    it("should not apply circle class when image-shape is not set", () => {
      const element = document.createElement("lightbox-dialog");
      element.images = [createTestImage("test.jpg", "Test")];
      document.body.appendChild(element);
      element.open();
      const img = element.querySelector("img");
      assert(!img.classList.contains("lightbox-image-circle"));
    });
  });

  describe("LightboxDialog - navigation", () => {
    it("should not show nav buttons with single image", () => {
      const element = document.createElement("lightbox-dialog");
      element.images = [createTestImage("test.jpg", "Test")];
      document.body.appendChild(element);
      element.open();
      const navButtons = element.querySelectorAll(".lightbox-nav");
      assert.deepEqual(navButtons.length, 0);
    });

    it("should show nav buttons with multiple images", () => {
      const element = document.createElement("lightbox-dialog");
      element.images = [
        createTestImage("test1.jpg", "Test 1"),
        createTestImage("test2.jpg", "Test 2"),
      ];
      document.body.appendChild(element);
      element.open();
      const navButtons = element.querySelectorAll(".lightbox-nav");
      assert.deepEqual(navButtons.length, 2);
    });

    it("should disable prev button on first image", () => {
      const element = document.createElement("lightbox-dialog");
      element.images = [
        createTestImage("test1.jpg", "Test 1"),
        createTestImage("test2.jpg", "Test 2"),
      ];
      element.currentIndex = 0;
      document.body.appendChild(element);
      element.open();
      const prevButton = element.querySelector(".lightbox-nav-prev");
      assert(prevButton.disabled);
    });

    it("should disable next button on last image", () => {
      const element = document.createElement("lightbox-dialog");
      element.images = [
        createTestImage("test1.jpg", "Test 1"),
        createTestImage("test2.jpg", "Test 2"),
      ];
      element.currentIndex = 1;
      document.body.appendChild(element);
      element.open();
      const nextButton = element.querySelector(".lightbox-nav-next");
      assert(nextButton.disabled);
    });

    it("should navigate to next image", () => {
      const element = document.createElement("lightbox-dialog");
      element.images = [
        createTestImage("test1.jpg", "Test 1"),
        createTestImage("test2.jpg", "Test 2"),
      ];
      element.currentIndex = 0;
      document.body.appendChild(element);
      element.open();
      element.navigate(1);
      assert.deepEqual(element.currentIndex, 1);
    });

    it("should navigate to previous image", () => {
      const element = document.createElement("lightbox-dialog");
      element.images = [
        createTestImage("test1.jpg", "Test 1"),
        createTestImage("test2.jpg", "Test 2"),
      ];
      element.currentIndex = 1;
      document.body.appendChild(element);
      element.open();
      element.navigate(-1);
      assert.deepEqual(element.currentIndex, 0);
    });

    it("should not navigate past first image", () => {
      const element = document.createElement("lightbox-dialog");
      element.images = [
        createTestImage("test1.jpg", "Test 1"),
        createTestImage("test2.jpg", "Test 2"),
      ];
      element.currentIndex = 0;
      document.body.appendChild(element);
      element.open();
      element.navigate(-1);
      assert.deepEqual(element.currentIndex, 0);
    });

    it("should not navigate past last image", () => {
      const element = document.createElement("lightbox-dialog");
      element.images = [
        createTestImage("test1.jpg", "Test 1"),
        createTestImage("test2.jpg", "Test 2"),
      ];
      element.currentIndex = 1;
      document.body.appendChild(element);
      element.open();
      element.navigate(1);
      assert.deepEqual(element.currentIndex, 1);
    });
  });

  describe("LightboxDialog - open/close", () => {
    it("should set isOpen to true when open() is called", () => {
      const element = document.createElement("lightbox-dialog");
      element.images = [createTestImage("test.jpg", "Test")];
      document.body.appendChild(element);
      element.open();
      assert.deepEqual(element.isOpen, true);
    });

    it("should set isOpen to false when close() is called", () => {
      const element = document.createElement("lightbox-dialog");
      element.images = [createTestImage("test.jpg", "Test")];
      document.body.appendChild(element);
      element.open();
      element.close();
      assert.deepEqual(element.isOpen, false);
    });

    it("should dispatch close event when close() is called", () => {
      const element = document.createElement("lightbox-dialog");
      element.images = [createTestImage("test.jpg", "Test")];
      document.body.appendChild(element);
      element.open();

      let eventFired = false;
      element.addEventListener("close", () => {
        eventFired = true;
      });

      element.close();
      assert(eventFired);
    });

    it("should set body overflow to hidden when opened", () => {
      const element = document.createElement("lightbox-dialog");
      element.images = [createTestImage("test.jpg", "Test")];
      document.body.appendChild(element);
      element.open();
      assert.deepEqual(document.body.style.overflow, "hidden");
    });

    it("should restore body overflow when closed", () => {
      const element = document.createElement("lightbox-dialog");
      element.images = [createTestImage("test.jpg", "Test")];
      document.body.appendChild(element);
      element.open();
      element.close();
      assert.deepEqual(document.body.style.overflow, "");
    });
  });

  describe("LightboxDialog - zoom", () => {
    it("should enable pinch zoom when opened", () => {
      const element = document.createElement("lightbox-dialog");
      element.images = [createTestImage("test.jpg", "Test")];
      document.body.appendChild(element);
      element.open();

      assert(element._zoomControl !== null);
      assert.deepEqual(typeof element._zoomControl.cleanup, "function");
      assert.deepEqual(typeof element._zoomControl.reset, "function");
      assert.deepEqual(typeof element._zoomControl.getState, "function");
    });

    it("should reset zoom when navigating to a different image", () => {
      const element = document.createElement("lightbox-dialog");
      element.images = [
        createTestImage("test1.jpg", "Test 1"),
        createTestImage("test2.jpg", "Test 2"),
      ];
      document.body.appendChild(element);
      element.open();

      let resetCalled = false;
      const originalReset = element._zoomControl.reset;
      element._zoomControl.reset = (...args) => {
        resetCalled = true;
        return originalReset(...args);
      };

      element.navigate(1);
      assert(resetCalled);
    });

    it("should clean up pinch zoom when closed", () => {
      const element = document.createElement("lightbox-dialog");
      element.images = [createTestImage("test.jpg", "Test")];
      document.body.appendChild(element);
      element.open();

      let cleanupCalled = false;
      const originalCleanup = element._zoomControl.cleanup;
      element._zoomControl.cleanup = (...args) => {
        cleanupCalled = true;
        return originalCleanup(...args);
      };

      element.close();
      assert(cleanupCalled);
      assert.deepEqual(element._zoomControl, null);
    });

    it("should not throw on a stray event fired at the image after close", () => {
      const element = document.createElement("lightbox-dialog");
      element.images = [createTestImage("test.jpg", "Test")];
      document.body.appendChild(element);
      element.open();
      const img = element.querySelector("img");

      element.close();

      assert.doesNotThrow(() => {
        img.dispatchEvent(
          new Event("wheel", { bubbles: true, cancelable: true }),
        );
      });
    });
  });

  describe("LightboxDialog - keyboard navigation", () => {
    it("should close on Escape key", () => {
      const element = document.createElement("lightbox-dialog");
      element.images = [createTestImage("test.jpg", "Test")];
      document.body.appendChild(element);
      element.open();

      element.handleKeyDown({ key: "Escape" });
      assert.deepEqual(element.isOpen, false);
    });

    it("should navigate left on ArrowLeft key", () => {
      const element = document.createElement("lightbox-dialog");
      element.images = [
        createTestImage("test1.jpg", "Test 1"),
        createTestImage("test2.jpg", "Test 2"),
      ];
      element.currentIndex = 1;
      document.body.appendChild(element);
      element.open();

      element.handleKeyDown({ key: "ArrowLeft" });
      assert.deepEqual(element.currentIndex, 0);
    });

    it("should navigate right on ArrowRight key", () => {
      const element = document.createElement("lightbox-dialog");
      element.images = [
        createTestImage("test1.jpg", "Test 1"),
        createTestImage("test2.jpg", "Test 2"),
      ];
      element.currentIndex = 0;
      document.body.appendChild(element);
      element.open();

      element.handleKeyDown({ key: "ArrowRight" });
      assert.deepEqual(element.currentIndex, 1);
    });
  });

  describe("LightboxImageGroup - rendering", () => {
    it("should preserve children", () => {
      const element = document.createElement("lightbox-image-group");
      element.innerHTML = '<img src="test.jpg" alt="Test">';
      document.body.appendChild(element);
      const img = element.querySelector("img");
      assert(img !== null);
    });
  });

  describe("LightboxImageGroup - click to open lightbox", () => {
    it("should create lightbox dialog when image is clicked", () => {
      const element = document.createElement("lightbox-image-group");
      element.innerHTML = '<img src="test.jpg" alt="Test">';
      document.body.appendChild(element);

      const img = element.querySelector("img");
      img.click();

      const lightboxDialog = document.querySelector("lightbox-dialog");
      assert(lightboxDialog !== null);

      // Clean up
      lightboxDialog.close();
      lightboxDialog.remove();
    });

    it("should pass hide-alt-text attribute to lightbox dialog", () => {
      const element = document.createElement("lightbox-image-group");
      element.setAttribute("hide-alt-text", "true");
      element.innerHTML = '<img src="test.jpg" alt="Test">';
      document.body.appendChild(element);

      const img = element.querySelector("img");
      img.click();

      const lightboxDialog = document.querySelector("lightbox-dialog");
      // The hideAltText is set as an attribute before appending to DOM
      assert(lightboxDialog.getAttribute("hide-alt-text") !== null);

      // Clean up
      lightboxDialog.close();
      lightboxDialog.remove();
    });

    it("should pass image-shape attribute to lightbox dialog", () => {
      const element = document.createElement("lightbox-image-group");
      element.setAttribute("image-shape", "circle");
      element.innerHTML = '<img src="test.jpg" alt="Test">';
      document.body.appendChild(element);

      const img = element.querySelector("img");
      img.click();

      const lightboxDialog = document.querySelector("lightbox-dialog");
      assert.deepEqual(lightboxDialog.getAttribute("image-shape"), "circle");

      lightboxDialog.close();
      lightboxDialog.remove();
    });

    it("should not set image-shape attribute on dialog when unset on group", () => {
      const element = document.createElement("lightbox-image-group");
      element.innerHTML = '<img src="test.jpg" alt="Test">';
      document.body.appendChild(element);

      const img = element.querySelector("img");
      img.click();

      const lightboxDialog = document.querySelector("lightbox-dialog");
      assert.deepEqual(lightboxDialog.getAttribute("image-shape"), null);

      lightboxDialog.close();
      lightboxDialog.remove();
    });
  });

  describe("LightboxImageGroup - reinitialization protection", () => {
    it("should not reinitialize when connectedCallback is called multiple times", () => {
      const element = document.createElement("lightbox-image-group");
      element.innerHTML = '<img src="test.jpg" alt="Test">';
      document.body.appendChild(element);

      element.connectedCallback();

      const images = element.querySelectorAll("img");
      assert.deepEqual(images.length, 1);
    });
  });
});
