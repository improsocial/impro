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

  it("should read height attribute", () => {
    const element = document.createElement("streaming-video");
    element.setAttribute("src", "test.m3u8");
    element.setAttribute("height", "480");
    document.body.appendChild(element);
    assertEquals(element.height, "480");
  });

  it("should read width attribute", () => {
    const element = document.createElement("streaming-video");
    element.setAttribute("src", "test.m3u8");
    element.setAttribute("width", "640");
    document.body.appendChild(element);
    assertEquals(element.width, "640");
  });

  it("should default height to empty string", () => {
    const element = document.createElement("streaming-video");
    element.setAttribute("src", "test.m3u8");
    document.body.appendChild(element);
    assertEquals(element.height, "");
  });

  it("should default width to empty string", () => {
    const element = document.createElement("streaming-video");
    element.setAttribute("src", "test.m3u8");
    document.body.appendChild(element);
    assertEquals(element.width, "");
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
