import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { playIconTemplate } from "/js/templates/icons/playIcon.template.js";

const YOUTUBE_EMBED_BASE_URL = "https://www.youtube-nocookie.com/embed";

class YoutubeEmbed extends Component {
  connectedCallback() {
    if (this._initialized) {
      return;
    }
    this.videoId = this.getAttribute("video-id");
    this.start = this.getAttribute("start");
    this.thumb = this.getAttribute("thumb");
    this.videoTitle = this.getAttribute("video-title") ?? "";
    this.playing = false;
    this.dataset.teststate = "preview";
    this.render();
    this._initialized = true;
  }

  getPlayerSrc() {
    const startSeconds = /^\d+$/.test(this.start ?? "") ? this.start : "0";
    return `${YOUTUBE_EMBED_BASE_URL}/${encodeURIComponent(
      this.videoId,
    )}?autoplay=1&start=${startSeconds}&rel=0&playsinline=1`;
  }

  play() {
    this.playing = true;
    this.dataset.teststate = "playing";
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
        : html`<button
            class="youtube-embed-play-button"
            data-testid="youtube-embed-play"
            aria-label=${this.videoTitle
              ? `Play YouTube video: ${this.videoTitle}`
              : "Play YouTube video"}
            @click=${(event) => {
              event.stopPropagation();
              event.preventDefault();
              this.play();
            }}
          >
            ${this.thumb
              ? html`<img
                  class="youtube-embed-thumb"
                  src=${this.thumb}
                  alt=""
                  loading="lazy"
                />`
              : ""}
            ${playIconTemplate()}
          </button>`,
      this,
    );
  }
}

YoutubeEmbed.register();
