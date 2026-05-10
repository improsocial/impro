import { getByteIndex, sliceByByte, getByteLength } from "/js/utils.js";
import tlds from "/js/lib/tlds.js";

// Matches logic in atproto/packages/api/src/rich-text/detection.ts

const urlRegex =
  /(^|\s|\()((https?:\/\/[\S]+)|((?<domain>[a-z][a-z0-9]*(\.[a-z0-9]+)+)[\S]*))/gim;

function isValidDomain(domain) {
  return tlds.some((tld) => domain.endsWith(`.${tld}`));
}

function trimUri(uri) {
  let trimmed = uri;
  if (".,;:!?".includes(trimmed.at(-1))) trimmed = trimmed.slice(0, -1);
  if (trimmed.endsWith(")") && !trimmed.includes("(")) {
    trimmed = trimmed.slice(0, -1);
  }
  return trimmed;
}

function getLinkFacetsFromText(text) {
  const facets = [];
  for (const match of text.matchAll(urlRegex)) {
    const leading = match[1];
    const isHttp = match[2].startsWith("http");

    if (!isHttp) {
      const domain = match.groups?.domain;
      if (!domain || !isValidDomain(domain)) continue;
    }

    const uri = trimUri(match[2]);
    const start = match.index + leading.length;
    facets.push({
      index: {
        byteStart: getByteIndex(text, start),
        byteEnd: getByteIndex(text, start + uri.length),
      },
      features: [
        {
          $type: "app.bsky.richtext.facet#link",
          uri: isHttp ? uri : `https://${uri}`,
        },
      ],
    });
  }
  return facets;
}

const hashtagRegex =
  /(^|\s)[#＃]((?!️)[^\s­⁠ ​‌‍⃢]*[^\d\s\p{P}­⁠ ​‌‍⃢]+[^\s­⁠ ​‌‍⃢]*)?/gu;
const trailingPunctuationRegex = /\p{P}+$/gu;

function getHashtags(text) {
  return [...text.matchAll(hashtagRegex)]
    .map((match) => {
      const leading = match[1];
      let tag = match[2];
      if (!tag) return null;
      tag = tag.trim().replace(trailingPunctuationRegex, "");
      if (tag.length === 0 || tag.length > 64) return null;
      const start = match.index + leading.length;
      const byteStart = getByteIndex(text, start);
      const byteEnd = getByteIndex(text, start + 1 + tag.length);
      return {
        index: { byteStart, byteEnd },
        features: [{ $type: "app.bsky.richtext.facet#tag", tag }],
      };
    })
    .filter(Boolean);
}

const cashtagRegex =
  /(^|\s|\()\$([A-Za-z][A-Za-z0-9]{0,4})(?=\s|$|[.,;:!?)"'’])/gu;

function getCashtags(text) {
  return [...text.matchAll(cashtagRegex)].map((match) => {
    const leading = match[1];
    const ticker = match[2].toUpperCase();
    const start = match.index + leading.length;
    const byteStart = getByteIndex(text, start);
    const byteEnd = getByteIndex(text, start + 1 + ticker.length);
    return {
      index: { byteStart, byteEnd },
      features: [{ $type: "app.bsky.richtext.facet#tag", tag: `$${ticker}` }],
    };
  });
}

const mentionRegex = /(^|\s|\()(@)([a-zA-Z0-9.-]+)(\b)/g;

function getUnresolvedMentions(text) {
  return [...text.matchAll(mentionRegex)]
    .map((match) => {
      const leading = match[1];
      const handle = match[3];
      if (!isValidDomain(handle)) return null;
      const start = match.index + leading.length;
      const byteStart = getByteIndex(text, start);
      const byteEnd = getByteIndex(text, start + 1 + handle.length);
      return {
        index: { byteStart, byteEnd },
        features: [
          {
            $type: "app.bsky.richtext.facet#mention",
            handle,
          },
        ],
      };
    })
    .filter(Boolean);
}

async function resolveMentions(mentions, identityResolver) {
  const resolvedMentions = [];
  await Promise.all(
    mentions.map(async (mention) => {
      let did = null;
      try {
        did = await identityResolver.resolveHandle(mention.features[0].handle);
      } catch (error) {
        // if we can't resolve the mention, just leave it out
      }
      if (did) {
        resolvedMentions.push({
          ...mention,
          features: [{ $type: "app.bsky.richtext.facet#mention", did }],
        });
      }
    }),
  );
  return resolvedMentions;
}

export function getUnresolvedFacetsFromText(text) {
  if (!text) {
    return [];
  }
  const links = getLinkFacetsFromText(text);
  const hashtags = getHashtags(text);
  const cashtags = getCashtags(text);
  const unresolvedMentions = getUnresolvedMentions(text);
  return [...links, ...hashtags, ...cashtags, ...unresolvedMentions];
}

export async function resolveFacets(facets, identityResolver) {
  const resolvedFacets = [];
  const unresolvedMentions = [];
  for (const facet of facets) {
    // Only handle one feature for now
    const feature = facet.features[0];
    if (feature.$type === "app.bsky.richtext.facet#mention" && !feature.did) {
      unresolvedMentions.push(facet);
    } else {
      resolvedFacets.push(facet);
    }
  }
  const resolvedMentions = await resolveMentions(
    unresolvedMentions,
    identityResolver,
  );
  return [...resolvedFacets, ...resolvedMentions];
}

export async function getFacetsFromText(text, identityResolver) {
  const unresolvedFacets = getUnresolvedFacetsFromText(text);
  const resolvedFacets = await resolveFacets(
    unresolvedFacets,
    identityResolver,
  );
  return resolvedFacets;
}

export function getTagsFromFacets(facets) {
  return facets.filter(
    (facet) => facet.features[0].$type === "app.bsky.richtext.facet#tag",
  );
}

// Reconstructs the plain-text representation of a post, substituting
// shortened link display text with the full URI from its facet. This matches
// the behavior of social-app's "Copy post text" action.
export function richTextToString(text, facets) {
  if (!text) {
    return "";
  }
  if (!facets?.length) {
    return text;
  }
  const linkFacets = facets
    .filter(
      (facet) =>
        facet.features?.[0]?.$type === "app.bsky.richtext.facet#link" &&
        facet.features[0].uri,
    )
    .slice()
    .sort((a, b) => a.index.byteStart - b.index.byteStart);

  const totalBytes = getByteLength(text);
  let result = "";
  let cursor = 0;
  for (const facet of linkFacets) {
    const { byteStart, byteEnd } = facet.index;
    if (byteStart < cursor || byteEnd > totalBytes) {
      continue;
    }
    result += sliceByByte(text, cursor, byteStart);
    result += facet.features[0].uri;
    cursor = byteEnd;
  }
  result += sliceByByte(text, cursor, totalBytes);
  return result;
}

export function clampFacetIndex(facet, { byteStart, byteEnd }) {
  return {
    ...facet,
    index: {
      byteStart: Math.max(facet.index.byteStart, byteStart),
      byteEnd: Math.min(facet.index.byteEnd, byteEnd),
    },
  };
}
