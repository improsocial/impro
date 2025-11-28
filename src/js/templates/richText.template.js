import { html } from "/js/lib/lit-html.js";
import { sliceByByte, sortBy } from "/js/utils.js";
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
      return html`<a href="${uri}">${wrappedText}</a>`;
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

export function richTextTemplate({ text, facets = [] }) {
  let parts = [];
  let currentIndex = 0;
  const sortedFacets = sortBy(facets, (facet) => facet.index.byteStart);
  for (const facet of sortedFacets) {
    parts.push(sliceByByte(text, currentIndex, facet.index.byteStart));
    const wrappedText = sliceByByte(
      text,
      facet.index.byteStart,
      facet.index.byteEnd
    );
    parts.push(facetTemplate({ facet, wrappedText }));
    currentIndex = facet.index.byteEnd;
  }
  parts.push(sliceByByte(text, currentIndex));
  return html`<div class="rich-text">${parts}</div>`;
}
