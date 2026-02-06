import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import "/js/components/gif-player.js";

const t = new TestSuite("GifPlayer");

t.beforeEach(() => {
  document.body.innerHTML = "";
});

t.describe("GifPlayer - rendering", (it) => {
  it("should render a video element", () => {
    const element = document.createElement("gif-player");
    element.setAttribute("src", "test.mp4");
    document.body.appendChild(element);
    const video = element.querySelector("video");
    assert(video !== null);
  });

  it("should set video to muted by default", () => {
    const element = document.createElement("gif-player");
    element.setAttribute("src", "test.mp4");
    document.body.appendChild(element);
    const video = element.querySelector("video");
    // The muted attribute is set in the template
    assert(video.hasAttribute("muted"));
  });

  it("should set video to loop", () => {
    const element = document.createElement("gif-player");
    element.setAttribute("src", "test.mp4");
    document.body.appendChild(element);
    const video = element.querySelector("video");
    assert(video.loop);
  });

  it("should set video to autoplay", () => {
    const element = document.createElement("gif-player");
    element.setAttribute("src", "test.mp4");
    document.body.appendChild(element);
    const video = element.querySelector("video");
    assert(video.autoplay);
  });

  it("should set playsinline attribute", () => {
    const element = document.createElement("gif-player");
    element.setAttribute("src", "test.mp4");
    document.body.appendChild(element);
    const video = element.querySelector("video");
    assert(video.playsInline);
  });
});

t.describe("GifPlayer - attributes", (it) => {
  it("should read src attribute", () => {
    const element = document.createElement("gif-player");
    element.setAttribute("src", "test-video.mp4");
    document.body.appendChild(element);
    assertEquals(element.src, "test-video.mp4");
  });

  it("should read alt attribute and set aria-label", () => {
    const element = document.createElement("gif-player");
    element.setAttribute("src", "test.mp4");
    element.setAttribute("alt", "A funny gif");
    document.body.appendChild(element);
    const video = element.querySelector("video");
    assertEquals(video.getAttribute("aria-label"), "A funny gif");
  });
});

t.describe("GifPlayer - loadGif", (it) => {
  it("should add source element when loadGif is called", async () => {
    const element = document.createElement("gif-player");
    element.setAttribute("src", "test-video.mp4");
    document.body.appendChild(element);

    await element.loadGif();

    const source = element.querySelector("video source");
    assert(source !== null);
    assertEquals(source.src.endsWith("test-video.mp4"), true);
    assertEquals(source.type, "video/mp4");
  });

  it("should only load gif once", async () => {
    const element = document.createElement("gif-player");
    element.setAttribute("src", "test-video.mp4");
    document.body.appendChild(element);

    await element.loadGif();
    await element.loadGif();

    const sources = element.querySelectorAll("video source");
    assertEquals(sources.length, 1);
  });

  it("should set _gifLoaded to true after loading", async () => {
    const element = document.createElement("gif-player");
    element.setAttribute("src", "test-video.mp4");
    document.body.appendChild(element);

    assertEquals(element._gifLoaded, false);
    await element.loadGif();
    assertEquals(element._gifLoaded, true);
  });
});

t.describe("GifPlayer - reinitialization protection", (it) => {
  it("should not reinitialize when connectedCallback is called multiple times", () => {
    const element = document.createElement("gif-player");
    element.setAttribute("src", "test.mp4");
    document.body.appendChild(element);

    element.connectedCallback();

    const videos = element.querySelectorAll("video");
    assertEquals(videos.length, 1);
  });
});

await t.run();
