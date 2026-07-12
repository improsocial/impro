import { describe, it, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import "/js/components/animated-button.js";

describe("animated-button", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  // Disconnect the last test's buttons so their ripple/recently-clicked
  // timers are cleared and don't hold the (shared) process open
  after(() => {
    document.body.innerHTML = "";
  });

  function createWithContent(html = "<span>content</span>") {
    const element = document.createElement("animated-button");
    element.innerHTML = html;
    return element;
  }

  describe("AnimatedButton - rendering", () => {
    it("should render a button element wrapping projected children", () => {
      const element = createWithContent();
      document.body.appendChild(element);
      const button = element.querySelector("button");
      assert(button !== null);
    });

    it("should have animated-button class on the inner button", () => {
      const element = createWithContent();
      document.body.appendChild(element);
      const button = element.querySelector("button");
      assert(button.classList.contains("animated-button"));
    });

    it("should apply button-class onto the inner button", () => {
      const element = createWithContent();
      element.setAttribute("button-class", "post-action-button extra-class");
      document.body.appendChild(element);
      const button = element.querySelector("button");
      assert(button.classList.contains("post-action-button"));
      assert(button.classList.contains("extra-class"));
    });

    it("should not forward host class attribute onto the inner button", () => {
      const element = createWithContent();
      element.setAttribute("class", "host-only");
      document.body.appendChild(element);
      const button = element.querySelector("button");
      assert(!button.classList.contains("host-only"));
    });

    it("should project parent-supplied children into the inner button", () => {
      const element = createWithContent(
        '<div class="post-action-icon">icon</div>',
      );
      document.body.appendChild(element);
      const button = element.querySelector("button");
      assert(button.querySelector(".post-action-icon") !== null);
    });

    it("should forward testid to inner button", () => {
      const element = createWithContent();
      element.setAttribute("testid", "my-button");
      document.body.appendChild(element);
      const button = element.querySelector("button");
      assert.deepEqual(button.getAttribute("data-testid"), "my-button");
    });
  });

  describe("AnimatedButton - initial state", () => {
    it("should not be active by default", () => {
      const element = createWithContent();
      document.body.appendChild(element);
      assert.deepEqual(element.isActive, false);
    });

    it("should not have active class by default", () => {
      const element = createWithContent();
      document.body.appendChild(element);
      const button = element.querySelector("button");
      assert(!button.classList.contains("active"));
    });
  });

  describe("AnimatedButton - is-active attribute", () => {
    it("should be active when is-active attribute is set", () => {
      const element = createWithContent();
      element.setAttribute("is-active", "");
      document.body.appendChild(element);
      assert.deepEqual(element.isActive, true);
    });

    it("should apply active class when is-active is set", () => {
      const element = createWithContent();
      element.setAttribute("is-active", "");
      document.body.appendChild(element);
      const button = element.querySelector("button");
      assert(button.classList.contains("active"));
    });

    it("should update isActive when attribute changes", async () => {
      const element = createWithContent();
      document.body.appendChild(element);
      assert.deepEqual(element.isActive, false);

      element.setAttribute("is-active", "");
      await new Promise((resolve) => requestAnimationFrame(resolve));
      assert.deepEqual(element.isActive, true);
    });
  });

  describe("AnimatedButton - click handling", () => {
    it("should bubble native click event to ancestors", () => {
      const element = createWithContent();
      const container = document.createElement("div");
      container.appendChild(element);
      document.body.appendChild(container);

      let eventFired = false;
      container.addEventListener("click", () => {
        eventFired = true;
      });

      const button = element.querySelector("button");
      button.click();

      assert(eventFired);
    });

    it("should set _recentlyClicked to true after click", () => {
      const element = createWithContent();
      document.body.appendChild(element);

      const button = element.querySelector("button");
      button.click();
      assert.deepEqual(element._recentlyClicked, true);
    });
  });

  describe("AnimatedButton - animations", () => {
    it("should not be animating by default", () => {
      const element = createWithContent();
      document.body.appendChild(element);
      assert.deepEqual(element._isRippleAnimating, false);
    });

    it("should set animating state when triggerRippleAnimation is called", () => {
      const element = createWithContent();
      document.body.appendChild(element);
      element.triggerRippleAnimation();
      assert.deepEqual(element._isRippleAnimating, true);
    });

    it("should add animating class during animation", () => {
      const element = createWithContent();
      document.body.appendChild(element);
      element.triggerRippleAnimation();
      const button = element.querySelector("button");
      assert(button.classList.contains("animating"));
    });
  });

  describe("AnimatedButton - reinitialization protection", () => {
    it("should not duplicate inner button when connectedCallback is called multiple times", () => {
      const element = createWithContent();
      document.body.appendChild(element);

      element.connectedCallback();

      const buttons = element.querySelectorAll("button");
      assert.deepEqual(buttons.length, 1);
    });
  });
});
