import { TestSuite } from "../testSuite.js";
import { assert, assertEquals } from "../testHelpers.js";
import {
  unique,
  noop,
  sliceByByte,
  formatLargeNumber,
  formatFullTimestamp,
  classnames,
  deepClone,
} from "../../src/js/utils.js";

const t = new TestSuite("utils");

t.describe("unique", (it) => {
  it("should remove duplicates from simple array", () => {
    const input = [1, 2, 2, 3, 1, 4];
    const result = unique(input);
    assertEquals(result, [1, 2, 3, 4]);
  });

  it("should preserve order of first occurrence", () => {
    const input = ["b", "a", "c", "a", "b"];
    const result = unique(input);
    assertEquals(result, ["b", "a", "c"]);
  });

  it("should handle empty array", () => {
    const result = unique([]);
    assertEquals(result, []);
  });

  it("should handle array with no duplicates", () => {
    const input = [1, 2, 3, 4];
    const result = unique(input);
    assertEquals(result, [1, 2, 3, 4]);
  });

  it("should work with objects using key property", () => {
    const input = [
      { id: 1, name: "John" },
      { id: 2, name: "Jane" },
      { id: 1, name: "Johnny" },
      { id: 3, name: "Bob" },
    ];
    const result = unique(input, { by: "id" });
    assertEquals(result, [
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
    assertEquals(result, [
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
    assertEquals(result, [
      { name: "John", age: 30 },
      { name: "Jane", age: 25 },
      { name: "Bob", age: 35 },
    ]);
  });
});

t.describe("noop", (it) => {
  it("should do nothing and return undefined", () => {
    const result = noop();
    assertEquals(result, undefined);
  });
});

t.describe("sliceByByte", (it) => {
  it("should slice ASCII string by byte indices", () => {
    const text = "Hello World";
    const result = sliceByByte(text, 0, 5);
    assertEquals(result, "Hello");
  });

  it("should handle multibyte UTF-8 characters", () => {
    const text = "Hello 世界";
    const result = sliceByByte(text, 0, 6);
    assertEquals(result, "Hello ");
  });

  it("should slice emoji correctly", () => {
    const text = "Hello 👋 World";
    const result = sliceByByte(text, 0, 6);
    assertEquals(result, "Hello ");
  });

  it("should handle end parameter", () => {
    const text = "Hello World";
    const result = sliceByByte(text, 6, 11);
    assertEquals(result, "World");
  });
});

t.describe("formatLargeNumber", (it) => {
  it("should format numbers >= 1000 with K suffix", () => {
    assertEquals(formatLargeNumber(1500), "1.5K");
    assertEquals(formatLargeNumber(2342), "2.3K");
  });

  it("should truncate decimal instead of rounding", () => {
    assertEquals(formatLargeNumber(1599), "1.5K");
    assertEquals(formatLargeNumber(1950), "1.9K");
    assertEquals(formatLargeNumber(2999), "2.9K");
  });

  it("should drop the decimal if it is 0", () => {
    assertEquals(formatLargeNumber(1000), "1K");
    assertEquals(formatLargeNumber(1001), "1K");
    assertEquals(formatLargeNumber(1099), "1K");
    assertEquals(formatLargeNumber(1100), "1.1K");
  });

  it("should return number as-is if < 1000", () => {
    assertEquals(formatLargeNumber(0), 0);
    assertEquals(formatLargeNumber(50), 50);
    assertEquals(formatLargeNumber(999), 999);
  });
});

t.describe("formatFullTimestamp", (it) => {
  it("should format timestamp correctly", () => {
    const timestamp = "2025-09-29T15:44:00.000Z";
    const result = formatFullTimestamp(timestamp);
    assert(result.includes("September"));
    assert(result.includes("29"));
    assert(result.includes("2025"));
  });
});

t.describe("classnames", (it) => {
  it("should combine string classnames", () => {
    const result = classnames("foo", "bar", "baz");
    assertEquals(result, "foo bar baz");
  });

  it("should handle object with truthy values", () => {
    const result = classnames({ foo: true, bar: false, baz: true });
    assertEquals(result, "foo baz");
  });

  it("should combine strings and objects", () => {
    const result = classnames(
      "base",
      { active: true, disabled: false },
      "extra",
    );
    assertEquals(result, "base active extra");
  });

  it("should handle empty input", () => {
    const result = classnames();
    assertEquals(result, "");
  });

  it("should throw error for invalid input", () => {
    let errorThrown = false;
    try {
      classnames(123);
    } catch (e) {
      errorThrown = true;
      assertEquals(e.message, "Invalid classname definition");
    }
    assert(errorThrown);
  });
});

t.describe("deepClone", (it) => {
  it("should clone primitive values", () => {
    assertEquals(deepClone(42), 42);
    assertEquals(deepClone("hello"), "hello");
    assertEquals(deepClone(true), true);
    assertEquals(deepClone(null), null);
    assertEquals(deepClone(undefined), undefined);
  });

  it("should clone simple arrays", () => {
    const input = [1, 2, 3];
    const result = deepClone(input);
    assertEquals(result, [1, 2, 3]);
    assert(result !== input, "Should create new array");
  });

  it("should clone simple objects", () => {
    const input = { a: 1, b: 2, c: 3 };
    const result = deepClone(input);
    assertEquals(result, { a: 1, b: 2, c: 3 });
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
    assertEquals(result, input);
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
    assertEquals(result, input);
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
    assertEquals(result, input);
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
    assertEquals(result, input);
    assert(result !== input, "Should create new object");
    assert(result.array !== input.array, "Should clone array property");
    assert(result.nested !== input.nested, "Should clone nested object");
  });

  it("should not mutate original when modifying clone", () => {
    const input = { a: 1, b: { c: 2 } };
    const result = deepClone(input);
    result.a = 999;
    result.b.c = 999;
    assertEquals(input.a, 1, "Original should not be modified");
    assertEquals(input.b.c, 2, "Nested original should not be modified");
    assertEquals(result.a, 999);
    assertEquals(result.b.c, 999);
  });

  it("should handle empty arrays and objects", () => {
    assertEquals(deepClone([]), []);
    assertEquals(deepClone({}), {});
  });
});

await t.run();
