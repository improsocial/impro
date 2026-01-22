import { getByteIndex } from "/js/utils.js";
import tlds from "/js/lib/tlds.js";

const urlCharacterRegex = /[a-zA-Z0-9.\-:/_-~?#\[\]@!$&'()*+,;%=]/;
const urlRegex = new RegExp(
  `${urlCharacterRegex.source}${urlCharacterRegex.source}+\\.${urlCharacterRegex.source}${urlCharacterRegex.source}+`,
  "gm",
);

function ensureExternal(href) {
  return href.includes("://") ? href : `https://${href}`;
}

function stripTrailingPunctuation(text) {
  return text.replace(/[.,!?:;)\]\u201d\u2019'"']+$/, "");
}

function getLinkFacetsFromText(text) {
  const matches = text.matchAll(urlRegex) || [];
  const items = [...matches].map((match) => {
    return {
      index: match.index,
      text: stripTrailingPunctuation(match[0]),
    };
  });
  return items
    .filter((item) => !item.text.startsWith("@")) // Don't include mentions
    .filter((item) => {
      // Check for valid TLD
      try {
        const url = new URL(ensureExternal(item.text));
        return tlds.includes(url.hostname.split(".").pop());
      } catch (error) {
        console.warn("Invalid URL: " + item.text, error);
        return false;
      }
    })
    .map((item) => {
      const byteStart = getByteIndex(text, item.index);
      const byteEnd = getByteIndex(text, item.index + item.text.length);
      return {
        index: { byteStart, byteEnd },
        features: [
          {
            $type: "app.bsky.richtext.facet#link",
            uri: ensureExternal(item.text),
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
  const items = [...matches].map((match) => {
    return {
      index: match.index,
      text: stripTrailingPunctuation(match[0]),
    };
  });
  return items.map((item) => {
    const byteStart = getByteIndex(text, item.index);
    const byteEnd = getByteIndex(text, item.index + item.text.length);
    return {
      index: { byteStart, byteEnd },
      features: [
        {
          $type: "app.bsky.richtext.facet#mention",
          handle: item.text.slice(1),
        },
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
