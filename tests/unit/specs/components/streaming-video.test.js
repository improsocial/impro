import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import "/js/components/streaming-video.js";

const t = new TestSuite("StreamingVideo");

t.beforeEach(() => {
  document.body.innerHTML = "";
});

t.describe("StreamingVideo - rendering", (it) => {
  it("should render a video element", () => {
    const element = document.createElement("streaming-video");
    element.setAttribute("src", "test.m3u8");
    document.body.appendChild(element);
    const video = element.querySelector("video");
    assert(video !== null);
  });
});

t.describe("StreamingVideo - attributes", (it) => {
  it("should read src attribute", () => {
    const element = document.createElement("streaming-video");
    element.setAttribute("src", "test-video.m3u8");
    document.body.appendChild(element);
    assertEquals(element.src, "test-video.m3u8");
  });

  it("should read controls attribute", () => {
    const element = document.createElement("streaming-video");
    element.setAttribute("src", "test.m3u8");
    element.setAttribute("controls", "");
    document.body.appendChild(element);
    assertEquals(element.controls, true);
  });

  it("should read autoplay attribute", () => {
    const element = document.createElement("streaming-video");
    element.setAttribute("src", "test.m3u8");
    element.setAttribute("autoplay", "");
    document.body.appendChild(element);
    assertEquals(element.autoplay, true);
  });

  it("should read muted attribute", () => {
    const element = document.createElement("streaming-video");
    element.setAttribute("src", "test.m3u8");
    element.setAttribute("muted", "");
    document.body.appendChild(element);
    assertEquals(element.muted, true);
  });

  it("should read loop attribute", () => {
    const element = document.createElement("streaming-video");
    element.setAttribute("src", "test.m3u8");
    element.setAttribute("loop", "");
    document.body.appendChild(element);
    assertEquals(element.loop, true);
  });

  it("should read playsinline attribute", () => {
    const element = document.createElement("streaming-video");
    element.setAttribute("src", "test.m3u8");
    element.setAttribute("playsinline", "");
    document.body.appendChild(element);
    assertEquals(element.playsinline, true);
  });
});

t.describe("StreamingVideo - video element attributes", (it) => {
  it("should not render controls on the video when attribute is absent", () => {
    const element = document.createElement("streaming-video");
    element.setAttribute("src", "test.m3u8");
    document.body.appendChild(element);
    const video = element.querySelector("video");
    assertEquals(video.controls, false);
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
    assertEquals(video.getAttribute("aria-label"), "A funny gif");
  });
});

t.describe("StreamingVideo - muted state", (it) => {
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
    assertEquals(element.muted, false);
  });
});

t.describe("StreamingVideo - streaming state", (it) => {
  it("should not be streaming enabled initially", () => {
    const element = document.createElement("streaming-video");
    element.setAttribute("src", "test.m3u8");
    document.body.appendChild(element);
    assertEquals(element._streamingEnabled, false);
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
    assertEquals(element._streamingEnabled, true);

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

    assertEquals(loadSourceCalls, 1);

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
    assertEquals(source.src.endsWith("test-video.mp4"), true);
    assertEquals(source.type, "video/mp4");
  });

  it("should use the webm type for webm sources", async () => {
    const element = document.createElement("streaming-video");
    element.setAttribute("src", "test-video.webm");
    document.body.appendChild(element);

    await element.enableStreaming();

    const source = element.querySelector("video source");
    assertEquals(source.type, "video/webm");
  });

  it("should only attach a progressive source once", async () => {
    const element = document.createElement("streaming-video");
    element.setAttribute("src", "test-video.mp4");
    document.body.appendChild(element);

    await element.enableStreaming();
    await element.enableStreaming();

    const sources = element.querySelectorAll("video source");
    assertEquals(sources.length, 1);
  });
});

t.describe("StreamingVideo - resume autoplay", (it) => {
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

t.describe("StreamingVideo - page transition handling", (it) => {
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
});

t.describe("StreamingVideo - reinitialization protection", (it) => {
  it("should not reinitialize when connectedCallback is called multiple times", () => {
    const element = document.createElement("streaming-video");
    element.setAttribute("src", "test.m3u8");
    document.body.appendChild(element);

    element.connectedCallback();

    const videos = element.querySelectorAll("video");
    assertEquals(videos.length, 1);
  });
});

await t.run();
