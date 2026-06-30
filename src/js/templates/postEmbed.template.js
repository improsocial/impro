import { html, render } from "/js/lib/lit-html.js";
import {
  getRKey,
  doHideAuthorOnUnauthenticated,
  getLabelNameAndDescription,
} from "/js/dataHelpers.js";
import { externalLinkTemplate } from "/js/templates/externalLink.template.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { infoIconTemplate } from "/js/templates/icons/infoIcon.template.js";
import { richTextTemplate } from "/js/templates/richText.template.js";
import { postHeaderTextTemplate } from "/js/templates/postHeaderText.template.js";
import { postLabelsTemplate } from "/js/templates/postLabels.template.js";
import { linkToPost, linkToFeed } from "/js/navigation.js";
import { moderationWarningTemplate } from "/js/templates/moderationWarning.template.js";
import "/js/components/container-link.js";
import {
  OG_CARD_SERVICE_URL,
  TENOR_GIF_PROXY_URL,
  KLIPY_GIF_PROXY_HOSTNAME,
} from "/js/config.js";
import { isSafari } from "/js/utils.js";
import "/js/components/lightbox-image-group.js";
import "/js/components/streaming-video.js";
import "/js/components/gif-player.js";
import "/js/components/moderation-warning.js";
import "/js/components/image-carousel.js";
import { chatJoinLinkEmbedTemplate } from "/js/templates/chatJoinLinkEmbed.template.js";

function galleryItemsToImages(items) {
  return (items ?? [])
    .filter(
      (item) =>
        !item.$type || item.$type === "app.bsky.embed.gallery#viewImage",
    )
    .map(({ thumbnail, ...rest }) => ({ thumb: thumbnail, ...rest }));
}

function moderationWarningWrapperTemplate({ children, mediaLabel }) {
  return mediaLabel
    ? moderationWarningTemplate({
        labelDefinition: mediaLabel.labelDefinition,
        labeler: mediaLabel.labeler,
        isAuthorLabel: false,
        children,
      })
    : children;
}

function blockedQuoteTemplate() {
  return html`<div
    class="quoted-post missing-quote-indicator embed-card"
    data-testid="blocked-quote"
  >
    ${infoIconTemplate()} Blocked
  </div>`;
}

function removedQuoteTemplate() {
  return html`<div
    class="quoted-post missing-quote-indicator embed-card"
    data-testid="removed-quote"
  >
    ${infoIconTemplate()} Removed by author
  </div>`;
}

function notFoundQuoteTemplate() {
  return html`<div
    class="quoted-post missing-quote-indicator embed-card"
    data-testid="not-found-quote"
  >
    ${infoIconTemplate()} Deleted
  </div>`;
}

function mutedWrapperTemplate({ isMuted, label, iconStyle, children }) {
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
      icon-style=${iconStyle}
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

export function quotedPostTemplate({
  quotedPost,
  lazyLoadImages,
  isAuthenticated,
}) {
  if (!quotedPost) {
    return html`<div class="quoted-post embed-card">Post not found</div>`;
  }
  // only supports one embed for now
  let embed = quotedPost.embeds?.length > 0 ? quotedPost.embeds[0] : null;
  // if the nested embed is a recordWithMedia, just show the media and not the quoted post
  if (embed?.$type === "app.bsky.embed.recordWithMedia#view") {
    embed = embed.media;
  }
  // Mute if necessary.
  let isMuted = false;
  let mutedLabel = null;
  let mutedIconStyle = "info";
  if (quotedPost.hasMutedWord) {
    isMuted = true;
    mutedLabel = "Hidden by muted word";
    mutedIconStyle = "closed-eye";
  }
  // this has precedence, in the case that both are true
  if (quotedPost.author.viewer?.muted) {
    isMuted = true;
    mutedLabel = "Muted Account";
    mutedIconStyle = "closed-eye";
  }
  // And this has further precedence
  const contentLabel = quotedPost.contentLabel;
  if (contentLabel && contentLabel.visibility !== "ignore") {
    isMuted = true;
    const { name: labelName } = getLabelNameAndDescription(
      contentLabel.labelDefinition,
    );
    mutedLabel = labelName;
    mutedIconStyle = "info";
    const isAuthorLabel = contentLabel.label.uri === quotedPost?.author?.did;
    if (isAuthorLabel) {
      mutedLabel += " (Account)";
    }
  }
  const postText = quotedPost.value.text || "";
  return html`<container-link
    class="quoted-post-link"
    href=${linkToPost(quotedPost)}
  >
    <div class="quoted-post post-content embed-card">
      ${mutedWrapperTemplate({
        isMuted,
        label: mutedLabel,
        iconStyle: mutedIconStyle,
        children: html`
          <div class="quoted-post-header">
            ${avatarTemplate({
              author: quotedPost.author,
              lazyLoad: lazyLoadImages,
            })}
            ${postHeaderTextTemplate({
              author: quotedPost.author,
              timestamp: quotedPost.indexedAt,
            })}
          </div>
          ${quotedPost.badgeLabels
            ? postLabelsTemplate({ badgeLabels: quotedPost.badgeLabels })
            : ""}
          <div class="quoted-post-body">
            ${postText.length > 0
              ? html`<div class="post-text">
                  ${richTextTemplate({
                    text: postText,
                    facets: quotedPost.value.facets,
                    truncateUrls: true,
                  })}
                </div>`
              : ""}
            ${embed && showNestedEmbed(embed)
              ? html`<div class="post-embed">
                  ${postEmbedTemplate({
                    embed: embed,
                    mediaLabel: quotedPost.mediaLabel,
                    lazyLoadImages,
                    isAuthenticated,
                  })}
                </div>`
              : ""}
          </div>
        `,
      })}
    </div>
  </container-link>`;
}

const MIN_POST_MEDIA_ASPECT_RATIO = 1 / 2;

function getPostMediaAspectRatio(media) {
  const dims = media?.aspectRatio;
  if (!dims) return null;
  const ratio = dims.width / dims.height;
  if (!Number.isFinite(ratio) || ratio <= 0) return null;
  return Math.max(ratio, MIN_POST_MEDIA_ASPECT_RATIO);
}

function imageContainerTemplate({ image, lazyLoad, doCalculateAspectRatio }) {
  return html`<div class="post-image-container">
    <img
      class="post-image"
      src="${image.thumb}"
      data-lightbox-src="${image.fullsize ?? image.thumb}"
      alt=${image.alt}
      style=${doCalculateAspectRatio
        ? `aspect-ratio: ${getPostMediaAspectRatio(image) ?? 1};`
        : ""}
      loading=${lazyLoad ? "lazy" : "eager"}
    />
    ${image.alt ? html` <div class="alt-indicator">ALT</div> ` : ""}
  </div>`;
}

function imageCarouselTemplate({ images }) {
  return html`<image-carousel
    data-testid="image-carousel"
    .images=${images}
  ></image-carousel>`;
}

function imagesTemplate({ images, lazyLoad = false }) {
  // Only single-image posts use the calculated aspect ratio
  const doCalculateAspectRatio = images.length === 1;
  return html`<lightbox-image-group
    class="post-images num-images-${images.length}"
    data-testid="post-images"
  >
    ${images.length === 3
      ? // When there are three images, wrap the right two in a div
        html`${imageContainerTemplate({
            image: images[0],
            lazyLoad,
            doCalculateAspectRatio,
          })}
          <div class="right-column">
            ${imageContainerTemplate({
              image: images[1],
              lazyLoad,
              doCalculateAspectRatio,
            })}
            ${imageContainerTemplate({
              image: images[2],
              lazyLoad,
              doCalculateAspectRatio,
            })}
          </div>`
      : images.map((image) =>
          imageContainerTemplate({ image, lazyLoad, doCalculateAspectRatio }),
        )}
  </lightbox-image-group>`;
}

function videoTemplate({ video }) {
  const aspectRatio = getPostMediaAspectRatio(video);
  return html`<div
    class="post-video"
    style=${aspectRatio ? `aspect-ratio: ${aspectRatio};` : ""}
    @click=${(e) => {
      e.stopPropagation();
      e.preventDefault();
    }}
  >
    <streaming-video
      src="${video.playlist}"
      alt="${video.alt ?? ""}"
      controls
      muted
    ></streaming-video>
    ${video.alt
      ? html`<button
          class="alt-indicator"
          data-testid="video-alt-badge"
          @click=${(e) => {
            e.stopPropagation();
            e.preventDefault();
            openAltTextDialog(video.alt);
          }}
        >
          ALT
        </button>`
      : ""}
  </div>`;
}

function openAltTextDialog(altText) {
  const dialog = document.createElement("dialog");
  dialog.className = "alt-text-dialog";
  dialog.dataset.testid = "alt-text-dialog";
  dialog.addEventListener("close", () => dialog.remove());
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });
  render(
    html`<button
        class="alt-text-dialog-close"
        data-testid="alt-text-dialog-close"
        @click=${() => dialog.close()}
        aria-label="Close"
      >
        ×
      </button>
      <p class="alt-text-dialog-text">${altText}</p>`,
    dialog,
  );
  document.body.appendChild(dialog);
  dialog.showModal();
}

function gifPlayerTemplate({ uri, alt }) {
  return html` <div class="post-video">
    <gif-player src="${uri}" alt="${alt}"></gif-player>
    ${alt
      ? html`<button
          class="alt-indicator"
          data-testid="video-alt-badge"
          @click=${(e) => {
            e.stopPropagation();
            e.preventDefault();
            openAltTextDialog(alt);
          }}
        >
          ALT
        </button>`
      : ""}
  </div>`;
}

function isTenorGifUrl(url) {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname !== "media.tenor.com") return false;
    const [_, id, filename] = parsedUrl.pathname.split("/");
    return Boolean(id && filename && id.includes("AAAAC"));
  } catch {
    return false;
  }
}

// https://github.com/bluesky-social/social-app/blob/main/src/lib/strings/embed-player.ts
function getTenorGifPlayerUri(url) {
  const parsedUrl = new URL(url);
  let [_, id, filename] = parsedUrl.pathname.split("/");
  if (isSafari()) {
    id = id.replace("AAAAC", "AAAP1");
    filename = filename.replace(".gif", ".mp4");
  } else {
    id = id.replace("AAAAC", "AAAP3");
    filename = filename.replace(".gif", ".webm");
  }
  return `${TENOR_GIF_PROXY_URL}/${id}/${filename}`;
}

function isKlipyGifUrl(url) {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname !== "static.klipy.com") return false;
    if (!parsedUrl.pathname.startsWith("/ii/")) return false;
    const height = Number(parsedUrl.searchParams.get("hh"));
    const width = Number(parsedUrl.searchParams.get("ww"));
    if (!height || !width || height <= 0 || width <= 0) return false;
    const slug = isSafari()
      ? parsedUrl.searchParams.get("mp4")
      : parsedUrl.searchParams.get("webm");
    return Boolean(slug);
  } catch {
    return false;
  }
}

// https://github.com/bluesky-social/social-app/blob/main/src/lib/strings/embed-player.ts
function getKlipyGifPlayerUri(url) {
  const parsedUrl = new URL(url);
  const slug = isSafari()
    ? parsedUrl.searchParams.get("mp4")
    : parsedUrl.searchParams.get("webm");
  const ext = isSafari() ? "mp4" : "webm";
  parsedUrl.hostname = KLIPY_GIF_PROXY_HOSTNAME;
  const parts = parsedUrl.pathname.split("/");
  parts[parts.length - 1] = `${slug}.${ext}`;
  parsedUrl.pathname = parts.join("/");
  parsedUrl.searchParams.delete("hh");
  parsedUrl.searchParams.delete("ww");
  parsedUrl.searchParams.delete("mp4");
  parsedUrl.searchParams.delete("webm");
  return parsedUrl.href;
}

function externalTemplate({ external, lazyLoadImages }) {
  if (isTenorGifUrl(external.uri)) {
    return gifPlayerTemplate({
      uri: getTenorGifPlayerUri(external.uri),
      alt: external.description,
    });
  }
  if (isKlipyGifUrl(external.uri)) {
    return gifPlayerTemplate({
      uri: getKlipyGifPlayerUri(external.uri),
      alt: external.description,
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
  return `${OG_CARD_SERVICE_URL}/start/${
    starterPack.creator.did
  }/${getRKey(starterPack)}`;
}

function starterPackTemplate({ starterPack }) {
  return html`<div class="starter-pack-embed embed-card">
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
  return html`<div class="feed-generator-embed embed-card">
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
  return html`<div class="list-embed embed-card">
    <a
      href="https://bsky.app/profile/${list.creator.handle}/lists/${getRKey(
        list,
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

function recordEmbedTemplate({ record, lazyLoadImages, isAuthenticated }) {
  switch (record.$type) {
    case "app.bsky.embed.record#viewRecord":
      if (
        !isAuthenticated &&
        record.author &&
        doHideAuthorOnUnauthenticated(record.author)
      ) {
        return blockedQuoteTemplate();
      }
      return quotedPostTemplate({
        quotedPost: record,
        lazyLoadImages,
        isAuthenticated,
      });
    // This only happens if the author is blocking the viewer
    case "app.bsky.embed.record#viewBlocked":
      return blockedQuoteTemplate();
    case "app.bsky.embed.record#viewDetached":
      return removedQuoteTemplate();
    case "app.bsky.feed.defs#notFoundPost":
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
  mediaLabel,
  enabledEmbedTypes,
  lazyLoadImages = false,
  isAuthenticated,
  currentConvoId = null,
}) {
  if (enabledEmbedTypes && !enabledEmbedTypes.includes(embed.$type)) {
    return null;
  }
  switch (embed.$type) {
    case "app.bsky.embed.record#view":
      return recordEmbedTemplate({
        record: embed.record,
        lazyLoadImages,
        isAuthenticated,
      });
    case "app.bsky.embed.recordWithMedia#view":
      return html`
        ${postEmbedTemplate({
          embed: embed.media,
          mediaLabel,
          lazyLoadImages,
          isAuthenticated,
        })}
        ${recordEmbedTemplate({
          record: embed.record.record,
          lazyLoadImages,
          isAuthenticated,
        })}
      `;
    case "app.bsky.embed.video#view":
      return moderationWarningWrapperTemplate({
        mediaLabel,
        children: videoTemplate({ video: embed }),
      });
    case "app.bsky.embed.images#view": {
      if (!embed.images?.length) return null;
      return moderationWarningWrapperTemplate({
        mediaLabel,
        children: imagesTemplate({
          images: embed.images,
          lazyLoad: lazyLoadImages,
        }),
      });
    }
    case "app.bsky.embed.gallery#view": {
      const images = galleryItemsToImages(embed.items);
      if (images.length === 0) return null;
      const children =
        images.length === 1
          ? imagesTemplate({ images, lazyLoad: lazyLoadImages })
          : imageCarouselTemplate({ images });
      return moderationWarningWrapperTemplate({ mediaLabel, children });
    }
    case "app.bsky.embed.external#view":
      return externalTemplate({
        external: embed.external,
        lazyLoadImages,
      });
    case "chat.bsky.embed.joinLink#view":
      return chatJoinLinkEmbedTemplate({ embed, currentConvoId });
    default:
      console.warn("Embed type not supported: ", embed.$type);
      break;
  }
}
