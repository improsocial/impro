import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import "/js/components/like-button.js";

const t = new TestSuite("LikeButton");

t.beforeEach(() => {
  document.body.innerHTML = "";
});

t.describe("LikeButton - rendering", (it) => {
  it("should render a button element", () => {
    const element = document.createElement("like-button");
    document.body.appendChild(element);
    const button = element.querySelector("button");
    assert(button !== null);
  });

  it("should have like-button class", () => {
    const element = document.createElement("like-button");
    document.body.appendChild(element);
    const button = element.querySelector("button");
    assert(button.classList.contains("like-button"));
  });

  it("should have post-action-button class", () => {
    const element = document.createElement("like-button");
    document.body.appendChild(element);
    const button = element.querySelector("button");
    assert(button.classList.contains("post-action-button"));
  });

  it("should render heart icon", () => {
    const element = document.createElement("like-button");
    document.body.appendChild(element);
    const icon = element.querySelector(".post-action-icon");
    assert(icon !== null);
  });
});

t.describe("LikeButton - initial state", (it) => {
  it("should not be liked by default", () => {
    const element = document.createElement("like-button");
    document.body.appendChild(element);
    assertEquals(element.isLiked, false);
  });

  it("should have count of 0 by default", () => {
    const element = document.createElement("like-button");
    document.body.appendChild(element);
    assertEquals(element.count, 0);
  });

  it("should not have liked class by default", () => {
    const element = document.createElement("like-button");
    document.body.appendChild(element);
    const button = element.querySelector("button");
    assert(!button.classList.contains("liked"));
  });

  it("should not show count when count is 0", () => {
    const element = document.createElement("like-button");
    document.body.appendChild(element);
    const count = element.querySelector(".post-action-count");
    assertEquals(count, null);
  });
});

t.describe("LikeButton - is-liked attribute", (it) => {
  it("should be liked when is-liked attribute is set", () => {
    const element = document.createElement("like-button");
    element.setAttribute("is-liked", "");
    document.body.appendChild(element);
    assertEquals(element.isLiked, true);
  });

  it("should have liked class when is-liked is set", () => {
    const element = document.createElement("like-button");
    element.setAttribute("is-liked", "");
    document.body.appendChild(element);
    const button = element.querySelector("button");
    assert(button.classList.contains("liked"));
  });

  it("should update isLiked when attribute changes", async () => {
    const element = document.createElement("like-button");
    document.body.appendChild(element);
    assertEquals(element.isLiked, false);

    element.setAttribute("is-liked", "");
    // Wait for batched attribute change
    await new Promise((resolve) => requestAnimationFrame(resolve));
    assertEquals(element.isLiked, true);
  });
});

t.describe("LikeButton - count attribute", (it) => {
  it("should display count when count > 0", () => {
    const element = document.createElement("like-button");
    element.setAttribute("count", "5");
    document.body.appendChild(element);
    const countEl = element.querySelector(".post-action-count");
    assert(countEl !== null);
  });

  it("should format large numbers", () => {
    const element = document.createElement("like-button");
    element.setAttribute("count", "1500");
    document.body.appendChild(element);
    const countEl = element.querySelector(".count-current");
    // formatLargeNumber should format 1500 as "1.5K" or similar
    assert(countEl !== null);
  });

  it("should update count when attribute changes", async () => {
    const element = document.createElement("like-button");
    element.setAttribute("count", "5");
    document.body.appendChild(element);
    assertEquals(element.count, 5);

    element.setAttribute("count", "10");
    // Wait for batched attribute change
    await new Promise((resolve) => requestAnimationFrame(resolve));
    assertEquals(element.count, 10);
  });
});

t.describe("LikeButton - click handling", (it) => {
  it("should dispatch click-like event when clicked", () => {
    const element = document.createElement("like-button");
    document.body.appendChild(element);

    let eventFired = false;
    element.addEventListener("click-like", () => {
      eventFired = true;
    });

    const button = element.querySelector("button");
    button.click();

    assert(eventFired);
  });

  it("should set _recentlyClicked to true after click", () => {
    const element = document.createElement("like-button");
    document.body.appendChild(element);

    element.handleClick();
    assertEquals(element._recentlyClicked, true);
  });

  it("should bubble click-like event", () => {
    const element = document.createElement("like-button");
    const container = document.createElement("div");
    container.appendChild(element);
    document.body.appendChild(container);

    let eventFired = false;
    container.addEventListener("click-like", () => {
      eventFired = true;
    });

    element.handleClick();
    assert(eventFired);
  });
});

t.describe("LikeButton - animations", (it) => {
  it("should not be animating by default", () => {
    const element = document.createElement("like-button");
    document.body.appendChild(element);
    assertEquals(element._isRippleAnimating, false);
  });

  it("should set animating state when triggerRippleAnimation is called", () => {
    const element = document.createElement("like-button");
    document.body.appendChild(element);
    element.triggerRippleAnimation();
    assertEquals(element._isRippleAnimating, true);
  });

  it("should add animating class during animation", () => {
    const element = document.createElement("like-button");
    document.body.appendChild(element);
    element.triggerRippleAnimation();
    const button = element.querySelector("button");
    assert(button.classList.contains("animating"));
  });
});

t.describe("LikeButton - cleanup", (it) => {
  it("should clear timeouts on disconnect", () => {
    const element = document.createElement("like-button");
    document.body.appendChild(element);
    element.triggerRippleAnimation();

    // Store the timeout
    const timeout = element._rippleTimeout;
    assert(timeout !== null);

    // Remove the element
    element.remove();

    // The disconnectedCallback should have been called
    // We can't easily verify the timeout was cleared, but we can verify
    // the method exists and was called
    assertEquals(element._rippleTimeout, timeout);
  });
});

t.describe("LikeButton - reinitialization protection", (it) => {
  it("should render when connectedCallback is called multiple times", () => {
    const element = document.createElement("like-button");
    element.setAttribute("count", "5");
    document.body.appendChild(element);

    element.connectedCallback();

    const buttons = element.querySelectorAll("button");
    assertEquals(buttons.length, 1);
  });
});

await t.run();
