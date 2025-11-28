import { html, render } from "/js/lib/lit-html.js";
import { Component } from "./component.js";

// Only start loading the video when it's close to visible in the viewport
const streamingVideoObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.enableStreaming();
      }
    }
  },
  {
    rootMargin: "200px",
  }
);

class StreamingVideo extends Component {
  connectedCallback() {
    // We always want to observe / unobserve the video to ensure it's streaming when it should be
    streamingVideoObserver.observe(this);
    if (this.initialized) {
      return;
    }
    this.src = this.getAttribute("src");
    this.controls = this.getAttribute("controls") !== null;
    this.autoplay = this.getAttribute("autoplay") !== null;
    this.muted = this.getAttribute("muted") !== null;
    this.height = this.getAttribute("height") ?? "";
    this.width = this.getAttribute("width") ?? "";
    this._streamingEnabled = false;
    this.render();
    this.initialized = true;
  }

  disconnectedCallback() {
    streamingVideoObserver.unobserve(this);
  }

  render() {
    render(
      html`<video
        controls=${this.controls}
        muted=${this.muted}
        height=${this.height}
        width=${this.width}
      ></video>`,
      this
    );
    const video = this.querySelector("video");
    if (this.muted) {
      video.muted = true;
    }
    window.addEventListener("page-transition", () => {
      video.muted = true;
      video.pause();
    });
  }

  async enableStreaming() {
    if (this._streamingEnabled) {
      return;
    }
    const video = this.querySelector("video");
    if (video && this.src.includes(".m3u8")) {
      if (!window.Hls) {
        await import("/js/lib/hls.js");
      }
      const hls = new window.Hls({
        // https://github.com/bluesky-social/social-app/blob/92926a2417af8fb6f37feb93779f8cf4c4a4b622/src/components/Post/Embed/VideoEmbed/VideoEmbedInner/VideoEmbedInnerWeb.tsx#L108
        maxBufferSize: 10 * 1000 * 1000, // 10MB
      });
      hls.loadSource(this.src);
      hls.attachMedia(video);
      this._streamingEnabled = true;
    }
  }
}

StreamingVideo.register();
