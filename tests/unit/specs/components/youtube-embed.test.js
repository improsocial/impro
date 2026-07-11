import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import "/js/components/youtube-embed.js";

const t = new TestSuite("YoutubeEmbed");

t.beforeEach(() => {
  document.body.innerHTML = "";
});

function createEmbed({
  start = "0",
  thumb = "",
  aspectRatio = String(9 / 16),
} = {}) {
  const element = document.createElement("youtube-embed");
  element.setAttribute("video-id", "dQw4w9WgXcQ");
  element.setAttribute("start", start);
  element.setAttribute("thumb", thumb);
  element.setAttribute("video-title", "Test video");
  element.setAttribute("url", "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  element.setAttribute("description", "Test description");
  if (aspectRatio !== null) {
    element.setAttribute("aspect-ratio", aspectRatio);
  }
  document.body.appendChild(element);
  return element;
}

function getCardLink(element) {
  return element.querySelector("[data-testid='external-link'] a");
}

t.describe("YoutubeEmbed - preview state", (it) => {
  it("renders an external link card and no iframe", () => {
    const element = createEmbed();
    assert(element.querySelector("[data-testid='external-link']") !== null);
    assertEquals(element.querySelector("iframe"), null);
    assertEquals(element.dataset.teststate, "preview");
  });

  it("links the card to the original video URL", () => {
    const element = createEmbed();
    assertEquals(
      getCardLink(element).getAttribute("href"),
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
  });

  it("labels the card link with the video title", () => {
    const element = createEmbed();
    assertEquals(
      getCardLink(element).getAttribute("aria-label"),
      "Play YouTube video: Test video",
    );
  });

  it("renders the title, description, and domain", () => {
    const element = createEmbed();
    assertEquals(
      element
        .querySelector("[data-testid='external-link-title']")
        .textContent.trim(),
      "Test video",
    );
    assertEquals(
      element
        .querySelector("[data-testid='external-link-description']")
        .textContent.trim(),
      "Test description",
    );
    assertEquals(
      element
        .querySelector("[data-testid='external-link-domain']")
        .textContent.trim(),
      "www.youtube.com",
    );
  });

  it("renders the thumbnail with a play icon when provided", () => {
    const element = createEmbed({ thumb: "https://example.com/thumb.jpg" });
    const thumb = element.querySelector(".external-link-image");
    assert(thumb !== null);
    assertEquals(thumb.getAttribute("src"), "https://example.com/thumb.jpg");
    assert(element.querySelector(".play-icon") !== null);
  });

  it("renders a play icon placeholder instead of an image when thumb is empty", () => {
    const element = createEmbed();
    assertEquals(element.querySelector(".external-link-image"), null);
    assert(
      element.querySelector(".external-link-video-placeholder .play-icon") !==
        null,
    );
  });
});

t.describe("YoutubeEmbed - playing state", (it) => {
  it("swaps in the player iframe when the card is clicked", () => {
    const element = createEmbed({ start: "32" });
    getCardLink(element).click();
    const iframe = element.querySelector(
      "[data-testid='youtube-embed-iframe']",
    );
    assert(iframe !== null);
    assertEquals(
      iframe.getAttribute("src"),
      `https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&start=32&rel=0&playsinline=1&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`,
    );
    assertEquals(element.dataset.teststate, "playing");
    assert(element.classList.contains("is-playing"));
    assertEquals(element.style.aspectRatio, String(9 / 16));
    assertEquals(element.querySelector("[data-testid='external-link']"), null);
  });

  it("applies no aspect ratio in the preview state", () => {
    const element = createEmbed();
    assertEquals(element.style.aspectRatio, "");
  });

  it("falls back to a 16:9 aspect ratio when the attribute is missing", () => {
    const element = createEmbed({ aspectRatio: null });
    getCardLink(element).click();
    assertEquals(element.style.aspectRatio, String(16 / 9));
  });

  it("does not play on a modified click so the link can open normally", () => {
    const element = createEmbed();
    const event = new window.MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      metaKey: true,
    });
    getCardLink(element).dispatchEvent(event);
    assertEquals(event.defaultPrevented, false);
    assertEquals(element.dataset.teststate, "preview");
    assertEquals(element.querySelector("iframe"), null);
  });

  it("moves focus to the iframe when the card is clicked", () => {
    const element = createEmbed();
    getCardLink(element).click();
    assertEquals(
      document.activeElement,
      element.querySelector("[data-testid='youtube-embed-iframe']"),
    );
  });

  it("falls back to start=0 for a non-numeric start attribute", () => {
    const element = createEmbed({ start: "1m30s" });
    getCardLink(element).click();
    const iframe = element.querySelector(
      "[data-testid='youtube-embed-iframe']",
    );
    assert(iframe.getAttribute("src").includes("start=0"));
  });
});

t.describe("YoutubeEmbed - page transitions", (it) => {
  function capturePostedMessages(element) {
    const messages = [];
    const iframe = element.querySelector("iframe");
    iframe.contentWindow.postMessage = (message, targetOrigin) => {
      messages.push({ message, targetOrigin });
    };
    return messages;
  }

  it("sends a pauseVideo command to the player on page-transition", () => {
    const element = createEmbed();
    getCardLink(element).click();
    const messages = capturePostedMessages(element);
    window.dispatchEvent(new window.CustomEvent("page-transition"));
    assertEquals(messages.length, 1);
    assertEquals(
      messages[0].message,
      JSON.stringify({ event: "command", func: "pauseVideo", args: [] }),
    );
    assertEquals(messages[0].targetOrigin, "https://www.youtube-nocookie.com");
  });

  it("does nothing on page-transition while in the preview state", () => {
    const element = createEmbed();
    window.dispatchEvent(new window.CustomEvent("page-transition"));
    assertEquals(element.dataset.teststate, "preview");
  });

  it("stops listening for page-transition after being removed", () => {
    const element = createEmbed();
    getCardLink(element).click();
    const messages = capturePostedMessages(element);
    element.remove();
    window.dispatchEvent(new window.CustomEvent("page-transition"));
    assertEquals(messages.length, 0);
  });
});

await t.run();
