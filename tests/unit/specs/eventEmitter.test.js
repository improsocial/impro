import { TestSuite } from "../testSuite.js";
import { assert, assertEquals } from "../testHelpers.js";
import { EventEmitter } from "/js/eventEmitter.js";

const t = new TestSuite("EventEmitter");

t.describe("on and emit", (it) => {
  it("should register and trigger event listener", () => {
    const emitter = new EventEmitter();
    let called = false;
    emitter.on("test", () => {
      called = true;
    });
    emitter.emit("test");
    assert(called);
  });

  it("should pass data to event listener", () => {
    const emitter = new EventEmitter();
    let receivedData = null;
    emitter.on("test", (data) => {
      receivedData = data;
    });
    emitter.emit("test", { foo: "bar" });
    assertEquals(receivedData, { foo: "bar" });
  });

  it("should call multiple listeners for same event", () => {
    const emitter = new EventEmitter();
    let count = 0;
    emitter.on("test", () => count++);
    emitter.on("test", () => count++);
    emitter.on("test", () => count++);
    emitter.emit("test");
    assertEquals(count, 3);
  });

  it("should not trigger listeners for different events", () => {
    const emitter = new EventEmitter();
    let called = false;
    emitter.on("event1", () => {
      called = true;
    });
    emitter.emit("event2");
    assertEquals(called, false);
  });

  it("should handle emitting event with no listeners", () => {
    const emitter = new EventEmitter();
    emitter.emit("nonexistent");
    assert(true);
  });
});

t.describe("off", (it) => {
  it("should remove event listener", () => {
    const emitter = new EventEmitter();
    let count = 0;
    const listener = () => count++;
    emitter.on("test", listener);
    emitter.emit("test");
    assertEquals(count, 1);
    emitter.off("test", listener);
    emitter.emit("test");
    assertEquals(count, 1);
  });

  it("should only remove specified listener", () => {
    const emitter = new EventEmitter();
    let count1 = 0;
    let count2 = 0;
    const listener1 = () => count1++;
    const listener2 = () => count2++;
    emitter.on("test", listener1);
    emitter.on("test", listener2);
    emitter.off("test", listener1);
    emitter.emit("test");
    assertEquals(count1, 0);
    assertEquals(count2, 1);
  });

  it("should handle removing non-existent listener", () => {
    const emitter = new EventEmitter();
    const listener = () => {};
    emitter.off("test", listener);
    assert(true);
  });

  it("should remove all listeners when array becomes empty", () => {
    const emitter = new EventEmitter();
    const listener = () => {};
    emitter.on("test", listener);
    emitter.off("test", listener);
    assertEquals(emitter.__eventListeners.has("test"), false);
  });
});

t.describe("removeAllListeners", (it) => {
  it("should remove all listeners for specific event", () => {
    const emitter = new EventEmitter();
    let count1 = 0;
    let count2 = 0;
    emitter.on("test1", () => count1++);
    emitter.on("test1", () => count1++);
    emitter.on("test2", () => count2++);
    emitter.removeAllListeners("test1");
    emitter.emit("test1");
    emitter.emit("test2");
    assertEquals(count1, 0);
    assertEquals(count2, 1);
  });

  it("should remove all listeners for all events when no event specified", () => {
    const emitter = new EventEmitter();
    let count1 = 0;
    let count2 = 0;
    emitter.on("test1", () => count1++);
    emitter.on("test2", () => count2++);
    emitter.removeAllListeners();
    emitter.emit("test1");
    emitter.emit("test2");
    assertEquals(count1, 0);
    assertEquals(count2, 0);
  });

  it("should handle removing listeners for non-existent event", () => {
    const emitter = new EventEmitter();
    emitter.removeAllListeners("nonexistent");
    assert(true);
  });
});

await t.run();
