import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "/js/components/image-carousel.js";

describe("image-carousel", () => {
  function makeImages(count, { withAlt = false } = {}) {
    const images = [];
    for (let i = 0; i < count; i += 1) {
      images.push({
        thumb: `https://example.com/${i}.jpg`,
        fullsize: `https://example.com/${i}-full.jpg`,
        alt: withAlt ? `image ${i}` : "",
        aspectRatio: { width: 4, height: 3 },
      });
    }
    return images;
  }

  function createCarousel(images) {
    const el = document.createElement("image-carousel");
    el.images = images;
    document.body.appendChild(el);
    return el;
  }

  beforeEach(() => {
    document.body.innerHTML = "";
  });

  describe("ImageCarousel rendering", () => {
    it("renders a carousel container with ARIA group + label", () => {
      const el = createCarousel(makeImages(5));
      const container = el.querySelector(
        '[data-testid="image-carousel-container"]',
      );
      assert(container !== null);
      assert.deepEqual(container.getAttribute("role"), "group");
      assert.deepEqual(
        container.getAttribute("aria-roledescription"),
        "carousel",
      );
      assert.deepEqual(
        container.getAttribute("aria-label"),
        "Image gallery, 5 images",
      );
    });

    it("renders one slide per image with slide ARIA + tabindex juggling", () => {
      const el = createCarousel(makeImages(3));
      const slides = el.querySelectorAll('[data-testid="carousel-slide"]');
      assert.deepEqual(slides.length, 3);
      assert.deepEqual(slides[0].getAttribute("data-teststate"), "active");
      assert.deepEqual(slides[0].getAttribute("tabindex"), "0");
      assert.deepEqual(slides[1].getAttribute("data-teststate"), "inactive");
      assert.deepEqual(slides[1].getAttribute("tabindex"), "-1");
      assert.deepEqual(slides[0].getAttribute("aria-roledescription"), "slide");
    });

    it("falls back to 'Image N of M' when no alt text", () => {
      const el = createCarousel(makeImages(2));
      const slides = el.querySelectorAll('[data-testid="carousel-slide"]');
      assert.deepEqual(slides[0].getAttribute("aria-label"), "Image 1 of 2");
    });

    it("uses alt text as slide aria-label when provided", () => {
      const el = createCarousel(makeImages(2, { withAlt: true }));
      const slides = el.querySelectorAll('[data-testid="carousel-slide"]');
      assert.deepEqual(slides[0].getAttribute("aria-label"), "image 0");
    });

    it("renders a per-slide counter 'i/N' on each slide when multiple images", () => {
      const el = createCarousel(makeImages(7));
      const counters = el.querySelectorAll('[data-testid="carousel-counter"]');
      assert.deepEqual(counters.length, 7);
      assert.deepEqual(counters[0].textContent, "1/7");
      assert.deepEqual(counters[3].textContent, "4/7");
      assert.deepEqual(counters[6].textContent, "7/7");
    });

    it("omits per-slide counters when there is only one image", () => {
      const el = createCarousel(makeImages(1));
      const counters = el.querySelectorAll('[data-testid="carousel-counter"]');
      assert.deepEqual(counters.length, 0);
    });

    it("renders ALT badge only when alt text present", () => {
      const el = createCarousel(makeImages(3, { withAlt: true }));
      const altBadges = el.querySelectorAll('[data-testid="image-alt-badge"]');
      assert.deepEqual(altBadges.length, 3);
    });

    it("omits ALT badge when alt text empty", () => {
      const el = createCarousel(makeImages(3));
      const altBadges = el.querySelectorAll('[data-testid="image-alt-badge"]');
      assert.deepEqual(altBadges.length, 0);
    });

    it("clamps slide aspect-ratio to [2/3, 3/2] and flags cropped slides with the crop badge", () => {
      const el = createCarousel([
        {
          thumb: "https://example.com/wide.jpg",
          fullsize: "https://example.com/wide.jpg",
          alt: "",
          aspectRatio: { width: 4, height: 1 },
        },
        {
          thumb: "https://example.com/normal.jpg",
          fullsize: "https://example.com/normal.jpg",
          alt: "",
          aspectRatio: { width: 4, height: 3 },
        },
        {
          thumb: "https://example.com/tall.jpg",
          fullsize: "https://example.com/tall.jpg",
          alt: "",
          aspectRatio: { width: 1, height: 4 },
        },
      ]);
      const slides = el.querySelectorAll('[data-testid="carousel-slide"]');
      // 4:1 (4.0) clamps down to 3/2
      assert.deepEqual(slides[0].style.aspectRatio, String(3 / 2));
      // 4:3 (~1.33) is in range, untouched
      assert.deepEqual(slides[1].style.aspectRatio, String(4 / 3));
      // 1:4 (0.25) clamps up to 2/3
      assert.deepEqual(slides[2].style.aspectRatio, String(2 / 3));
      // Only the two out-of-range slides get a crop badge
      const cropBadges = el.querySelectorAll(
        '[data-testid="image-crop-badge"]',
      );
      assert.deepEqual(cropBadges.length, 2);
    });
  });

  describe("ImageCarousel interaction", () => {
    it("updates active slide on arrow key", () => {
      const el = createCarousel(makeImages(4));
      const slides = el.querySelectorAll('[data-testid="carousel-slide"]');
      slides[0].focus();
      el.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      );
      assert.deepEqual(el.currentIndex, 1);
      assert.deepEqual(slides[1].getAttribute("data-teststate"), "active");
      assert.deepEqual(slides[1].getAttribute("tabindex"), "0");
      assert.deepEqual(slides[0].getAttribute("data-teststate"), "inactive");
      assert.deepEqual(slides[0].getAttribute("tabindex"), "-1");
    });

    it("clamps arrow key navigation at boundaries", () => {
      const el = createCarousel(makeImages(3));
      const slides = el.querySelectorAll('[data-testid="carousel-slide"]');
      slides[0].focus();
      el.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
      assert.deepEqual(el.currentIndex, 0);
    });

    it("ignores arrow keys when focus is outside the carousel", () => {
      const el = createCarousel(makeImages(3));
      const outsideButton = document.createElement("button");
      document.body.appendChild(outsideButton);
      outsideButton.focus();
      el.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
      assert.deepEqual(el.currentIndex, 0);
    });

    it("opens a lightbox-dialog when a slide is clicked", () => {
      const el = createCarousel(makeImages(2));
      const slide = el.querySelectorAll('[data-testid="carousel-slide"]')[1];
      slide.click();
      const dialog = document.querySelector("lightbox-dialog");
      assert(dialog !== null);
      assert.deepEqual(dialog.currentIndex, 1);
      dialog.remove();
    });
  });
});
