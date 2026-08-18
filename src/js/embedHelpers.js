import {
  IN_APP_LINK_DOMAINS,
  TENOR_GIF_PROXY_URL,
  KLIPY_GIF_PROXY_HOSTNAME,
} from "/js/config.js";
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

const TENOR_GIF_HOSTNAME = "media.tenor.com";
const KLIPY_GIF_HOSTNAME = "static.klipy.com";
const TENOR_GIF_PROXY_HOSTNAME = new URL(TENOR_GIF_PROXY_URL).hostname;
const GIF_HOSTNAMES = [TENOR_GIF_HOSTNAME, KLIPY_GIF_HOSTNAME];

export function parseGifFromUrl(url) {
  let parsed = null;
  try {
    parsed = new URL(url);
  } catch (error) {
    return null;
  }
  if (!GIF_HOSTNAMES.includes(parsed.hostname)) {
    return null;
  }
  const width = Number(parsed.searchParams.get("ww"));
  const height = Number(parsed.searchParams.get("hh"));
  if (!width || !height) {
    return null;
  }
  return {
    url,
    width,
    height,
    alt: parsed.searchParams.get("alt") ?? "",
  };
}

export function getGifFromPost(post) {
  let external = null;
  if (post?.embed?.$type === "app.bsky.embed.external#view") {
    external = post.embed.external;
  } else if (
    post?.embed?.$type === "app.bsky.embed.recordWithMedia#view" &&
    post.embed.media?.$type === "app.bsky.embed.external#view"
  ) {
    external = post.embed.media.external;
  }
  if (!external?.thumb) return null;
  if (parseGifFromUrl(external.uri) === null) return null;
  return {
    thumb: external.thumb,
    alt: parseAltFromGifDescription(external.description).alt,
  };
}

export function isValidGif(gif) {
  const tinygif = gif?.media_formats?.tinygif;
  return (
    typeof gif?.id === "string" &&
    gif.id.length > 0 &&
    typeof tinygif?.url === "string" &&
    Array.isArray(tinygif.dims) &&
    tinygif.dims.length === 2
  );
}

// Reduces a provider gif object to the fields the app reads, so stored
// recents (synced via preferences) stay small
export function createMinimalGifObject(gif) {
  const formats = gif.media_formats;
  const trimmedFormats = {};
  for (const formatName of ["gif", "tinygif"]) {
    const format = formats[formatName];
    if (format) {
      trimmedFormats[formatName] = { url: format.url, dims: format.dims };
    }
  }
  for (const formatName of ["preview", "mp4", "webm"]) {
    const format = formats[formatName];
    if (format) {
      trimmedFormats[formatName] = { url: format.url };
    }
  }
  return {
    id: gif.id,
    title: gif.title,
    content_description: gif.content_description,
    media_formats: trimmedFormats,
  };
}

// Rewrites a provider's CDN URL (Tenor or Klipy) to the corresponding bsky proxy
export function gifProxyUrl(gifUrl) {
  if (!gifUrl) return null;
  let url;
  try {
    url = new URL(gifUrl);
  } catch (error) {
    return null;
  }
  if (url.hostname === TENOR_GIF_HOSTNAME) {
    url.hostname = TENOR_GIF_PROXY_HOSTNAME;
    return url.href;
  }
  if (url.hostname === KLIPY_GIF_HOSTNAME) {
    url.hostname = KLIPY_GIF_PROXY_HOSTNAME;
    return url.href;
  }
  return gifUrl;
}

// e.g. "/foo/bar.mp3" -> "bar"
export function getFileSlug(url) {
  if (!url) return null;
  const filename = url.split("/").pop();
  if (!filename) return null;
  const dotIndex = filename.lastIndexOf(".");
  return dotIndex > 0 ? filename.slice(0, dotIndex) : null;
}

// Builds the external embed shape for a picked GIF
export function buildGifExternal({ gif, alt = "" }) {
  const format = gif.media_formats.gif ?? gif.media_formats.tinygif;
  if (!format?.url || !format.dims?.[0] || !format.dims?.[1]) return null;
  const params = new URLSearchParams();
  params.set("hh", String(format.dims[1]));
  params.set("ww", String(format.dims[0]));
  try {
    // Add file slugs if possible
    if (new URL(format.url).hostname === KLIPY_GIF_HOSTNAME) {
      const mp4Slug = getFileSlug(gif.media_formats.mp4?.url);
      const webmSlug = getFileSlug(gif.media_formats.webm?.url);
      if (mp4Slug) params.set("mp4", mp4Slug);
      if (webmSlug) params.set("webm", webmSlug);
    }
  } catch (error) {
    // pass
  }
  const vendorText = gif.content_description || gif.title;
  const previewUrl = gif.media_formats.preview?.url;
  return {
    url: `${format.url}?${params.toString()}`,
    title: vendorText,
    description: createGifDescription(vendorText, alt),
    image: previewUrl ? gifProxyUrl(previewUrl) : null,
  };
}

// Serializes a gif to the draft external URI format shared with bsky
export function buildGifDraftUri({ gif, alt = "" }) {
  const format = gif.media_formats.gif ?? gif.media_formats.tinygif;
  if (!format?.url || !format.dims?.[0] || !format.dims?.[1]) return null;
  const params = new URLSearchParams();
  params.set("ww", String(format.dims[0]));
  params.set("hh", String(format.dims[1]));
  const trimmedAlt = alt.trim();
  if (trimmedAlt) {
    params.set("alt", trimmedAlt);
  }
  return `${format.url}?${params.toString()}`;
}

// Rebuilds from serialized URI format
export function restoreGifFromDraftUri(uri) {
  const parsed = parseGifFromUrl(uri);
  if (!parsed) return null;
  const cleanParsedUrl = new URL(uri);
  for (const param of ["ww", "hh", "alt", "mp4", "webm"]) {
    cleanParsedUrl.searchParams.delete(param);
  }
  const cleanUrl = cleanParsedUrl.href;
  const mediaObject = {
    url: cleanUrl,
    dims: [parsed.width, parsed.height],
    duration: 0,
    size: 0,
  };
  return {
    gif: {
      id: "",
      created: 0,
      hasaudio: false,
      hascaption: false,
      flags: "",
      tags: [],
      title: "",
      content_description: parsed.alt || "",
      itemurl: "",
      url: cleanUrl,
      media_formats: {
        gif: mediaObject,
        tinygif: mediaObject,
        preview: mediaObject,
      },
    },
    alt: parsed.alt,
  };
}

// Bluesky uses these to distinguish between user-provided and default alt text
const USER_ALT_PREFIX = "Alt: ";
const DEFAULT_ALT_PREFIX = "ALT: ";

export function createGifDescription(vendorText, userAlt = "") {
  const trimmed = userAlt.trim();
  return trimmed !== ""
    ? USER_ALT_PREFIX + trimmed
    : DEFAULT_ALT_PREFIX + vendorText;
}

export function parseAltFromGifDescription(description) {
  if (!description) return { isPreferred: false, alt: "" };
  if (description.startsWith(USER_ALT_PREFIX)) {
    return {
      isPreferred: true,
      alt: description.slice(USER_ALT_PREFIX.length),
    };
  }
  if (description.startsWith(DEFAULT_ALT_PREFIX)) {
    return {
      isPreferred: false,
      alt: description.slice(DEFAULT_ALT_PREFIX.length),
    };
  }
  return { isPreferred: false, alt: description };
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
