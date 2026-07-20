import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

// scrollLocks.js coordinates holders through a module-level manager.
const { scrollLocks } = await import("/js/scrollLocks.js?fresh-for-test");

describe("ScrollLock", () => {
  let container;
  let createdLocks;

  const createLock = (target) => {
    const lock = scrollLocks.acquire({ target });
    createdLocks.push(lock);
    return lock;
  };

  beforeEach(() => {
    container = document.createElement("div");
    container.className = "current-page";
    container.innerHTML = "<header></header><main></main>";
    document.body.appendChild(container);
    scrollLocks.setContainerProvider(() => container);
    createdLocks = [];
    document.body.style.position = "";
  });

  afterEach(() => {
    for (const lock of createdLocks) {
      lock.release();
    }
    container.remove();
    document.body.style.position = "";
    document.body.style.overflow = "";
    document.body.style.top = "";
    document.body.style.width = "";
    document.body.style.height = "";
  });

  it("locks and unlocks page scroll", () => {
    const lock = createLock();
    assert.deepEqual(document.body.style.position, "fixed");
    lock.release();
    assert.deepEqual(document.body.style.position, "");
  });

  it("keeps the page locked when the first holder unlocks before the second", () => {
    const menuLock = createLock();
    const dialogLock = createLock();

    menuLock.release();
    assert.deepEqual(document.body.style.position, "fixed");

    dialogLock.release();
    assert.deepEqual(document.body.style.position, "");
  });

  it("keeps the page locked when a stacked dialog unlocks first", () => {
    const composerLock = createLock();
    const nestedDialogLock = createLock();

    nestedDialogLock.release();
    assert.deepEqual(document.body.style.position, "fixed");

    composerLock.release();
    assert.deepEqual(document.body.style.position, "");
  });

  it("returns a harmless release when no page container is available", () => {
    scrollLocks.setContainerProvider(() => null);

    const warn = console.warn;
    console.warn = () => {};
    try {
      const lock = createLock();
      assert.deepEqual(document.body.style.position, "");

      lock.release();
      assert.deepEqual(document.body.style.position, "");
    } finally {
      console.warn = warn;
    }
  });

  it("ignores repeated releases from the same lease", () => {
    const lock = createLock();
    lock.release();
    lock.release();
    assert.deepEqual(document.body.style.position, "");
  });

  it("restores a locked scrollable ancestor's overflow on unlock", () => {
    const scrollable = document.createElement("div");
    scrollable.style.overflowY = "auto";
    Object.defineProperty(scrollable, "scrollHeight", { value: 200 });
    Object.defineProperty(scrollable, "clientHeight", { value: 100 });
    const target = document.createElement("div");
    scrollable.appendChild(target);
    container.appendChild(scrollable);

    const lock = createLock(target);
    assert.deepEqual(scrollable.style.overflow, "hidden");
    lock.release();
    assert.deepEqual(scrollable.style.overflow, "");
  });
});
