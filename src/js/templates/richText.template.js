import { html } from "/js/lib/lit-html.js";
import { sliceByByte, sortBy, getByteLength, sanitizeUri } from "/js/utils.js";
import { clampFacetIndex } from "/js/facetHelpers.js";
import { linkToHashtag, linkToProfileByDid } from "/js/navigation.js";

const KNOWN_UNSUPPORTED_FACET_TYPES = ["blue.poll.post.facet#option"];

// Matches social-app behavior
export function truncateUrl(url) {
  try {
    const urlp = new URL(url);
    if (urlp.protocol !== "http:" && urlp.protocol !== "https:") {
      return url;
    }
    const path =
      (urlp.pathname === "/" ? "" : urlp.pathname) + urlp.search + urlp.hash;
    if (path.length > 15) {
      return urlp.host + path.slice(0, 13) + "...";
    }
    return urlp.host + path;
  } catch {
    return url;
  }
}

function facetTemplate({ facet, wrappedText, truncateUrls }) {
  // only support 1 feature for now
  const feature = facet.features[0];
  if (!feature) {
    console.warn("no feature found for facet", facet);
    return wrappedText;
  }
  switch (feature.$type) {
    case "app.bsky.richtext.facet#link":
      const uri = feature.uri;
      return html`<a href="${sanitizeUri(uri)}"
        >${truncateUrls ? truncateUrl(wrappedText) : wrappedText}</a
      >`;
    case "app.bsky.richtext.facet#tag":
      const tag = feature.tag;
      return html`<a href="${linkToHashtag(tag)}">${wrappedText}</a>`;
    case "app.bsky.richtext.facet#mention":
      const did = feature.did;
      // Handle unresolved mentions
      return html`<a href="${did ? linkToProfileByDid(did) : "#"}"
        >${wrappedText}</a
      >`;
    default:
      if (!KNOWN_UNSUPPORTED_FACET_TYPES.includes(feature.$type)) {
        console.warn("unknown facet type " + feature.$type, feature);
      }
      return null;
  }
}

function facetOverlaps(facet1, facet2) {
  return (
    facet1.index.byteStart < facet2.index.byteEnd &&
    facet1.index.byteEnd > facet2.index.byteStart
  );
}

export function richTextTemplate({ text, facets = [], truncateUrls = false }) {
  const textByteLength = getByteLength(text);
  const clampedFacets = facets.map((facet) =>
    clampFacetIndex(facet, {
      byteStart: 0,
      byteEnd: textByteLength,
    }),
  );
  const sortedFacets = sortBy(clampedFacets, (facet) => facet.index.byteStart);
  const distinctFacets = [];
  for (const facet of sortedFacets) {
    if (!distinctFacets.some((f) => facetOverlaps(f, facet))) {
      distinctFacets.push(facet);
    }
  }
  const parts = [];
  let currentIndex = 0;
  for (const facet of distinctFacets) {
    parts.push(sliceByByte(text, currentIndex, facet.index.byteStart));
    const wrappedText = sliceByByte(
      text,
      facet.index.byteStart,
      facet.index.byteEnd,
    );
    parts.push(facetTemplate({ facet, wrappedText, truncateUrls }));
    currentIndex = facet.index.byteEnd;
  }
  parts.push(sliceByByte(text, currentIndex));
  // prettier-ignore
  return html`<div class="rich-text" data-testid="rich-text">${parts}</div>`;
}
