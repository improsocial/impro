import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import "/js/components/floating-card.js";

// Await one RAF tick (patched to setTimeout(0) in the test env)
const flushRaf = () => new Promise((resolve) => requestAnimationFrame(resolve));

// Build a <floating-card> whose measured size is `cardSize` and whose popover
// state is "open", so a call to open()/reposition() will apply positioning
// styles inline. Returns the element; the caller reads its inline styles.
function mountFloatingCard({ cardSize }) {
  const el = document.createElement("floating-card");
  document.body.appendChild(el);
  let isOpen = false;
  el.getBoundingClientRect = () => ({
    width: cardSize.width,
    height: cardSize.height,
    top: 0,
    left: 0,
    right: cardSize.width,
    bottom: cardSize.height,
  });
  el.matches = (sel) => sel === ":popover-open" && isOpen;
  el.showPopover = () => {
    isOpen = true;
  };
  el.hidePopover = () => {
    isOpen = false;
  };
  return el;
}

function parseTranslate(transform) {
  const m = /translate\((-?\d+)px,\s*(-?\d+)px\)/.exec(transform);
  return { x: Number(m[1]), y: Number(m[2]) };
}

describe("<floating-card>", () => {
  // JSDOM defaults: window.innerWidth = 1024, window.innerHeight = 768.
  const viewport = { width: 1024, height: 768 };
  let card;
  afterEach(() => {
    card?.remove();
    card = null;
  });

  it("sets inline positioning that survives Firefox's UA :popover-open styles", () => {
    card = mountFloatingCard({ cardSize: { width: 300, height: 200 } });
    assert.equal(card.style.position, "fixed");
    assert.equal(card.style.top, "0px");
    assert.equal(card.style.left, "0px");
    assert.equal(card.style.margin, "0px");
  });

  it("places card below the anchor when there's room", async () => {
    card = mountFloatingCard({ cardSize: { width: 300, height: 200 } });
    card.open({
      top: 100,
      bottom: 130,
      left: 200,
      right: 240,
      width: 40,
      height: 30,
    });
    await flushRaf();
    assert.equal(card.dataset.placement, "bottom");
    const { x, y } = parseTranslate(card.style.transform);
    assert.equal(x, 200);
    assert.equal(y, 130 + 4);
  });

  it("flips above the anchor when there isn't room below", async () => {
    card = mountFloatingCard({ cardSize: { width: 300, height: 200 } });
    card.open({
      top: 700,
      bottom: 730,
      left: 200,
      right: 240,
      width: 40,
      height: 30,
    });
    await flushRaf();
    assert.equal(card.dataset.placement, "top");
    const { y } = parseTranslate(card.style.transform);
    assert.equal(y, 700 - 4 - 200);
  });

  it("shifts left to stay on-screen at the right edge", async () => {
    card = mountFloatingCard({ cardSize: { width: 300, height: 200 } });
    card.open({
      top: 100,
      bottom: 130,
      left: 950,
      right: 990,
      width: 40,
      height: 30,
    });
    await flushRaf();
    // right edge = viewport.width - padding = 1024 - 16 = 1008; x = 1008 - 300
    const { x } = parseTranslate(card.style.transform);
    assert.equal(x, 708);
  });

  it("clamps at left padding and reports viewport-derived maxWidth", async () => {
    card = mountFloatingCard({ cardSize: { width: 2000, height: 200 } });
    card.open({
      top: 100,
      bottom: 130,
      left: 0,
      right: 40,
      width: 40,
      height: 30,
    });
    await flushRaf();
    const { x } = parseTranslate(card.style.transform);
    assert.equal(x, 16);
    assert.equal(card.style.maxWidth, `${viewport.width - 32}px`);
  });

  it("re-runs positioning when reposition() is called with a new rect", async () => {
    card = mountFloatingCard({ cardSize: { width: 300, height: 200 } });
    card.open({
      top: 100,
      bottom: 130,
      left: 200,
      right: 240,
      width: 40,
      height: 30,
    });
    await flushRaf();
    card.reposition({
      top: 100,
      bottom: 130,
      left: 500,
      right: 540,
      width: 40,
      height: 30,
    });
    await flushRaf();
    const { x } = parseTranslate(card.style.transform);
    assert.equal(x, 500);
  });

  it("keeps a reopened card hidden until its new position is applied", async () => {
    card = mountFloatingCard({ cardSize: { width: 300, height: 200 } });
    card.open({
      top: 100,
      bottom: 130,
      left: 200,
      right: 240,
      width: 40,
      height: 30,
    });
    assert.equal(card.style.visibility, "hidden");
    await flushRaf();
    assert.equal(card.style.visibility, "");
    assert.equal(parseTranslate(card.style.transform).x, 200);

    card.close();
    card.open({
      top: 100,
      bottom: 130,
      left: 500,
      right: 540,
      width: 40,
      height: 30,
    });
    assert.equal(card.style.visibility, "hidden");
    // The stale transform is still present, but cannot intercept the pointer.
    assert.equal(parseTranslate(card.style.transform).x, 200);

    await flushRaf();
    assert.equal(card.style.visibility, "");
    assert.equal(parseTranslate(card.style.transform).x, 500);
  });
});
