import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Signal, SignalSet, SignalMap } from "/js/signals.js";

describe("SignalSet - Set behavior", () => {
  it("starts empty by default", () => {
    const set = new SignalSet();
    assert.deepEqual(set.size, 0);
    assert.deepEqual(set.has("a"), false);
  });

  it("seeds from an iterable passed to the constructor", () => {
    const set = new SignalSet(["a", "b"]);
    assert.deepEqual(set.size, 2);
    assert(set.has("a"));
    assert(set.has("b"));
  });

  it("add/has/delete behave like a native Set", () => {
    const set = new SignalSet();
    assert.deepEqual(set.add("a"), set);
    assert(set.has("a"));
    assert.deepEqual(set.size, 1);
    assert.deepEqual(set.delete("a"), true);
    assert.deepEqual(set.delete("a"), false);
    assert.deepEqual(set.has("a"), false);
    assert.deepEqual(set.size, 0);
  });

  it("clear removes every value", () => {
    const set = new SignalSet(["a", "b"]);
    set.clear();
    assert.deepEqual(set.size, 0);
    assert.deepEqual(set.has("a"), false);
  });

  it("supports iteration helpers", () => {
    const set = new SignalSet(["a", "b"]);
    assert.deepEqual([...set], ["a", "b"]);
    assert.deepEqual([...set.values()], ["a", "b"]);
    assert.deepEqual([...set.keys()], ["a", "b"]);
    assert.deepEqual(
      [...set.entries()],
      [
        ["a", "a"],
        ["b", "b"],
      ],
    );
    const collected = [];
    set.forEach((value) => collected.push(value));
    assert.deepEqual(collected, ["a", "b"]);
  });
});

describe("SignalSet - reactivity", () => {
  it("a has() reader recomputes when its value is added or removed", () => {
    const set = new SignalSet();
    let runs = 0;
    const $hasA = new Signal.Computed(() => {
      runs++;
      return set.has("a");
    });

    assert.deepEqual($hasA.get(), false);
    assert.deepEqual(runs, 1);

    set.add("a");
    assert.deepEqual($hasA.get(), true);
    assert.deepEqual(runs, 2);

    set.delete("a");
    assert.deepEqual($hasA.get(), false);
    assert.deepEqual(runs, 3);
  });

  it("a has() reader is not disturbed by changes to other values", () => {
    const set = new SignalSet();
    let runs = 0;
    const $hasA = new Signal.Computed(() => {
      runs++;
      return set.has("a");
    });

    assert.deepEqual($hasA.get(), false);
    assert.deepEqual(runs, 1);

    // Mutating an unrelated value must not invalidate the has("a") reader.
    set.add("b");
    set.delete("b");
    assert.deepEqual($hasA.get(), false);
    assert.deepEqual(runs, 1);
  });

  it("a size reader recomputes on membership changes", () => {
    const set = new SignalSet();
    let runs = 0;
    const $size = new Signal.Computed(() => {
      runs++;
      return set.size;
    });

    assert.deepEqual($size.get(), 0);
    assert.deepEqual(runs, 1);

    set.add("a");
    assert.deepEqual($size.get(), 1);
    assert.deepEqual(runs, 2);
  });

  it("re-adding an existing value still notifies readers (no dedup, signal-utils semantics)", () => {
    const set = new SignalSet(["a"]);
    let runs = 0;
    const $size = new Signal.Computed(() => {
      runs++;
      return set.size;
    });

    assert.deepEqual($size.get(), 1);
    assert.deepEqual(runs, 1);

    // No dedup: re-adding an existing value still notifies the collection.
    set.add("a");
    assert.deepEqual($size.get(), 1);
    assert.deepEqual(runs, 2);
  });

  it("deleting an absent value still notifies readers (no dedup, signal-utils semantics)", () => {
    const set = new SignalSet();
    let runs = 0;
    const $size = new Signal.Computed(() => {
      runs++;
      return set.size;
    });

    assert.deepEqual($size.get(), 0);
    assert.deepEqual(runs, 1);

    // No dedup: deleting an absent value still notifies the collection.
    assert.deepEqual(set.delete("missing"), false);
    assert.deepEqual($size.get(), 0);
    assert.deepEqual(runs, 2);
  });

  it("clear notifies both has() and size readers", () => {
    const set = new SignalSet(["a"]);
    let hasRuns = 0;
    let sizeRuns = 0;
    const $hasA = new Signal.Computed(() => {
      hasRuns++;
      return set.has("a");
    });
    const $size = new Signal.Computed(() => {
      sizeRuns++;
      return set.size;
    });

    assert.deepEqual($hasA.get(), true);
    assert.deepEqual($size.get(), 1);

    set.clear();
    assert.deepEqual($hasA.get(), false);
    assert.deepEqual($size.get(), 0);
    assert.deepEqual(hasRuns, 2);
    assert.deepEqual(sizeRuns, 2);
  });
});

describe("SignalMap - Map behavior", () => {
  it("returns null for an absent key", () => {
    const map = new SignalMap();
    assert.deepEqual(map.get("a"), null);
    assert.deepEqual(map.has("a"), false);
    assert.deepEqual(map.size, 0);
  });

  it("seeds from entries passed to the constructor", () => {
    const map = new SignalMap([
      ["a", 1],
      ["b", 2],
    ]);
    assert.deepEqual(map.size, 2);
    assert.deepEqual(map.get("a"), 1);
    assert(map.has("b"));
  });

  it("set/get/has/delete behave like a native Map", () => {
    const map = new SignalMap();
    map.set("a", 1);
    assert.deepEqual(map.get("a"), 1);
    assert(map.has("a"));
    assert.deepEqual(map.size, 1);
    assert.deepEqual(map.delete("a"), true);
    assert.deepEqual(map.delete("a"), false);
    assert.deepEqual(map.get("a"), null);
  });

  it("clear removes every entry", () => {
    const map = new SignalMap([
      ["a", 1],
      ["b", 2],
    ]);
    map.clear();
    assert.deepEqual(map.size, 0);
    assert.deepEqual(map.get("a"), null);
  });

  it("supports iteration helpers", () => {
    const map = new SignalMap([
      ["a", 1],
      ["b", 2],
    ]);
    assert.deepEqual([...map.keys()], ["a", "b"]);
    assert.deepEqual([...map.values()], [1, 2]);
    assert.deepEqual(
      [...map.entries()],
      [
        ["a", 1],
        ["b", 2],
      ],
    );
    assert.deepEqual(
      [...map],
      [
        ["a", 1],
        ["b", 2],
      ],
    );
    const collected = [];
    map.forEach((value, key) => collected.push([key, value]));
    assert.deepEqual(collected, [
      ["a", 1],
      ["b", 2],
    ]);
  });
});

describe("SignalMap - reactivity", () => {
  it("a get() reader recomputes when its key is written", () => {
    const map = new SignalMap();
    let runs = 0;
    const $a = new Signal.Computed(() => {
      runs++;
      return map.get("a");
    });

    assert.deepEqual($a.get(), null);
    assert.deepEqual(runs, 1);

    map.set("a", 1);
    assert.deepEqual($a.get(), 1);
    assert.deepEqual(runs, 2);
  });

  it("a get() reader is not disturbed by writes to other keys", () => {
    const map = new SignalMap();
    let runs = 0;
    const $a = new Signal.Computed(() => {
      runs++;
      return map.get("a");
    });

    assert.deepEqual($a.get(), null);
    assert.deepEqual(runs, 1);

    // Writing an unrelated key must not invalidate the get("a") reader.
    map.set("b", 2);
    map.set("b", 3);
    assert.deepEqual($a.get(), null);
    assert.deepEqual(runs, 1);
  });

  it("a size/keys reader recomputes on any write (signal-utils semantics)", () => {
    const map = new SignalMap();
    let runs = 0;
    const $keys = new Signal.Computed(() => {
      runs++;
      return [...map.keys()];
    });

    assert.deepEqual($keys.get(), []);
    assert.deepEqual(runs, 1);

    map.set("a", 1);
    assert.deepEqual($keys.get(), ["a"]);
    assert.deepEqual(runs, 2);

    // No value dedup: re-setting an existing key still notifies collection.
    map.set("a", 1);
    assert.deepEqual($keys.get(), ["a"]);
    assert.deepEqual(runs, 3);
  });

  it("a has() reader recomputes when its key is added or removed", () => {
    const map = new SignalMap();
    let runs = 0;
    const $hasA = new Signal.Computed(() => {
      runs++;
      return map.has("a");
    });

    assert.deepEqual($hasA.get(), false);
    map.set("a", 1);
    assert.deepEqual($hasA.get(), true);
    map.delete("a");
    assert.deepEqual($hasA.get(), false);
    assert.deepEqual(runs, 3);
  });
});
