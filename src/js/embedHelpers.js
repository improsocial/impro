import { IN_APP_LINK_DOMAINS } from "/js/config.js";
import { createEmbedFromPost } from "/js/dataHelpers.js";

// e.g. https://bsky.app/profile/gracekind.net/post/3m63ewg5nws23
const RECORD_LINK_PATTERNS = [
  {
    pattern: /^\/profile\/([a-zA-Z0-9:.-]+)\/post\/([a-zA-Z0-9.-]+)$/,
    collection: "app.bsky.feed.post",
  },
  {
    pattern: /^\/profile\/([a-zA-Z0-9:.-]+)\/feed\/([a-zA-Z0-9.-]+)$/,
    collection: "app.bsky.feed.generator",
  },
  {
    pattern: /^\/profile\/([a-zA-Z0-9:.-]+)\/lists\/([a-zA-Z0-9.-]+)$/,
    collection: "app.bsky.graph.list",
  },
  {
    pattern: /^\/profile\/([a-zA-Z0-9:.-]+)\/starter-pack\/([a-zA-Z0-9.-]+)$/,
    collection: "app.bsky.graph.starterpack",
  },
  {
    pattern: /^\/starter-pack\/([a-zA-Z0-9:.-]+)\/([a-zA-Z0-9.-]+)$/,
    collection: "app.bsky.graph.starterpack",
  },
];

// E.g. https://bsky.app/profile/gracekind.net/post/3m63ewg5nws23
// -> { collection: "app.bsky.feed.post", didOrHandle: "gracekind.net", rkey: "3m63ewg5nws23" }
export function parseRecordLink(url) {
  try {
    const parsedUrl = new URL(url);
    if (
      parsedUrl.hostname !== window.location.hostname &&
      !IN_APP_LINK_DOMAINS.includes(parsedUrl.hostname)
    ) {
      return null;
    }
    for (const { pattern, collection } of RECORD_LINK_PATTERNS) {
      const match = pattern.exec(parsedUrl.pathname);
      if (match) {
        return { collection, didOrHandle: match[1], rkey: match[2] };
      }
    }
    return null;
  } catch (error) {
    return null;
  }
}

export async function resolveRecordFromLink(
  url,
  { identityResolver, dataLayer },
) {
  const parsedLink = parseRecordLink(url);
  if (!parsedLink) {
    throw new Error(`Not a record link: ${url}`);
  }
  const { collection, didOrHandle, rkey } = parsedLink;
  const did = didOrHandle.startsWith("did:")
    ? didOrHandle
    : await identityResolver.resolveHandle(didOrHandle);
  const recordUri = `at://${did}/${collection}/${rkey}`;
  if (collection === "app.bsky.feed.post") {
    const post = await dataLayer.declarative.ensurePost(recordUri);
    return createEmbedFromPost(post);
  } else if (collection === "app.bsky.feed.generator") {
    const view = await dataLayer.declarative.ensureFeedGenerator(recordUri);
    return { ...view, $type: "app.bsky.feed.defs#generatorView" };
  } else if (collection === "app.bsky.graph.list") {
    const view = await dataLayer.declarative.ensureList(recordUri);
    return { ...view, $type: "app.bsky.graph.defs#listView" };
  }
  const view = await dataLayer.declarative.ensureStarterPack(recordUri);
  return { ...view, $type: "app.bsky.graph.defs#starterPackViewBasic" };
}
