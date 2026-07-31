import { sliceByByte, sortBy, getByteLength, isOnlyEmoji } from "/js/utils.js";
import { clampFacetIndex } from "/js/facetHelpers.js";

function facetOverlaps(facet1, facet2) {
  return (
    facet1.index.byteStart < facet2.index.byteEnd &&
    facet1.index.byteEnd > facet2.index.byteStart
  );
}

// Produces the flat token stream ({ type: "text" } / { type: "facet" }) that
// feeds the plugin rich-text pipeline.
export function tokenizeRichText({ text, facets = [] }) {
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
  const tokens = [];
  let currentIndex = 0;
  for (const facet of distinctFacets) {
    const beforeText = sliceByByte(text, currentIndex, facet.index.byteStart);
    if (beforeText) {
      tokens.push({ type: "text", value: beforeText });
    }
    tokens.push({
      type: "facet",
      facet,
      text: sliceByByte(text, facet.index.byteStart, facet.index.byteEnd),
    });
    currentIndex = facet.index.byteEnd;
  }
  const remainingText = sliceByByte(text, currentIndex);
  if (remainingText) {
    tokens.push({ type: "text", value: remainingText });
  }
  return tokens;
}

export function tokensHaveFacetType(tokens, facetTypes) {
  if (!facetTypes || facetTypes.size === 0) return false;
  for (const token of tokens) {
    if (token.type !== "facet") continue;
    const features = token.facet.features;
    if (!features) continue;
    for (const feature of features) {
      if (facetTypes.has(feature.$type)) return true;
    }
  }
  return false;
}

export function isEmojiOnlyTokens(tokens) {
  if (!Array.isArray(tokens) || tokens.length === 0) return false;
  let text = "";
  for (const token of tokens) {
    if (token.type !== "text") return false;
    text += token.value;
  }
  return isOnlyEmoji(text);
}

export function validateRichTextTokens(tokens) {
  if (!Array.isArray(tokens)) return false;
  return tokens.every((token) => {
    if (!token || typeof token !== "object") return false;
    switch (token.type) {
      case "text":
        return typeof token.value === "string";
      case "facet":
        return !!token.facet?.index;
      case "inline":
      case "block": {
        const node = token.node;
        return (
          !!node && typeof node === "object" && typeof node.tag === "string"
        );
      }
      default:
        return false;
    }
  });
}

// Replaces facet tokens with the originals from the input stream they were
// derived from, matched by byte range
export function hydrateRichTextFacets(tokens, baseTokens) {
  const facetTokensByRange = new Map();
  for (const token of baseTokens) {
    if (token.type === "facet") {
      const { byteStart, byteEnd } = token.facet.index;
      facetTokensByRange.set(`${byteStart}-${byteEnd}`, token);
    }
  }
  const hydrated = [];
  for (const token of tokens) {
    if (token.type !== "facet") {
      hydrated.push(token);
      continue;
    }
    const { byteStart, byteEnd } = token.facet.index;
    const original = facetTokensByRange.get(`${byteStart}-${byteEnd}`);
    if (!original) {
      throw new Error(
        `facet ${byteStart}-${byteEnd} does not match any input facet`,
      );
    }
    hydrated.push(original);
  }
  return hydrated;
}
