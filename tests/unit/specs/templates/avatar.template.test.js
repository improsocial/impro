import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { cdnImageUrl } from "/js/dataHelpers.js";
import { post } from "../../testData.js";
import { render } from "/js/lib/lit-html.js";

describe("avatarTemplate", () => {
  it("should render avatar container", () => {
    const result = avatarTemplate({ author: post.author });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='avatar']") !== null);
  });

  it("should render avatar image with author info", () => {
    const result = avatarTemplate({ author: post.author });
    const container = document.createElement("div");
    render(result, container);
    const img = container.querySelector("[data-testid='avatar-image']");
    assert(img !== null);
    assert(img.getAttribute("src").includes(post.author.did));
  });

  it("should render fallback avatar when no avatar URL", () => {
    const author = { ...post.author, avatar: null };
    const result = avatarTemplate({ author });
    const container = document.createElement("div");
    render(result, container);
    const img = container.querySelector("[data-testid='avatar-image']");
    assert(img !== null);
    assert(img.getAttribute("src").includes("avatar-fallback.svg"));
  });

  it("should render as link by default", () => {
    const result = avatarTemplate({ author: post.author });
    const container = document.createElement("div");
    render(result, container);
    const link = container.querySelector("a.avatar-link");
    assert(link !== null);
  });

  it("should render as lightbox when clickAction is lightbox", () => {
    const result = avatarTemplate({
      author: post.author,
      clickAction: "lightbox",
    });
    const container = document.createElement("div");
    render(result, container);
    const lightbox = container.querySelector("lightbox-image-group");
    assert(lightbox !== null);
  });

  it("should set image-shape to circle on lightbox wrapper", () => {
    const result = avatarTemplate({
      author: post.author,
      clickAction: "lightbox",
    });
    const container = document.createElement("div");
    render(result, container);
    const lightbox = container.querySelector("lightbox-image-group");
    assert.deepEqual(lightbox.getAttribute("image-shape"), "circle");
  });

  it("should render without wrapper when clickAction is none", () => {
    const result = avatarTemplate({
      author: post.author,
      clickAction: "none",
    });
    const container = document.createElement("div");
    render(result, container);
    assert.deepEqual(container.querySelector("a.avatar-link"), null);
    assert.deepEqual(container.querySelector("lightbox-image-group"), null);
  });

  it("should use lazy loading when lazyLoad is true", () => {
    const result = avatarTemplate({
      author: post.author,
      lazyLoad: true,
    });
    const container = document.createElement("div");
    render(result, container);
    const img = container.querySelector("[data-testid='avatar-image']");
    assert.deepEqual(img.getAttribute("loading"), "lazy");
  });

  it("should use eager loading by default", () => {
    const result = avatarTemplate({ author: post.author });
    const container = document.createElement("div");
    render(result, container);
    const img = container.querySelector("[data-testid='avatar-image']");
    assert.deepEqual(img.getAttribute("loading"), "eager");
  });

  it("should set data-lightbox-src to full-size avatar URL", () => {
    const result = avatarTemplate({ author: post.author });
    const container = document.createElement("div");
    render(result, container);
    const img = container.querySelector("[data-testid='avatar-image']");
    assert.deepEqual(
      img.getAttribute("data-lightbox-src"),
      cdnImageUrl(post.author.avatar),
    );
  });

  it("should use thumbnail URL for src and full-size URL for data-lightbox-src", () => {
    const result = avatarTemplate({ author: post.author });
    const container = document.createElement("div");
    render(result, container);
    const img = container.querySelector("[data-testid='avatar-image']");
    assert(img.getAttribute("src").includes("avatar_thumbnail"));
    assert(!img.getAttribute("data-lightbox-src").includes("avatar_thumbnail"));
  });

  it("should use fallback for both src and data-lightbox-src when no avatar URL", () => {
    const author = { ...post.author, avatar: null };
    const result = avatarTemplate({ author });
    const container = document.createElement("div");
    render(result, container);
    const img = container.querySelector("[data-testid='avatar-image']");
    assert(img.getAttribute("src").includes("avatar-fallback.svg"));
    assert(
      img.getAttribute("data-lightbox-src").includes("avatar-fallback.svg"),
    );
  });
});

describe("avatarTemplate - live status", () => {
  const liveAuthor = { ...post.author, isLive: true };

  it("should render live ring class and badge for a live author", () => {
    const result = avatarTemplate({ author: liveAuthor });
    const container = document.createElement("div");
    render(result, container);
    const frame = container.querySelector(".avatar-image-frame");
    assert(frame.classList.contains("avatar-live"));
    assert(container.querySelector("[data-testid='live-badge']") !== null);
  });

  it("should render no ring class or badge for a non-live author", () => {
    const result = avatarTemplate({ author: post.author });
    const container = document.createElement("div");
    render(result, container);
    const frame = container.querySelector(".avatar-image-frame");
    assert(!frame.classList.contains("avatar-live"));
    assert.deepEqual(
      container.querySelector("[data-testid='live-badge']"),
      null,
    );
  });

  it("should hide the badge but keep the ring when showLiveBadge is false", () => {
    const result = avatarTemplate({ author: liveAuthor, showLiveBadge: false });
    const container = document.createElement("div");
    render(result, container);
    const frame = container.querySelector(".avatar-image-frame");
    assert(frame.classList.contains("avatar-live"));
    assert.deepEqual(
      container.querySelector("[data-testid='live-badge']"),
      null,
    );
  });

  it("should render no ring or badge when showLiveStatus is false", () => {
    const result = avatarTemplate({
      author: liveAuthor,
      showLiveStatus: false,
    });
    const container = document.createElement("div");
    render(result, container);
    const frame = container.querySelector(".avatar-image-frame");
    assert(!frame.classList.contains("avatar-live"));
    assert.deepEqual(
      container.querySelector("[data-testid='live-badge']"),
      null,
    );
  });

  it("should dispatch live-avatar:click instead of navigating on touch devices", () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = () => ({
      matches: true,
      addEventListener: () => {},
      removeEventListener: () => {},
    });
    try {
      const container = document.createElement("div");
      render(avatarTemplate({ author: liveAuthor }), container);
      let detail = null;
      container.addEventListener("live-avatar:click", (event) => {
        detail = event.detail;
      });
      const clickEvent = new window.MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      });
      container.querySelector("a.avatar-link").dispatchEvent(clickEvent);
      assert(clickEvent.defaultPrevented);
      assert.equal(detail.did, liveAuthor.did);
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it("should keep link navigation on touch devices when clickAction is link", () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = () => ({
      matches: true,
      addEventListener: () => {},
      removeEventListener: () => {},
    });
    try {
      const container = document.createElement("div");
      render(
        avatarTemplate({ author: liveAuthor, clickAction: "link" }),
        container,
      );
      let dispatched = false;
      let templatePrevented = null;
      container.addEventListener("live-avatar:click", () => {
        dispatched = true;
      });
      container.addEventListener("click", (event) => {
        templatePrevented = event.defaultPrevented;
        event.preventDefault();
      });
      const clickEvent = new window.MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      });
      container.querySelector("a.avatar-link").dispatchEvent(clickEvent);
      assert.equal(templatePrevented, false);
      assert.equal(dispatched, false);
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it("should keep link navigation for live avatars on non-touch devices", () => {
    const container = document.createElement("div");
    render(avatarTemplate({ author: liveAuthor }), container);
    let dispatched = false;
    let templatePrevented = null;
    container.addEventListener("live-avatar:click", () => {
      dispatched = true;
    });
    container.addEventListener("click", (event) => {
      templatePrevented = event.defaultPrevented;
      event.preventDefault();
    });
    const clickEvent = new window.MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    container.querySelector("a.avatar-link").dispatchEvent(clickEvent);
    assert.equal(templatePrevented, false);
    assert.equal(dispatched, false);
  });

  it("should render a button dispatching live-avatar:click when clickAction is live", () => {
    const result = avatarTemplate({
      author: liveAuthor,
      clickAction: "live",
    });
    const container = document.createElement("div");
    render(result, container);
    let detail = null;
    container.addEventListener("live-avatar:click", (event) => {
      detail = event.detail;
    });
    const button = container.querySelector(
      "[data-testid='avatar-live-button']",
    );
    assert(button !== null);
    button.click();
    assert.equal(detail.did, liveAuthor.did);
  });
});

describe("avatarTemplate - labeler profiles", () => {
  it("should render avatar for labeler profile with labeler class", () => {
    const labelerAuthor = {
      ...post.author,
      associated: { labeler: true },
    };
    const result = avatarTemplate({ author: labelerAuthor });
    const container = document.createElement("div");
    render(result, container);
    const img = container.querySelector("[data-testid='avatar-image']");
    assert(img.classList.contains("labeler-avatar"));
  });

  it("should render avatar for non-labeler profile without labeler class", () => {
    const normalAuthor = {
      ...post.author,
      associated: { labeler: false },
    };
    const result = avatarTemplate({ author: normalAuthor });
    const container = document.createElement("div");
    render(result, container);
    const img = container.querySelector("[data-testid='avatar-image']");
    assert(!img.classList.contains("labeler-avatar"));
  });

  it("should render avatar when associated is undefined", () => {
    const authorWithoutAssociated = { ...post.author };
    delete authorWithoutAssociated.associated;
    const result = avatarTemplate({ author: authorWithoutAssociated });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='avatar-image']") !== null);
  });

  it("should use labeler fallback avatar for labeler without avatar URL", () => {
    const labelerAuthor = {
      ...post.author,
      avatar: null,
      associated: { labeler: true },
    };
    const result = avatarTemplate({ author: labelerAuthor });
    const container = document.createElement("div");
    render(result, container);
    const img = container.querySelector("[data-testid='avatar-image']");
    assert(img.getAttribute("src").includes("labeler-avatar-fallback.svg"));
  });

  it("should use regular fallback avatar for non-labeler without avatar URL", () => {
    const normalAuthor = {
      ...post.author,
      avatar: null,
      associated: { labeler: false },
    };
    const result = avatarTemplate({ author: normalAuthor });
    const container = document.createElement("div");
    render(result, container);
    const img = container.querySelector("[data-testid='avatar-image']");
    assert(img.getAttribute("src").includes("avatar-fallback.svg"));
    assert(!img.getAttribute("src").includes("labeler"));
  });
});
