import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { isTouchOnlyDevice } from "/js/utils.js";

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

const MIN_ACTIVE_VISIBILITY_RATIO = 0.5;
const allElements = new Set();
let activeVideo = null;

const activeVideoObserver = new IntersectionObserver(
  () => updateActiveVideo(),
  { threshold: [0, MIN_ACTIVE_VISIBILITY_RATIO, 0.75, 1] },
);

// Fraction of the element's area inside the viewport, plus its top edge
function measureViewportVisibility(element) {
  const rect = element.getBoundingClientRect();
  const area = rect.width * rect.height;
  if (area === 0) {
    return { ratio: 0, top: rect.top };
  }
  const visibleWidth =
    Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0);
  const visibleHeight =
    Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
  if (visibleWidth <= 0 || visibleHeight <= 0) {
    return { ratio: 0, top: rect.top };
  }
  return { ratio: (visibleWidth * visibleHeight) / area, top: rect.top };
}

function pickActiveVideo() {
  let best = null;
  let bestVisibility = null;
  for (const candidate of allElements) {
    const visibility = measureViewportVisibility(candidate);
    if (visibility.ratio < MIN_ACTIVE_VISIBILITY_RATIO) {
      continue;
    }
    if (
      !best ||
      visibility.ratio > bestVisibility.ratio ||
      (visibility.ratio === bestVisibility.ratio &&
        visibility.top < bestVisibility.top)
    ) {
      best = candidate;
      bestVisibility = visibility;
    }
  }
  return best;
}

function setActiveVideo(element) {
  if (element === activeVideo) {
    return;
  }
  const previous = activeVideo;
  activeVideo = element;
  previous?.deactivate();
  element?.activate();
}

export function updateActiveVideo() {
  setActiveVideo(pickActiveVideo());
}

let manuallyMuted = true;

function formatRemainingTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

class StreamingVideo extends Component {
  // Pause on navigate
  handlePageTransition = () => {
    const video = this.querySelector("video");
    if (!video) {
      return;
    }
    if (activeVideo === this) {
      activeVideo = null;
    }
    this._setMutedProgrammatically(video, true);
    video.pause();
  };

  _setMutedProgrammatically(video, muted) {
    if (video.muted === muted) {
      return;
    }
    this._pendingProgrammaticVolumeChange = true;
    video.muted = muted;
  }

  handleVolumeChange = (event) => {
    if (this._pendingProgrammaticVolumeChange) {
      this._pendingProgrammaticVolumeChange = false;
      return;
    }
    if (this.controls) {
      manuallyMuted = event.target.muted;
    }
  };

  handlePlay = (event) => {
    if (!this.controls) {
      return;
    }
    if (this._isActiveCandidate) {
      setActiveVideo(this);
    }
    if (!manuallyMuted) {
      this._setMutedProgrammatically(event.target, false);
    }
  };

  get _isActiveCandidate() {
    return this.controls && this.autoplay;
  }

  activate() {
    const video = this.querySelector("video");
    if (!video || !video.paused) {
      return;
    }
    this.enableStreaming().then(() => {
      if (activeVideo === this) {
        video.play().catch(() => {});
      }
    });
  }

  deactivate() {
    this.querySelector("video")?.pause();
  }

  connectedCallback() {
    // We always want to observe / unobserve the video to ensure it's streaming when it should be
    streamingVideoObserver.observe(this);
    window.addEventListener("page-transition", this.handlePageTransition);
    if (!this.initialized) {
      this._initialize();
    }
    if (this._isActiveCandidate) {
      this._observeForActivation();
    }
  }

  _initialize() {
    this.src = this.getAttribute("src");
    this.alt = this.getAttribute("alt") || "";
    this.poster = this.getAttribute("poster");
    this.controls = this.getAttribute("controls") !== null;
    // On touch devices the native controls stay hidden until the first tap
    this._controlsRevealed = !isTouchOnlyDevice();
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
    if (this._isActiveCandidate) {
      activeVideoObserver.unobserve(this);
      allElements.delete(this);
      if (activeVideo === this) {
        activeVideo = null;
        updateActiveVideo();
      }
    }
  }

  _observeForActivation() {
    allElements.add(this);
    activeVideoObserver.observe(this);
  }

  render() {
    render(
      html`<video
          ?controls=${this.controls && this._controlsRevealed}
          ?autoplay=${this.autoplay && !this.controls}
          ?loop=${this.loop}
          ?playsinline=${this.playsinline}
          ?muted=${this.muted}
          aria-label=${this.alt || null}
          @click=${this.handleClick}
          @play=${this.handlePlay}
          @volumechange=${this.handleVolumeChange}
          @timeupdate=${this.handleTimeChange}
          @durationchange=${this.handleTimeChange}
        ></video>
        ${this.controls
          ? html`<span
              class="video-time-remaining"
              data-testid="video-time-remaining"
              hidden
            ></span>`
          : null}`,
      this,
    );
    const video = this.querySelector("video");
    if (this.muted) {
      this._setMutedProgrammatically(video, true);
    }
    if (this.poster) {
      video.setAttribute("poster", this.poster);
    }
  }

  handleClick = () => {
    if (!this.controls || this._controlsRevealed) {
      return;
    }
    this._controlsRevealed = true;
    this.render();
  };

  handleTimeChange = (event) => {
    const indicator = this.querySelector(".video-time-remaining");
    if (!indicator) {
      return;
    }
    const { duration, currentTime } = event.target;
    if (!Number.isFinite(duration) || duration <= 0) {
      indicator.hidden = true;
      return;
    }
    const remaining = Math.max(0, Math.floor(duration - currentTime));
    indicator.textContent = formatRemainingTime(remaining);
    indicator.setAttribute(
      "aria-label",
      `Time remaining: ${remaining} seconds`,
    );
    indicator.hidden = false;
  };

  resumeAutoplay() {
    if (!this.autoplay || this._isActiveCandidate) {
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
