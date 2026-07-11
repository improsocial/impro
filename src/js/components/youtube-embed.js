import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { externalLinkTemplate } from "/js/templates/externalLink.template.js";

const YOUTUBE_EMBED_BASE_URL = "https://www.youtube-nocookie.com/embed";
const DEFAULT_ASPECT_RATIO = String(16 / 9);

class YoutubeEmbed extends Component {
  // Pause on navigate
  handlePageTransition = () => {
    if (!this.playing) {
      return;
    }
    this.querySelector("iframe")?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func: "pauseVideo", args: [] }),
      "https://www.youtube-nocookie.com",
    );
  };

  connectedCallback() {
    window.addEventListener("page-transition", this.handlePageTransition);
    if (this._initialized) {
      return;
    }
    this.videoId = this.getAttribute("video-id");
    this.start = this.getAttribute("start");
    this.thumb = this.getAttribute("thumb");
    this.videoTitle = this.getAttribute("video-title") ?? "";
    this.url = this.getAttribute("url");
    this.description = this.getAttribute("description") ?? "";
    this.aspectRatio = this.getAttribute("aspect-ratio");
    this.playing = false;
    this.dataset.teststate = "preview";
    this.render();
    this._initialized = true;
  }

  disconnectedCallback() {
    window.removeEventListener("page-transition", this.handlePageTransition);
  }

  getPlayerSrc() {
    const startSeconds = /^\d+$/.test(this.start ?? "") ? this.start : "0";
    return `${YOUTUBE_EMBED_BASE_URL}/${encodeURIComponent(
      this.videoId,
    )}?autoplay=1&start=${startSeconds}&rel=0&playsinline=1&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`;
  }

  play() {
    this.playing = true;
    this.dataset.teststate = "playing";
    this.classList.add("is-playing");
    this.style.aspectRatio = this.aspectRatio || DEFAULT_ASPECT_RATIO;
    this.render();
    this.querySelector("iframe")?.focus();
  }

  render() {
    render(
      this.playing
        ? html`<iframe
            class="youtube-embed-iframe"
            data-testid="youtube-embed-iframe"
            src=${this.getPlayerSrc()}
            title=${this.videoTitle}
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowfullscreen
          ></iframe>`
        : externalLinkTemplate({
            url: this.url,
            title: this.videoTitle,
            description: this.description,
            image: this.thumb,
            lazyLoadImages: true,
            onClick: () => this.play(),
            ariaLabel: this.videoTitle
              ? `Play YouTube video: ${this.videoTitle}`
              : "Play YouTube video",
          }),
      this,
    );
  }
}

YoutubeEmbed.register();
