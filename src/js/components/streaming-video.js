import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";

// Only start loading the video when it's close to visible in the viewport.
// Also fires when a hidden page is shown again, resuming autoplay videos
// that were paused on page exit.
const streamingVideoObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.enableStreaming();
        entry.target.resumeAutoplay();
      }
    }
  },
  {
    rootMargin: "200px",
  },
);

class StreamingVideo extends Component {
  // Pause on navigate
  handlePageTransition = () => {
    const video = this.querySelector("video");
    if (!video) {
      return;
    }
    video.muted = true;
    video.pause();
  };

  connectedCallback() {
    // We always want to observe / unobserve the video to ensure it's streaming when it should be
    streamingVideoObserver.observe(this);
    window.addEventListener("page-transition", this.handlePageTransition);
    if (this.initialized) {
      return;
    }
    this.src = this.getAttribute("src");
    this.alt = this.getAttribute("alt") || "";
    this.controls = this.getAttribute("controls") !== null;
    this.autoplay = this.getAttribute("autoplay") !== null;
    this.muted = this.getAttribute("muted") !== null;
    this.loop = this.getAttribute("loop") !== null;
    this.playsinline = this.getAttribute("playsinline") !== null;
    this._streamingEnabled = false;
    this.render();
    this.initialized = true;
  }

  disconnectedCallback() {
    streamingVideoObserver.unobserve(this);
    window.removeEventListener("page-transition", this.handlePageTransition);
  }

  render() {
    render(
      html`<video
        ?controls=${this.controls}
        ?autoplay=${this.autoplay}
        ?loop=${this.loop}
        ?playsinline=${this.playsinline}
        ?muted=${this.muted}
        aria-label=${this.alt || null}
      ></video>`,
      this,
    );
    const video = this.querySelector("video");
    if (this.muted) {
      video.muted = true;
    }
  }

  resumeAutoplay() {
    if (!this.autoplay) {
      return;
    }
    const video = this.querySelector("video");
    if (video && video.paused) {
      video.play().catch(() => {});
    }
  }

  async enableStreaming() {
    if (this._streamingEnabled) {
      return;
    }
    const video = this.querySelector("video");
    if (!video) {
      return;
    }
    if (this.src.includes(".m3u8")) {
      if (!window.Hls) {
        await import("/js/lib/hls.js");
      }
      const hls = new window.Hls({
        // https://github.com/bluesky-social/social-app/blob/92926a2417af8fb6f37feb93779f8cf4c4a4b622/src/components/Post/Embed/VideoEmbed/VideoEmbedInner/VideoEmbedInnerWeb.tsx#L108
        maxBufferSize: 10 * 1000 * 1000, // 10MB
      });
      hls.loadSource(this.src);
      hls.attachMedia(video);
    } else {
      const source = document.createElement("source");
      source.src = this.src;
      source.type = this.src.endsWith(".webm") ? "video/webm" : "video/mp4";
      video.appendChild(source);
    }
    this._streamingEnabled = true;
  }
}

StreamingVideo.register();
