import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  Signal,
  SignalSet,
  SignalMap,
  SignalArray,
  effect,
  PersistedReactiveStore,
} from "/js/signals.js";

// effect() batches reactions via a double requestAnimationFrame (see
// signals.js) - this waits for that flush to actually happen.
function flushEffects() {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve)),
  );
}

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

describe("SignalArray - Array behavior", () => {
  it("starts empty by default", () => {
    const arr = new SignalArray();
    assert.deepEqual(arr.length, 0);
    assert.deepEqual([...arr], []);
  });

  it("seeds from an iterable passed to the constructor", () => {
    const arr = new SignalArray(["a", "b", "c"]);
    assert.deepEqual(arr.length, 3);
    assert.deepEqual([...arr], ["a", "b", "c"]);
  });

  it("does not share the backing storage with the seed array", () => {
    const seed = ["a", "b"];
    const arr = new SignalArray(seed);
    seed.push("c");
    assert.deepEqual([...arr], ["a", "b"]);
  });

  it("at() returns the element at the given index", () => {
    const arr = new SignalArray(["a", "b", "c"]);
    assert.deepEqual(arr.at(0), "a");
    assert.deepEqual(arr.at(-1), "c");
    assert.deepEqual(arr.at(99), undefined);
  });

  it("indexOf and includes work like a native Array", () => {
    const arr = new SignalArray(["a", "b", "c"]);
    assert.deepEqual(arr.indexOf("b"), 1);
    assert.deepEqual(arr.indexOf("missing"), -1);
    assert(arr.includes("c"));
    assert.deepEqual(arr.includes("missing"), false);
  });

  it("push appends and returns the new length", () => {
    const arr = new SignalArray(["a"]);
    assert.deepEqual(arr.push("b", "c"), 3);
    assert.deepEqual([...arr], ["a", "b", "c"]);
  });

  it("pop removes and returns the last element", () => {
    const arr = new SignalArray(["a", "b"]);
    assert.deepEqual(arr.pop(), "b");
    assert.deepEqual([...arr], ["a"]);
    assert.deepEqual(new SignalArray().pop(), undefined);
  });

  it("set replaces the element at an index", () => {
    const arr = new SignalArray(["a", "b", "c"]);
    arr.set(1, "B");
    assert.deepEqual([...arr], ["a", "B", "c"]);
  });

  it("splice inserts, removes, and returns removed items", () => {
    const arr = new SignalArray(["a", "b", "c", "d"]);
    const removed = arr.splice(1, 2, "X", "Y", "Z");
    assert.deepEqual(removed, ["b", "c"]);
    assert.deepEqual([...arr], ["a", "X", "Y", "Z", "d"]);
  });

  it("replace swaps the whole contents in one shot", () => {
    const arr = new SignalArray(["a", "b"]);
    arr.replace(["x", "y", "z"]);
    assert.deepEqual([...arr], ["x", "y", "z"]);
    arr.replace([]);
    assert.deepEqual([...arr], []);
  });

  it("clear empties the array", () => {
    const arr = new SignalArray(["a", "b"]);
    arr.clear();
    assert.deepEqual(arr.length, 0);
    assert.deepEqual([...arr], []);
  });

  it("map/filter/slice return plain arrays", () => {
    const arr = new SignalArray([1, 2, 3, 4]);
    const doubled = arr.map((n) => n * 2);
    assert.deepEqual(doubled, [2, 4, 6, 8]);
    assert(Array.isArray(doubled));
    assert.deepEqual(
      arr.filter((n) => n % 2 === 0),
      [2, 4],
    );
    assert.deepEqual(arr.slice(1, 3), [2, 3]);
  });

  it("forEach visits each element in order", () => {
    const arr = new SignalArray(["a", "b", "c"]);
    const seen = [];
    arr.forEach((value, index) => seen.push([index, value]));
    assert.deepEqual(seen, [
      [0, "a"],
      [1, "b"],
      [2, "c"],
    ]);
  });
});

describe("SignalArray - reactivity", () => {
  it("a length reader recomputes on push, pop, splice, replace, and clear", () => {
    const arr = new SignalArray();
    let runs = 0;
    const $length = new Signal.Computed(() => {
      runs++;
      return arr.length;
    });

    assert.deepEqual($length.get(), 0);
    assert.deepEqual(runs, 1);

    arr.push("a");
    assert.deepEqual($length.get(), 1);
    assert.deepEqual(runs, 2);

    arr.pop();
    assert.deepEqual($length.get(), 0);
    assert.deepEqual(runs, 3);

    arr.splice(0, 0, "a", "b");
    assert.deepEqual($length.get(), 2);
    assert.deepEqual(runs, 4);

    arr.replace(["x"]);
    assert.deepEqual($length.get(), 1);
    assert.deepEqual(runs, 5);

    arr.clear();
    assert.deepEqual($length.get(), 0);
    assert.deepEqual(runs, 6);
  });

  it("an iteration reader recomputes on mutation", () => {
    const arr = new SignalArray(["a"]);
    let runs = 0;
    const $joined = new Signal.Computed(() => {
      runs++;
      return [...arr].join(",");
    });

    assert.deepEqual($joined.get(), "a");
    assert.deepEqual(runs, 1);

    arr.push("b");
    assert.deepEqual($joined.get(), "a,b");
    assert.deepEqual(runs, 2);

    arr.replace(["z"]);
    assert.deepEqual($joined.get(), "z");
    assert.deepEqual(runs, 3);
  });

  it("set(index, value) notifies iteration and length readers", () => {
    const arr = new SignalArray(["a", "b"]);
    let runs = 0;
    const $joined = new Signal.Computed(() => {
      runs++;
      return [...arr].join(",");
    });

    assert.deepEqual($joined.get(), "a,b");
    arr.set(1, "B");
    assert.deepEqual($joined.get(), "a,B");
    assert.deepEqual(runs, 2);
  });

  it("map/filter/indexOf/at/includes readers all subscribe to the collection", () => {
    const cases = [
      { name: "map", read: (arr) => arr.map((v) => v).join(",") },
      { name: "filter", read: (arr) => arr.filter(() => true).join(",") },
      { name: "indexOf", read: (arr) => arr.indexOf("b") },
      { name: "at", read: (arr) => arr.at(0) },
      { name: "includes", read: (arr) => arr.includes("a") },
    ];
    for (const { name, read } of cases) {
      const arr = new SignalArray(["a", "b"]);
      let runs = 0;
      const $c = new Signal.Computed(() => {
        runs++;
        return read(arr);
      });
      $c.get();
      assert.deepEqual(runs, 1, `${name}: initial run`);
      arr.push("c");
      $c.get();
      assert.deepEqual(runs, 2, `${name}: refires after push`);
    }
  });

  it("replacing with an equal-content array still notifies (no dedup, signal-utils semantics)", () => {
    const arr = new SignalArray(["a", "b"]);
    let runs = 0;
    const $length = new Signal.Computed(() => {
      runs++;
      return arr.length;
    });

    assert.deepEqual($length.get(), 2);
    assert.deepEqual(runs, 1);

    arr.replace(["a", "b"]);
    assert.deepEqual($length.get(), 2);
    assert.deepEqual(runs, 2);
  });
});

describe("effect", () => {
  it("re-runs when a read signal changes", async () => {
    const $count = new Signal.State(0);
    const seen = [];
    const dispose = effect(() => {
      seen.push($count.get());
    });
    try {
      $count.set(1);
      await flushEffects();
      assert.deepEqual(seen, [0, 1]);
    } finally {
      dispose();
    }
  });

  it("keeps reacting to future changes even after the callback throws", () => {
    // effect() schedules its reaction inside a requestAnimationFrame
    // callback. An exception thrown there is a genuinely uncaught
    // exception (same as in a real browser) - not something a surrounding
    // try/catch or .catch() can observe, and node:test fails the test for
    // any uncaught exception during its run regardless of handlers.
    //
    // Auto-running rAF synchronously doesn't work either: it would fire
    // while still inside the signal's own change-notification dispatch
    // (reentrantly), which trips the signal library's own reentrancy guard
    // instead of exercising our code at all. Instead, capture the pending
    // rAF callback and invoke it manually, after set() has already
    // returned -- that's a plain synchronous call in our own test code, so
    // a normal try/catch works and nothing is ever actually "uncaught".
    const originalRaf = globalThis.requestAnimationFrame;
    let pendingRaf = null;
    globalThis.requestAnimationFrame = (cb) => {
      pendingRaf = cb;
    };
    try {
      const $count = new Signal.State(0);
      const seen = [];
      const dispose = effect(() => {
        const value = $count.get();
        seen.push(value);
        if (value === 1) {
          throw new Error("boom");
        }
      });
      try {
        $count.set(1);
        assert.ok(pendingRaf, "expected a reaction to be scheduled");
        assert.throws(() => pendingRaf(), /boom/);

        // The regression this guards against: a naive implementation stops
        // re-arming its watcher once the callback throws, so this second
        // change would silently never be observed.
        pendingRaf = null;
        $count.set(2);
        assert.ok(pendingRaf, "expected the effect to still be re-armed");
        pendingRaf();

        assert.deepEqual(seen, [0, 1, 2]);
      } finally {
        dispose();
      }
    } finally {
      globalThis.requestAnimationFrame = originalRaf;
    }
  });

  it("stops reacting after dispose", async () => {
    const $count = new Signal.State(0);
    const seen = [];
    const dispose = effect(() => {
      seen.push($count.get());
    });
    dispose();

    $count.set(1);
    await flushEffects();

    assert.deepEqual(seen, [0]);
  });
});

describe("PersistedReactiveStore", () => {
  const storageKey = "persisted-store-test";

  beforeEach(() => localStorage.removeItem(storageKey));
  afterEach(() => localStorage.removeItem(storageKey));

  it("restores a stored value matching the default's type", () => {
    localStorage.setItem(storageKey, JSON.stringify({ hidden: true }));
    const store = new PersistedReactiveStore(storageKey);
    store.$hidden = new Signal.State(false);
    assert.deepEqual(store.$hidden.get(), true);
  });

  it("ignores a stored value whose type differs from the default", () => {
    localStorage.setItem(storageKey, JSON.stringify({ hidden: "yes" }));
    const store = new PersistedReactiveStore(storageKey);
    store.$hidden = new Signal.State(false);
    assert.deepEqual(store.$hidden.get(), false);
  });

  it("restores any stored value when the default is null", () => {
    localStorage.setItem(storageKey, JSON.stringify({ selected: "following" }));
    const store = new PersistedReactiveStore(storageKey);
    store.$selected = new Signal.State(null);
    assert.deepEqual(store.$selected.get(), "following");
  });

  it("keeps a null default when nothing is stored", () => {
    const store = new PersistedReactiveStore(storageKey);
    store.$selected = new Signal.State(null);
    assert.deepEqual(store.$selected.get(), null);
  });

  it("saves changed values and drops values back at their default", async () => {
    const store = new PersistedReactiveStore(storageKey);
    store.$hidden = new Signal.State(false);
    store.$selected = new Signal.State(null);

    store.$hidden.set(true);
    store.$selected.set("following");
    await flushEffects();
    assert.deepEqual(JSON.parse(localStorage.getItem(storageKey)), {
      hidden: true,
      selected: "following",
    });

    store.$hidden.set(false);
    store.$selected.set(null);
    await flushEffects();
    assert.deepEqual(localStorage.getItem(storageKey), null);
  });

  it("does not write the defaults back on registration", async () => {
    const store = new PersistedReactiveStore(storageKey);
    store.$hidden = new Signal.State(false);
    await flushEffects();
    assert.deepEqual(localStorage.getItem(storageKey), null);
  });

  it("throws without a storage key", () => {
    assert.throws(() => new PersistedReactiveStore(), /storage key/);
  });
});
