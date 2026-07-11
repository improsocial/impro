import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

// scrollLock.js tracks lock holders in module-global state
const { ScrollLock } = await import("/js/scrollLock.js?fresh-for-test");

describe("ScrollLock", () => {
  let container;
  let createdLocks;

  const createLock = (target) => {
    const lock = new ScrollLock(target);
    createdLocks.push(lock);
    return lock;
  };

  beforeEach(() => {
    container = document.createElement("div");
    container.className = "page-visible";
    container.innerHTML = "<header></header><main></main>";
    document.body.appendChild(container);
    createdLocks = [];
    document.body.style.position = "";
  });

  afterEach(() => {
    for (const lock of createdLocks) {
      lock.unlock();
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
    lock.lock();
    assert.deepEqual(document.body.style.position, "fixed");
    lock.unlock();
    assert.deepEqual(document.body.style.position, "");
  });

  it("keeps the page locked when the first holder unlocks before the second", () => {
    const menuLock = createLock();
    const dialogLock = createLock();
    menuLock.lock();
    dialogLock.lock();

    menuLock.unlock();
    assert.deepEqual(document.body.style.position, "fixed");

    dialogLock.unlock();
    assert.deepEqual(document.body.style.position, "");
  });

  it("keeps the page locked when a stacked dialog unlocks first", () => {
    const composerLock = createLock();
    const nestedDialogLock = createLock();
    composerLock.lock();
    nestedDialogLock.lock();

    nestedDialogLock.unlock();
    assert.deepEqual(document.body.style.position, "fixed");

    composerLock.unlock();
    assert.deepEqual(document.body.style.position, "");
  });

  it("ignores unlock without a prior lock", () => {
    const heldLock = createLock();
    heldLock.lock();

    const idleLock = createLock();
    idleLock.unlock();
    assert.deepEqual(document.body.style.position, "fixed");

    heldLock.unlock();
    assert.deepEqual(document.body.style.position, "");
  });

  it("ignores repeated lock calls from the same holder", () => {
    const lock = createLock();
    lock.lock();
    lock.lock();
    lock.unlock();
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
    lock.lock();
    assert.deepEqual(scrollable.style.overflow, "hidden");
    lock.unlock();
    assert.deepEqual(scrollable.style.overflow, "");
  });
});
