import { html, render } from "/js/lib/lit-html.js";
import { Component } from "./component.js";

// Only start loading the video when it's close to visible in the viewport
const gifPlayerObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.loadGif();
      }
    }
  },
  {
    rootMargin: "200px",
  },
);

class GifPlayer extends Component {
  connectedCallback() {
    // We always want to observe / unobserve the video to ensure it's loading when it should be
    gifPlayerObserver.observe(this);
    if (this.initialized) {
      return;
    }
    this.src = this.getAttribute("src");
    this.controls = this.getAttribute("controls") !== null;
    this.autoplay = this.getAttribute("autoplay") !== null;
    this.muted = this.getAttribute("muted") !== null;
    this.alt = this.getAttribute("alt");
    this.height = this.getAttribute("height") ?? "";
    this.width = this.getAttribute("width") ?? "";
    this._gifLoaded = false;
    this.render();
    this.initialized = true;
  }

  disconnectedCallback() {
    gifPlayerObserver.unobserve(this);
  }

  render() {
    render(
      html` <video
        muted
        loop
        autoplay
        playsinline
        style="flex: 1 1 0%;"
        aria-label="${this.alt}"
      ></video>`,
      this,
    );
  }

  async loadGif() {
    if (this._gifLoaded) {
      return;
    }
    const video = this.querySelector("video");
    if (video) {
      const source = document.createElement("source");
      source.src = this.src;
      source.type = "video/mp4";
      video.appendChild(source);
      this._gifLoaded = true;
    }
  }
}

GifPlayer.register();
