import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { updateActiveVideo } from "/js/components/streaming-video.js";
import { deviceState } from "/js/deviceState.js";

describe("streaming-video", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  describe("StreamingVideo - rendering", () => {
    it("should render a video element", () => {
      const element = document.createElement("streaming-video");
      element.setAttribute("src", "test.m3u8");
      document.body.appendChild(element);
      const video = element.querySelector("video");
      assert(video !== null);
    });
  });

  describe("StreamingVideo - attributes", () => {
    it("should read src attribute", () => {
      const element = document.createElement("streaming-video");
      element.setAttribute("src", "test-video.m3u8");
      document.body.appendChild(element);
      assert.deepEqual(element.src, "test-video.m3u8");
    });

    it("should forward the poster attribute to the video element", () => {
      const element = document.createElement("streaming-video");
      element.setAttribute("src", "test.m3u8");
      element.setAttribute("poster", "https://example.com/thumb.jpg");
      document.body.appendChild(element);
      assert.deepEqual(
        element.querySelector("video").getAttribute("poster"),
        "https://example.com/thumb.jpg",
      );
    });

    it("should not set a poster on the video element when none is given", () => {
      const element = document.createElement("streaming-video");
      element.setAttribute("src", "test.m3u8");
      document.body.appendChild(element);
      assert(!element.querySelector("video").hasAttribute("poster"));
    });

    it("should read controls attribute", () => {
      const element = document.createElement("streaming-video");
      element.setAttribute("src", "test.m3u8");
      element.setAttribute("controls", "");
      document.body.appendChild(element);
      assert.deepEqual(element.controls, true);
    });

    it("should read autoplay attribute", () => {
      const element = document.createElement("streaming-video");
      element.setAttribute("src", "test.m3u8");
      element.setAttribute("autoplay", "");
      document.body.appendChild(element);
      assert.deepEqual(element.autoplay, true);
    });

    it("should read muted attribute", () => {
      const element = document.createElement("streaming-video");
      element.setAttribute("src", "test.m3u8");
      element.setAttribute("muted", "");
      document.body.appendChild(element);
      assert.deepEqual(element.muted, true);
    });

    it("should read loop attribute", () => {
      const element = document.createElement("streaming-video");
      element.setAttribute("src", "test.m3u8");
      element.setAttribute("loop", "");
      document.body.appendChild(element);
      assert.deepEqual(element.loop, true);
    });

    it("should read playsinline attribute", () => {
      const element = document.createElement("streaming-video");
      element.setAttribute("src", "test.m3u8");
      element.setAttribute("playsinline", "");
      document.body.appendChild(element);
      assert.deepEqual(element.playsinline, true);
    });
  });

  describe("StreamingVideo - video element attributes", () => {
    it("should not render controls on the video when attribute is absent", () => {
      const element = document.createElement("streaming-video");
      element.setAttribute("src", "test.m3u8");
      document.body.appendChild(element);
      const video = element.querySelector("video");
      assert.deepEqual(video.controls, false);
      assert(!video.autoplay);
      assert(!video.loop);
    });

    it("should render loop, autoplay, and playsinline on the video when set", () => {
      const element = document.createElement("streaming-video");
      element.setAttribute("src", "test.mp4");
      element.setAttribute("loop", "");
      element.setAttribute("autoplay", "");
      element.setAttribute("playsinline", "");
      document.body.appendChild(element);
      const video = element.querySelector("video");
      assert(video.loop);
      assert(video.autoplay);
      assert(video.playsInline);
    });

    it("should read alt attribute and set aria-label", () => {
      const element = document.createElement("streaming-video");
      element.setAttribute("src", "test.mp4");
      element.setAttribute("alt", "A funny gif");
      document.body.appendChild(element);
      const video = element.querySelector("video");
      assert.deepEqual(video.getAttribute("aria-label"), "A funny gif");
    });
  });

  describe("StreamingVideo - deferred controls on touch devices", () => {
    let originalMatchMedia;

    beforeEach(() => {
      originalMatchMedia = window.matchMedia;
      window.matchMedia = (query) => ({
        ...originalMatchMedia(query),
        matches: query === "(hover: none) and (pointer: coarse)",
      });
    });

    afterEach(() => {
      window.matchMedia = originalMatchMedia;
    });

    function createControlledVideo() {
      const element = document.createElement("streaming-video");
      element.setAttribute("src", "test.m3u8");
      element.setAttribute("controls", "");
      document.body.appendChild(element);
      return element;
    }

    it("should hide controls until the video is tapped", () => {
      const element = createControlledVideo();
      const video = element.querySelector("video");
      assert.deepEqual(video.controls, false);
      video.click();
      assert.deepEqual(element.querySelector("video").controls, true);
    });

    it("should still render the time remaining indicator before the tap", () => {
      const element = createControlledVideo();
      assert(
        element.querySelector('[data-testid="video-time-remaining"]') !== null,
      );
    });

    it("should show controls right away when autoplay is disabled", () => {
      deviceState.$autoplayDisabledSetting.set(true);
      const element = createControlledVideo();
      deviceState.$autoplayDisabledSetting.set(null);
      assert.deepEqual(element.querySelector("video").controls, true);
    });

    describe("controls indicator", () => {
      beforeEach(() => {
        mock.timers.enable({ apis: ["setTimeout"] });
      });

      afterEach(() => {
        mock.timers.reset();
      });

      function createPlayingVideo() {
        const element = createControlledVideo();
        const video = element.querySelector("video");
        let paused = false;
        Object.defineProperty(video, "paused", { get: () => paused });
        const setPaused = (value) => {
          paused = value;
          video.dispatchEvent(new window.Event(value ? "pause" : "play"));
        };
        return { element, video, setPaused };
      }

      it("should not flag controls before they're revealed", () => {
        const { element } = createPlayingVideo();
        assert(!element.classList.contains("is-showing-controls"));
      });

      it("should flag controls as showing for a while after a tap", () => {
        const { element, video } = createPlayingVideo();
        video.click();
        assert(element.classList.contains("is-showing-controls"));
        mock.timers.tick(2999);
        assert(element.classList.contains("is-showing-controls"));
        mock.timers.tick(1);
        assert(!element.classList.contains("is-showing-controls"));
      });

      it("should restart the window on each tap", () => {
        const { element, video } = createPlayingVideo();
        video.click();
        mock.timers.tick(2000);
        video.click();
        mock.timers.tick(2000);
        assert(element.classList.contains("is-showing-controls"));
      });

      it("should flag controls as showing while paused", () => {
        const { element, video, setPaused } = createPlayingVideo();
        video.click();
        setPaused(true);
        mock.timers.tick(3000);
        assert(element.classList.contains("is-showing-controls"));
        setPaused(false);
        assert(!element.classList.contains("is-showing-controls"));
      });
    });

    it("should not add controls on tap when the attribute is absent", () => {
      const element = document.createElement("streaming-video");
      element.setAttribute("src", "test.m3u8");
      document.body.appendChild(element);
      const video = element.querySelector("video");
      video.click();
      assert.deepEqual(element.querySelector("video").controls, false);
    });
  });

  describe("StreamingVideo - single active video", () => {
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
    const VIEWPORT_HEIGHT = 800;
    let originalInnerHeight;
    let originalInnerWidth;

    beforeEach(() => {
      originalInnerHeight = window.innerHeight;
      originalInnerWidth = window.innerWidth;
      window.innerHeight = VIEWPORT_HEIGHT;
      window.innerWidth = 400;
    });

    afterEach(() => {
      window.innerHeight = originalInnerHeight;
      window.innerWidth = originalInnerWidth;
    });

    function createCandidate() {
      const element = document.createElement("streaming-video");
      element.setAttribute("src", "test.mp4");
      element.setAttribute("controls", "");
      element.setAttribute("autoplay", "");
      element.setAttribute("muted", "");
      document.body.appendChild(element);
      const video = element.querySelector("video");
      const calls = { play: 0, pause: 0 };
      let paused = true;
      Object.defineProperty(video, "paused", { get: () => paused });
      video.play = () => {
        calls.play++;
        paused = false;
        video.dispatchEvent(new window.Event("play"));
        return Promise.resolve();
      };
      video.pause = () => {
        calls.pause++;
        paused = true;
      };
      // Full-width, 200px tall box at the given offset from the viewport top
      const placeAt = (top) => {
        element.getBoundingClientRect = () => ({
          top,
          bottom: top + 200,
          left: 0,
          right: 400,
          width: 400,
          height: 200,
        });
      };
      placeAt(VIEWPORT_HEIGHT + 1000);
      return { element, video, calls, placeAt };
    }

    it("should not put the autoplay attribute on controlled videos", () => {
      const { video } = createCandidate();
      assert(!video.autoplay);
    });

    it("should keep the autoplay attribute on gif players", () => {
      const element = document.createElement("streaming-video");
      element.setAttribute("src", "test.mp4");
      element.setAttribute("autoplay", "");
      document.body.appendChild(element);
      assert(element.querySelector("video").autoplay);
    });

    it("should play only the video closest to 40% down the viewport", async () => {
      const first = createCandidate();
      const second = createCandidate();
      first.placeAt(-80);
      second.placeAt(300);
      updateActiveVideo();
      await flush();
      assert.deepEqual(first.calls.play, 0);
      assert.deepEqual(second.calls.play, 1);
    });

    it("should play a partly visible video when no other is on screen", async () => {
      const only = createCandidate();
      only.placeAt(-150);
      updateActiveVideo();
      await flush();
      assert.deepEqual(only.calls.play, 1);
    });

    it("should not play a video entirely outside the viewport", async () => {
      const only = createCandidate();
      only.placeAt(-200);
      updateActiveVideo();
      await flush();
      assert.deepEqual(only.calls.play, 0);
    });

    it("should pause the active video when another becomes closer", async () => {
      const first = createCandidate();
      const second = createCandidate();
      first.placeAt(0);
      second.placeAt(VIEWPORT_HEIGHT - 60);
      updateActiveVideo();
      await flush();
      assert.deepEqual(first.calls.play, 1);
      first.placeAt(-80);
      second.placeAt(100);
      updateActiveVideo();
      await flush();
      assert.deepEqual(first.calls.pause, 1);
      assert.deepEqual(second.calls.play, 1);
    });

    it("should pause the active video when it scrolls out of view", async () => {
      const only = createCandidate();
      only.placeAt(0);
      updateActiveVideo();
      await flush();
      only.placeAt(-200);
      updateActiveVideo();
      assert.deepEqual(only.calls.pause, 1);
    });

    it("should pause the active video when the user plays another one", async () => {
      const first = createCandidate();
      const second = createCandidate();
      first.placeAt(220);
      second.placeAt(550);
      updateActiveVideo();
      await flush();
      second.video.play();
      assert.deepEqual(first.calls.pause, 1);
    });

    it("should resume the active video when its page is shown again", async () => {
      const only = createCandidate();
      only.placeAt(0);
      updateActiveVideo();
      await flush();
      window.dispatchEvent(new Event("page-transition"));
      assert.deepEqual(only.calls.pause, 1);
      updateActiveVideo();
      await flush();
      assert.deepEqual(only.calls.play, 2);
    });

    it("should hand over to the next video when the active one is removed", async () => {
      const first = createCandidate();
      const second = createCandidate();
      first.placeAt(0);
      second.placeAt(300);
      updateActiveVideo();
      await flush();
      first.element.remove();
      await flush();
      assert.deepEqual(second.calls.play, 1);
    });

    it("should keep a video the user played active while its center is on screen", async () => {
      const first = createCandidate();
      const second = createCandidate();
      first.placeAt(220);
      second.placeAt(550);
      updateActiveVideo();
      await flush();
      second.video.play();
      updateActiveVideo();
      await flush();
      assert.deepEqual(first.calls.play, 1);
      assert.deepEqual(second.calls.pause, 0);
      second.placeAt(VIEWPORT_HEIGHT - 100);
      updateActiveVideo();
      await flush();
      assert.deepEqual(second.calls.pause, 1);
      assert.deepEqual(first.calls.play, 2);
    });

    describe("with autoplay disabled", () => {
      beforeEach(() => {
        deviceState.$autoplayDisabledSetting.set(true);
      });

      afterEach(() => {
        deviceState.$autoplayDisabledSetting.set(null);
      });

      it("should not play the active video", async () => {
        const only = createCandidate();
        only.placeAt(220);
        updateActiveVideo();
        await flush();
        assert.deepEqual(only.calls.play, 0);
      });

      it("should pause the video the user played when they play another", async () => {
        const first = createCandidate();
        const second = createCandidate();
        first.placeAt(220);
        second.placeAt(550);
        first.video.play();
        second.video.play();
        assert.deepEqual(first.calls.pause, 1);
      });
    });

    describe("per-video mute", () => {
      // JSDOM fires volumechange synchronously on assignment
      function unmuteByUser(video) {
        video.muted = false;
      }

      it("should make a video the user unmutes the active one", async () => {
        const first = createCandidate();
        const second = createCandidate();
        first.placeAt(220);
        second.placeAt(550);
        updateActiveVideo();
        await flush();
        unmuteByUser(second.video);
        await flush();
        assert.deepEqual(first.calls.pause, 1);
        assert.deepEqual(second.calls.play, 1);
        assert.deepEqual(second.video.muted, false);
      });

      it("should re-mute a video when it stops being active", async () => {
        const first = createCandidate();
        const second = createCandidate();
        first.placeAt(220);
        updateActiveVideo();
        await flush();
        unmuteByUser(first.video);
        first.placeAt(-200);
        second.placeAt(220);
        updateActiveVideo();
        await flush();
        assert(first.video.muted);
        assert.deepEqual(first.calls.pause, 1);
      });

      it("should not carry an unmute over to the next active video", async () => {
        const first = createCandidate();
        const second = createCandidate();
        first.placeAt(220);
        updateActiveVideo();
        await flush();
        unmuteByUser(first.video);
        first.placeAt(-200);
        second.placeAt(220);
        updateActiveVideo();
        await flush();
        assert.deepEqual(second.calls.play, 1);
        assert(second.video.muted);
      });

      it("should resume a video muted when its page is shown again", async () => {
        const only = createCandidate();
        only.placeAt(220);
        updateActiveVideo();
        await flush();
        unmuteByUser(only.video);
        window.dispatchEvent(new Event("page-transition"));
        assert(only.video.muted);
        updateActiveVideo();
        await flush();
        assert.deepEqual(only.calls.play, 2);
        assert(only.video.muted);
      });
    });
  });

  describe("StreamingVideo - gif players", () => {
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

    afterEach(() => {
      deviceState.$autoplayDisabledSetting.set(null);
    });

    function createGif() {
      const element = document.createElement("streaming-video");
      element.setAttribute("src", "test.mp4");
      element.setAttribute("autoplay", "");
      element.setAttribute("muted", "");
      element.setAttribute("loop", "");
      document.body.appendChild(element);
      const video = element.querySelector("video");
      const calls = { play: 0 };
      let paused = true;
      Object.defineProperty(video, "paused", { get: () => paused });
      video.play = () => {
        calls.play++;
        paused = false;
        video.dispatchEvent(new window.Event("play"));
        return Promise.resolve();
      };
      video.pause = () => {
        paused = true;
        video.dispatchEvent(new window.Event("pause"));
      };
      const toggle = element.querySelector('[data-testid="gif-play-toggle"]');
      return { element, video, calls, toggle };
    }

    it("should not render the play toggle on controlled videos", () => {
      const element = document.createElement("streaming-video");
      element.setAttribute("src", "test.mp4");
      element.setAttribute("controls", "");
      document.body.appendChild(element);
      assert.deepEqual(
        element.querySelector('[data-testid="gif-play-toggle"]'),
        null,
      );
    });

    it("should not show the play button while waiting to autoplay", () => {
      const { element } = createGif();
      assert(!element.classList.contains("is-paused"));
    });

    it("should pause a playing gif when tapped and show the play button", async () => {
      const { element, video, toggle } = createGif();
      await video.play();
      toggle.click();
      assert(video.paused);
      assert(element.classList.contains("is-paused"));
    });

    it("should resume a paused gif when tapped again", async () => {
      const { element, video, calls, toggle } = createGif();
      await video.play();
      toggle.click();
      toggle.click();
      await flush();
      assert.deepEqual(calls.play, 2);
      assert(!element.classList.contains("is-paused"));
    });

    it("should not let a toggle tap reach the surrounding post", () => {
      const { element, toggle } = createGif();
      let reachedParent = false;
      const handleBodyClick = () => {
        reachedParent = true;
      };
      document.body.addEventListener("click", handleBodyClick);
      toggle.click();
      document.body.removeEventListener("click", handleBodyClick);
      assert(!reachedParent);
      assert(element.isConnected);
    });

    describe("with autoplay disabled", () => {
      beforeEach(() => {
        deviceState.$autoplayDisabledSetting.set(true);
      });

      it("should not put the autoplay attribute on the video", () => {
        const { video } = createGif();
        assert(!video.autoplay);
      });

      it("should show the play button before the first play", () => {
        const { element } = createGif();
        assert(element.classList.contains("is-paused"));
      });

      it("should not resume as it scrolls into view", () => {
        const { element, calls } = createGif();
        element.resumeAutoplay();
        assert.deepEqual(calls.play, 0);
      });

      it("should play when tapped", async () => {
        const { calls, toggle } = createGif();
        toggle.click();
        await flush();
        assert.deepEqual(calls.play, 1);
      });
    });

    it("should drop the autoplay attribute when the setting is turned off", async () => {
      const { video, element } = createGif();
      assert(video.autoplay);
      deviceState.$autoplayDisabledSetting.set(true);
      await flush();
      assert(!element.querySelector("video").autoplay);
      assert(element.classList.contains("is-paused"));
    });
  });

  describe("StreamingVideo - muted state", () => {
    it("should set video muted when muted attribute is present", () => {
      const element = document.createElement("streaming-video");
      element.setAttribute("src", "test.m3u8");
      element.setAttribute("muted", "");
      document.body.appendChild(element);
      const video = element.querySelector("video");
      assert(video.muted);
    });

    it("should not be muted by default", () => {
      const element = document.createElement("streaming-video");
      element.setAttribute("src", "test.m3u8");
      document.body.appendChild(element);
      assert.deepEqual(element.muted, false);
    });
  });

  describe("StreamingVideo - streaming state", () => {
    let hlsInstances;

    beforeEach(() => {
      hlsInstances = [];
      window.Hls = class {
        constructor(config) {
          this.config = config;
          this.destroyed = false;
          hlsInstances.push(this);
        }
        loadSource(src) {
          this.src = src;
        }
        attachMedia(video) {
          this.media = video;
        }
        destroy() {
          this.destroyed = true;
        }
      };
    });

    afterEach(() => {
      delete window.Hls;
    });

    function createElement(src) {
      const element = document.createElement("streaming-video");
      element.setAttribute("src", src);
      document.body.appendChild(element);
      return element;
    }

    it("should not create an hls player before streaming is enabled", () => {
      createElement("test.m3u8");
      assert.deepEqual(hlsInstances.length, 0);
    });

    it("should attach an hls player when streaming is enabled", async () => {
      const element = createElement("test.m3u8");

      await element.enableStreaming();

      assert.deepEqual(hlsInstances.length, 1);
      assert.deepEqual(hlsInstances[0].src, "test.m3u8");
      assert.deepEqual(hlsInstances[0].media, element.querySelector("video"));
    });

    it("should cap how much the hls player buffers", async () => {
      const element = createElement("test.m3u8");

      await element.enableStreaming();

      const { config } = hlsInstances[0];
      assert(Number.isFinite(config.maxMaxBufferLength));
      assert(Number.isFinite(config.backBufferLength));
    });

    it("should only enable streaming once", async () => {
      const element = createElement("test.m3u8");

      await element.enableStreaming();
      await element.enableStreaming();

      assert.deepEqual(hlsInstances.length, 1);
    });

    it("should create one hls player for concurrent calls while hls.js loads", async () => {
      delete window.Hls;
      const MockHls = class {
        constructor() {
          hlsInstances.push(this);
        }
        loadSource() {}
        attachMedia() {}
        destroy() {}
      };
      const element = createElement("test.m3u8");

      const first = element.enableStreaming();
      const second = element.enableStreaming();
      // The real hls.js module is imported; swap in the mock once it lands
      Object.defineProperty(window, "Hls", {
        configurable: true,
        get: () => MockHls,
        set: () => {},
      });
      await Promise.all([first, second]);

      assert.deepEqual(hlsInstances.length, 1);
    });

    it("should destroy the hls player when streaming is released", async () => {
      const element = createElement("test.m3u8");
      await element.enableStreaming();

      element.releaseStreaming();

      assert(hlsInstances[0].destroyed);
    });

    it("should create a new hls player when streaming is re-enabled after release", async () => {
      const element = createElement("test.m3u8");
      await element.enableStreaming();
      element.releaseStreaming();

      await element.enableStreaming();

      assert.deepEqual(hlsInstances.length, 2);
      assert(!hlsInstances[1].destroyed);
    });

    it("should resume from the released position", async () => {
      const element = createElement("test.m3u8");
      await element.enableStreaming();
      element.querySelector("video").currentTime = 12;
      element.releaseStreaming();

      await element.enableStreaming();

      assert.deepEqual(hlsInstances[1].config.startPosition, 12);
    });

    it("should start from the default position when never played", async () => {
      const element = createElement("test.m3u8");
      await element.enableStreaming();
      element.releaseStreaming();

      await element.enableStreaming();

      assert.deepEqual(hlsInstances[1].config.startPosition, -1);
    });

    it("should destroy the hls player when disconnected", async () => {
      const element = createElement("test.m3u8");
      await element.enableStreaming();

      element.remove();

      assert(hlsInstances[0].destroyed);
    });

    it("should not release a video playing picture-in-picture", async () => {
      const element = createElement("test.m3u8");
      await element.enableStreaming();
      Object.defineProperty(document, "pictureInPictureElement", {
        configurable: true,
        get: () => element.querySelector("video"),
      });

      try {
        element.releaseStreaming();
      } finally {
        delete document.pictureInPictureElement;
      }

      assert(!hlsInstances[0].destroyed);
    });

    it("should append a source element for mp4 sources", async () => {
      const element = createElement("test-video.mp4");

      await element.enableStreaming();

      const source = element.querySelector("video source");
      assert(source !== null);
      assert.deepEqual(source.src.endsWith("test-video.mp4"), true);
      assert.deepEqual(source.type, "video/mp4");
    });

    it("should use the webm type for webm sources", async () => {
      const element = createElement("test-video.webm");

      await element.enableStreaming();

      const source = element.querySelector("video source");
      assert.deepEqual(source.type, "video/webm");
    });

    it("should only attach a progressive source once", async () => {
      const element = createElement("test-video.mp4");

      await element.enableStreaming();
      await element.enableStreaming();

      const sources = element.querySelectorAll("video source");
      assert.deepEqual(sources.length, 1);
    });

    it("should remove the progressive source when streaming is released", async () => {
      const element = createElement("test-video.mp4");
      await element.enableStreaming();

      element.releaseStreaming();

      assert.deepEqual(element.querySelectorAll("video source").length, 0);
    });

    it("should reattach the progressive source when re-enabled after release", async () => {
      const element = createElement("test-video.mp4");
      await element.enableStreaming();
      element.releaseStreaming();

      await element.enableStreaming();

      assert.deepEqual(element.querySelectorAll("video source").length, 1);
    });
  });

  describe("StreamingVideo - time remaining indicator", () => {
    function createControlledVideo({ duration, currentTime }) {
      const element = document.createElement("streaming-video");
      element.setAttribute("src", "test.m3u8");
      element.setAttribute("controls", "");
      document.body.appendChild(element);
      const video = element.querySelector("video");
      Object.defineProperty(video, "duration", {
        value: duration,
        configurable: true,
      });
      Object.defineProperty(video, "currentTime", {
        value: currentTime,
        configurable: true,
      });
      return { element, video };
    }

    it("should render a hidden indicator until the duration is known", () => {
      const { element } = createControlledVideo({
        duration: NaN,
        currentTime: 0,
      });
      const indicator = element.querySelector(
        '[data-testid="video-time-remaining"]',
      );
      assert(indicator !== null);
      assert(indicator.hidden);
    });

    it("should show the remaining time as m:ss on timeupdate", () => {
      const { element, video } = createControlledVideo({
        duration: 125.4,
        currentTime: 3.2,
      });
      video.dispatchEvent(new window.Event("timeupdate"));
      const indicator = element.querySelector(
        '[data-testid="video-time-remaining"]',
      );
      assert(!indicator.hidden);
      assert.deepEqual(indicator.textContent, "2:02");
    });

    it("should show 0:00 once playback reaches the end", () => {
      const { element, video } = createControlledVideo({
        duration: 10,
        currentTime: 10,
      });
      video.dispatchEvent(new window.Event("durationchange"));
      assert.deepEqual(
        element.querySelector('[data-testid="video-time-remaining"]')
          .textContent,
        "0:00",
      );
    });

    it("should not render an indicator for players without controls", () => {
      const element = document.createElement("streaming-video");
      element.setAttribute("src", "test.mp4");
      element.setAttribute("autoplay", "");
      element.setAttribute("loop", "");
      document.body.appendChild(element);
      assert.deepEqual(
        element.querySelector('[data-testid="video-time-remaining"]'),
        null,
      );
    });
  });

  describe("StreamingVideo - resume autoplay", () => {
    it("should resume a paused autoplay video", () => {
      const element = document.createElement("streaming-video");
      element.setAttribute("src", "test.m3u8");
      element.setAttribute("autoplay", "");
      document.body.appendChild(element);

      const video = element.querySelector("video");
      let playCalled = false;
      video.play = () => {
        playCalled = true;
        return Promise.resolve();
      };

      element.resumeAutoplay();
      assert(playCalled);
    });

    it("should not resume a video that is already playing", () => {
      const element = document.createElement("streaming-video");
      element.setAttribute("src", "test.m3u8");
      element.setAttribute("autoplay", "");
      document.body.appendChild(element);

      const video = element.querySelector("video");
      Object.defineProperty(video, "paused", { value: false });
      let playCalled = false;
      video.play = () => {
        playCalled = true;
        return Promise.resolve();
      };

      element.resumeAutoplay();
      assert(!playCalled);
    });

    it("should not resume a non-autoplay video", () => {
      const element = document.createElement("streaming-video");
      element.setAttribute("src", "test.m3u8");
      element.setAttribute("controls", "");
      document.body.appendChild(element);

      const video = element.querySelector("video");
      let playCalled = false;
      video.play = () => {
        playCalled = true;
        return Promise.resolve();
      };

      element.resumeAutoplay();
      assert(!playCalled);
    });
  });

  describe("StreamingVideo - page transition handling", () => {
    it("should pause video on page-transition event", () => {
      const element = document.createElement("streaming-video");
      element.setAttribute("src", "test.m3u8");
      document.body.appendChild(element);

      const video = element.querySelector("video");
      let pauseCalled = false;
      video.pause = () => {
        pauseCalled = true;
      };

      window.dispatchEvent(new Event("page-transition"));
      assert(pauseCalled);
    });

    it("should mute video on page-transition event", () => {
      const element = document.createElement("streaming-video");
      element.setAttribute("src", "test.m3u8");
      document.body.appendChild(element);

      const video = element.querySelector("video");
      video.muted = false;
      video.pause = () => {};

      window.dispatchEvent(new Event("page-transition"));
      assert(video.muted);
    });

    it("should stop listening for page-transition after disconnect", () => {
      const element = document.createElement("streaming-video");
      element.setAttribute("src", "test.m3u8");
      document.body.appendChild(element);

      const video = element.querySelector("video");
      let pauseCalled = false;
      video.pause = () => {
        pauseCalled = true;
      };

      element.remove();
      window.dispatchEvent(new Event("page-transition"));
      assert(!pauseCalled);
    });

    it("should listen for page-transition again after reconnect", () => {
      const element = document.createElement("streaming-video");
      element.setAttribute("src", "test.m3u8");
      document.body.appendChild(element);
      element.remove();
      document.body.appendChild(element);

      const video = element.querySelector("video");
      let pauseCalled = false;
      video.pause = () => {
        pauseCalled = true;
      };

      window.dispatchEvent(new Event("page-transition"));
      assert(pauseCalled);
    });
  });

  describe("StreamingVideo - reinitialization protection", () => {
    it("should not reinitialize when connectedCallback is called multiple times", () => {
      const element = document.createElement("streaming-video");
      element.setAttribute("src", "test.m3u8");
      document.body.appendChild(element);

      element.connectedCallback();

      const videos = element.querySelectorAll("video");
      assert.deepEqual(videos.length, 1);
    });
  });
});
