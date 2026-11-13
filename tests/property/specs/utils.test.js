import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import {
  isValidDid,
  isValidHandle,
  isValidNsid,
  isValidRkey,
  compareVersions,
  getByteIndex,
  getIndexFromByteIndex,
  graphemeCount,
  truncateGraphemes,
  BoundedMap,
} from "/js/utils.js";

// Rule-by-rule restatements of the atproto syntax specs, written without
// regexes over the whole string so they fail independently of the patterns
// under test.
const LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";

function onlyContains(value, characters) {
  return [...value].every((character) => characters.includes(character));
}

function isValidDomainLabel(label) {
  return (
    label.length >= 1 &&
    label.length <= 63 &&
    onlyContains(label, LETTERS + DIGITS + "-") &&
    !label.startsWith("-") &&
    !label.endsWith("-")
  );
}

const syntax = {
  isValidHandle(value) {
    const labels = value.split(".");
    return (
      value.length <= 253 &&
      labels.length >= 2 &&
      labels.every(isValidDomainLabel) &&
      LETTERS.includes(labels.at(-1)[0])
    );
  },
  isValidNsid(value) {
    const segments = value.split(".");
    const name = segments.at(-1);
    return (
      value.length <= 317 &&
      segments.length >= 3 &&
      segments.every(isValidDomainLabel) &&
      !DIGITS.includes(segments[0][0]) &&
      !DIGITS.includes(name[0]) &&
      !name.includes("-")
    );
  },
  isValidRecordKey(value) {
    return (
      value.length >= 1 &&
      value.length <= 512 &&
      value !== "." &&
      value !== ".." &&
      onlyContains(value, LETTERS + DIGITS + "._~:-")
    );
  },
  // Restricted to the two DID methods the app supports.
  isValidDid(value) {
    const method = ["did:plc:", "did:web:"].find((prefix) =>
      value.startsWith(prefix),
    );
    if (!method) return false;
    const identifier = value.slice(method.length);
    return (
      value.length <= 2048 &&
      identifier.length >= 1 &&
      onlyContains(identifier, LETTERS + DIGITS + "._:%-") &&
      !identifier.endsWith(":") &&
      !identifier.endsWith("%")
    );
  },
};

function stringOf(characters, constraints) {
  return fc.string({ unit: fc.constantFrom(...characters), ...constraints });
}

const junkArbitrary = fc.oneof(
  fc.string(),
  fc.string({ unit: "binary" }),
  fc.constantFrom("", ".", "..", " ", "\n"),
);

const labelArbitrary = fc.oneof(
  {
    weight: 6,
    arbitrary: stringOf("abzAZ019-", { minLength: 1, maxLength: 6 }),
  },
  { weight: 1, arbitrary: stringOf("ab1-_ é", { maxLength: 4 }) },
  {
    weight: 1,
    arbitrary: stringOf("a1", { minLength: 62, maxLength: 65, size: "max" }),
  },
);

const dottedArbitrary = fc
  .tuple(
    fc.array(labelArbitrary, { minLength: 1, maxLength: 5 }),
    fc.constantFrom("", "", "", ".", " "),
    fc.constantFrom("", "", "", ".", " "),
  )
  .map(([labels, prefix, suffix]) => prefix + labels.join(".") + suffix);

const longDottedArbitrary = fc
  .array(stringOf("ab1", { minLength: 40, maxLength: 63, size: "max" }), {
    minLength: 3,
    maxLength: 8,
    size: "max",
  })
  .map((labels) => labels.join(".") + ".com");

const handleArbitrary = fc.oneof(
  { weight: 6, arbitrary: dottedArbitrary },
  { weight: 1, arbitrary: longDottedArbitrary },
  { weight: 1, arbitrary: junkArbitrary },
);

const didArbitrary = fc.oneof(
  {
    weight: 6,
    arbitrary: fc
      .tuple(
        fc.constantFrom("did", "DID", "di"),
        fc.constantFrom("plc", "web", "key", "PLC", ""),
        stringOf("abzAZ019._:%-", { maxLength: 12 }),
      )
      .map((parts) => parts.join(":")),
  },
  { weight: 1, arbitrary: stringOf("did:plcweb%._- é/", { maxLength: 20 }) },
  {
    weight: 1,
    arbitrary: stringOf("ab1", {
      minLength: 2036,
      maxLength: 2044,
      size: "max",
    }).map((identifier) => `did:plc:${identifier}`),
  },
  { weight: 1, arbitrary: junkArbitrary },
);

const rkeyArbitrary = fc.oneof(
  { weight: 6, arbitrary: stringOf("abzAZ019._~:-", { maxLength: 12 }) },
  { weight: 2, arbitrary: stringOf("a.~:-_/ é#?", { maxLength: 6 }) },
  {
    weight: 1,
    arbitrary: stringOf("a.", { minLength: 510, maxLength: 514, size: "max" }),
  },
  { weight: 1, arbitrary: junkArbitrary },
);

describe("atproto syntax validator properties", () => {
  it("isValidHandle agrees with the reference rules", () => {
    fc.assert(
      fc.property(handleArbitrary, (value) => {
        assert.deepEqual(isValidHandle(value), syntax.isValidHandle(value));
      }),
      { numRuns: 2000 },
    );
  });

  it("isValidRkey agrees with the reference rules", () => {
    fc.assert(
      fc.property(rkeyArbitrary, (value) => {
        assert.deepEqual(isValidRkey(value), syntax.isValidRecordKey(value));
      }),
      { numRuns: 2000 },
    );
  });

  it("isValidDid agrees with the reference rules", () => {
    fc.assert(
      fc.property(didArbitrary, (value) => {
        assert.deepEqual(isValidDid(value), syntax.isValidDid(value));
      }),
      { numRuns: 2000 },
    );
  });

  it("isValidNsid agrees with the reference rules", () => {
    fc.assert(
      fc.property(handleArbitrary, (value) => {
        assert.deepEqual(isValidNsid(value), syntax.isValidNsid(value));
      }),
      { numRuns: 2000 },
    );
  });
});

const versionPartArbitrary = fc.integer({ min: 0, max: 30 });

const semverArbitrary = fc
  .tuple(
    versionPartArbitrary,
    versionPartArbitrary,
    versionPartArbitrary,
    fc.constantFrom("", "-beta", "-rc.1"),
  )
  .map(([major, minor, patch, suffix]) => ({
    parts: [major, minor, patch],
    text: `${major}.${minor}.${patch}${suffix}`,
  }));

const looseVersionArbitrary = fc.oneof(
  semverArbitrary.map((version) => version.text),
  fc.constantFrom("", "1", "1.2", "v1.2.3", "1.2.3.4", "1.x.3", "-1.2.3"),
  fc.string({ maxLength: 8 }),
  fc.constantFrom(null, undefined),
);

function compareParts(first, second) {
  for (let i = 0; i < 3; i++) {
    if (first[i] !== second[i]) return first[i] > second[i] ? 1 : -1;
  }
  return 0;
}

describe("compareVersions properties", () => {
  it("orders well-formed versions numerically, ignoring the prerelease tag", () => {
    fc.assert(
      fc.property(semverArbitrary, semverArbitrary, (first, second) => {
        assert.deepEqual(
          compareVersions(first.text, second.text),
          compareParts(first.parts, second.parts),
        );
      }),
      { numRuns: 500 },
    );
  });

  it("is a consistent ordering for any input", () => {
    fc.assert(
      fc.property(
        looseVersionArbitrary,
        looseVersionArbitrary,
        looseVersionArbitrary,
        (first, second, third) => {
          assert.deepEqual(compareVersions(first, first), 0);
          assert.deepEqual(
            compareVersions(first, second),
            -compareVersions(second, first) + 0,
          );
          if (
            compareVersions(first, second) <= 0 &&
            compareVersions(second, third) <= 0
          ) {
            assert(compareVersions(first, third) <= 0);
          }
        },
      ),
      { numRuns: 1000 },
    );
  });
});

const unicodeTextArbitrary = fc.oneof(
  fc.string({ unit: "binary", maxLength: 12 }),
  fc.string({ unit: "grapheme", maxLength: 12 }),
  fc
    .array(
      fc.constantFrom("a", "é", "e\u0301", "日", "👋", "🧑‍🚀", "🇯🇵", "👍🏽", " "),
      {
        maxLength: 10,
      },
    )
    .map((parts) => parts.join("")),
);

describe("byte index properties", () => {
  it("getIndexFromByteIndex inverts getByteIndex at every character boundary", () => {
    fc.assert(
      fc.property(unicodeTextArbitrary, (text) => {
        let index = 0;
        for (const character of [...text, ""]) {
          assert.deepEqual(
            getIndexFromByteIndex(text, getByteIndex(text, index)),
            index,
          );
          index += character.length;
        }
      }),
      { numRuns: 500 },
    );
  });
});

describe("truncateGraphemes properties", () => {
  it("returns a prefix no longer than the limit, or the string itself", () => {
    fc.assert(
      fc.property(
        unicodeTextArbitrary,
        fc.integer({ min: 0, max: 12 }),
        (text, maxGraphemes) => {
          const truncated = truncateGraphemes(text, maxGraphemes);
          assert(text.startsWith(truncated));
          assert(graphemeCount(truncated) <= maxGraphemes);
          if (graphemeCount(text) <= maxGraphemes) {
            assert.deepEqual(truncated, text);
          }
        },
      ),
      { numRuns: 500 },
    );
  });
});

const boundedMapOperationArbitrary = fc.oneof(
  {
    weight: 4,
    arbitrary: fc.record({
      type: fc.constant("set"),
      key: fc.integer({ min: 0, max: 5 }),
      value: fc.integer({ min: 0, max: 9 }),
    }),
  },
  {
    weight: 3,
    arbitrary: fc.record({
      type: fc.constantFrom("get", "peek", "delete"),
      key: fc.integer({ min: 0, max: 5 }),
    }),
  },
);

describe("BoundedMap properties", () => {
  it("never exceeds its size and evicts in fifo or lru order", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 4 }),
        fc.constantFrom("fifo", "lru"),
        fc.array(boundedMapOperationArbitrary, { maxLength: 40 }),
        (maxSize, policy, operations) => {
          const evicted = [];
          const boundedMap = new BoundedMap(maxSize, {
            policy,
            onEvict: (key, value) => evicted.push([key, value]),
          });
          let model = [];
          const expectedEvicted = [];
          for (const { type, key, value } of operations) {
            const position = model.findIndex(([modelKey]) => modelKey === key);
            const existing = position === -1 ? undefined : model[position][1];
            if (type === "set") {
              boundedMap.set(key, value);
              if (position === -1) model.push([key, value]);
              else model[position][1] = value;
              while (model.length > maxSize) {
                expectedEvicted.push(model.shift());
              }
            } else if (type === "delete") {
              assert.deepEqual(boundedMap.delete(key), position !== -1);
              model = model.filter(([modelKey]) => modelKey !== key);
            } else if (type === "peek") {
              assert.deepEqual(boundedMap.peek(key), existing);
            } else {
              assert.deepEqual(boundedMap.get(key), existing);
              if (policy === "lru" && position !== -1) {
                model.push(...model.splice(position, 1));
              }
            }
            assert(boundedMap.size <= maxSize);
            assert.deepEqual([...boundedMap.entries()], model);
            assert.deepEqual(evicted, expectedEvicted);
          }
        },
      ),
      { numRuns: 500 },
    );
  });
});
