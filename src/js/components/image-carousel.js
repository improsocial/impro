import { Component } from "/js/components/component.js";
import { html, render } from "/js/lib/lit-html.js";
import { isSafari } from "/js/utils.js";
import "/js/components/lightbox-image-group.js";

const MIN_ASPECT_RATIO = 2 / 3;
const MAX_ASPECT_RATIO = 3 / 2;
const ITEM_GAP_PX = 8;

function clampAspectRatio(rawRatio) {
  if (!Number.isFinite(rawRatio) || rawRatio <= 0) {
    return { ratio: 1, isCropped: false };
  }
  const ratio = Math.min(
    MAX_ASPECT_RATIO,
    Math.max(MIN_ASPECT_RATIO, rawRatio),
  );
  return { ratio, isCropped: ratio !== rawRatio };
}

export class ImageCarousel extends Component {
  connectedCallback() {
    if (this._initialized) return;
    this._initialized = true;
    this.currentIndex = 0;
    if (!Array.isArray(this._images)) this._images = [];
    this.render();
    this._scroller = this.querySelector(".carousel-scroller");
    this._disposers = [];
    if (this._scroller) {
      this._disposers.push(this._bindScroll(), this._bindKeyboard());
      if (isSafari()) {
        this._disposers.push(this._bindWheel());
      }
    }
  }

  disconnectedCallback() {
    this._disposers?.forEach((dispose) => dispose());
    this._disposers = [];
  }

  set images(value) {
    this._images = Array.isArray(value) ? value : [];
    if (this._initialized) {
      this.currentIndex = 0;
      this.render();
    }
  }

  get images() {
    return this._images ?? [];
  }

  get _slides() {
    return this.querySelectorAll('[data-testid="carousel-slide"]');
  }

  render() {
    const numImages = this.images.length;
    render(
      html`
        <div
          class="image-carousel-container"
          role="group"
          aria-roledescription="carousel"
          aria-label=${`Image gallery, ${numImages} images`}
          data-testid="image-carousel-container"
        >
          <div class="carousel-scroller">
            ${this.images.map((image, index) => {
              const rawRatio = image.aspectRatio
                ? image.aspectRatio.width / image.aspectRatio.height
                : 1;
              const { ratio, isCropped } = clampAspectRatio(rawRatio);
              const ariaLabel =
                image.alt && image.alt.length > 0
                  ? image.alt
                  : `Image ${index + 1} of ${numImages}`;
              const isActive = index === this.currentIndex;
              return html`
                <button
                  type="button"
                  class="carousel-slide"
                  data-testid="carousel-slide"
                  data-teststate=${isActive ? "active" : "inactive"}
                  data-index=${index}
                  role="group"
                  aria-roledescription="slide"
                  aria-label=${ariaLabel}
                  tabindex=${isActive ? "0" : "-1"}
                  style=${`aspect-ratio: ${ratio};`}
                  @click=${(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    this._openLightbox(index);
                  }}
                >
                  <img
                    class="carousel-image"
                    src=${image.thumb}
                    data-lightbox-src=${image.fullsize ?? image.thumb}
                    alt=${image.alt ?? ""}
                    loading="lazy"
                    draggable="false"
                  />
                  ${image.alt
                    ? html`<span
                        class="alt-indicator"
                        data-testid="image-alt-badge"
                        >ALT</span
                      >`
                    : ""}
                  ${isCropped
                    ? html`<span
                        class="crop-indicator"
                        data-testid="image-crop-badge"
                        aria-label="Image cropped"
                        >✂</span
                      >`
                    : ""}
                </button>
              `;
            })}
          </div>
          ${numImages > 1
            ? html`<span
                class="carousel-counter"
                data-testid="carousel-counter"
                aria-hidden="true"
                >${this.currentIndex + 1}/${numImages}</span
              >`
            : ""}
        </div>
      `,
      this,
    );
  }

  _openLightbox(index) {
    const images = Array.from(this.querySelectorAll("img.carousel-image"));
    const lightboxDialog = document.createElement("lightbox-dialog");
    lightboxDialog.images = images;
    lightboxDialog.currentIndex = index;
    lightboxDialog.addEventListener("close", () => {
      lightboxDialog.remove();
    });
    document.body.appendChild(lightboxDialog);
    lightboxDialog.open();
  }

  _getSlideWidths() {
    return Array.from(this._slides, (slide) => slide.offsetWidth);
  }

  _getOffsetForIndex(index) {
    const widths = this._getSlideWidths();
    let offset = 0;
    for (let i = 0; i < index; i += 1) {
      offset += widths[i] + ITEM_GAP_PX;
    }
    return offset;
  }

  _getActiveIndexFromScroll() {
    const widths = this._getSlideWidths();
    const scrollLeft = this._scroller.scrollLeft;
    const viewportCenter = scrollLeft + this._scroller.clientWidth / 2;
    let cumulative = 0;
    for (let i = 0; i < widths.length; i += 1) {
      const itemStart = cumulative;
      const itemEnd = itemStart + widths[i];
      const itemCenter = (itemStart + itemEnd) / 2;
      if (viewportCenter < itemCenter + (widths[i] + ITEM_GAP_PX) / 2) {
        return i;
      }
      cumulative = itemEnd + ITEM_GAP_PX;
    }
    return widths.length - 1;
  }

  _updateCurrentIndex(index) {
    if (index === this.currentIndex) return;
    this.currentIndex = index;
    this.render();
  }

  _bindScroll() {
    const onScrollEnd = () => {
      const index = this._getActiveIndexFromScroll();
      this._updateCurrentIndex(index);
    };
    this._scroller.addEventListener("scrollend", onScrollEnd);
    return () => this._scroller.removeEventListener("scrollend", onScrollEnd);
  }

  _bindKeyboard() {
    const onKeyDown = (event) => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      if (!this.contains(document.activeElement)) return;
      event.preventDefault();
      const offset = event.key === "ArrowRight" ? 1 : -1;
      const nextIndex = Math.max(
        0,
        Math.min(this.images.length - 1, this.currentIndex + offset),
      );
      if (nextIndex === this.currentIndex) return;
      this._updateCurrentIndex(nextIndex);
      this._scroller.scrollTo({
        left: this._getOffsetForIndex(nextIndex),
        behavior: "smooth",
      });
      const slide = this._slides[nextIndex];
      if (slide) slide.focus({ preventScroll: true });
    };
    this.addEventListener("keydown", onKeyDown);
    return () => this.removeEventListener("keydown", onKeyDown);
  }

  _bindWheel() {
    const onWheel = (event) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      event.preventDefault();
      this._scroller.scrollLeft += event.deltaX;
    };
    this._scroller.addEventListener("wheel", onWheel, { passive: false });
    return () => this._scroller.removeEventListener("wheel", onWheel);
  }
}

ImageCarousel.register();
