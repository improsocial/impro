import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import {
  unique,
  groupBy,
  sortBy,
  noop,
  sliceByByte,
  formatLargeNumber,
  formatFullTimestamp,
  classnames,
  shallowEquals,
  deepClone,
  differenceInMinutes,
  differenceInHours,
  differenceInDays,
  buildQueryString,
  ImageLoader,
  compareVersions,
  getPostLangs,
  getBrowserLanguageCodes,
  withTimeout,
  wait,
  enableLongPress,
  enableDragToDismiss,
  TimeoutError,
  debounce,
  resetScrollOnBlur,
  pinScrollPosition,
} from "/js/utils.js";

describe("sortBy", () => {
  it("sorts by a key string ascending", () => {
    const input = [{ name: "Gamma" }, { name: "Alpha" }, { name: "Beta" }];
    const result = sortBy(input, "name");
    assert.deepEqual(
      result.map((item) => item.name),
      ["Alpha", "Beta", "Gamma"],
    );
  });

  it("sorts by a function descending", () => {
    const input = [{ value: 1 }, { value: 3 }, { value: 2 }];
    const result = sortBy(input, (item) => item.value, {
      direction: "desc",
    });
    assert.deepEqual(
      result.map((item) => item.value),
      [3, 2, 1],
    );
  });

  it("returns a copy without mutating the input array", () => {
    const input = [{ name: "Beta" }, { name: "Alpha" }];
    const result = sortBy(input, "name");
    assert(result !== input);
    assert.deepEqual(
      input.map((item) => item.name),
      ["Beta", "Alpha"],
    );
  });

  it("throws on an invalid direction", () => {
    assert.throws(() => sortBy([], "name", { direction: "up" }), {
      message: "Invalid direction: up",
    });
  });
});

describe("unique", () => {
  it("should remove duplicates from simple array", () => {
    const input = [1, 2, 2, 3, 1, 4];
    const result = unique(input);
    assert.deepEqual(result, [1, 2, 3, 4]);
  });

  it("should preserve order of first occurrence", () => {
    const input = ["b", "a", "c", "a", "b"];
    const result = unique(input);
    assert.deepEqual(result, ["b", "a", "c"]);
  });

  it("should handle empty array", () => {
    const result = unique([]);
    assert.deepEqual(result, []);
  });

  it("should handle array with no duplicates", () => {
    const input = [1, 2, 3, 4];
    const result = unique(input);
    assert.deepEqual(result, [1, 2, 3, 4]);
  });

  it("should work with objects using key property", () => {
    const input = [
      { id: 1, name: "John" },
      { id: 2, name: "Jane" },
      { id: 1, name: "Johnny" },
      { id: 3, name: "Bob" },
    ];
    const result = unique(input, { by: "id" });
    assert.deepEqual(result, [
      { id: 1, name: "John" },
      { id: 2, name: "Jane" },
      { id: 3, name: "Bob" },
    ]);
  });

  it("should work with objects using function", () => {
    const input = [
      { id: 1, name: "John" },
      { id: 2, name: "Jane" },
      { id: 1, name: "Johnny" },
      { id: 3, name: "Bob" },
    ];
    const result = unique(input, { by: (item) => item.id });
    assert.deepEqual(result, [
      { id: 1, name: "John" },
      { id: 2, name: "Jane" },
      { id: 3, name: "Bob" },
    ]);
  });

  it("should work with function that returns complex key", () => {
    const input = [
      { name: "John", age: 30 },
      { name: "Jane", age: 25 },
      { name: "John", age: 30 },
      { name: "Bob", age: 35 },
    ];
    const result = unique(input, { by: (item) => `${item.name}-${item.age}` });
    assert.deepEqual(result, [
      { name: "John", age: 30 },
      { name: "Jane", age: 25 },
      { name: "Bob", age: 35 },
    ]);
  });
});

describe("groupBy", () => {
  it("should group items by key string", () => {
    const input = [
      { pluginId: "a", title: "1" },
      { pluginId: "b", title: "2" },
      { pluginId: "a", title: "3" },
    ];
    const result = groupBy(input, "pluginId");
    assert.deepEqual(
      [...result.entries()],
      [
        [
          "a",
          [
            { pluginId: "a", title: "1" },
            { pluginId: "a", title: "3" },
          ],
        ],
        ["b", [{ pluginId: "b", title: "2" }]],
      ],
    );
  });

  it("should group items by function", () => {
    const input = [1, 2, 3, 4, 5];
    const result = groupBy(input, (n) => (n % 2 === 0 ? "even" : "odd"));
    assert.deepEqual(
      [...result.entries()],
      [
        ["odd", [1, 3, 5]],
        ["even", [2, 4]],
      ],
    );
  });

  it("should preserve insertion order of keys", () => {
    const input = [
      { id: "b" },
      { id: "a" },
      { id: "b" },
      { id: "c" },
      { id: "a" },
    ];
    const result = groupBy(input, "id");
    assert.deepEqual([...result.keys()], ["b", "a", "c"]);
  });

  it("should return empty Map for empty array", () => {
    const result = groupBy([], "id");
    assert.deepEqual([...result.entries()], []);
  });
});

describe("noop", () => {
  it("should do nothing and return undefined", () => {
    const result = noop();
    assert.deepEqual(result, undefined);
  });
});

describe("sliceByByte", () => {
  it("should slice ASCII string by byte indices", () => {
    const text = "Hello World";
    const result = sliceByByte(text, 0, 5);
    assert.deepEqual(result, "Hello");
  });

  it("should handle multibyte UTF-8 characters", () => {
    const text = "Hello 世界";
    const result = sliceByByte(text, 0, 6);
    assert.deepEqual(result, "Hello ");
  });

  it("should slice emoji correctly", () => {
    const text = "Hello 👋 World";
    const result = sliceByByte(text, 0, 6);
    assert.deepEqual(result, "Hello ");
  });

  it("should handle end parameter", () => {
    const text = "Hello World";
    const result = sliceByByte(text, 6, 11);
    assert.deepEqual(result, "World");
  });
});

describe("formatLargeNumber", () => {
  it("should format numbers >= 1000 with K suffix", () => {
    assert.deepEqual(formatLargeNumber(1500), "1.5K");
    assert.deepEqual(formatLargeNumber(2342), "2.3K");
  });

  it("should truncate decimal instead of rounding", () => {
    assert.deepEqual(formatLargeNumber(1599), "1.5K");
    assert.deepEqual(formatLargeNumber(1950), "1.9K");
    assert.deepEqual(formatLargeNumber(2999), "2.9K");
  });

  it("should drop the decimal if it is 0", () => {
    assert.deepEqual(formatLargeNumber(1000), "1K");
    assert.deepEqual(formatLargeNumber(1001), "1K");
    assert.deepEqual(formatLargeNumber(1099), "1K");
    assert.deepEqual(formatLargeNumber(1100), "1.1K");
  });

  it("should return number as-is if < 1000", () => {
    assert.deepEqual(formatLargeNumber(0), 0);
    assert.deepEqual(formatLargeNumber(50), 50);
    assert.deepEqual(formatLargeNumber(999), 999);
  });

  it("should format numbers >= 1,000,000 with M suffix", () => {
    assert.deepEqual(formatLargeNumber(1_000_000), "1M");
    assert.deepEqual(formatLargeNumber(1_500_000), "1.5M");
    assert.deepEqual(formatLargeNumber(2_990_000), "2.9M");
    assert.deepEqual(formatLargeNumber(12_345_678), "12.3M");
    assert.deepEqual(formatLargeNumber(1_099_000), "1M");
  });
});

describe("formatFullTimestamp", () => {
  it("should format timestamp correctly", () => {
    const timestamp = "2025-09-29T15:44:00.000Z";
    const result = formatFullTimestamp(timestamp);
    assert(result.includes("September"));
    assert(result.includes("29"));
    assert(result.includes("2025"));
  });
});

describe("classnames", () => {
  it("should combine string classnames", () => {
    const result = classnames("foo", "bar", "baz");
    assert.deepEqual(result, "foo bar baz");
  });

  it("should handle object with truthy values", () => {
    const result = classnames({ foo: true, bar: false, baz: true });
    assert.deepEqual(result, "foo baz");
  });

  it("should combine strings and objects", () => {
    const result = classnames(
      "base",
      { active: true, disabled: false },
      "extra",
    );
    assert.deepEqual(result, "base active extra");
  });

  it("should handle empty input", () => {
    const result = classnames();
    assert.deepEqual(result, "");
  });

  it("should throw error for invalid input", () => {
    let errorThrown = false;
    try {
      classnames(123);
    } catch (e) {
      errorThrown = true;
      assert.deepEqual(e.message, "Invalid classname definition");
    }
    assert(errorThrown);
  });
});

describe("shallowEquals", () => {
  it("returns true for the same reference and for equal null/undefined", () => {
    const obj = { a: 1 };
    assert.deepEqual(shallowEquals(obj, obj), true);
    assert.deepEqual(shallowEquals(null, null), true);
    assert.deepEqual(shallowEquals(undefined, undefined), true);
  });

  it("returns false when either side is nullish and the other is not", () => {
    assert.deepEqual(shallowEquals(null, {}), false);
    assert.deepEqual(shallowEquals({}, null), false);
  });

  it("compares own keys by value identity", () => {
    assert.deepEqual(shallowEquals({ a: 1, b: "x" }, { a: 1, b: "x" }), true);
    assert.deepEqual(shallowEquals({ a: 1 }, { a: 2 }), false);
    const nested = { c: 3 };
    assert.deepEqual(shallowEquals({ a: nested }, { a: nested }), true);
    assert.deepEqual(shallowEquals({ a: { c: 3 } }, { a: { c: 3 } }), false);
  });

  it("returns false when key sets differ", () => {
    assert.deepEqual(shallowEquals({ a: 1 }, { a: 1, b: 2 }), false);
    assert.deepEqual(shallowEquals({ a: 1, b: 2 }, { a: 1 }), false);
  });
});

describe("deepClone", () => {
  it("should clone primitive values", () => {
    assert.deepEqual(deepClone(42), 42);
    assert.deepEqual(deepClone("hello"), "hello");
    assert.deepEqual(deepClone(true), true);
    assert.deepEqual(deepClone(null), null);
    assert.deepEqual(deepClone(undefined), undefined);
  });

  it("should clone simple arrays", () => {
    const input = [1, 2, 3];
    const result = deepClone(input);
    assert.deepEqual(result, [1, 2, 3]);
    assert(result !== input, "Should create new array");
  });

  it("should clone simple objects", () => {
    const input = { a: 1, b: 2, c: 3 };
    const result = deepClone(input);
    assert.deepEqual(result, { a: 1, b: 2, c: 3 });
    assert(result !== input, "Should create new object");
  });

  it("should clone nested objects", () => {
    const input = {
      name: "John",
      address: {
        street: "123 Main St",
        city: "Boston",
        coords: {
          lat: 42.3601,
          lng: -71.0589,
        },
      },
    };
    const result = deepClone(input);
    assert.deepEqual(result, input);
    assert(result !== input, "Should create new object");
    assert(result.address !== input.address, "Should clone nested object");
    assert(
      result.address.coords !== input.address.coords,
      "Should clone deeply nested object",
    );
  });

  it("should clone nested arrays", () => {
    const input = [
      [1, 2],
      [3, 4],
      [5, [6, 7]],
    ];
    const result = deepClone(input);
    assert.deepEqual(result, input);
    assert(result !== input, "Should create new array");
    assert(result[0] !== input[0], "Should clone nested arrays");
    assert(result[2][1] !== input[2][1], "Should clone deeply nested arrays");
  });

  it("should clone mixed nested structures", () => {
    const input = {
      users: [
        { id: 1, name: "Alice", tags: ["admin", "user"] },
        { id: 2, name: "Bob", tags: ["user"] },
      ],
      metadata: {
        count: 2,
        filters: ["active", "verified"],
      },
    };
    const result = deepClone(input);
    assert.deepEqual(result, input);
    assert(result !== input, "Should create new object");
    assert(result.users !== input.users, "Should clone array");
    assert(result.users[0] !== input.users[0], "Should clone objects in array");
    assert(
      result.users[0].tags !== input.users[0].tags,
      "Should clone nested arrays",
    );
  });

  it("should handle objects with various value types", () => {
    const input = {
      string: "text",
      number: 42,
      boolean: true,
      nullValue: null,
      undefinedValue: undefined,
      array: [1, 2, 3],
      nested: { key: "value" },
    };
    const result = deepClone(input);
    assert.deepEqual(result, input);
    assert(result !== input, "Should create new object");
    assert(result.array !== input.array, "Should clone array property");
    assert(result.nested !== input.nested, "Should clone nested object");
  });

  it("should not mutate original when modifying clone", () => {
    const input = { a: 1, b: { c: 2 } };
    const result = deepClone(input);
    result.a = 999;
    result.b.c = 999;
    assert.deepEqual(input.a, 1, "Original should not be modified");
    assert.deepEqual(input.b.c, 2, "Nested original should not be modified");
    assert.deepEqual(result.a, 999);
    assert.deepEqual(result.b.c, 999);
  });

  it("should handle empty arrays and objects", () => {
    assert.deepEqual(deepClone([]), []);
    assert.deepEqual(deepClone({}), {});
  });
});

describe("differenceInMinutes", () => {
  it("should return the difference in minutes between two dates", () => {
    const a = new Date("2025-01-01T12:00:00Z");
    const b = new Date("2025-01-01T12:30:00Z");
    assert.deepEqual(differenceInMinutes(a, b), 30);
  });

  it("should return absolute difference regardless of order", () => {
    const a = new Date("2025-01-01T12:30:00Z");
    const b = new Date("2025-01-01T12:00:00Z");
    assert.deepEqual(differenceInMinutes(a, b), 30);
  });

  it("should accept string arguments", () => {
    assert.deepEqual(
      differenceInMinutes("2025-01-01T12:00:00Z", "2025-01-01T13:00:00Z"),
      60,
    );
  });

  it("should floor partial minutes", () => {
    const a = new Date("2025-01-01T12:00:00Z");
    const b = new Date("2025-01-01T12:05:45Z");
    assert.deepEqual(differenceInMinutes(a, b), 5);
  });

  it("should return 0 for identical dates", () => {
    const date = new Date("2025-01-01T12:00:00Z");
    assert.deepEqual(differenceInMinutes(date, date), 0);
  });
});

describe("differenceInHours", () => {
  it("should return the difference in hours between two dates", () => {
    const a = new Date("2025-01-01T15:00:00Z");
    const b = new Date("2025-01-01T12:00:00Z");
    assert.deepEqual(differenceInHours(a, b), 3);
  });

  it("should ceil partial hours", () => {
    const a = new Date("2025-01-01T12:30:00Z");
    const b = new Date("2025-01-01T12:00:00Z");
    assert.deepEqual(differenceInHours(a, b), 1);
  });

  it("should return negative when first date is earlier", () => {
    const a = new Date("2025-01-01T10:00:00Z");
    const b = new Date("2025-01-01T12:00:00Z");
    assert.deepEqual(differenceInHours(a, b), -2);
  });

  it("should return 0 for identical dates", () => {
    const date = new Date("2025-01-01T12:00:00Z");
    assert.deepEqual(differenceInHours(date, date), 0);
  });
});

describe("differenceInDays", () => {
  it("should return the difference in days between two dates", () => {
    const a = new Date("2025-01-05T12:00:00Z");
    const b = new Date("2025-01-01T12:00:00Z");
    assert.deepEqual(differenceInDays(a, b), 4);
  });

  it("should ceil partial days", () => {
    const a = new Date("2025-01-02T06:00:00Z");
    const b = new Date("2025-01-01T12:00:00Z");
    assert.deepEqual(differenceInDays(a, b), 1);
  });

  it("should return negative when first date is earlier", () => {
    const a = new Date("2025-01-01T12:00:00Z");
    const b = new Date("2025-01-05T12:00:00Z");
    assert.deepEqual(differenceInDays(a, b), -4);
  });

  it("should return 0 for identical dates", () => {
    const date = new Date("2025-01-01T12:00:00Z");
    assert.deepEqual(differenceInDays(date, date), 0);
  });
});

describe("buildQueryString", () => {
  it("should build a query string from simple key-value pairs", () => {
    const result = buildQueryString({ foo: "bar", baz: "qux" });
    assert.deepEqual(result, "foo=bar&baz=qux");
  });

  it("should url-encode keys and values", () => {
    const result = buildQueryString({ "a key": "a value", other: "a&b" });
    assert.deepEqual(result, "a+key=a+value&other=a%26b");
  });

  it("should repeat the key for array values", () => {
    const result = buildQueryString({ tag: ["a", "b", "c"] });
    assert.deepEqual(result, "tag=a&tag=b&tag=c");
  });

  it("should handle a mix of scalar and array values", () => {
    const result = buildQueryString({ q: "hello", tag: ["a", "b"] });
    assert.deepEqual(result, "q=hello&tag=a&tag=b");
  });

  it("should stringify non-string scalar values", () => {
    const result = buildQueryString({ limit: 25, active: true });
    assert.deepEqual(result, "limit=25&active=true");
  });

  it("should return an empty string for an empty object", () => {
    assert.deepEqual(buildQueryString({}), "");
  });

  it("should omit the key entirely for an empty array", () => {
    const result = buildQueryString({ tag: [] });
    assert.deepEqual(result, "");
  });
});

describe("ImageLoader", () => {
  const originalImage = window.Image;

  class MockImage {
    static instances = [];
    constructor() {
      this.onload = null;
      this.onerror = null;
      this._src = "";
      MockImage.instances.push(this);
    }
    set src(value) {
      this._src = value;
    }
    get src() {
      return this._src;
    }
  }

  beforeEach(() => {
    MockImage.instances = [];
    window.Image = MockImage;
  });

  afterEach(() => {
    window.Image = originalImage;
  });

  async function assertRejects(promise) {
    let threw = false;
    try {
      await promise;
    } catch {
      threw = true;
    }
    assert(threw, "expected promise to reject");
  }

  it("returns the same promise for concurrent loads of the same src", async () => {
    const loader = new ImageLoader();
    const promiseA = loader.load("a.jpg");
    const promiseB = loader.load("a.jpg");

    assert.deepEqual(MockImage.instances.length, 1);
    assert(promiseA === promiseB);

    MockImage.instances[0].onload();
    await promiseA;
    assert(loader.isLoaded("a.jpg"));
  });

  it("does not refetch a src that has already loaded", async () => {
    const loader = new ImageLoader();
    const first = loader.load("b.jpg");
    MockImage.instances[0].onload();
    await first;

    await loader.load("b.jpg");
    assert.deepEqual(MockImage.instances.length, 1);
  });

  it("isLoaded returns false until the load completes", async () => {
    const loader = new ImageLoader();
    const promise = loader.load("c.jpg");
    assert.deepEqual(loader.isLoaded("c.jpg"), false);

    MockImage.instances[0].onload();
    await promise;
    assert.deepEqual(loader.isLoaded("c.jpg"), true);
  });

  it("abort rejects in-flight loads and clears their handlers", async () => {
    const loader = new ImageLoader();
    const promise = loader.load("d.jpg");
    loader.abort();

    await assertRejects(promise);
    assert.deepEqual(MockImage.instances[0].onload, null);
    assert.deepEqual(MockImage.instances[0].onerror, null);
    assert.deepEqual(loader.isLoaded("d.jpg"), false);
  });

  it("abort allows a subsequent load to refetch", async () => {
    const loader = new ImageLoader();
    const aborted = loader.load("e.jpg");
    loader.abort();
    await assertRejects(aborted);
    loader.load("e.jpg");

    assert.deepEqual(MockImage.instances.length, 2);
  });

  it("resolves on success and rejects on error", async () => {
    const loader = new ImageLoader();
    const okPromise = loader.load("ok.jpg");
    MockImage.instances[0].onload();
    await okPromise;

    const failPromise = loader.load("bad.jpg");
    MockImage.instances[1].onerror();
    await assertRejects(failPromise);
  });

  it("does not refetch a src that has already failed", async () => {
    const loader = new ImageLoader();
    const promise = loader.load("f.jpg");
    MockImage.instances[0].onerror();
    await assertRejects(promise);

    assert.deepEqual(loader.isLoaded("f.jpg"), false);
    assert.deepEqual(loader.hasFailed("f.jpg"), true);
    await assertRejects(loader.load("f.jpg"));
    assert.deepEqual(MockImage.instances.length, 1);
  });
});

describe("compareVersions", () => {
  it("returns 0 for equal versions", () => {
    assert.deepEqual(compareVersions("1.2.3", "1.2.3"), 0);
    assert.deepEqual(compareVersions("0.0.0", "0.0.0"), 0);
  });

  it("returns 1 when first is greater", () => {
    assert.deepEqual(compareVersions("1.2.4", "1.2.3"), 1);
    assert.deepEqual(compareVersions("1.3.0", "1.2.99"), 1);
    assert.deepEqual(compareVersions("2.0.0", "1.99.99"), 1);
  });

  it("returns -1 when first is less", () => {
    assert.deepEqual(compareVersions("1.2.3", "1.2.4"), -1);
    assert.deepEqual(compareVersions("0.0.0", "0.0.1"), -1);
  });

  it("pads missing parts with 0", () => {
    assert.deepEqual(compareVersions("1", "1.0.0"), 0);
    assert.deepEqual(compareVersions("1.2", "1.2.0"), 0);
    assert.deepEqual(compareVersions("1.2.0", "1.2.1"), -1);
  });

  it("ignores prerelease tags", () => {
    assert.deepEqual(compareVersions("1.2.3-beta", "1.2.3"), 0);
    assert.deepEqual(compareVersions("1.2.3-rc.1", "1.2.4-alpha"), -1);
  });

  it("coerces malformed parts to 0", () => {
    assert.deepEqual(compareVersions("abc", "0.0.0"), 0);
    assert.deepEqual(compareVersions("1.x.3", "1.0.3"), 0);
    assert.deepEqual(compareVersions(undefined, "0.0.1"), -1);
    assert.deepEqual(compareVersions(null, null), 0);
  });
});

describe("getPostLangs", () => {
  let originalLanguages;
  let originalLanguage;

  beforeEach(() => {
    originalLanguages = Object.getOwnPropertyDescriptor(navigator, "languages");
    originalLanguage = Object.getOwnPropertyDescriptor(navigator, "language");
  });

  afterEach(() => {
    if (originalLanguages) {
      Object.defineProperty(navigator, "languages", originalLanguages);
    }
    if (originalLanguage) {
      Object.defineProperty(navigator, "language", originalLanguage);
    }
  });

  function setLanguages(languages, language) {
    Object.defineProperty(navigator, "languages", {
      value: languages,
      configurable: true,
    });
    Object.defineProperty(navigator, "language", {
      value: language,
      configurable: true,
    });
  }

  it("returns base language codes from navigator.languages", () => {
    setLanguages(["en-US", "fr-FR"], "en-US");
    assert.deepEqual(getPostLangs(), ["en", "fr"]);
  });

  it("dedupes language codes", () => {
    setLanguages(["en-US", "en-GB", "fr-FR"], "en-US");
    assert.deepEqual(getPostLangs(), ["en", "fr"]);
  });

  it("limits to top 3 codes", () => {
    setLanguages(["en", "fr", "de", "es", "ja"], "en");
    assert.deepEqual(getPostLangs(), ["en", "fr", "de"]);
  });

  it("falls back to navigator.language when languages is empty", () => {
    setLanguages([], "es-MX");
    assert.deepEqual(getPostLangs(), ["es"]);
  });

  it("falls back to ['en'] when no locale info is available", () => {
    setLanguages([], "");
    assert.deepEqual(getPostLangs(), ["en"]);
  });
});

describe("getBrowserLanguageCodes", () => {
  let originalLanguages;
  let originalLanguage;

  beforeEach(() => {
    originalLanguages = Object.getOwnPropertyDescriptor(navigator, "languages");
    originalLanguage = Object.getOwnPropertyDescriptor(navigator, "language");
  });

  afterEach(() => {
    if (originalLanguages) {
      Object.defineProperty(navigator, "languages", originalLanguages);
    }
    if (originalLanguage) {
      Object.defineProperty(navigator, "language", originalLanguage);
    }
  });

  function setLanguages(languages, language) {
    Object.defineProperty(navigator, "languages", {
      value: languages,
      configurable: true,
    });
    Object.defineProperty(navigator, "language", {
      value: language,
      configurable: true,
    });
  }

  it("returns deduped base language codes from navigator.languages", () => {
    setLanguages(["en-US", "en-GB", "fr-FR"], "en-US");
    assert.deepEqual(getBrowserLanguageCodes(), ["en", "fr"]);
  });

  it("does not limit the number of codes", () => {
    setLanguages(["en", "fr", "de", "es", "ja"], "en");
    assert.deepEqual(getBrowserLanguageCodes(), ["en", "fr", "de", "es", "ja"]);
  });

  it("falls back to navigator.language when languages is empty", () => {
    setLanguages([], "es-MX");
    assert.deepEqual(getBrowserLanguageCodes(), ["es"]);
  });

  it("returns an empty array when no locale info is available", () => {
    setLanguages([], "");
    assert.deepEqual(getBrowserLanguageCodes(), []);
  });
});

describe("withTimeout", () => {
  it("resolves with the value when fn completes before the timeout", async () => {
    const result = await withTimeout(async () => "ok", 50);
    assert.deepEqual(result, "ok");
  });

  it("rejects with TimeoutError when fn exceeds the timeout", async () => {
    let caught;
    try {
      await withTimeout(
        () => new Promise((resolve) => setTimeout(resolve, 50)),
        5,
      );
    } catch (error) {
      caught = error;
    }
    assert(caught instanceof TimeoutError, "expected a TimeoutError");
    assert.deepEqual(caught.name, "TimeoutError");
    assert.deepEqual(caught.message, "Timed out");
  });

  it("passes an AbortSignal to fn", async () => {
    let receivedSignal;
    await withTimeout(async (signal) => {
      receivedSignal = signal;
    }, 50);
    assert(
      receivedSignal instanceof AbortSignal,
      "expected fn to receive an AbortSignal",
    );
    assert.deepEqual(receivedSignal.aborted, false);
  });

  it("aborts the signal when the timeout fires", async () => {
    let receivedSignal;
    try {
      await withTimeout(
        (signal) =>
          new Promise((resolve) => {
            receivedSignal = signal;
            setTimeout(resolve, 50);
          }),
        5,
      );
    } catch {
      // expected
    }
    assert.deepEqual(receivedSignal.aborted, true);
  });

  it("does not abort the signal when fn resolves first", async () => {
    let receivedSignal;
    await withTimeout(async (signal) => {
      receivedSignal = signal;
    }, 50);
    // Wait past the timeout to confirm the timer was cleared.
    await new Promise((resolve) => setTimeout(resolve, 75));
    assert.deepEqual(receivedSignal.aborted, false);
  });

  it("propagates errors thrown by fn", async () => {
    const boom = new Error("boom");
    let caught;
    try {
      await withTimeout(async () => {
        throw boom;
      }, 50);
    } catch (error) {
      caught = error;
    }
    assert.deepEqual(caught, boom);
  });
});

function pressEvent(
  type,
  { clientX = 0, clientY = 0, touch = false, button = 0 } = {},
) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  if (touch) {
    event.touches = [{ clientX, clientY }];
  } else {
    event.clientX = clientX;
    event.clientY = clientY;
    event.button = button;
  }
  return event;
}

describe("enableLongPress", () => {
  let el;
  let longPressCount;
  let originalSetTimeout;

  beforeEach(() => {
    originalSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = (fn) => originalSetTimeout(fn, 0);
    el = document.createElement("div");
    document.body.appendChild(el);
    longPressCount = 0;
    el.addEventListener("long-press", () => longPressCount++);
  });

  afterEach(() => {
    globalThis.setTimeout = originalSetTimeout;
    // Consume any click suppressor a long-press left armed on the document so
    // it cannot leak into the next test.
    document.dispatchEvent(pressEvent("click"));
    el.remove();
  });

  it("dispatches a long-press event after the timeout", async () => {
    enableLongPress(el, 30);
    el.dispatchEvent(pressEvent("mousedown"));
    await wait(60);
    assert.deepEqual(longPressCount, 1);
  });

  it("does not dispatch when released before the timeout", async () => {
    enableLongPress(el, 30);
    el.dispatchEvent(pressEvent("mousedown"));
    el.dispatchEvent(pressEvent("mouseup"));
    await wait(60);
    assert.deepEqual(longPressCount, 0);
  });

  it("cancels when a touch moves beyond the threshold", async () => {
    enableLongPress(el, 30);
    el.dispatchEvent(pressEvent("touchstart", { touch: true }));
    el.dispatchEvent(pressEvent("touchmove", { touch: true, clientX: 50 }));
    await wait(60);
    assert.deepEqual(longPressCount, 0);
  });

  it("does not cancel for small touch movements", async () => {
    enableLongPress(el, 30);
    el.dispatchEvent(pressEvent("touchstart", { touch: true }));
    el.dispatchEvent(
      pressEvent("touchmove", { touch: true, clientX: 3, clientY: 3 }),
    );
    await wait(60);
    assert.deepEqual(longPressCount, 1);
  });

  it("guards against double-binding", async () => {
    enableLongPress(el, 30);
    enableLongPress(el, 30);
    el.dispatchEvent(pressEvent("mousedown"));
    await wait(60);
    assert.deepEqual(longPressCount, 1);
  });

  it("ignores presses from non-primary mouse buttons", async () => {
    enableLongPress(el, 30);
    el.dispatchEvent(pressEvent("mousedown", { button: 2 }));
    await wait(60);
    assert.deepEqual(longPressCount, 0);
  });

  it("suppresses the click that follows a long-press", async () => {
    enableLongPress(el, 30);
    let laterClickCount = 0;
    el.addEventListener("click", () => laterClickCount++);
    el.dispatchEvent(pressEvent("mousedown"));
    await wait(60);
    const click = pressEvent("click");
    el.dispatchEvent(click);
    assert(click.defaultPrevented);
    assert.deepEqual(laterClickCount, 0);
  });

  it("suppresses the trailing click even when it lands on another element", async () => {
    // A long-press can open UI (e.g. a modal sheet) on top of the trigger, so
    // the release's click hits that UI instead of the trigger.
    const overlay = document.createElement("div");
    document.body.appendChild(overlay);
    let overlayClickCount = 0;
    overlay.addEventListener("click", () => overlayClickCount++);
    enableLongPress(el, 30);
    el.dispatchEvent(pressEvent("mousedown"));
    await wait(60);
    const click = pressEvent("click");
    overlay.dispatchEvent(click);
    assert(click.defaultPrevented);
    assert.deepEqual(overlayClickCount, 0);
    overlay.remove();
  });

  it("suppresses only the first click after a long-press", async () => {
    enableLongPress(el, 30);
    el.dispatchEvent(pressEvent("mousedown"));
    await wait(60);
    el.dispatchEvent(pressEvent("click"));
    const secondClick = pressEvent("click");
    el.dispatchEvent(secondClick);
    assert(!secondClick.defaultPrevented);
  });

  it("does not suppress a normal click", () => {
    enableLongPress(el, 30);
    let laterClickCount = 0;
    el.addEventListener("click", () => laterClickCount++);
    const click = pressEvent("click");
    el.dispatchEvent(click);
    assert(!click.defaultPrevented);
    assert.deepEqual(laterClickCount, 1);
  });
});

describe("enableLongPress - context menu", () => {
  let el;

  function setMaxTouchPoints(value) {
    Object.defineProperty(window.navigator, "maxTouchPoints", {
      value,
      configurable: true,
    });
  }

  beforeEach(() => {
    el = document.createElement("div");
    document.body.appendChild(el);
    enableLongPress(el, 30);
    setMaxTouchPoints(5);
  });
  afterEach(() => setMaxTouchPoints(0));

  it("suppresses the context menu on touch devices", () => {
    const contextmenu = pressEvent("contextmenu");
    el.dispatchEvent(contextmenu);
    assert(contextmenu.defaultPrevented);
  });

  it("leaves the context menu alone on non-touch devices", () => {
    setMaxTouchPoints(0);
    const contextmenu = pressEvent("contextmenu");
    el.dispatchEvent(contextmenu);
    assert(!contextmenu.defaultPrevented);
  });
});

describe("enableDragToDismiss", () => {
  let el;
  let closeCount;
  let dragState;
  let originalMatchMedia;
  let originalVisualViewport;

  const setKeyboardOpen = (open) => {
    window.visualViewport = {
      height: open ? window.innerHeight - 300 : window.innerHeight,
    };
  };

  const drag = async (deltaY) => {
    el.dispatchEvent(pressEvent("touchstart", { touch: true, clientY: 100 }));
    el.dispatchEvent(
      pressEvent("touchmove", { touch: true, clientY: 100 + deltaY }),
    );
    el.dispatchEvent(pressEvent("touchend", { touch: true }));
    await wait(0);
  };

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    window.matchMedia = (query) => ({
      matches: query === "(max-width: 799px)",
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    });
    originalVisualViewport = window.visualViewport;
    setKeyboardOpen(false);
    el = document.createElement("div");
    document.body.appendChild(el);
    closeCount = 0;
    dragState = null;
  });

  afterEach(() => {
    dragState?.cleanup();
    el.remove();
    window.matchMedia = originalMatchMedia;
    window.visualViewport = originalVisualViewport;
  });

  it("returns null on non-mobile viewports", () => {
    window.matchMedia = originalMatchMedia;
    dragState = enableDragToDismiss(el, { onClose: () => closeCount++ });
    assert.deepEqual(dragState, null);
  });

  it("dismisses on a downward drag past the threshold", async () => {
    dragState = enableDragToDismiss(el, { onClose: () => closeCount++ });
    await drag(150);
    assert.deepEqual(closeCount, 1);
  });

  it("does not dismiss on a drag below the threshold", async () => {
    dragState = enableDragToDismiss(el, { onClose: () => closeCount++ });
    await drag(50);
    assert.deepEqual(closeCount, 0);
  });

  it("dismisses while the keyboard is open by default", async () => {
    setKeyboardOpen(true);
    dragState = enableDragToDismiss(el, { onClose: () => closeCount++ });
    await drag(150);
    assert.deepEqual(closeCount, 1);
  });

  it("ignores drags while the keyboard is open when disableWhenKeyboardOpen is true", async () => {
    setKeyboardOpen(true);
    dragState = enableDragToDismiss(el, {
      onClose: () => closeCount++,
      disableWhenKeyboardOpen: true,
    });
    await drag(150);
    assert.deepEqual(closeCount, 0);
    assert.deepEqual(el.style.transform, "");
  });

  it("hides the caret while the sheet is displaced", () => {
    dragState = enableDragToDismiss(el, { onClose: () => closeCount++ });
    el.dispatchEvent(pressEvent("touchstart", { touch: true, clientY: 100 }));
    el.dispatchEvent(pressEvent("touchmove", { touch: true, clientY: 150 }));
    assert.deepEqual(el.style.caretColor, "transparent");
  });

  it("restores the caret only after the snap-back transition lands", async () => {
    dragState = enableDragToDismiss(el, { onClose: () => closeCount++ });
    await drag(50);
    assert.deepEqual(el.style.caretColor, "transparent");
    await wait(200);
    assert.deepEqual(el.style.caretColor, "");
  });

  it("keeps the caret hidden through a dismiss", async () => {
    dragState = enableDragToDismiss(el, { onClose: () => closeCount++ });
    await drag(150);
    assert.deepEqual(el.style.caretColor, "transparent");
  });

  it("restores the caret on cleanup", async () => {
    dragState = enableDragToDismiss(el, { onClose: () => closeCount++ });
    await drag(150);
    dragState.cleanup();
    assert.deepEqual(el.style.caretColor, "");
  });

  describe("with text selected", () => {
    beforeEach(() => {
      el.textContent = "some selectable text";
      const range = document.createRange();
      range.selectNodeContents(el);
      const selection = document.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    });

    afterEach(() => {
      document.getSelection().removeAllRanges();
    });

    it("ignores drags that start while text is selected", async () => {
      dragState = enableDragToDismiss(el, { onClose: () => closeCount++ });
      await drag(150);
      assert.deepEqual(closeCount, 0);
      assert.deepEqual(el.style.transform, "");
    });

    it("abandons a drag when a selection appears mid-gesture", async () => {
      dragState = enableDragToDismiss(el, { onClose: () => closeCount++ });
      document.getSelection().removeAllRanges();
      el.dispatchEvent(pressEvent("touchstart", { touch: true, clientY: 100 }));
      const range = document.createRange();
      range.selectNodeContents(el);
      document.getSelection().addRange(range);
      el.dispatchEvent(pressEvent("touchmove", { touch: true, clientY: 250 }));
      el.dispatchEvent(pressEvent("touchend", { touch: true }));
      await wait(0);
      assert.deepEqual(closeCount, 0);
      assert.deepEqual(el.style.transform, "");
    });
  });
});

describe("debounce", () => {
  let originalSetTimeout;

  beforeEach(() => {
    originalSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = (fn) => originalSetTimeout(fn, 0);
  });

  afterEach(() => {
    globalThis.setTimeout = originalSetTimeout;
  });

  it("fires once with the latest arguments", async () => {
    const calls = [];
    const debounced = debounce((value) => calls.push(value));
    debounced("first");
    debounced("second");
    await wait(10);
    assert.deepEqual(calls, ["second"]);
  });

  it("does not fire a pending invocation after cancel", async () => {
    const calls = [];
    const debounced = debounce((value) => calls.push(value));
    debounced("pending");
    debounced.cancel();
    await wait(10);
    assert.deepEqual(calls, []);
  });

  it("fires again when invoked after cancel", async () => {
    const calls = [];
    const debounced = debounce((value) => calls.push(value));
    debounced("cancelled");
    debounced.cancel();
    debounced("kept");
    await wait(10);
    assert.deepEqual(calls, ["kept"]);
  });
});

describe("resetScrollOnBlur", () => {
  let dialog;
  let scrollArea;

  const blurFrom = (element) => {
    element.dispatchEvent(new window.FocusEvent("blur"));
  };

  beforeEach(() => {
    dialog = document.createElement("dialog");
    scrollArea = document.createElement("div");
    dialog.appendChild(scrollArea);
    document.body.appendChild(dialog);
    resetScrollOnBlur(dialog, scrollArea);
    scrollArea.scrollTop = 42;
  });

  afterEach(() => {
    dialog.remove();
  });

  it("resets the scroll area when a textarea blurs", () => {
    const textarea = document.createElement("textarea");
    scrollArea.appendChild(textarea);
    blurFrom(textarea);
    assert.deepEqual(scrollArea.scrollTop, 0);
  });

  it("resets the scroll area when an input blurs", () => {
    const input = document.createElement("input");
    scrollArea.appendChild(input);
    blurFrom(input);
    assert.deepEqual(scrollArea.scrollTop, 0);
  });

  it("resets the scroll area when a contenteditable element blurs", () => {
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    scrollArea.appendChild(editable);
    blurFrom(editable);
    assert.deepEqual(scrollArea.scrollTop, 0);
  });

  it("does not reset scroll when a button blurs", () => {
    const button = document.createElement("button");
    scrollArea.appendChild(button);
    blurFrom(button);
    assert.deepEqual(scrollArea.scrollTop, 42);
  });
});

describe("pinScrollPosition", () => {
  let activeStops;
  let scroller;

  beforeEach(() => {
    activeStops = [];
    scroller = document.createElement("div");
  });

  afterEach(() => {
    for (const stop of activeStops) {
      stop();
    }
  });

  const startPin = (options) => {
    const stop = pinScrollPosition(options);
    activeStops.push(stop);
    return stop;
  };

  it("evaluates the target synchronously and again on later frames", async () => {
    const getTargetY = mock.fn(() => 0);
    startPin({
      targetY: getTargetY,
      durationMs: 30,
      scroller,
    });
    assert.equal(getTargetY.mock.callCount(), 1);
    await wait(60);
    assert(getTargetY.mock.callCount() > 1);
  });

  it("scrolls the scroller to the target", () => {
    startPin({
      targetY: () => 100,
      durationMs: 30,
      scroller,
    });
    assert.equal(scroller.scrollTop, 100);
  });

  it("accepts a plain number target", async () => {
    startPin({ targetY: 100, durationMs: 60, scroller });
    assert.equal(scroller.scrollTop, 100);
    scroller.scrollTop = 130;
    await wait(30);
    assert.equal(scroller.scrollTop, 100);
  });

  it("re-pins when the position deviates from the target", async () => {
    startPin({
      targetY: () => 100,
      durationMs: 60,
      scroller,
    });
    scroller.scrollTop = 130;
    await wait(30);
    assert.equal(scroller.scrollTop, 100);
  });

  it("follows a target that moves between frames", async () => {
    let target = 100;
    startPin({
      targetY: () => target,
      durationMs: 60,
      scroller,
    });
    assert.equal(scroller.scrollTop, 100);
    target = 200;
    await wait(30);
    assert.equal(scroller.scrollTop, 200);
  });

  it("stops re-evaluating once the duration elapses", async () => {
    const getTargetY = mock.fn(() => 0);
    startPin({
      targetY: getTargetY,
      durationMs: 20,
      scroller,
    });
    await wait(60);
    const countAfterExpiry = getTargetY.mock.callCount();
    await wait(30);
    assert.equal(getTargetY.mock.callCount(), countAfterExpiry);
  });

  it("stops when getTargetY returns null", async () => {
    const getTargetY = mock.fn(() => null);
    startPin({
      targetY: getTargetY,
      durationMs: 1000,
      scroller,
    });
    await wait(30);
    assert.equal(getTargetY.mock.callCount(), 1);
  });

  it("stops when shouldStop returns true", async () => {
    startPin({
      targetY: () => 100,
      durationMs: 1000,
      scroller,
      shouldStop: (currentY, lastPinnedY) =>
        lastPinnedY !== null && currentY < lastPinnedY - 1,
    });
    assert.equal(scroller.scrollTop, 100);
    scroller.scrollTop = 50;
    await wait(30);
    assert.equal(scroller.scrollTop, 50);
  });

  it("passes the current and last pinned positions to shouldStop", async () => {
    const shouldStop = mock.fn(() => false);
    startPin({
      targetY: () => 100,
      durationMs: 30,
      scroller,
      shouldStop,
    });
    assert.deepEqual(shouldStop.mock.calls[0].arguments, [0, null]);
    await wait(60);
    const laterCall = shouldStop.mock.calls.at(-1);
    assert.deepEqual(laterCall.arguments, [100, 100]);
  });

  it("keeps pinning after an upward deviation without shouldStop", async () => {
    startPin({
      targetY: () => 100,
      durationMs: 60,
      scroller,
    });
    scroller.scrollTop = 50;
    await wait(30);
    assert.equal(scroller.scrollTop, 100);
  });

  it("stops on touchmove on the scroller", async () => {
    const getTargetY = mock.fn(() => 0);
    startPin({
      targetY: getTargetY,
      durationMs: 1000,
      scroller,
    });
    scroller.dispatchEvent(new window.Event("touchmove"));
    const countAtStop = getTargetY.mock.callCount();
    await wait(30);
    assert.equal(getTargetY.mock.callCount(), countAtStop);
  });

  it("stops on wheel on the scroller", async () => {
    const getTargetY = mock.fn(() => 0);
    startPin({
      targetY: getTargetY,
      durationMs: 1000,
      scroller,
    });
    scroller.dispatchEvent(new window.Event("wheel"));
    const countAtStop = getTargetY.mock.callCount();
    await wait(30);
    assert.equal(getTargetY.mock.callCount(), countAtStop);
  });

  it("stops on page-transition", async () => {
    const getTargetY = mock.fn(() => 0);
    startPin({
      targetY: getTargetY,
      durationMs: 1000,
      scroller,
    });
    window.dispatchEvent(new window.CustomEvent("page-transition"));
    const countAtStop = getTargetY.mock.callCount();
    await wait(30);
    assert.equal(getTargetY.mock.callCount(), countAtStop);
  });

  it("stops on keydown", async () => {
    const getTargetY = mock.fn(() => 0);
    startPin({
      targetY: getTargetY,
      durationMs: 1000,
      scroller,
    });
    window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "a" }));
    const countAtStop = getTargetY.mock.callCount();
    await wait(30);
    assert.equal(getTargetY.mock.callCount(), countAtStop);
  });

  it("stops when the returned stop function is called", async () => {
    const getTargetY = mock.fn(() => 0);
    const stop = startPin({
      targetY: getTargetY,
      durationMs: 1000,
      scroller,
    });
    stop();
    await wait(30);
    assert.equal(getTargetY.mock.callCount(), 1);
  });
});
