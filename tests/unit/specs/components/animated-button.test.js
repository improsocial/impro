import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import "/js/components/animated-button.js";

const t = new TestSuite("AnimatedButton");

t.beforeEach(() => {
  document.body.innerHTML = "";
});

function createWithContent(html = "<span>content</span>") {
  const element = document.createElement("animated-button");
  element.innerHTML = html;
  return element;
}

t.describe("AnimatedButton - rendering", (it) => {
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
    assertEquals(button.getAttribute("data-testid"), "my-button");
  });
});

t.describe("AnimatedButton - initial state", (it) => {
  it("should not be active by default", () => {
    const element = createWithContent();
    document.body.appendChild(element);
    assertEquals(element.isActive, false);
  });

  it("should not have active class by default", () => {
    const element = createWithContent();
    document.body.appendChild(element);
    const button = element.querySelector("button");
    assert(!button.classList.contains("active"));
  });
});

t.describe("AnimatedButton - is-active attribute", (it) => {
  it("should be active when is-active attribute is set", () => {
    const element = createWithContent();
    element.setAttribute("is-active", "");
    document.body.appendChild(element);
    assertEquals(element.isActive, true);
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
    assertEquals(element.isActive, false);

    element.setAttribute("is-active", "");
    await new Promise((resolve) => requestAnimationFrame(resolve));
    assertEquals(element.isActive, true);
  });
});

t.describe("AnimatedButton - click handling", (it) => {
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
    assertEquals(element._recentlyClicked, true);
  });
});

t.describe("AnimatedButton - animations", (it) => {
  it("should not be animating by default", () => {
    const element = createWithContent();
    document.body.appendChild(element);
    assertEquals(element._isRippleAnimating, false);
  });

  it("should set animating state when triggerRippleAnimation is called", () => {
    const element = createWithContent();
    document.body.appendChild(element);
    element.triggerRippleAnimation();
    assertEquals(element._isRippleAnimating, true);
  });

  it("should add animating class during animation", () => {
    const element = createWithContent();
    document.body.appendChild(element);
    element.triggerRippleAnimation();
    const button = element.querySelector("button");
    assert(button.classList.contains("animating"));
  });
});

t.describe("AnimatedButton - reinitialization protection", (it) => {
  it("should not duplicate inner button when connectedCallback is called multiple times", () => {
    const element = createWithContent();
    document.body.appendChild(element);

    element.connectedCallback();

    const buttons = element.querySelectorAll("button");
    assertEquals(buttons.length, 1);
  });
});

await t.run();
