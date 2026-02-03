import { Component, getChildrenFragment } from "./component.js";
import { html, render } from "/js/lib/lit-html.js";
import { chevronLeftIconTemplate } from "../templates/icons/chevronLeft.template.js";
import { chevronRightIconTemplate } from "../templates/icons/chevronRight.template.js";

class LightboxDialog extends Component {
  connectedCallback() {
    if (this._initialized) {
      return;
    }
    this.innerHTML = "";
    this.hideAltText = !!this.getAttribute("hide-alt-text");
    this.currentIndex = this.currentIndex || 0;
    this.images = this.images || [];
    this.isOpen = false;
    this.render();
    this._initialized = true;
  }

  render() {
    if (!this.isOpen) {
      this.innerHTML = "";
      return;
    }
    const currentImg = this.images[this.currentIndex];
    const src = currentImg.src;
    const alt = currentImg.alt;
    const hasMultiple = this.images.length > 1;

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
            ×
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
          <img src=${src} alt=${alt} />
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
    this.render();
  }

  close() {
    document.body.style.overflow = "";
    document.removeEventListener("keydown", this.handleKeyDown);
    this.isOpen = false;
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
    this.hideAltText = !!this.getAttribute("hide-alt-text");
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
      lightboxDialog.setAttribute("hide-alt-text", "");
    }
    lightboxDialog.addEventListener("close", () => {
      lightboxDialog.remove();
    });
    document.body.appendChild(lightboxDialog);
    lightboxDialog.open();
  }
}

LightboxImageGroup.register();
