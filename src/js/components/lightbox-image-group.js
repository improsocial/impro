import { Component, getChildrenFragment } from "./component.js";
import { html, render } from "/js/lib/lit-html.js";
import { chevronLeftIconTemplate } from "../templates/icons/chevronLeft.template.js";
import { chevronRightIconTemplate } from "../templates/icons/chevronRight.template.js";

function getSharedContainer(id) {
  let container = document.getElementById(id);
  if (!container) {
    container = document.createElement("div");
    container.id = id;
    document.body.appendChild(container);
  }
  return container;
}

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
    // Show lightbox on image click
    const images = this._children.querySelectorAll("img");
    images.forEach((img) => {
      img.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showLightbox(img);
      });
    });
    // Render children
    this.appendChild(this._children);
  }

  showLightbox(img) {
    const images = Array.from(this.querySelectorAll("img"));
    let currentIndex = images.indexOf(img);
    const lightboxContainer = getSharedContainer("lightbox-container");

    function renderLightbox() {
      const currentImg = images[currentIndex];
      const src = currentImg.src;
      const alt = currentImg.alt;
      const hasMultiple = images.length > 1;

      render(
        html`
          <div
            class="lightbox"
            style="display: flex;"
            @click=${(e) => {
              if (e.target.classList.contains("lightbox")) {
                closeLightbox();
              }
            }}
          >
            <div
              class="lightbox-close"
              @click=${(e) => {
                e.stopPropagation();
                closeLightbox();
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
                      navigate(-1);
                    }}
                    ?disabled=${currentIndex === 0}
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
                      navigate(1);
                    }}
                    ?disabled=${currentIndex === images.length - 1}
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
        lightboxContainer,
      );
    }

    function navigate(steps) {
      const newIndex = currentIndex + steps;
      if (newIndex >= 0 && newIndex < images.length) {
        currentIndex = newIndex;
        renderLightbox();
      }
    }

    function closeLightbox() {
      document.body.style.overflow = ""; // Restore scrolling
      render(html``, lightboxContainer);
      document.removeEventListener("keydown", onKeyDown);
    }

    function onKeyDown(e) {
      if (e.key === "Escape") {
        closeLightbox();
      } else if (e.key === "ArrowLeft") {
        navigate(-1);
      } else if (e.key === "ArrowRight") {
        navigate(1);
      }
    }

    renderLightbox();
    document.body.style.overflow = "hidden"; // Prevent background scrolling
    document.addEventListener("keydown", onKeyDown);
  }
}

LightboxImageGroup.register();
