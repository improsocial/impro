import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "/js/eventEmitter.js";

describe("on and emit", () => {
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
    assert.deepEqual(receivedData, { foo: "bar" });
  });

  it("should call multiple listeners for same event", () => {
    const emitter = new EventEmitter();
    let count = 0;
    emitter.on("test", () => count++);
    emitter.on("test", () => count++);
    emitter.on("test", () => count++);
    emitter.emit("test");
    assert.deepEqual(count, 3);
  });

  it("should not trigger listeners for different events", () => {
    const emitter = new EventEmitter();
    let called = false;
    emitter.on("event1", () => {
      called = true;
    });
    emitter.emit("event2");
    assert.deepEqual(called, false);
  });

  it("should handle emitting event with no listeners", () => {
    const emitter = new EventEmitter();
    emitter.emit("nonexistent");
    assert(true);
  });
});

describe("emitAsync", () => {
  it("should await async listeners before resolving", async () => {
    const emitter = new EventEmitter();
    const order = [];
    emitter.on("test", async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      order.push("listener");
    });
    await emitter.emitAsync("test");
    order.push("after");
    assert.deepEqual(order, ["listener", "after"]);
  });

  it("should run listeners in parallel", async () => {
    const emitter = new EventEmitter();
    let inFlight = 0;
    let maxInFlight = 0;
    const listener = async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 0));
      inFlight--;
    };
    emitter.on("test", listener);
    emitter.on("test", listener);
    emitter.on("test", listener);
    await emitter.emitAsync("test");
    assert.deepEqual(maxInFlight, 3);
  });

  it("should pass data to listeners", async () => {
    const emitter = new EventEmitter();
    let received = null;
    emitter.on("test", async (data) => {
      received = data;
    });
    await emitter.emitAsync("test", { foo: "bar" });
    assert.deepEqual(received, { foo: "bar" });
  });

  it("should tolerate sync listeners", async () => {
    const emitter = new EventEmitter();
    let called = false;
    emitter.on("test", () => {
      called = true;
    });
    await emitter.emitAsync("test");
    assert(called);
  });

  it("should resolve when there are no listeners", async () => {
    const emitter = new EventEmitter();
    await emitter.emitAsync("nonexistent");
    assert(true);
  });

  it("should reject when a listener throws", async () => {
    const emitter = new EventEmitter();
    emitter.on("test", async () => {
      throw new Error("boom");
    });
    await assert.rejects(() => emitter.emitAsync("test"), /boom/);
  });
});

describe("off", () => {
  it("should remove event listener", () => {
    const emitter = new EventEmitter();
    let count = 0;
    const listener = () => count++;
    emitter.on("test", listener);
    emitter.emit("test");
    assert.deepEqual(count, 1);
    emitter.off("test", listener);
    emitter.emit("test");
    assert.deepEqual(count, 1);
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
    assert.deepEqual(count1, 0);
    assert.deepEqual(count2, 1);
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
    assert.deepEqual(emitter.__eventListeners.has("test"), false);
  });
});

describe("removeAllListeners", () => {
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
    assert.deepEqual(count1, 0);
    assert.deepEqual(count2, 1);
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
    assert.deepEqual(count1, 0);
    assert.deepEqual(count2, 0);
  });

  it("should handle removing listeners for non-existent event", () => {
    const emitter = new EventEmitter();
    emitter.removeAllListeners("nonexistent");
    assert(true);
  });
});
