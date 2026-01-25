import { html } from "/js/lib/lit-html.js";
import { sliceByByte, sortBy, getByteLength, sanitizeUri } from "/js/utils.js";
import { linkToHashtag, linkToProfile } from "/js/navigation.js";

const KNOWN_UNSUPPORTED_FACET_TYPES = ["blue.poll.post.facet#option"];

function facetTemplate({ facet, wrappedText }) {
  // only support 1 feature for now
  const feature = facet.features[0];
  if (!feature) {
    console.warn("no feature found for facet", facet);
    return wrappedText;
  }
  switch (feature.$type) {
    case "app.bsky.richtext.facet#link":
      const uri = feature.uri;
      return html`<a href="${sanitizeUri(uri)}">${wrappedText}</a>`;
    case "app.bsky.richtext.facet#tag":
      const tag = feature.tag;
      return html`<a href="${linkToHashtag(tag)}">${wrappedText}</a>`;
    case "app.bsky.richtext.facet#mention":
      const did = feature.did;
      // Handle unresolved mentions
      return html`<a href="${did ? linkToProfile(did) : "#"}"
        >${wrappedText}</a
      >`;
    default:
      if (!KNOWN_UNSUPPORTED_FACET_TYPES.includes(feature.$type)) {
        console.warn("unknown facet type " + feature.$type, feature);
      }
      return null;
  }
}

function textPartTemplate({ text }) {
  return text;
}

function facetOverlaps(facet1, facet2) {
  return (
    facet1.index.byteStart < facet2.index.byteEnd &&
    facet1.index.byteEnd > facet2.index.byteStart
  );
}

function richTextLineTemplate({ text, facets, byteOffset }) {
  if (text.length === 0) {
    return html`<div><br /></div>`;
  }
  let parts = [];
  let currentIndex = 0;
  const sortedFacets = sortBy(facets, (facet) => facet.index.byteStart);
  // Filter overlapping facets
  const distinctFacets = [];
  for (const facet of sortedFacets) {
    if (!distinctFacets.some((f) => facetOverlaps(f, facet))) {
      distinctFacets.push(facet);
    }
  }
  for (const facet of distinctFacets) {
    const textPart = sliceByByte(
      text,
      currentIndex,
      facet.index.byteStart - byteOffset,
    );
    parts.push(textPartTemplate({ text: textPart }));
    const wrappedText = sliceByByte(
      text,
      facet.index.byteStart - byteOffset,
      facet.index.byteEnd - byteOffset,
    );
    parts.push(facetTemplate({ facet, wrappedText }));
    currentIndex = facet.index.byteEnd - byteOffset;
  }
  const finalTextPart = sliceByByte(text, currentIndex);
  parts.push(textPartTemplate({ text: finalTextPart }));
  return html`<div>${parts}</div>`;
}

export function richTextTemplate({ text, facets = [] }) {
  const lines = text.split("\n");
  const divs = [];
  let byteOffset = 0;
  for (const line of lines) {
    const lineByteLength = getByteLength(line);
    const facetsForLine = facets.filter(
      (facet) =>
        facet.index.byteStart >= byteOffset &&
        facet.index.byteEnd <= byteOffset + lineByteLength,
    );
    divs.push(
      richTextLineTemplate({ text: line, facets: facetsForLine, byteOffset }),
    );
    byteOffset += lineByteLength + 1; // +1 for the newline character
  }
  // prettier-ignore
  return html`<div class="rich-text">${divs}</div>`;
}
