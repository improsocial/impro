import { Component, getChildrenFragment } from "/js/components/component.js";
import { html, render } from "/js/lib/lit-html.js";
import { ImageLoader } from "/js/utils.js";
import { enablePinchZoom } from "/js/zoomHelpers.js";
import { scrollLocks } from "/js/scrollLocks.js";
import { closeWithAnimation } from "/js/dialogHelpers.js";
import "/js/components/app-icon.js";

class LightboxDialog extends Component {
  connectedCallback() {
    if (this._initialized) {
      return;
    }
    this.setAttribute("data-dialog-wrapper", "");
    this.innerHTML = "";
    this.hideAltText = this.getAttribute("hide-alt-text") === "true";
    this.imageShape = this.getAttribute("image-shape");
    this.currentIndex = this.currentIndex || 0;
    this.images = this.images || [];
    this.isOpen = false;
    this.scrollLock = null;
    this._imageLoader = this._imageLoader || new ImageLoader();
    this.render();
    this._initialized = true;
  }

  render() {
    if (!this.isOpen) {
      this.innerHTML = "";
      return;
    }
    const currentImg = this.images[this.currentIndex];
    const fullsizeSrc = currentImg.dataset.lightboxSrc;
    const thumbSrc = currentImg.src;
    const hasFullsize = fullsizeSrc && fullsizeSrc !== thumbSrc;
    const fullsizeReady =
      hasFullsize && this._imageLoader.isLoaded(fullsizeSrc);
    const src = fullsizeReady ? fullsizeSrc : thumbSrc;
    const alt = currentImg.alt;
    const hasMultiple = this.images.length > 1;

    if (
      hasFullsize &&
      !fullsizeReady &&
      !this._imageLoader.hasFailed(fullsizeSrc)
    ) {
      this._imageLoader.load(fullsizeSrc).then(
        () => {
          if (this.isOpen) {
            this.render();
          }
        },
        () => {
          // Load failed or was aborted; keep showing the thumb.
        },
      );
    }

    render(
      html`
        <dialog
          class="lightbox"
          autofocus
          @click=${(e) => {
            if (e.target === e.currentTarget) {
              this.close();
            }
          }}
          @cancel=${(e) => {
            e.preventDefault();
            this.close();
          }}
          @close=${() => {
            this.scrollLock?.release();
            this.scrollLock = null;
            this._zoomControl?.cleanup();
            this._zoomControl = null;
            document.removeEventListener("keydown", this.handleKeyDown);
            this.isOpen = false;
            this._imageLoader.abort();
            this.render();
            this.dispatchEvent(new Event("close"));
          }}
        >
          <div
            class="lightbox-close"
            @click=${(e) => {
              e.stopPropagation();
              this.close();
            }}
          >
            <app-icon icon="close-line"></app-icon>
          </div>
          ${hasMultiple
            ? html`
                <button
                  class="lightbox-nav lightbox-nav-prev"
                  @click=${(e) => {
                    e.stopPropagation();
                    this.navigate(-1);
                  }}
                  ?disabled=${this.currentIndex === 0}
                >
                  <app-icon icon="chevron-left-line"></app-icon>
                </button>
              `
            : ""}
          <img
            src=${src}
            alt=${alt}
            class=${this.imageShape === "circle" ? "lightbox-image-circle" : ""}
          />
          ${hasMultiple
            ? html`
                <button
                  class="lightbox-nav lightbox-nav-next"
                  @click=${(e) => {
                    e.stopPropagation();
                    this.navigate(1);
                  }}
                  ?disabled=${this.currentIndex === this.images.length - 1}
                >
                  <app-icon icon="chevron-right-line"></app-icon>
                </button>
              `
            : ""}
          ${alt && !this.hideAltText
            ? html`<p class="lightbox-alt-text">${alt}</p>`
            : ""}
        </dialog>
      `,
      this,
    );
  }

  open() {
    this.isOpen = true;
    this.handleKeyDown = this.handleKeyDown.bind(this);
    document.addEventListener("keydown", this.handleKeyDown);
    this.render();
    this.querySelector(".lightbox").showModal();
    this.scrollLock ??= scrollLocks.acquire({ target: this });
    this._zoomControl = enablePinchZoom(this.querySelector("img"), {
      container: this.querySelector(".lightbox"),
    });
  }

  disconnectedCallback() {
    this.scrollLock?.release();
    this.scrollLock = null;
  }

  close() {
    return closeWithAnimation(this.querySelector(".lightbox"));
  }

  navigate(steps) {
    const newIndex = this.currentIndex + steps;
    if (newIndex >= 0 && newIndex < this.images.length) {
      this.currentIndex = newIndex;
      this._zoomControl?.reset();
      this.render();
    }
  }

  handleKeyDown(e) {
    if (e.key === "ArrowLeft") {
      this.navigate(-1);
    } else if (e.key === "ArrowRight") {
      this.navigate(1);
    }
  }
}

LightboxDialog.register();

class LightboxImageGroup extends Component {
  connectedCallback() {
    if (this._initialized) {
      return;
    }
    this.hideAltText = this.getAttribute("hide-alt-text") === "true";
    this.imageShape = this.getAttribute("image-shape");
    this._children = getChildrenFragment(this);
    this.innerHTML = "";
    this.render();
    this._initialized = true;
  }

  render() {
    const images = this._children.querySelectorAll("img");
    images.forEach((img) => {
      img.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showLightbox(img);
      });
    });
    this.appendChild(this._children);
  }

  showLightbox(img) {
    const images = Array.from(this.querySelectorAll("img"));
    const initialIndex = images.indexOf(img);
    const lightboxDialog = document.createElement("lightbox-dialog");
    lightboxDialog.images = images;
    lightboxDialog.currentIndex = initialIndex;
    if (this.hideAltText) {
      lightboxDialog.setAttribute("hide-alt-text", "true");
    }
    if (this.imageShape) {
      lightboxDialog.setAttribute("image-shape", this.imageShape);
    }
    lightboxDialog.addEventListener("close", () => {
      lightboxDialog.remove();
    });
    document.body.appendChild(lightboxDialog);
    lightboxDialog.open();
  }
}

LightboxImageGroup.register();
