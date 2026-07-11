import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "/js/components/streaming-video.js";

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
