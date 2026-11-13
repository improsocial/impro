import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import * as dagCbor from "@ipld/dag-cbor";
import { CID } from "multiformats/cid";
import { sha256 } from "multiformats/hashes/sha2";
import * as digest from "multiformats/hashes/digest";
import { computeRecordCid } from "/js/atproto.js";

const SHA_256_CODE = 0x12;
const RAW_CODEC = 0x55;

// Values on either side of each CBOR argument-width boundary.
const integerBoundaries = [
  0,
  23,
  24,
  255,
  256,
  65535,
  65536,
  0xffffffff,
  0x100000000,
  Number.MAX_SAFE_INTEGER,
];

const integerArbitrary = fc.oneof(
  fc.maxSafeInteger(),
  fc.constantFrom(...integerBoundaries),
  fc
    .constantFrom(...integerBoundaries)
    .map((value) => Math.max(-value - 1, Number.MIN_SAFE_INTEGER)),
);

const stringArbitrary = fc.oneof(
  fc.string({ unit: "binary" }),
  fc.string({ unit: "binary", minLength: 20, maxLength: 400, size: "max" }),
);

const cidLinkArbitrary = fc
  .tuple(
    fc.constantFrom(RAW_CODEC, dagCbor.code),
    fc.uint8Array({ minLength: 32, maxLength: 32 }),
  )
  .map(([codec, hashBytes]) => ({
    $link: CID.createV1(
      codec,
      digest.create(SHA_256_CODE, hashBytes),
    ).toString(),
  }));

const leafArbitrary = fc.oneof(
  stringArbitrary,
  integerArbitrary,
  fc.boolean(),
  fc.constant(null),
  cidLinkArbitrary,
);

function recordArbitraryWithLeaf(leaf) {
  return fc.letrec((tie) => ({
    value: fc.oneof(
      { depthSize: "small", withCrossShrink: true },
      leaf,
      tie("array"),
      tie("object"),
    ),
    array: fc.oneof(
      fc.array(tie("value")),
      fc.array(leaf, { minLength: 20, maxLength: 300, size: "max" }),
    ),
    object: fc.dictionary(
      fc.string({ unit: "binary" }),
      fc.oneof(tie("value"), fc.constant(undefined)),
      { noNullPrototype: true },
    ),
  })).object;
}

const recordArbitrary = recordArbitraryWithLeaf(leafArbitrary);

function isCidLink(value) {
  const keys = Object.keys(value);
  return (
    keys.length === 1 && keys[0] === "$link" && typeof value.$link === "string"
  );
}

function toIpld(value) {
  if (Array.isArray(value)) {
    return value.map(toIpld);
  }
  if (value !== null && typeof value === "object") {
    if (isCidLink(value)) {
      return CID.parse(value.$link);
    }
    const result = {};
    for (const [key, entryValue] of Object.entries(value)) {
      if (entryValue !== undefined) {
        Object.defineProperty(result, key, {
          value: toIpld(entryValue),
          enumerable: true,
        });
      }
    }
    return result;
  }
  return value;
}

async function referenceCid(record) {
  const bytes = dagCbor.encode(toIpld(record));
  const hash = await sha256.digest(bytes);
  return CID.createV1(dagCbor.code, hash).toString();
}

function reverseKeyOrder(value) {
  if (Array.isArray(value)) {
    return value.map(reverseKeyOrder);
  }
  if (value !== null && typeof value === "object") {
    const result = {};
    for (const [key, entryValue] of Object.entries(value).reverse()) {
      Object.defineProperty(result, key, {
        value: reverseKeyOrder(entryValue),
        enumerable: true,
      });
    }
    return result;
  }
  return value;
}

function hasLeaf(value) {
  if (Array.isArray(value)) {
    return value.some(hasLeaf);
  }
  if (value === undefined) {
    return false;
  }
  if (Object.getPrototypeOf(value) === Object.prototype) {
    return Object.values(value).some(hasLeaf);
  }
  return true;
}

const unsupportedLeafArbitrary = fc.oneof(
  fc.double({ noInteger: true }),
  fc.constant(Number.MAX_SAFE_INTEGER + 1),
  fc.date({ noInvalidDate: true }),
  fc.bigInt(),
  fc.uint8Array(),
);

describe("computeRecordCid properties", () => {
  it("matches the reference dag-cbor implementation for any supported record", async () => {
    await fc.assert(
      fc.asyncProperty(recordArbitrary, async (record) => {
        assert.deepEqual(
          await computeRecordCid(record),
          await referenceCid(record),
        );
      }),
      { numRuns: 300 },
    );
  });

  it("is insensitive to object key insertion order", async () => {
    await fc.assert(
      fc.asyncProperty(recordArbitrary, async (record) => {
        assert.deepEqual(
          await computeRecordCid(reverseKeyOrder(record)),
          await computeRecordCid(record),
        );
      }),
    );
  });

  it("rejects any record containing a value outside the supported subset", async () => {
    await fc.assert(
      fc.asyncProperty(
        recordArbitraryWithLeaf(unsupportedLeafArbitrary),
        async (record) => {
          fc.pre(hasLeaf(record));
          await assert.rejects(() => computeRecordCid(record));
        },
      ),
    );
  });
});
