import { Component, getChildrenFragment } from "/js/components/component.js";
import { html, render } from "/js/lib/lit-html.js";
import { ImageLoader } from "/js/utils.js";
import { chevronLeftIconTemplate } from "/js/templates/icons/chevronLeft.template.js";
import { chevronRightIconTemplate } from "/js/templates/icons/chevronRight.template.js";
import { closeIconTemplate } from "/js/templates/icons/closeIcon.template.js";

class LightboxDialog extends Component {
  connectedCallback() {
    if (this._initialized) {
      return;
    }
    this.innerHTML = "";
    this.hideAltText = this.getAttribute("hide-alt-text") === "true";
    this.imageShape = this.getAttribute("image-shape");
    this.currentIndex = this.currentIndex || 0;
    this.images = this.images || [];
    this.isOpen = false;
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
        <div
          class="lightbox"
          style="display: flex;"
          @click=${(e) => {
            if (e.target.classList.contains("lightbox")) {
              this.close();
            }
          }}
        >
          <div
            class="lightbox-close"
            @click=${(e) => {
              e.stopPropagation();
              this.close();
            }}
          >
            ${closeIconTemplate()}
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
                  ${chevronLeftIconTemplate()}
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
                  ${chevronRightIconTemplate()}
                </button>
              `
            : ""}
          ${alt && !this.hideAltText
            ? html`<p class="lightbox-alt-text">${alt}</p>`
            : ""}
        </div>
      `,
      this,
    );
  }

  open() {
    document.body.style.overflow = "hidden";
    this.isOpen = true;
    this.handleKeyDown = this.handleKeyDown.bind(this);
    document.addEventListener("keydown", this.handleKeyDown);
    this.handleViewportResize = this.handleViewportResize.bind(this);
    window.addEventListener("resize", this.handleViewportResize);
    window.visualViewport?.addEventListener(
      "resize",
      this.handleViewportResize,
    );
    this.render();
    this.syncViewportSize();
  }

  // Some browsers size a position:fixed element's 100%/vw/vh/inset against
  // something narrower than the true viewport in this app's layout (root
  // cause unconfirmed - reproduces even with no transform/filter/contain
  // anywhere in the ancestor chain, so it isn't the usual containing-block
  // culprit). Measuring the viewport directly and applying it as an
  // explicit pixel size sidesteps whatever CSS is getting that resolution
  // wrong, and using visualViewport (with a fallback) keeps it correct
  // through on-screen-keyboard/URL-bar-driven viewport changes on mobile.
  syncViewportSize() {
    const lightbox = this.querySelector(".lightbox");
    if (!lightbox) return;
    const vv = window.visualViewport;
    lightbox.style.width = `${vv ? vv.width : window.innerWidth}px`;
    lightbox.style.height = `${vv ? vv.height : window.innerHeight}px`;
  }

  handleViewportResize() {
    this.syncViewportSize();
  }

  close() {
    document.body.style.overflow = "";
    document.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("resize", this.handleViewportResize);
    window.visualViewport?.removeEventListener(
      "resize",
      this.handleViewportResize,
    );
    this.isOpen = false;
    this._imageLoader.abort();
    this.render();
    this.dispatchEvent(new Event("close"));
  }

  navigate(steps) {
    const newIndex = this.currentIndex + steps;
    if (newIndex >= 0 && newIndex < this.images.length) {
      this.currentIndex = newIndex;
      this.render();
    }
  }

  handleKeyDown(e) {
    if (e.key === "Escape") {
      this.close();
    } else if (e.key === "ArrowLeft") {
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
