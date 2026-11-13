import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import {
  parsePluginManifest,
  repoWebUrl,
  SourceProvider,
} from "/js/plugins/sourceProvider.js";

const pathFragmentArbitrary = fc.oneof(
  {
    weight: 6,
    arbitrary: fc.constantFrom(
      "..",
      ".",
      "/",
      "\\",
      "%2e",
      "%2E",
      "%2f",
      "%5c",
      "\t",
      "\n",
      " ",
      "://",
      "?",
      "#",
      "@",
      "fonts",
      "a",
      "Inter",
    ),
  },
  { weight: 1, arbitrary: fc.string({ unit: "binary", maxLength: 3 }) },
);

const fontFileArbitrary = fc
  .tuple(
    fc.array(pathFragmentArbitrary, { maxLength: 8 }),
    fc.constantFrom(".woff2", ".woff", ".WOFF2"),
  )
  .map(([fragments, extension]) => fragments.join("") + extension);

const manifestArbitrary = fc.oneof(
  fc.jsonValue(),
  fc.record(
    {
      id: fc.oneof(fc.constant("my-plugin"), fc.jsonValue()),
      name: fc.oneof(fc.string({ maxLength: 8 }), fc.jsonValue()),
      version: fc.oneof(fc.constant("1.0.0"), fc.jsonValue()),
      fonts: fc.oneof(
        fc.jsonValue(),
        fc.array(
          fc.oneof(
            fc.jsonValue(),
            fc.record(
              {
                family: fc.oneof(fc.string({ maxLength: 8 }), fc.jsonValue()),
                file: fc.oneof(fontFileArbitrary, fc.jsonValue()),
              },
              { requiredKeys: [] },
            ),
          ),
          { maxLength: 3 },
        ),
      ),
    },
    { requiredKeys: [] },
  ),
);

function parseOrError(pluginId, manifest) {
  try {
    return { manifest: parsePluginManifest(pluginId, manifest) };
  } catch (error) {
    return { error };
  }
}

describe("parsePluginManifest properties", () => {
  it("returns a well-formed manifest or a descriptive error for any JSON", () => {
    fc.assert(
      fc.property(manifestArbitrary, (rawManifest) => {
        const { manifest, error } = parseOrError("my-plugin", rawManifest);
        if (error) {
          assert.deepEqual(error.constructor, Error);
          return;
        }
        assert.deepEqual(manifest.id, "my-plugin");
        assert.deepEqual(typeof manifest.name, "string");
        assert.deepEqual(typeof manifest.version, "string");
        for (const font of manifest.fonts ?? []) {
          assert.deepEqual(typeof font.family, "string");
          assert.deepEqual(typeof font.file, "string");
        }
      }),
      { numRuns: 1000 },
    );
  });

  it("only accepts font files that stay inside the plugin's release", async () => {
    const sourceProvider = new SourceProvider(null, {});
    await fc.assert(
      fc.asyncProperty(fontFileArbitrary, async (file) => {
        const { manifest } = parseOrError("my-plugin", {
          id: "my-plugin",
          name: "My plugin",
          version: "1.0.0",
          fonts: [{ family: "Inter", file }],
        });
        if (!manifest) return;
        const url = await sourceProvider._remoteAssetUrl({
          repo: "owner/repo",
          file: manifest.fonts[0].file,
          release: "1.0.0",
        });
        const parsedUrl = new URL(url);
        assert.deepEqual(parsedUrl.origin, "https://raw.githubusercontent.com");
        assert(
          parsedUrl.pathname.startsWith("/owner/repo/refs/tags/1.0.0/"),
          `escaped to ${parsedUrl.pathname}`,
        );
        assert.match(parsedUrl.pathname, /\.woff2?$/i);
      }),
      { numRuns: 3000 },
    );
  });
});

describe("repoWebUrl properties", () => {
  it("always links to the repo's own host", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("", "github:", "tangled:"),
        fc.array(pathFragmentArbitrary, { maxLength: 6 }),
        (prefix, fragments) => {
          const repo = prefix + fragments.join("").replaceAll(":", "");
          const expectedOrigin =
            prefix === "tangled:"
              ? "https://tangled.org"
              : "https://github.com";
          assert.deepEqual(new URL(repoWebUrl(repo)).origin, expectedOrigin);
        },
      ),
      { numRuns: 1000 },
    );
  });
});
