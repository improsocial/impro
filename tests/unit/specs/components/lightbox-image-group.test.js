import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import "/js/components/lightbox-image-group.js";

const t = new TestSuite("LightboxImageGroup");

t.beforeEach(() => {
  document.body.innerHTML = "";
});

t.describe("LightboxDialog - rendering", (it) => {
  it("should render empty when not open", () => {
    const element = document.createElement("lightbox-dialog");
    document.body.appendChild(element);
    assertEquals(element.innerHTML, "");
  });

  it("should render lightbox when open", () => {
    const element = document.createElement("lightbox-dialog");
    element.images = [{ src: "test.jpg", alt: "Test" }];
    document.body.appendChild(element);
    element.open();
    const lightbox = element.querySelector(".lightbox");
    assert(lightbox !== null);
  });

  it("should render close button", () => {
    const element = document.createElement("lightbox-dialog");
    element.images = [{ src: "test.jpg", alt: "Test" }];
    document.body.appendChild(element);
    element.open();
    const closeBtn = element.querySelector(".lightbox-close");
    assert(closeBtn !== null);
  });

  it("should render image with correct src", () => {
    const element = document.createElement("lightbox-dialog");
    element.images = [{ src: "test.jpg", alt: "Test image" }];
    document.body.appendChild(element);
    element.open();
    const img = element.querySelector("img");
    assert(img !== null);
    assert(img.src.includes("test.jpg"));
  });

  it("should render alt text when available", () => {
    const element = document.createElement("lightbox-dialog");
    element.images = [{ src: "test.jpg", alt: "Test alt text" }];
    document.body.appendChild(element);
    element.open();
    const altText = element.querySelector(".lightbox-alt-text");
    assert(altText !== null);
    assertEquals(altText.textContent, "Test alt text");
  });

  it("should hide alt text when hide-alt-text attribute is set", () => {
    const element = document.createElement("lightbox-dialog");
    element.setAttribute("hide-alt-text", "true");
    element.images = [{ src: "test.jpg", alt: "Test alt text" }];
    document.body.appendChild(element);
    element.open();
    const altText = element.querySelector(".lightbox-alt-text");
    assertEquals(altText, null);
  });
});

t.describe("LightboxDialog - navigation", (it) => {
  it("should not show nav buttons with single image", () => {
    const element = document.createElement("lightbox-dialog");
    element.images = [{ src: "test.jpg", alt: "Test" }];
    document.body.appendChild(element);
    element.open();
    const navButtons = element.querySelectorAll(".lightbox-nav");
    assertEquals(navButtons.length, 0);
  });

  it("should show nav buttons with multiple images", () => {
    const element = document.createElement("lightbox-dialog");
    element.images = [
      { src: "test1.jpg", alt: "Test 1" },
      { src: "test2.jpg", alt: "Test 2" },
    ];
    document.body.appendChild(element);
    element.open();
    const navButtons = element.querySelectorAll(".lightbox-nav");
    assertEquals(navButtons.length, 2);
  });

  it("should disable prev button on first image", () => {
    const element = document.createElement("lightbox-dialog");
    element.images = [
      { src: "test1.jpg", alt: "Test 1" },
      { src: "test2.jpg", alt: "Test 2" },
    ];
    element.currentIndex = 0;
    document.body.appendChild(element);
    element.open();
    const prevButton = element.querySelector(".lightbox-nav-prev");
    assert(prevButton.disabled);
  });

  it("should disable next button on last image", () => {
    const element = document.createElement("lightbox-dialog");
    element.images = [
      { src: "test1.jpg", alt: "Test 1" },
      { src: "test2.jpg", alt: "Test 2" },
    ];
    element.currentIndex = 1;
    document.body.appendChild(element);
    element.open();
    const nextButton = element.querySelector(".lightbox-nav-next");
    assert(nextButton.disabled);
  });

  it("should navigate to next image", () => {
    const element = document.createElement("lightbox-dialog");
    element.images = [
      { src: "test1.jpg", alt: "Test 1" },
      { src: "test2.jpg", alt: "Test 2" },
    ];
    element.currentIndex = 0;
    document.body.appendChild(element);
    element.open();
    element.navigate(1);
    assertEquals(element.currentIndex, 1);
  });

  it("should navigate to previous image", () => {
    const element = document.createElement("lightbox-dialog");
    element.images = [
      { src: "test1.jpg", alt: "Test 1" },
      { src: "test2.jpg", alt: "Test 2" },
    ];
    element.currentIndex = 1;
    document.body.appendChild(element);
    element.open();
    element.navigate(-1);
    assertEquals(element.currentIndex, 0);
  });

  it("should not navigate past first image", () => {
    const element = document.createElement("lightbox-dialog");
    element.images = [
      { src: "test1.jpg", alt: "Test 1" },
      { src: "test2.jpg", alt: "Test 2" },
    ];
    element.currentIndex = 0;
    document.body.appendChild(element);
    element.open();
    element.navigate(-1);
    assertEquals(element.currentIndex, 0);
  });

  it("should not navigate past last image", () => {
    const element = document.createElement("lightbox-dialog");
    element.images = [
      { src: "test1.jpg", alt: "Test 1" },
      { src: "test2.jpg", alt: "Test 2" },
    ];
    element.currentIndex = 1;
    document.body.appendChild(element);
    element.open();
    element.navigate(1);
    assertEquals(element.currentIndex, 1);
  });
});

t.describe("LightboxDialog - open/close", (it) => {
  it("should set isOpen to true when open() is called", () => {
    const element = document.createElement("lightbox-dialog");
    element.images = [{ src: "test.jpg", alt: "Test" }];
    document.body.appendChild(element);
    element.open();
    assertEquals(element.isOpen, true);
  });

  it("should set isOpen to false when close() is called", () => {
    const element = document.createElement("lightbox-dialog");
    element.images = [{ src: "test.jpg", alt: "Test" }];
    document.body.appendChild(element);
    element.open();
    element.close();
    assertEquals(element.isOpen, false);
  });

  it("should dispatch close event when close() is called", () => {
    const element = document.createElement("lightbox-dialog");
    element.images = [{ src: "test.jpg", alt: "Test" }];
    document.body.appendChild(element);
    element.open();

    let eventFired = false;
    element.addEventListener("close", () => {
      eventFired = true;
    });

    element.close();
    assert(eventFired);
  });

  it("should set body overflow to hidden when opened", () => {
    const element = document.createElement("lightbox-dialog");
    element.images = [{ src: "test.jpg", alt: "Test" }];
    document.body.appendChild(element);
    element.open();
    assertEquals(document.body.style.overflow, "hidden");
  });

  it("should restore body overflow when closed", () => {
    const element = document.createElement("lightbox-dialog");
    element.images = [{ src: "test.jpg", alt: "Test" }];
    document.body.appendChild(element);
    element.open();
    element.close();
    assertEquals(document.body.style.overflow, "");
  });
});

t.describe("LightboxDialog - keyboard navigation", (it) => {
  it("should close on Escape key", () => {
    const element = document.createElement("lightbox-dialog");
    element.images = [{ src: "test.jpg", alt: "Test" }];
    document.body.appendChild(element);
    element.open();

    element.handleKeyDown({ key: "Escape" });
    assertEquals(element.isOpen, false);
  });

  it("should navigate left on ArrowLeft key", () => {
    const element = document.createElement("lightbox-dialog");
    element.images = [
      { src: "test1.jpg", alt: "Test 1" },
      { src: "test2.jpg", alt: "Test 2" },
    ];
    element.currentIndex = 1;
    document.body.appendChild(element);
    element.open();

    element.handleKeyDown({ key: "ArrowLeft" });
    assertEquals(element.currentIndex, 0);
  });

  it("should navigate right on ArrowRight key", () => {
    const element = document.createElement("lightbox-dialog");
    element.images = [
      { src: "test1.jpg", alt: "Test 1" },
      { src: "test2.jpg", alt: "Test 2" },
    ];
    element.currentIndex = 0;
    document.body.appendChild(element);
    element.open();

    element.handleKeyDown({ key: "ArrowRight" });
    assertEquals(element.currentIndex, 1);
  });
});

t.describe("LightboxImageGroup - rendering", (it) => {
  it("should preserve children", () => {
    const element = document.createElement("lightbox-image-group");
    element.innerHTML = '<img src="test.jpg" alt="Test">';
    document.body.appendChild(element);
    const img = element.querySelector("img");
    assert(img !== null);
  });
});

t.describe("LightboxImageGroup - click to open lightbox", (it) => {
  it("should create lightbox dialog when image is clicked", () => {
    const element = document.createElement("lightbox-image-group");
    element.innerHTML = '<img src="test.jpg" alt="Test">';
    document.body.appendChild(element);

    const img = element.querySelector("img");
    img.click();

    const lightboxDialog = document.querySelector("lightbox-dialog");
    assert(lightboxDialog !== null);

    // Clean up
    lightboxDialog.close();
    lightboxDialog.remove();
  });

  it("should pass hide-alt-text attribute to lightbox dialog", () => {
    const element = document.createElement("lightbox-image-group");
    element.setAttribute("hide-alt-text", "true");
    element.innerHTML = '<img src="test.jpg" alt="Test">';
    document.body.appendChild(element);

    const img = element.querySelector("img");
    img.click();

    const lightboxDialog = document.querySelector("lightbox-dialog");
    // The hideAltText is set as an attribute before appending to DOM
    assert(lightboxDialog.getAttribute("hide-alt-text") !== null);

    // Clean up
    lightboxDialog.close();
    lightboxDialog.remove();
  });
});

t.describe("LightboxImageGroup - reinitialization protection", (it) => {
  it("should not reinitialize when connectedCallback is called multiple times", () => {
    const element = document.createElement("lightbox-image-group");
    element.innerHTML = '<img src="test.jpg" alt="Test">';
    document.body.appendChild(element);

    element.connectedCallback();

    const images = element.querySelectorAll("img");
    assertEquals(images.length, 1);
  });
});

await t.run();
