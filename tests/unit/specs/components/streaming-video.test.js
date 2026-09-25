import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { updateActiveVideo } from "/js/components/streaming-video.js";

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

    it("should play only the most visible video", async () => {
      const first = createCandidate();
      const second = createCandidate();
      first.placeAt(-80);
      second.placeAt(300);
      updateActiveVideo();
      await flush();
      assert.deepEqual(first.calls.play, 0);
      assert.deepEqual(second.calls.play, 1);
    });

    it("should not play a video that is less than half visible", async () => {
      const only = createCandidate();
      only.placeAt(-120);
      updateActiveVideo();
      await flush();
      assert.deepEqual(only.calls.play, 0);
    });

    it("should prefer the topmost video on a visibility tie", async () => {
      const lower = createCandidate();
      const upper = createCandidate();
      lower.placeAt(400);
      upper.placeAt(50);
      updateActiveVideo();
      await flush();
      assert.deepEqual(lower.calls.play, 0);
      assert.deepEqual(upper.calls.play, 1);
    });

    it("should pause the active video when another becomes more visible", async () => {
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

    it("should pause the active video when it scrolls mostly out of view", async () => {
      const only = createCandidate();
      only.placeAt(0);
      updateActiveVideo();
      await flush();
      only.placeAt(-160);
      updateActiveVideo();
      assert.deepEqual(only.calls.pause, 1);
    });

    it("should pause the active video when the user plays another one", async () => {
      const first = createCandidate();
      const second = createCandidate();
      first.placeAt(0);
      second.placeAt(300);
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
  });

  describe("StreamingVideo - shared mute preference", () => {
    function createVideo(attributes) {
      const element = document.createElement("streaming-video");
      element.setAttribute("src", "test.mp4");
      element.setAttribute("muted", "");
      element.setAttribute("autoplay", "");
      for (const attribute of attributes) {
        element.setAttribute(attribute, "");
      }
      document.body.appendChild(element);
      return element.querySelector("video");
    }

    // JSDOM fires volumechange synchronously on assignment (no event when
    // the value is unchanged, so videos start muted before re-muting)
    function setMutedByUser(video, muted) {
      video.muted = muted;
    }

    function reMuteByUser(video) {
      setMutedByUser(video, false);
      setMutedByUser(video, true);
    }

    afterEach(() => {
      reMuteByUser(createVideo(["controls"]));
    });

    it("should start later controlled videos unmuted after the user unmutes one", () => {
      setMutedByUser(createVideo(["controls"]), false);
      const next = createVideo(["controls"]);
      assert(next.muted);
      next.dispatchEvent(new window.Event("play"));
      assert.deepEqual(next.muted, false);
    });

    it("should start later videos muted again after the user re-mutes", () => {
      setMutedByUser(createVideo(["controls"]), false);
      reMuteByUser(createVideo(["controls"]));
      const next = createVideo(["controls"]);
      next.dispatchEvent(new window.Event("play"));
      assert(next.muted);
    });

    it("should not unmute players without controls", () => {
      setMutedByUser(createVideo(["controls"]), false);
      const gif = createVideo([]);
      gif.dispatchEvent(new window.Event("play"));
      assert(gif.muted);
    });

    it("should ignore volume changes from players without controls", () => {
      setMutedByUser(createVideo([]), false);
      const next = createVideo(["controls"]);
      next.dispatchEvent(new window.Event("play"));
      assert(next.muted);
    });

    it("should not treat the navigation mute as a user preference", () => {
      const video = createVideo(["controls"]);
      setMutedByUser(video, false);
      video.pause = () => {};
      window.dispatchEvent(new Event("page-transition"));
      assert(video.muted);
      const next = createVideo(["controls"]);
      next.dispatchEvent(new window.Event("play"));
      assert.deepEqual(next.muted, false);
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
    it("should not be streaming enabled initially", () => {
      const element = document.createElement("streaming-video");
      element.setAttribute("src", "test.m3u8");
      document.body.appendChild(element);
      assert.deepEqual(element._streamingEnabled, false);
    });

    it("should set _streamingEnabled after enableStreaming is called", async () => {
      const element = document.createElement("streaming-video");
      element.setAttribute("src", "test.m3u8");
      document.body.appendChild(element);

      // Mock Hls
      window.Hls = class {
        loadSource() {}
        attachMedia() {}
      };

      await element.enableStreaming();
      assert.deepEqual(element._streamingEnabled, true);

      // Clean up
      delete window.Hls;
    });

    it("should only enable streaming once", async () => {
      const element = document.createElement("streaming-video");
      element.setAttribute("src", "test.m3u8");
      document.body.appendChild(element);

      let loadSourceCalls = 0;
      window.Hls = class {
        loadSource() {
          loadSourceCalls++;
        }
        attachMedia() {}
      };

      await element.enableStreaming();
      await element.enableStreaming();

      assert.deepEqual(loadSourceCalls, 1);

      // Clean up
      delete window.Hls;
    });

    it("should append a source element for mp4 sources", async () => {
      const element = document.createElement("streaming-video");
      element.setAttribute("src", "test-video.mp4");
      document.body.appendChild(element);

      await element.enableStreaming();

      const source = element.querySelector("video source");
      assert(source !== null);
      assert.deepEqual(source.src.endsWith("test-video.mp4"), true);
      assert.deepEqual(source.type, "video/mp4");
    });

    it("should use the webm type for webm sources", async () => {
      const element = document.createElement("streaming-video");
      element.setAttribute("src", "test-video.webm");
      document.body.appendChild(element);

      await element.enableStreaming();

      const source = element.querySelector("video source");
      assert.deepEqual(source.type, "video/webm");
    });

    it("should only attach a progressive source once", async () => {
      const element = document.createElement("streaming-video");
      element.setAttribute("src", "test-video.mp4");
      document.body.appendChild(element);

      await element.enableStreaming();
      await element.enableStreaming();

      const sources = element.querySelectorAll("video source");
      assert.deepEqual(sources.length, 1);
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
