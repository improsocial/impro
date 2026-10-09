import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { isTouchOnlyDevice } from "/js/utils.js";
import { effect, untrack } from "/js/signals.js";
import { deviceState } from "/js/deviceState.js";
import "/js/components/app-icon.js";

// Only stream the video while it's close to visible in the viewport, releasing
// its buffers once it scrolls away or its page is hidden. Also fires when a
// hidden page is shown again, resuming autoplay videos that were paused on
// page exit.
const streamingVideoObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.enableStreaming();
        entry.target.resumeAutoplay();
      } else {
        entry.target.releaseStreaming();
      }
    }
  },
  {
    rootMargin: "200px",
  },
);

// The active video is the on-screen one whose center is closest to this
// fraction of the viewport height, matching bsky.app on the web
const IDEAL_POSITION_RATIO = 1 / 2.5;
const allElements = new Set();
let activeVideo = null;
// A video the user played or unmuted stays active until its center leaves
// the viewport, even if another video is closer to the ideal position
let activeVideoIsManual = false;

const ACTIVE_VIDEO_SETTLE_MS = 150;
let activeVideoUpdateTimer = null;

function scheduleActiveVideoUpdate() {
  if (allElements.size === 0) {
    return;
  }
  clearTimeout(activeVideoUpdateTimer);
  activeVideoUpdateTimer = setTimeout(
    updateActiveVideo,
    ACTIVE_VIDEO_SETTLE_MS,
  );
}

const activeVideoObserver = new IntersectionObserver(
  scheduleActiveVideoUpdate,
  { threshold: 0 },
);

document.addEventListener("scroll", scheduleActiveVideoUpdate, {
  capture: true,
  passive: true,
});

// Vertical center of the element, or null when no part of it is on screen
function measureOnScreenCenter(element) {
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    return null;
  }
  if (rect.bottom <= 0 || rect.top >= window.innerHeight) {
    return null;
  }
  return rect.top + rect.height / 2;
}

function pickActiveVideo() {
  if (activeVideoIsManual) {
    const center = measureOnScreenCenter(activeVideo);
    if (center !== null && center > 0 && center < window.innerHeight) {
      return activeVideo;
    }
  }
  const idealY = window.innerHeight * IDEAL_POSITION_RATIO;
  let best = null;
  let bestDistance = Infinity;
  for (const candidate of allElements) {
    const center = measureOnScreenCenter(candidate);
    if (center === null) {
      continue;
    }
    const distance = Math.abs(center - idealY);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
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
  activeVideoIsManual = false;
  previous?.deactivate();
  element?.activate();
}

function setActiveVideoManually(element) {
  setActiveVideo(element);
  activeVideoIsManual = true;
}

export function updateActiveVideo() {
  setActiveVideo(pickActiveVideo());
}

const TOUCH_CONTROLS_VISIBLE_MS = 3000;

const connectedPlayers = new Set();

effect(() => {
  deviceState.$autoplayDisabled.get();
  untrack(() => {
    for (const player of connectedPlayers) {
      player.render();
    }
  });
});

function isAutoplayDisabled() {
  return untrack(() => deviceState.$autoplayDisabled.get());
}

function formatRemainingTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

class StreamingVideo extends Component {
  // Pause on navigate
  handlePageTransition = () => {
    if (activeVideo === this) {
      activeVideo = null;
      activeVideoIsManual = false;
    }
    this.deactivate();
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
    if (this._isActiveCandidate && !event.target.muted) {
      setActiveVideoManually(this);
    }
  };

  handlePlay = () => {
    this._pausedByUser = false;
    this._updatePausedIndicator();
    this._updateControlsIndicator();
    if (this._isActiveCandidate && activeVideo !== this) {
      setActiveVideoManually(this);
    }
  };

  handlePause = () => {
    this._updatePausedIndicator();
    this._updateControlsIndicator();
  };

  handleGifToggleClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const video = this.querySelector("video");
    if (video.paused) {
      this.enableStreaming().then(() => video.play().catch(() => {}));
    } else {
      this._pausedByUser = true;
      video.pause();
    }
  };

  // Players without controls show a play button while paused, unless
  // they're only paused until autoplay resumes them
  _updatePausedIndicator() {
    const video = this.querySelector("video");
    this.classList.toggle(
      "is-paused",
      !this.controls &&
        video.paused &&
        (this._pausedByUser || isAutoplayDisabled()),
    );
  }

  _updateControlsIndicator() {
    const video = this.querySelector("video");
    this.classList.toggle(
      "is-showing-controls",
      video.controls &&
        isTouchOnlyDevice() &&
        (video.paused || this._recentlyTapped),
    );
  }

  get _isActiveCandidate() {
    return this.controls && this.autoplay;
  }

  activate() {
    const video = this.querySelector("video");
    if (!video || !video.paused || isAutoplayDisabled()) {
      return;
    }
    this.enableStreaming().then(() => {
      if (activeVideo === this) {
        video.play().catch(() => {});
      }
    });
  }

  deactivate() {
    const video = this.querySelector("video");
    if (!video) {
      return;
    }
    this._setMutedProgrammatically(video, true);
    video.pause();
  }

  connectedCallback() {
    // We always want to observe / unobserve the video to ensure it's streaming when it should be
    streamingVideoObserver.observe(this);
    window.addEventListener("page-transition", this.handlePageTransition);
    connectedPlayers.add(this);
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
    this._streamingPromise = null;
    this._streamingGeneration = 0;
    this._hls = null;
    this._resumeTime = null;
    this._pausedByUser = false;
    this._recentlyTapped = false;
    this._recentTapTimer = null;
    this.render();
    this.initialized = true;
  }

  disconnectedCallback() {
    clearTimeout(this._recentTapTimer);
    streamingVideoObserver.unobserve(this);
    this.releaseStreaming();
    window.removeEventListener("page-transition", this.handlePageTransition);
    connectedPlayers.delete(this);
    if (this._isActiveCandidate) {
      activeVideoObserver.unobserve(this);
      allElements.delete(this);
      if (activeVideo === this) {
        activeVideo = null;
        activeVideoIsManual = false;
        updateActiveVideo();
      }
    }
  }

  _observeForActivation() {
    allElements.add(this);
    activeVideoObserver.observe(this);
  }

  render() {
    const autoplayDisabled = isAutoplayDisabled();
    render(
      html`<video
          ?controls=${this.controls &&
          (this._controlsRevealed || autoplayDisabled)}
          ?autoplay=${this.autoplay && !this.controls && !autoplayDisabled}
          ?loop=${this.loop}
          ?playsinline=${this.playsinline}
          ?muted=${this.muted}
          aria-label=${this.alt || null}
          @click=${this.handleClick}
          @play=${this.handlePlay}
          @pause=${this.handlePause}
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
          : html`<button
              class="gif-play-toggle"
              data-testid="gif-play-toggle"
              aria-label="Play or pause GIF"
              @click=${this.handleGifToggleClick}
            >
              <app-icon icon="play"></app-icon>
            </button>`}`,
      this,
    );
    const video = this.querySelector("video");
    if (this.muted) {
      this._setMutedProgrammatically(video, true);
    }
    if (this.poster) {
      video.setAttribute("poster", this.poster);
    }
    this._updatePausedIndicator();
    this._updateControlsIndicator();
  }

  handleClick = () => {
    if (!this.controls) {
      return;
    }
    if (!this._controlsRevealed) {
      this._controlsRevealed = true;
      this.render();
    }
    this._recentlyTapped = true;
    this._updateControlsIndicator();
    clearTimeout(this._recentTapTimer);
    this._recentTapTimer = setTimeout(() => {
      this._recentlyTapped = false;
      this._updateControlsIndicator();
    }, TOUCH_CONTROLS_VISIBLE_MS);
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
    if (!this.autoplay || this._isActiveCandidate || isAutoplayDisabled()) {
      return;
    }
    const video = this.querySelector("video");
    if (video && video.paused) {
      video.play().catch(() => {});
    }
  }

  enableStreaming() {
    if (!this._streamingPromise) {
      this._streamingPromise = this._startStreaming();
    }
    return this._streamingPromise;
  }

  async _startStreaming() {
    const video = this.querySelector("video");
    const resumeTime = this._resumeTime;
    if (this.src.includes(".m3u8")) {
      if (!window.Hls) {
        const generation = this._streamingGeneration;
        await import("/js/lib/hls.js");
        if (generation !== this._streamingGeneration) {
          return;
        }
      }
      this._hls = new window.Hls({
        // https://github.com/bluesky-social/social-app/blob/92926a2417af8fb6f37feb93779f8cf4c4a4b622/src/components/Post/Embed/VideoEmbed/VideoEmbedInner/VideoEmbedInnerWeb.tsx#L108
        maxBufferSize: 10 * 1000 * 1000, // 10MB
        maxMaxBufferLength: 10,
        backBufferLength: 10,
        startPosition: resumeTime ?? -1,
      });
      this._hls.loadSource(this.src);
      this._hls.attachMedia(video);
    } else {
      const source = document.createElement("source");
      source.src = this.src;
      source.type = this.src.endsWith(".webm") ? "video/webm" : "video/mp4";
      video.appendChild(source);
      if (resumeTime !== null) {
        video.currentTime = resumeTime;
      }
    }
  }

  releaseStreaming() {
    if (!this._streamingPromise) {
      return;
    }
    const video = this.querySelector("video");
    if (document.pictureInPictureElement === video) {
      return;
    }
    this._resumeTime = video.currentTime > 0 ? video.currentTime : null;
    this._streamingGeneration++;
    this._streamingPromise = null;
    if (this._hls) {
      this._hls.destroy();
      this._hls = null;
    } else {
      video.querySelector("source")?.remove();
      video.load();
    }
  }
}

StreamingVideo.register();
