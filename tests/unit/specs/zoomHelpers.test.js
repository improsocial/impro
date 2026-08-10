import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { enablePinchZoom } from "/js/zoomHelpers.js";

function pointerEvent(
  type,
  {
    pointerId = 1,
    clientX = 0,
    clientY = 0,
    pointerType = "touch",
    button = 0,
  } = {},
) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  event.pointerId = pointerId;
  event.clientX = clientX;
  event.clientY = clientY;
  event.pointerType = pointerType;
  event.button = button;
  return event;
}

function wheelEvent({ deltaY, ctrlKey = true, clientX = 0, clientY = 0 } = {}) {
  const event = new Event("wheel", { bubbles: true, cancelable: true });
  event.deltaY = deltaY;
  event.ctrlKey = ctrlKey;
  event.clientX = clientX;
  event.clientY = clientY;
  return event;
}

function rect({ centerX, centerY, width, height }) {
  return {
    x: centerX - width / 2,
    y: centerY - height / 2,
    left: centerX - width / 2,
    top: centerY - height / 2,
    right: centerX + width / 2,
    bottom: centerY + height / 2,
    width,
    height,
  };
}

// Container fixed at 300x300 centered on (150,150). By default the img is
// mocked at a fixed 100x100 (smaller than the container, matching scale 1 -
// no room to pan). Tests that need the img's measured size to track zoom
// (e.g. panning while zoomed) pass trackScale: true, which re-derives the
// rect from the control's own committed scale on every read.
function createZoomableImg({ trackScale = false } = {}) {
  const container = document.createElement("div");
  container.getBoundingClientRect = () =>
    rect({ centerX: 150, centerY: 150, width: 300, height: 300 });

  const img = document.createElement("img");
  img.setPointerCapture = () => {};
  img.releasePointerCapture = () => {};
  document.body.appendChild(container);
  container.appendChild(img);

  const control = enablePinchZoom(img, { container });

  img.getBoundingClientRect = () => {
    const scale = trackScale ? control.getState().scale : 1;
    return rect({
      centerX: 150,
      centerY: 150,
      width: 100 * scale,
      height: 100 * scale,
    });
  };

  return { container, img, control };
}

describe("enablePinchZoom", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("starts at scale 1 with no translation", () => {
    const { control } = createZoomableImg();
    assert.deepEqual(control.getState(), {
      scale: 1,
      translateX: 0,
      translateY: 0,
    });
  });

  it("increases scale on a two-pointer pinch", () => {
    const { img, control } = createZoomableImg();

    img.dispatchEvent(
      pointerEvent("pointerdown", { pointerId: 1, clientX: 140, clientY: 150 }),
    );
    img.dispatchEvent(
      pointerEvent("pointerdown", { pointerId: 2, clientX: 160, clientY: 150 }),
    );
    // start distance = 20
    img.dispatchEvent(
      pointerEvent("pointermove", { pointerId: 1, clientX: 90, clientY: 150 }),
    );
    img.dispatchEvent(
      pointerEvent("pointermove", { pointerId: 2, clientX: 210, clientY: 150 }),
    );
    // end distance = 120, ratio = 6x -> would be 6 but clamps to maxScale

    assert.equal(control.getState().scale, 4);
  });

  it("clamps pinch-out to maxScale", () => {
    const { img, control } = createZoomableImg();

    img.dispatchEvent(
      pointerEvent("pointerdown", { pointerId: 1, clientX: 145, clientY: 150 }),
    );
    img.dispatchEvent(
      pointerEvent("pointerdown", { pointerId: 2, clientX: 155, clientY: 150 }),
    );
    img.dispatchEvent(
      pointerEvent("pointermove", {
        pointerId: 1,
        clientX: -350,
        clientY: 150,
      }),
    );
    img.dispatchEvent(
      pointerEvent("pointermove", { pointerId: 2, clientX: 650, clientY: 150 }),
    );

    assert.equal(control.getState().scale, 4);
  });

  it("clamps pinch-in to minScale and re-centers translation", () => {
    const { img, control } = createZoomableImg();

    img.dispatchEvent(
      pointerEvent("pointerdown", { pointerId: 1, clientX: 100, clientY: 150 }),
    );
    img.dispatchEvent(
      pointerEvent("pointerdown", { pointerId: 2, clientX: 200, clientY: 150 }),
    );
    // start distance = 100
    img.dispatchEvent(
      pointerEvent("pointermove", { pointerId: 1, clientX: 145, clientY: 150 }),
    );
    img.dispatchEvent(
      pointerEvent("pointermove", { pointerId: 2, clientX: 155, clientY: 150 }),
    );
    // end distance = 10, ratio = 0.1 -> clamps to minScale 1

    assert.deepEqual(control.getState(), {
      scale: 1,
      translateX: 0,
      translateY: 0,
    });
  });

  it("pans and clamps to the computed bounds once zoomed in", () => {
    const { img, control } = createZoomableImg({ trackScale: true });

    // Zoom to max (4x) via a large outward pinch (clamped by maxScale) so
    // there's room to pan afterward.
    img.dispatchEvent(
      pointerEvent("pointerdown", { pointerId: 1, clientX: 145, clientY: 150 }),
    );
    img.dispatchEvent(
      pointerEvent("pointerdown", { pointerId: 2, clientX: 155, clientY: 150 }),
    );
    img.dispatchEvent(
      pointerEvent("pointermove", {
        pointerId: 1,
        clientX: -350,
        clientY: 150,
      }),
    );
    img.dispatchEvent(
      pointerEvent("pointermove", { pointerId: 2, clientX: 650, clientY: 150 }),
    );
    img.dispatchEvent(pointerEvent("pointerup", { pointerId: 1 }));
    img.dispatchEvent(pointerEvent("pointerup", { pointerId: 2 }));
    assert.equal(control.getState().scale, 4);

    // img is now 400x400 inside a 300x300 container -> max pan offset is 50px
    // per axis. Drag far past that and confirm it clamps.
    img.dispatchEvent(
      pointerEvent("pointerdown", { pointerId: 3, clientX: 150, clientY: 150 }),
    );
    img.dispatchEvent(
      pointerEvent("pointermove", { pointerId: 3, clientX: 500, clientY: 150 }),
    );

    assert.equal(control.getState().translateX, 50);
  });

  it("does not pan while at scale 1", () => {
    const { img, control } = createZoomableImg();

    img.dispatchEvent(
      pointerEvent("pointerdown", { pointerId: 1, clientX: 150, clientY: 150 }),
    );
    img.dispatchEvent(
      pointerEvent("pointermove", { pointerId: 1, clientX: 600, clientY: 150 }),
    );

    assert.deepEqual(control.getState(), {
      scale: 1,
      translateX: 0,
      translateY: 0,
    });
  });

  it("toggles zoom on double-click", () => {
    const { img, control } = createZoomableImg({ trackScale: true });

    const dblclick = () => {
      const event = new Event("dblclick", { bubbles: true, cancelable: true });
      event.clientX = 150;
      event.clientY = 150;
      img.dispatchEvent(event);
    };

    dblclick();
    assert.equal(control.getState().scale, 2.5);
    dblclick();
    assert.equal(control.getState().scale, 1);
  });

  it("toggles zoom on a manual touch double-tap", () => {
    const { img, control } = createZoomableImg({ trackScale: true });

    const tap = (pointerId) => {
      img.dispatchEvent(
        pointerEvent("pointerdown", { pointerId, clientX: 150, clientY: 150 }),
      );
      img.dispatchEvent(
        pointerEvent("pointerup", { pointerId, clientX: 150, clientY: 150 }),
      );
    };

    tap(1);
    tap(2);

    assert.equal(control.getState().scale, 2.5);
  });

  it("does not treat two slow taps as a double-tap", (t) => {
    let clock = 0;
    t.mock.method(performance, "now", () => clock);
    const { img, control } = createZoomableImg({ trackScale: true });

    const tap = (pointerId) => {
      img.dispatchEvent(
        pointerEvent("pointerdown", { pointerId, clientX: 150, clientY: 150 }),
      );
      img.dispatchEvent(
        pointerEvent("pointerup", { pointerId, clientX: 150, clientY: 150 }),
      );
    };

    tap(1);
    clock += 350;
    tap(2);

    assert.equal(control.getState().scale, 1);
  });

  it("ignores mouse taps in the manual double-tap detector", () => {
    const { img, control } = createZoomableImg({ trackScale: true });

    const tap = (pointerId) => {
      img.dispatchEvent(
        pointerEvent("pointerdown", {
          pointerId,
          clientX: 150,
          clientY: 150,
          pointerType: "mouse",
        }),
      );
      img.dispatchEvent(
        pointerEvent("pointerup", {
          pointerId,
          clientX: 150,
          clientY: 150,
          pointerType: "mouse",
        }),
      );
    };

    tap(1);
    tap(2);

    assert.equal(control.getState().scale, 1);
  });

  it("zooms in and out on ctrl+wheel", () => {
    const { img, control } = createZoomableImg({ trackScale: true });

    img.dispatchEvent(
      wheelEvent({ deltaY: -100, ctrlKey: true, clientX: 150, clientY: 150 }),
    );
    assert(control.getState().scale > 1, "should zoom in on negative deltaY");

    const zoomedIn = control.getState().scale;
    img.dispatchEvent(
      wheelEvent({ deltaY: 100, ctrlKey: true, clientX: 150, clientY: 150 }),
    );
    assert(
      control.getState().scale < zoomedIn,
      "should zoom out on positive deltaY",
    );
  });

  it("ignores wheel events without ctrlKey", () => {
    const { img, control } = createZoomableImg();

    img.dispatchEvent(
      wheelEvent({ deltaY: -100, ctrlKey: false, clientX: 150, clientY: 150 }),
    );

    assert.equal(control.getState().scale, 1);
  });

  it("reset() snaps back to scale 1 with no translation", () => {
    const { img, control } = createZoomableImg({ trackScale: true });

    const event = new Event("dblclick", { bubbles: true, cancelable: true });
    event.clientX = 150;
    event.clientY = 150;
    img.dispatchEvent(event);
    assert.equal(control.getState().scale, 2.5);

    control.reset();

    assert.deepEqual(control.getState(), {
      scale: 1,
      translateX: 0,
      translateY: 0,
    });
  });

  it("cleanup() clears the applied transform and removes listeners", () => {
    const { img, control } = createZoomableImg({ trackScale: true });

    const event = new Event("dblclick", { bubbles: true, cancelable: true });
    event.clientX = 150;
    event.clientY = 150;
    img.dispatchEvent(event);
    assert.equal(control.getState().scale, 2.5);

    control.cleanup();
    assert.equal(img.style.transform, "");
    assert.equal(img.style.transition, "");

    const stateAfterCleanup = control.getState();

    assert.doesNotThrow(() => {
      img.dispatchEvent(
        pointerEvent("pointerdown", {
          pointerId: 9,
          clientX: 150,
          clientY: 150,
        }),
      );
      img.dispatchEvent(
        wheelEvent({ deltaY: -100, clientX: 150, clientY: 150 }),
      );
      const dbl = new Event("dblclick", { bubbles: true, cancelable: true });
      dbl.clientX = 150;
      dbl.clientY = 150;
      img.dispatchEvent(dbl);
    });

    assert.deepEqual(control.getState(), stateAfterCleanup);
    assert.equal(img.style.transform, "");
  });

  it("replaces a previous binding when called again on the same img", () => {
    const container = document.createElement("div");
    container.getBoundingClientRect = () =>
      rect({ centerX: 150, centerY: 150, width: 300, height: 300 });
    const img = document.createElement("img");
    img.setPointerCapture = () => {};
    img.releasePointerCapture = () => {};
    document.body.appendChild(container);
    container.appendChild(img);

    const first = enablePinchZoom(img, { container });
    const second = enablePinchZoom(img, { container });
    img.getBoundingClientRect = () =>
      rect({
        centerX: 150,
        centerY: 150,
        width: 100 * second.getState().scale,
        height: 100 * second.getState().scale,
      });

    const event = new Event("dblclick", { bubbles: true, cancelable: true });
    event.clientX = 150;
    event.clientY = 150;
    img.dispatchEvent(event);

    assert.equal(second.getState().scale, 2.5);
    assert.equal(first.getState().scale, 1);
  });
});
