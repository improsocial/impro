import { TestSuite } from "../testSuite.js";
import { assert, assertEquals } from "../testHelpers.js";
import { Signal, SignalSet, SignalMap } from "/js/signals.js";

const t = new TestSuite("signals");

t.describe("SignalSet - Set behavior", (it) => {
  it("starts empty by default", () => {
    const set = new SignalSet();
    assertEquals(set.size, 0);
    assertEquals(set.has("a"), false);
  });

  it("seeds from an iterable passed to the constructor", () => {
    const set = new SignalSet(["a", "b"]);
    assertEquals(set.size, 2);
    assert(set.has("a"));
    assert(set.has("b"));
  });

  it("add/has/delete behave like a native Set", () => {
    const set = new SignalSet();
    assertEquals(set.add("a"), set);
    assert(set.has("a"));
    assertEquals(set.size, 1);
    assertEquals(set.delete("a"), true);
    assertEquals(set.delete("a"), false);
    assertEquals(set.has("a"), false);
    assertEquals(set.size, 0);
  });

  it("clear removes every value", () => {
    const set = new SignalSet(["a", "b"]);
    set.clear();
    assertEquals(set.size, 0);
    assertEquals(set.has("a"), false);
  });

  it("supports iteration helpers", () => {
    const set = new SignalSet(["a", "b"]);
    assertEquals([...set], ["a", "b"]);
    assertEquals([...set.values()], ["a", "b"]);
    assertEquals([...set.keys()], ["a", "b"]);
    assertEquals(
      [...set.entries()],
      [
        ["a", "a"],
        ["b", "b"],
      ],
    );
    const collected = [];
    set.forEach((value) => collected.push(value));
    assertEquals(collected, ["a", "b"]);
  });
});

t.describe("SignalSet - reactivity", (it) => {
  it("a has() reader recomputes when its value is added or removed", () => {
    const set = new SignalSet();
    let runs = 0;
    const $hasA = new Signal.Computed(() => {
      runs++;
      return set.has("a");
    });

    assertEquals($hasA.get(), false);
    assertEquals(runs, 1);

    set.add("a");
    assertEquals($hasA.get(), true);
    assertEquals(runs, 2);

    set.delete("a");
    assertEquals($hasA.get(), false);
    assertEquals(runs, 3);
  });

  it("a has() reader is not disturbed by changes to other values", () => {
    const set = new SignalSet();
    let runs = 0;
    const $hasA = new Signal.Computed(() => {
      runs++;
      return set.has("a");
    });

    assertEquals($hasA.get(), false);
    assertEquals(runs, 1);

    // Mutating an unrelated value must not invalidate the has("a") reader.
    set.add("b");
    set.delete("b");
    assertEquals($hasA.get(), false);
    assertEquals(runs, 1);
  });

  it("a size reader recomputes on membership changes", () => {
    const set = new SignalSet();
    let runs = 0;
    const $size = new Signal.Computed(() => {
      runs++;
      return set.size;
    });

    assertEquals($size.get(), 0);
    assertEquals(runs, 1);

    set.add("a");
    assertEquals($size.get(), 1);
    assertEquals(runs, 2);
  });

  it("re-adding an existing value still notifies readers (no dedup, signal-utils semantics)", () => {
    const set = new SignalSet(["a"]);
    let runs = 0;
    const $size = new Signal.Computed(() => {
      runs++;
      return set.size;
    });

    assertEquals($size.get(), 1);
    assertEquals(runs, 1);

    // No dedup: re-adding an existing value still notifies the collection.
    set.add("a");
    assertEquals($size.get(), 1);
    assertEquals(runs, 2);
  });

  it("deleting an absent value still notifies readers (no dedup, signal-utils semantics)", () => {
    const set = new SignalSet();
    let runs = 0;
    const $size = new Signal.Computed(() => {
      runs++;
      return set.size;
    });

    assertEquals($size.get(), 0);
    assertEquals(runs, 1);

    // No dedup: deleting an absent value still notifies the collection.
    assertEquals(set.delete("missing"), false);
    assertEquals($size.get(), 0);
    assertEquals(runs, 2);
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

    assertEquals($hasA.get(), true);
    assertEquals($size.get(), 1);

    set.clear();
    assertEquals($hasA.get(), false);
    assertEquals($size.get(), 0);
    assertEquals(hasRuns, 2);
    assertEquals(sizeRuns, 2);
  });
});

t.describe("SignalMap - Map behavior", (it) => {
  it("returns null for an absent key", () => {
    const map = new SignalMap();
    assertEquals(map.get("a"), null);
    assertEquals(map.has("a"), false);
    assertEquals(map.size, 0);
  });

  it("seeds from entries passed to the constructor", () => {
    const map = new SignalMap([
      ["a", 1],
      ["b", 2],
    ]);
    assertEquals(map.size, 2);
    assertEquals(map.get("a"), 1);
    assert(map.has("b"));
  });

  it("set/get/has/delete behave like a native Map", () => {
    const map = new SignalMap();
    map.set("a", 1);
    assertEquals(map.get("a"), 1);
    assert(map.has("a"));
    assertEquals(map.size, 1);
    assertEquals(map.delete("a"), true);
    assertEquals(map.delete("a"), false);
    assertEquals(map.get("a"), null);
  });

  it("clear removes every entry", () => {
    const map = new SignalMap([
      ["a", 1],
      ["b", 2],
    ]);
    map.clear();
    assertEquals(map.size, 0);
    assertEquals(map.get("a"), null);
  });

  it("supports iteration helpers", () => {
    const map = new SignalMap([
      ["a", 1],
      ["b", 2],
    ]);
    assertEquals([...map.keys()], ["a", "b"]);
    assertEquals([...map.values()], [1, 2]);
    assertEquals(
      [...map.entries()],
      [
        ["a", 1],
        ["b", 2],
      ],
    );
    assertEquals(
      [...map],
      [
        ["a", 1],
        ["b", 2],
      ],
    );
    const collected = [];
    map.forEach((value, key) => collected.push([key, value]));
    assertEquals(collected, [
      ["a", 1],
      ["b", 2],
    ]);
  });
});

t.describe("SignalMap - reactivity", (it) => {
  it("a get() reader recomputes when its key is written", () => {
    const map = new SignalMap();
    let runs = 0;
    const $a = new Signal.Computed(() => {
      runs++;
      return map.get("a");
    });

    assertEquals($a.get(), null);
    assertEquals(runs, 1);

    map.set("a", 1);
    assertEquals($a.get(), 1);
    assertEquals(runs, 2);
  });

  it("a get() reader is not disturbed by writes to other keys", () => {
    const map = new SignalMap();
    let runs = 0;
    const $a = new Signal.Computed(() => {
      runs++;
      return map.get("a");
    });

    assertEquals($a.get(), null);
    assertEquals(runs, 1);

    // Writing an unrelated key must not invalidate the get("a") reader.
    map.set("b", 2);
    map.set("b", 3);
    assertEquals($a.get(), null);
    assertEquals(runs, 1);
  });

  it("a size/keys reader recomputes on any write (signal-utils semantics)", () => {
    const map = new SignalMap();
    let runs = 0;
    const $keys = new Signal.Computed(() => {
      runs++;
      return [...map.keys()];
    });

    assertEquals($keys.get(), []);
    assertEquals(runs, 1);

    map.set("a", 1);
    assertEquals($keys.get(), ["a"]);
    assertEquals(runs, 2);

    // No value dedup: re-setting an existing key still notifies collection.
    map.set("a", 1);
    assertEquals($keys.get(), ["a"]);
    assertEquals(runs, 3);
  });

  it("a has() reader recomputes when its key is added or removed", () => {
    const map = new SignalMap();
    let runs = 0;
    const $hasA = new Signal.Computed(() => {
      runs++;
      return map.has("a");
    });

    assertEquals($hasA.get(), false);
    map.set("a", 1);
    assertEquals($hasA.get(), true);
    map.delete("a");
    assertEquals($hasA.get(), false);
    assertEquals(runs, 3);
  });
});

await t.run();
