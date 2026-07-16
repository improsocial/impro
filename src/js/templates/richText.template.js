import { html } from "/js/lib/lit-html.js";
import { sanitizeUri } from "/js/utils.js";
import { tokenizeRichText } from "/js/richTextHelpers.js";
import { linkToHashtag, linkToProfileByDid } from "/js/navigation.js";

const KNOWN_UNSUPPORTED_FACET_TYPES = [
  "blue.poll.post.facet#option",
  "blue.moji.richtext.facet",
];

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
      return wrappedText;
  }
}

// tokens: ({ type: "text" } / { type: "facet" } / { type: "inline" } / { type: "block" })
export function richTextTokensTemplate({
  tokens,
  truncateUrls = false,
  renderNodeToken = () => null,
}) {
  const parts = [];
  tokens.forEach((token, index) => {
    switch (token.type) {
      case "text": {
        let value = token.value;
        // Trim the newlines adjoining a block token so blocks don't render
        // with double gaps (the text is displayed white-space: pre-wrap).
        if (tokens[index - 1]?.type === "block" && value.startsWith("\n")) {
          value = value.slice(1);
        }
        if (tokens[index + 1]?.type === "block" && value.endsWith("\n")) {
          value = value.slice(0, -1);
        }
        parts.push(value);
        break;
      }
      case "facet":
        parts.push(
          facetTemplate({
            facet: token.facet,
            wrappedText: token.text,
            truncateUrls,
          }),
        );
        break;
      case "inline":
      case "block": {
        const element = renderNodeToken(token) ?? null;
        if (!element) break;
        parts.push(
          token.type === "block"
            ? html`<div class="rich-text-block">${element}</div>`
            : element,
        );
        break;
      }
    }
  });
  // prettier-ignore
  return html`<div class="rich-text" data-testid="rich-text">${parts}</div>`;
}

export function richTextTemplate({ text, facets = [], truncateUrls = false }) {
  const tokens = tokenizeRichText({ text, facets });
  return richTextTokensTemplate({
    tokens,
    truncateUrls,
  });
}
