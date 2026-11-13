import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import {
  buildGifDraftUri,
  restoreGifFromDraftUri,
  buildGifExternal,
  parseGifFromUrl,
  createGifDescription,
  parseAltFromGifDescription,
} from "/js/embedHelpers.js";

const textArbitrary = fc.oneof(
  fc.string({ unit: "binary" }),
  fc.string({ unit: "grapheme" }),
  fc.constantFrom("", "  ", "Alt: nested", "ALT: nested", "a&b=c?d#e", "100%"),
);

const slugArbitrary = fc.stringMatching(/^[A-Za-z0-9_-]{1,12}$/);

const dimensionArbitrary = fc.integer({ min: 1, max: 4096 });

const gifArbitrary = fc
  .record({
    hostname: fc.constantFrom("media.tenor.com", "static.klipy.com"),
    id: slugArbitrary,
    name: slugArbitrary,
    width: dimensionArbitrary,
    height: dimensionArbitrary,
    hasFullGif: fc.boolean(),
    title: textArbitrary,
    contentDescription: textArbitrary,
  })
  .map((fields) => {
    const base = `https://${fields.hostname}/${fields.id}/${fields.name}`;
    const format = {
      url: `${base}.gif`,
      dims: [fields.width, fields.height],
    };
    return {
      id: fields.id,
      title: fields.title,
      content_description: fields.contentDescription,
      media_formats: {
        ...(fields.hasFullGif ? { gif: format } : {}),
        tinygif: format,
        mp4: { url: `${base}.mp4` },
        webm: { url: `${base}.webm` },
      },
    };
  });

describe("gif description properties", () => {
  it("round-trips the alt text and whether the user wrote it", () => {
    fc.assert(
      fc.property(textArbitrary, textArbitrary, (vendorText, userAlt) => {
        const parsed = parseAltFromGifDescription(
          createGifDescription(vendorText, userAlt),
        );
        const trimmedAlt = userAlt.trim();
        assert.deepEqual(
          parsed,
          trimmedAlt !== ""
            ? { isPreferred: true, alt: trimmedAlt }
            : { isPreferred: false, alt: vendorText },
        );
      }),
      { numRuns: 500 },
    );
  });
});

describe("gif draft uri properties", () => {
  it("restores the url, dimensions and alt text it was built from", () => {
    fc.assert(
      fc.property(gifArbitrary, textArbitrary, (gif, alt) => {
        const restored = restoreGifFromDraftUri(buildGifDraftUri({ gif, alt }));
        const format = gif.media_formats.gif ?? gif.media_formats.tinygif;
        assert.deepEqual(restored.alt, alt.trim());
        assert.deepEqual(restored.gif.media_formats.gif.url, format.url);
        assert.deepEqual(restored.gif.media_formats.gif.dims, format.dims);
      }),
      { numRuns: 500 },
    );
  });

  it("builds an external embed that parses back to the same gif", () => {
    fc.assert(
      fc.property(gifArbitrary, textArbitrary, (gif, alt) => {
        const external = buildGifExternal({ gif, alt });
        const format = gif.media_formats.gif ?? gif.media_formats.tinygif;
        const parsed = parseGifFromUrl(external.url);
        assert.deepEqual([parsed.width, parsed.height], format.dims);
        assert(external.url.startsWith(`${format.url}?`));
        const vendorText = gif.content_description || gif.title;
        assert.deepEqual(
          parseAltFromGifDescription(external.description).alt,
          alt.trim() || vendorText,
        );
      }),
      { numRuns: 500 },
    );
  });
});
