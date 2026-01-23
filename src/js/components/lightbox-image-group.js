import { Component, getChildrenFragment } from "./component.js";
import { html, render } from "/js/lib/lit-html.js";

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

  // TODO: navigate between images within the group
  showLightbox(img) {
    const src = img.src;
    const alt = img.alt;

    const lightboxContainer = getSharedContainer("lightbox-container");

    // Helper to close the lightbox and clean up
    const closeBox = () => {
      document.body.style.overflow = ""; // Restore scrolling
      render(html``, lightboxContainer);
      document.removeEventListener("keydown", onKeyDown);
    };

    // Keydown handler for Escape
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        closeBox();
      }
    };

    render(
      html`
        <div
          class="lightbox"
          style="display: flex;"
          @click=${(e) => {
            if (e.target.classList.contains("lightbox")) {
              closeBox();
            }
          }}
        >
          <div
            class="lightbox-close"
            @click=${(e) => {
              e.stopPropagation();
              closeBox();
            }}
          >
            ×
          </div>
          <img src=${src} alt=${alt} />
          ${alt && !this.hideAltText
            ? html`<p class="lightbox-alt-text">${alt}</p>`
            : ""}
        </div>
      `,
      lightboxContainer,
    );

    document.body.style.overflow = "hidden"; // Prevent background scrolling
    document.addEventListener("keydown", onKeyDown);
  }
}

LightboxImageGroup.register();
