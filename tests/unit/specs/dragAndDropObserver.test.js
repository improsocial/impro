import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { DragAndDropObserver } from "/js/dragAndDropObserver.js";

describe("DragAndDropObserver", () => {
  let observer;
  let onDragStart;
  let onDragEnd;
  let onDrop;

  beforeEach(() => {
    onDragStart = mock.fn();
    onDragEnd = mock.fn();
    onDrop = mock.fn();
  });

  afterEach(() => {
    observer?.disconnect();
    observer = null;
  });

  function makeEvent(type, { files = [], hasFiles = true } = {}) {
    const event = new window.Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", {
      value: {
        files,
        items: [],
        types: hasFiles ? ["Files"] : ["text/plain"],
        dropEffect: "none",
      },
    });
    return event;
  }

  it("fires onDragStart on the first file dragenter", () => {
    observer = new DragAndDropObserver(window, { onDragStart });
    window.dispatchEvent(makeEvent("dragenter"));
    assert.deepEqual(onDragStart.mock.callCount(), 1);
  });

  it("does not fire onDragStart for non-file drags", () => {
    observer = new DragAndDropObserver(window, { onDragStart });
    window.dispatchEvent(makeEvent("dragenter", { hasFiles: false }));
    assert.deepEqual(onDragStart.mock.callCount(), 0);
  });

  it("keeps active while crossing child elements (counter)", () => {
    observer = new DragAndDropObserver(window, { onDragStart, onDragEnd });
    window.dispatchEvent(makeEvent("dragenter"));
    window.dispatchEvent(makeEvent("dragenter"));
    window.dispatchEvent(makeEvent("dragleave"));
    assert.deepEqual(onDragStart.mock.callCount(), 1);
    assert.deepEqual(onDragEnd.mock.callCount(), 0);
    window.dispatchEvent(makeEvent("dragleave"));
    assert.deepEqual(onDragEnd.mock.callCount(), 1);
  });

  it("preventDefaults dragover with files and sets dropEffect to copy", () => {
    observer = new DragAndDropObserver(window, {});
    const event = makeEvent("dragover");
    window.dispatchEvent(event);
    assert(event.defaultPrevented);
    assert.deepEqual(event.dataTransfer.dropEffect, "copy");
  });

  it("ignores dragover without files", () => {
    observer = new DragAndDropObserver(window, {});
    const event = makeEvent("dragover", { hasFiles: false });
    window.dispatchEvent(event);
    assert(!event.defaultPrevented);
  });

  it("forwards dropped files to onDrop and ends the drag", () => {
    observer = new DragAndDropObserver(window, {
      onDragStart,
      onDragEnd,
      onDrop,
    });
    window.dispatchEvent(makeEvent("dragenter"));
    const file = new window.File(["x"], "x.png", { type: "image/png" });
    const event = makeEvent("drop", { files: [file] });
    window.dispatchEvent(event);
    assert(event.defaultPrevented);
    assert.deepEqual(onDrop.mock.callCount(), 1);
    assert.deepEqual(onDrop.mock.calls[0].arguments[0], [file]);
    assert.deepEqual(onDragEnd.mock.callCount(), 1);
  });

  it("does not preventDefault a drop with no files", () => {
    observer = new DragAndDropObserver(window, { onDrop });
    const event = makeEvent("drop", { files: [] });
    window.dispatchEvent(event);
    assert(!event.defaultPrevented);
    assert.deepEqual(onDrop.mock.callCount(), 0);
  });

  it("disconnect removes listeners and fires onDragEnd if active", () => {
    observer = new DragAndDropObserver(window, {
      onDragStart,
      onDragEnd,
      onDrop,
    });
    window.dispatchEvent(makeEvent("dragenter"));
    observer.disconnect();
    observer = null;
    assert.deepEqual(onDragEnd.mock.callCount(), 1);
    window.dispatchEvent(
      makeEvent("drop", { files: [new window.File(["x"], "x.png")] }),
    );
    assert.deepEqual(onDrop.mock.callCount(), 0);
  });

  it("resets when the pointer leaves the window (relatedTarget null)", () => {
    observer = new DragAndDropObserver(window, { onDragStart, onDragEnd });
    window.dispatchEvent(makeEvent("dragenter"));
    window.dispatchEvent(makeEvent("dragenter"));
    const leave = new window.Event("dragleave", { bubbles: true });
    Object.defineProperty(leave, "relatedTarget", { value: null });
    window.dispatchEvent(leave);
    assert.deepEqual(onDragEnd.mock.callCount(), 1);
  });

  it("resets on dragend", () => {
    observer = new DragAndDropObserver(window, { onDragStart, onDragEnd });
    window.dispatchEvent(makeEvent("dragenter"));
    window.dispatchEvent(new window.Event("dragend", { bubbles: true }));
    assert.deepEqual(onDragEnd.mock.callCount(), 1);
  });

  it("throws when constructed without a rootEl", () => {
    assert.throws(() => new DragAndDropObserver(null, {}));
  });
});
