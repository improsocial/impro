import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import "/js/components/youtube-embed.js";

const t = new TestSuite("YoutubeEmbed");

t.beforeEach(() => {
  document.body.innerHTML = "";
});

function createEmbed({ start = "0", thumb = "" } = {}) {
  const element = document.createElement("youtube-embed");
  element.setAttribute("video-id", "dQw4w9WgXcQ");
  element.setAttribute("start", start);
  element.setAttribute("thumb", thumb);
  element.setAttribute("video-title", "Test video");
  document.body.appendChild(element);
  return element;
}

t.describe("YoutubeEmbed - preview state", (it) => {
  it("renders a play button and no iframe", () => {
    const element = createEmbed();
    assert(
      element.querySelector("[data-testid='youtube-embed-play']") !== null,
    );
    assertEquals(element.querySelector("iframe"), null);
    assertEquals(element.dataset.teststate, "preview");
  });

  it("renders the thumbnail when provided", () => {
    const element = createEmbed({ thumb: "https://example.com/thumb.jpg" });
    const thumb = element.querySelector(".youtube-embed-thumb");
    assert(thumb !== null);
    assertEquals(thumb.getAttribute("src"), "https://example.com/thumb.jpg");
  });

  it("renders no thumbnail image when thumb is empty", () => {
    const element = createEmbed();
    assertEquals(element.querySelector(".youtube-embed-thumb"), null);
    assert(
      element.querySelector("[data-testid='youtube-embed-play']") !== null,
    );
  });

  it("labels the play button with the video title", () => {
    const element = createEmbed();
    const button = element.querySelector("[data-testid='youtube-embed-play']");
    assertEquals(
      button.getAttribute("aria-label"),
      "Play YouTube video: Test video",
    );
  });
});

t.describe("YoutubeEmbed - playing state", (it) => {
  it("swaps in the player iframe when the play button is clicked", () => {
    const element = createEmbed({ start: "32" });
    element.querySelector("[data-testid='youtube-embed-play']").click();
    const iframe = element.querySelector(
      "[data-testid='youtube-embed-iframe']",
    );
    assert(iframe !== null);
    assertEquals(
      iframe.getAttribute("src"),
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&start=32&rel=0&playsinline=1",
    );
    assertEquals(element.dataset.teststate, "playing");
    assertEquals(
      element.querySelector("[data-testid='youtube-embed-play']"),
      null,
    );
  });

  it("moves focus to the iframe when the play button is clicked", () => {
    const element = createEmbed();
    element.querySelector("[data-testid='youtube-embed-play']").click();
    assertEquals(
      document.activeElement,
      element.querySelector("[data-testid='youtube-embed-iframe']"),
    );
  });

  it("falls back to start=0 for a non-numeric start attribute", () => {
    const element = createEmbed({ start: "1m30s" });
    element.querySelector("[data-testid='youtube-embed-play']").click();
    const iframe = element.querySelector(
      "[data-testid='youtube-embed-iframe']",
    );
    assert(iframe.getAttribute("src").includes("start=0"));
  });
});

await t.run();
