import { getByteIndex } from "/js/utils.js";
import tlds from "/js/lib/tlds.js";

const urlCharacterRegex = /[a-zA-Z0-9.\-:/_-~?#\[\]@!$&'()*+,;%=]/;
const urlRegex = new RegExp(
  `${urlCharacterRegex.source}${urlCharacterRegex.source}+\\.${urlCharacterRegex.source}${urlCharacterRegex.source}+`,
  "gm"
);

function ensureExternal(href) {
  return href.includes("://") ? href : `https://${href}`;
}

function getLinkFacetsFromText(text) {
  const matches = text.matchAll(urlRegex) || [];
  return [...matches]
    .filter((match) => !match[0].startsWith("@")) // Don't include mentions
    .filter((match) => {
      // Check for valid TLD
      try {
        const url = new URL(ensureExternal(match[0]));
        return tlds.includes(url.hostname.split(".").pop());
      } catch (error) {
        console.error(error);
        return false;
      }
    })
    .map((match) => {
      const byteStart = getByteIndex(text, match.index);
      const byteEnd = getByteIndex(text, match.index + match[0].length);
      return {
        index: { byteStart, byteEnd },
        features: [
          {
            $type: "app.bsky.richtext.facet#link",
            uri: ensureExternal(match[0]),
          },
        ],
      };
    });
}

const hashtagRegex = /#[a-zA-Z0-9_]+/gm;

function getHashtags(text) {
  const matches = text.matchAll(hashtagRegex) || [];
  return [...matches].map((match) => {
    const byteStart = getByteIndex(text, match.index);
    const byteEnd = getByteIndex(text, match.index + match[0].length);
    return {
      index: { byteStart, byteEnd },
      features: [
        { $type: "app.bsky.richtext.facet#tag", tag: match[0].slice(1) },
      ],
    };
  });
}

const mentionRegex = /@[a-zA-Z0-9._-]+/gm;

function getUnresolvedMentions(text) {
  const matches = text.matchAll(mentionRegex) || [];
  return [...matches].map((match) => {
    const byteStart = getByteIndex(text, match.index);
    const byteEnd = getByteIndex(text, match.index + match[0].length);
    return {
      index: { byteStart, byteEnd },
      features: [
        { $type: "app.bsky.richtext.facet#mention", handle: match[0].slice(1) },
      ],
    };
  });
}

async function resolveMentions(mentions, identityResolver) {
  const resolvedMentions = [];
  for (const mention of mentions) {
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
  }
  return resolvedMentions;
}

export function getUnresolvedFacetsFromText(text) {
  if (!text) {
    return [];
  }
  const links = getLinkFacetsFromText(text);
  const hashtags = getHashtags(text);
  const unresolvedMentions = getUnresolvedMentions(text);
  return [...links, ...hashtags, ...unresolvedMentions];
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
    identityResolver
  );
  return [...resolvedFacets, ...resolvedMentions];
}

export async function getFacetsFromText(text, identityResolver) {
  const unresolvedFacets = getUnresolvedFacetsFromText(text);
  const resolvedFacets = await resolveFacets(
    unresolvedFacets,
    identityResolver
  );
  return resolvedFacets;
}
