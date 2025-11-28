import { html } from "/js/lib/lit-html.js";
import { getRKey } from "/js/dataHelpers.js";
import { externalLinkTemplate } from "/js/templates/externalLink.template.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { richTextTemplate } from "/js/templates/richText.template.js";
import { parseEmbedPlayerFromUrl } from "/js/lib/embed-player.js";
import { postHeaderTextTemplate } from "/js/templates/postHeaderText.template.js";
import { linkToPost, linkToFeed } from "/js/navigation.js";
import "/js/components/lightbox-image-group.js";
import "/js/components/streaming-video.js";
import "/js/components/gif-player.js";
import "/js/components/moderation-warning.js";

function blockedQuoteTemplate() {
  return html`<div class="quoted-post">Post unavailable</div>`;
}

function removedQuoteTemplate() {
  return html`<div class="quoted-post">Removed by author</div>`;
}

function notFoundQuoteTemplate() {
  return html`<div class="quoted-post">Deleted</div>`;
}

function mutedWrapperTemplate({ isMuted, label, children }) {
  if (isMuted) {
    return html`<moderation-warning
      @click=${(e) => {
        const clickedBar = !!e.target.closest(".top-bar");
        if (clickedBar) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      class="quoted-account-muted-warning"
      label=${label}
      >${children}</moderation-warning
    >`;
  }
  return children;
}

function showNestedEmbed(embed) {
  if (embed.$type === "app.bsky.embed.record#view") {
    const record = embed.record;
    if (record.$type === "app.bsky.embed.record#viewBlocked") {
      return false;
    }
    if (record.$type === "app.bsky.embed.record#viewNotFound") {
      return false;
    }
    if (record.author?.viewer?.muted) {
      return false;
    }
    if (record.$type === "app.bsky.embed.record#viewRecord") {
      return !!record.value.text;
    }
    return false;
  }
  return true;
}

function quotedPostTemplate({ quotedPost, lazyLoadImages }) {
  if (!quotedPost) {
    return html`<div class="quoted-post">Post not found</div>`;
  }
  // only supports one embed for now
  const embed = quotedPost.embeds?.length > 0 ? quotedPost.embeds[0] : null;
  // Mute if necessary.
  let isMuted = false;
  let mutedLabel = null;
  if (quotedPost.hasMutedWord) {
    isMuted = true;
    mutedLabel = "Hidden by muted word";
  }
  // this has precedence, in the case that both are true
  if (quotedPost.author.viewer?.muted) {
    isMuted = true;
    mutedLabel = "Muted Account";
  }
  return html`<a class="quoted-post-link" href="${linkToPost(quotedPost)}">
    <div class="quoted-post post-content">
      ${mutedWrapperTemplate({
        isMuted,
        label: mutedLabel,
        children: html`
          <div class="quoted-post-header">
            ${avatarTemplate({
              author: quotedPost.author,
              lazyLoad: lazyLoadImages,
            })}
            ${postHeaderTextTemplate({
              author: quotedPost.author,
              timestamp: quotedPost.value.createdAt,
            })}
          </div>
          <div class="quoted-post-body">
            <div class="post-text">
              ${richTextTemplate({
                text: quotedPost.value.text.trimEnd(),
                facets: quotedPost.value.facets,
              })}
            </div>
            ${embed && showNestedEmbed(embed)
              ? html`<div class="post-embed">
                  ${postEmbedTemplate({
                    embed: embed,
                    labels: quotedPost.labels,
                    lazyLoadImages,
                  })}
                </div>`
              : ""}
          </div>
        `,
      })}
    </div>
  </a>`;
}

function imagesTemplate({ images, lazyLoad = false }) {
  return html`<lightbox-image-group
    class="post-images num-images-${images.length}"
  >
    ${images.map(
      (image) =>
        html`<div class="post-image-container">
          <img
            class="post-image"
            src="${image.thumb}"
            alt=${image.alt}
            height=${image.aspectRatio?.height ?? ""}
            width=${image.aspectRatio?.width ?? ""}
            loading=${lazyLoad ? "lazy" : "eager"}
          />
          ${image.alt ? html` <div class="alt-indicator">ALT</div> ` : ""}
        </div> `
    )}
  </lightbox-image-group>`;
}

function videoTemplate({ video }) {
  return html`<div class="post-video">
    <streaming-video
      src="${video.playlist}"
      controls
      muted
      height=${video.aspectRatio?.height ?? ""}
      width=${video.aspectRatio?.width ?? ""}
    ></streaming-video>
  </div>`;
}

function tenorPlayerTemplate({ uri, alt }) {
  return html` <div class="post-video">
    <gif-player src="${uri}" alt="${alt}"></gif-player>
  </div>`;
}

function externalTemplate({ external, lazyLoadImages }) {
  const embedPlayer = parseEmbedPlayerFromUrl(external.uri);
  // todo: other embed players
  if (embedPlayer && embedPlayer.type === "tenor_gif") {
    return tenorPlayerTemplate({
      uri: embedPlayer.playerUri,
      alt: external.description,
      lazyLoad: lazyLoadImages,
    });
  }
  return externalLinkTemplate({
    url: external.uri,
    title: external.title,
    description: external.description,
    image: external.thumb,
    lazyLoadImages,
  });
}

function getStarterPackThumbnail(starterPack) {
  return `https://ogcard.cdn.bsky.app/start/${
    starterPack.creator.did
  }/${getRKey(starterPack)}`;
}

function starterPackTemplate({ starterPack }) {
  return html`<div class="starter-pack-embed">
    <a
      href="https://bsky.app/starter-pack/${starterPack.creator
        .handle}/${getRKey(starterPack)}"
      target="_blank"
      @click=${(e) => e.stopPropagation()}
    >
      <div class="starter-pack-embed-content">
        <img
          class="starter-pack-embed-image"
          src="${getStarterPackThumbnail(starterPack)}"
          alt=${starterPack.title}
        />
        <div class="starter-pack-embed-text">
          <div class="starter-pack-embed-title">${starterPack.record.name}</div>
          <div class="starter-pack-embed-subtitle">
            Starter pack by @${starterPack.creator.handle}
          </div>
          <div class="starter-pack-embed-description">
            ${starterPack.record.description}
          </div>
        </div>
      </div>
    </a>
  </div>`;
}

function feedGeneratorTemplate({ feedGenerator }) {
  const avatarUrl = feedGenerator.avatar ?? "/img/list-avatar-fallback.svg"; // todo - is there a different fallback for feed generators?
  return html`<div class="feed-generator-embed">
    <a href="${linkToFeed(feedGenerator)}">
      <div class="feed-generator-embed-content">
        <img
          class="feed-avatar"
          src="${avatarUrl}"
          alt=${feedGenerator.displayName}
        />
        <div class="feed-generator-embed-text">
          <div class="feed-generator-embed-title">
            ${feedGenerator.displayName}
          </div>
          <div class="feed-generator-embed-subtitle">
            Feed by @${feedGenerator.creator.handle}
          </div>
        </div>
      </div>
    </a>
  </div>`;
}

function listTemplate({ list }) {
  const avatarUrl = list.avatar ?? "/img/list-avatar-fallback.svg";
  return html`<div class="list-embed">
    <a
      href="https://bsky.app/profile/${list.creator.handle}/lists/${getRKey(
        list
      )}"
      target="_blank"
      @click=${(e) => e.stopPropagation()}
    >
      <div class="list-embed-content">
        <img class="list-avatar" src="${avatarUrl}" alt=${list.name} />
        <div class="list-embed-text">
          <div class="list-embed-title">${list.name}</div>
          <div class="list-embed-subtitle">Feed by @${list.creator.handle}</div>
        </div>
      </div>
    </a>
  </div>`;
}

const ModerationLabels = {
  NUDITY: "nudity",
  PORN: "porn",
  SEXUAL: "sexual",
  SEXUAL_FIGURATIVE: "sexual-figurative",
  GRAPHIC_MEDIA: "graphic-media",
};

const ModerationLabelDisplayNames = {
  [ModerationLabels.NUDITY]: "Adult Content",
  [ModerationLabels.PORN]: "Adult Content",
  [ModerationLabels.SEXUAL]: "Adult Content",
  [ModerationLabels.SEXUAL_FIGURATIVE]: "Sexually Suggestive (Cartoon)",
  [ModerationLabels.GRAPHIC_MEDIA]: "Graphic Media",
};

const HIDDEN_LABELS = [
  ModerationLabels.NUDITY,
  ModerationLabels.PORN,
  ModerationLabels.SEXUAL,
  ModerationLabels.SEXUAL_FIGURATIVE,
  ModerationLabels.GRAPHIC_MEDIA,
];

function getDisplayNameForLabel(label) {
  return ModerationLabelDisplayNames[label.val];
}

function moderationWarningTemplate({ label, children }) {
  return html`<moderation-warning
    class="post-moderation-warning"
    @click=${(e) => {
      const clickedBar = !!e.target.closest(".top-bar");
      if (clickedBar) {
        e.preventDefault();
        e.stopPropagation();
      }
    }}
    label="${getDisplayNameForLabel(label)}"
  >
    ${children}
  </moderation-warning>`;
}

function getWarningLabel(labels) {
  if (!labels) {
    return null;
  }
  return labels.find((label) => HIDDEN_LABELS.includes(label.val));
}

function recordEmbedTemplate({ record, lazyLoadImages }) {
  switch (record.$type) {
    case "app.bsky.embed.record#viewRecord":
      return quotedPostTemplate({ quotedPost: record, lazyLoadImages });
    // This only happens if the author is blocking the viewer
    case "app.bsky.embed.record#viewBlocked":
      return blockedQuoteTemplate();
    case "app.bsky.embed.record#viewDetached":
      return removedQuoteTemplate();
    case "app.bsky.embed.record#viewNotFound":
      return notFoundQuoteTemplate();
    case "app.bsky.graph.defs#starterPackViewBasic":
      return starterPackTemplate({ starterPack: record });
    case "app.bsky.feed.defs#generatorView":
      return feedGeneratorTemplate({ feedGenerator: record });
    case "app.bsky.graph.defs#listView":
      return listTemplate({ list: record });
    default:
      console.warn("Record embed type not supported: ", record.$type);
      return null;
  }
}

export function postEmbedTemplate({
  embed,
  labels,
  enabledEmbedTypes,
  // lazyLoadImages = false,
  lazyLoadImages = false,
}) {
  let content = null;
  if (enabledEmbedTypes && !enabledEmbedTypes.includes(embed.$type)) {
    return null;
  }
  switch (embed.$type) {
    case "app.bsky.embed.record#view":
      content = recordEmbedTemplate({ record: embed.record, lazyLoadImages });
      break;
    case "app.bsky.embed.recordWithMedia#view":
      content = html`
        ${postEmbedTemplate({ embed: embed.media })}
        ${recordEmbedTemplate({ record: embed.record.record, lazyLoadImages })}
      `;
      break;
    case "app.bsky.embed.video#view":
      content = videoTemplate({ video: embed });
      break;
    case "app.bsky.embed.images#view":
      content = imagesTemplate({
        images: embed.images,
        lazyLoad: lazyLoadImages,
      });
      break;
    case "app.bsky.embed.external#view":
      content = externalTemplate({
        external: embed.external,
        lazyLoadImages,
      });
      break;
    default:
      console.warn("Embed type not supported: ", embed.$type);
      break;
  }
  // Optionally wrap with moderation warning
  const warningLabel = getWarningLabel(labels);
  const wrappedContent = warningLabel
    ? moderationWarningTemplate({ label: warningLabel, children: content })
    : content;
  return wrappedContent;
}
