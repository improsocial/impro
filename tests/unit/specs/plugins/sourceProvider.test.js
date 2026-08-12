import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parsePluginManifest } from "/js/plugins/sourceProvider.js";

const VALID_HASH = "a".repeat(64);

function baseManifest(overrides = {}) {
  return { id: "demo", name: "Demo", version: "1.0.0", ...overrides };
}

describe("parsePluginManifest: executables", () => {
  it("is undefined when the manifest declares no executables", () => {
    const manifest = parsePluginManifest("demo", baseManifest());
    assert.deepEqual(manifest.executables, undefined);
  });

  it("accepts a well-formed entry and lowercases the hash", () => {
    const manifest = parsePluginManifest(
      "demo",
      baseManifest({
        executables: [
          {
            name: "engine.wasm",
            sourceUrl: "https://example.com/engine",
            sha256: VALID_HASH.toUpperCase(),
          },
        ],
      }),
    );
    assert.deepEqual(manifest.executables, [
      {
        name: "engine.wasm",
        sourceUrl: "https://example.com/engine",
        sha256: VALID_HASH,
      },
    ]);
  });

  it("rejects a non-array executables field", () => {
    assert.throws(
      () => parsePluginManifest("demo", baseManifest({ executables: {} })),
      /must be an array/,
    );
  });

  it("rejects an entry missing name", () => {
    assert.throws(
      () =>
        parsePluginManifest(
          "demo",
          baseManifest({
            executables: [
              { sourceUrl: "https://example.com/x", sha256: VALID_HASH },
            ],
          }),
        ),
      /missing required field "name"/,
    );
  });

  it("rejects an entry missing sourceUrl", () => {
    assert.throws(
      () =>
        parsePluginManifest(
          "demo",
          baseManifest({
            executables: [{ name: "x", sha256: VALID_HASH }],
          }),
        ),
      /missing required field "sourceUrl"/,
    );
  });

  it("rejects an entry with a malformed sourceUrl", () => {
    assert.throws(
      () =>
        parsePluginManifest(
          "demo",
          baseManifest({
            executables: [
              { name: "x", sourceUrl: "not-a-url", sha256: VALID_HASH },
            ],
          }),
        ),
      /sourceUrl is not a valid URL/,
    );
  });

  it("accepts a sourceUrl pointing at a proprietary vendor page (a transparency pointer, not an openness check)", () => {
    const manifest = parsePluginManifest(
      "demo",
      baseManifest({
        executables: [
          {
            name: "vendor-engine",
            sourceUrl: "https://vendor.example/product/engine",
            sha256: VALID_HASH,
          },
        ],
      }),
    );
    assert.deepEqual(
      manifest.executables[0].sourceUrl,
      "https://vendor.example/product/engine",
    );
  });

  it("rejects a sha256 that is not 64 hex characters", () => {
    assert.throws(
      () =>
        parsePluginManifest(
          "demo",
          baseManifest({
            executables: [
              {
                name: "x",
                sourceUrl: "https://example.com/x",
                sha256: "deadbeef",
              },
            ],
          }),
        ),
      /sha256 must be a 64-character hex digest/,
    );
  });

  it("rejects a non-object entry", () => {
    assert.throws(
      () =>
        parsePluginManifest("demo", baseManifest({ executables: ["nope"] })),
      /executables\[0\] must be an object/,
    );
  });
});
