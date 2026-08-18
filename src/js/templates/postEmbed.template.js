import { html, render } from "/js/lib/lit-html.js";
import {
  cdnImageUrl,
  getRKey,
  doHideAuthorOnUnauthenticated,
  getLabelNameAndDescription,
  parseYouTubeVideoFromUrl,
} from "/js/dataHelpers.js";
import { parseAltFromGifDescription } from "/js/embedHelpers.js";
import { externalLinkTemplate } from "/js/templates/externalLink.template.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { infoIconTemplate } from "/js/templates/icons/infoIcon.template.js";
import { closeIconTemplate } from "/js/templates/icons/closeIcon.template.js";
import { closeWithAnimation } from "/js/dialogHelpers.js";
import "/js/components/plugin-rich-text.js";
import { postHeaderTextTemplate } from "/js/templates/postHeaderText.template.js";
import { authorBadgesTemplate } from "/js/templates/labelBadges.template.js";
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
import "/js/components/moderation-warning.js";
import "/js/components/image-carousel.js";
import "/js/components/youtube-embed.js";
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

function condensedMediaTemplate({ embed, lazyLoadImages }) {
  if (embed?.$type === "app.bsky.embed.images#view") {
    return html`<div class="quoted-post-media-thumbs">
      ${embed.images
        .slice(0, 4)
        .map(
          (image) =>
            html`<img
              class="quoted-post-media-thumb"
              src="${cdnImageUrl(image.thumb)}"
              alt="${image.alt || ""}"
              loading=${lazyLoadImages ? "lazy" : "eager"}
            />`,
        )}
    </div>`;
  }
  if (embed?.$type === "app.bsky.embed.video#view") {
    return html`<div class="quoted-post-media-thumbs">
      <div class="quoted-post-media-video">
        <img
          class="quoted-post-media-thumb"
          src="${cdnImageUrl(embed.thumbnail)}"
          alt="${embed.alt || ""}"
          loading=${lazyLoadImages ? "lazy" : "eager"}
        />
        <div class="video-preview-play-button"></div>
      </div>
    </div>`;
  }
  return "";
}

export function quotedPostTemplate({
  quotedPost,
  lazyLoadImages,
  isAuthenticated,
  condensed = false,
  pluginService,
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
  if (quotedPost.isHidden) {
    isMuted = true;
    mutedLabel = "Post hidden by you";
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
    <div
      class="quoted-post post-content embed-card ${condensed
        ? "quoted-post-condensed"
        : ""}"
    >
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
              enableProfileLink: false,
            })}
          </div>
          ${authorBadgesTemplate({
            badgeLabels: quotedPost.badgeLabels,
            did: quotedPost.author?.did,
            pluginService,
          })}
          <div class="quoted-post-body">
            ${postText.length > 0
              ? html`<div class="post-text">
                  <plugin-rich-text
                    .pluginService=${pluginService}
                    .text=${postText}
                    .facets=${quotedPost.value.facets}
                    .transformContext=${{
                      surface: "quotedPost",
                      uri: quotedPost.uri,
                      did: quotedPost.author?.did ?? null,
                    }}
                    truncate-urls
                  ></plugin-rich-text>
                </div>`
              : ""}
            ${embed && condensed
              ? condensedMediaTemplate({ embed, lazyLoadImages })
              : embed && showNestedEmbed(embed)
                ? html`<div class="post-embed">
                    ${postEmbedTemplate({
                      embed: embed,
                      mediaLabel: quotedPost.mediaLabel,
                      lazyLoadImages,
                      isAuthenticated,
                      pluginService,
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

function postVideoSizingStyle(aspectRatio) {
  const ratio =
    Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 1;
  return `--post-video-height: ${100 / ratio}%;`;
}

function imageContainerTemplate({ image, lazyLoad, doCalculateAspectRatio }) {
  return html`<div class="post-image-container">
    <img
      class="post-image"
      src="${cdnImageUrl(image.thumb)}"
      data-lightbox-src="${cdnImageUrl(image.fullsize ?? image.thumb)}"
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
  if (video.presentation === "gif") {
    return gifPlayerTemplate({
      uri: video.playlist,
      alt: video.alt,
      aspectRatio,
    });
  }
  return html`<div
    class="post-video"
    style=${postVideoSizingStyle(aspectRatio)}
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
    if (e.target === dialog) closeWithAnimation(dialog);
  });
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    closeWithAnimation(dialog);
  });
  render(
    html`<button
        class="alt-text-dialog-close"
        data-testid="alt-text-dialog-close"
        @click=${() => closeWithAnimation(dialog)}
        aria-label="Close"
      >
        ${closeIconTemplate()}
      </button>
      <p class="alt-text-dialog-text">${altText}</p>`,
    dialog,
  );
  document.body.appendChild(dialog);
  dialog.showModal();
}

function gifPlayerTemplate({ type = "video", uri, alt, aspectRatio = null }) {
  return html` <div
    class="post-video"
    style=${postVideoSizingStyle(aspectRatio)}
  >
    ${type === "video"
      ? html`<streaming-video
          src="${uri}"
          alt="${alt ?? ""}"
          loop
          autoplay
          muted
          playsinline
        ></streaming-video>`
      : html`<img src="${uri}" alt="${alt ?? ""}" loading="lazy" />`}
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

const YOUTUBE_VIDEO_ASPECT_RATIO = 16 / 9;
const YOUTUBE_SHORT_ASPECT_RATIO = 9 / 16;

function youtubeEmbedTemplate({ youtubeVideo, external }) {
  const aspectRatio = youtubeVideo.isShort
    ? YOUTUBE_SHORT_ASPECT_RATIO
    : YOUTUBE_VIDEO_ASPECT_RATIO;
  return html`<youtube-embed
    class="youtube-embed"
    data-testid="youtube-embed"
    aspect-ratio=${aspectRatio}
    video-id=${youtubeVideo.videoId}
    start=${youtubeVideo.startTime}
    thumb=${external.thumb ?? ""}
    video-title=${external.title ?? ""}
    url=${external.uri}
    description=${external.description ?? ""}
    @click=${(e) => {
      e.stopPropagation();
    }}
  ></youtube-embed>`;
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

// https://github.com/bluesky-social/social-app/blob/main/src/lib/strings/embed-player.ts
function parseKlipyGif(url) {
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return null;
  }
  if (parsedUrl.hostname !== "static.klipy.com") return null;
  if (!parsedUrl.pathname.startsWith("/ii/")) return null;
  const height = Number(parsedUrl.searchParams.get("hh"));
  const width = Number(parsedUrl.searchParams.get("ww"));
  if (!height || !width || height <= 0 || width <= 0) return null;
  const aspectRatio = width / height;
  const slug = isSafari()
    ? parsedUrl.searchParams.get("mp4")
    : parsedUrl.searchParams.get("webm");
  const proxyUrl = new URL(parsedUrl.href);
  proxyUrl.hostname = KLIPY_GIF_PROXY_HOSTNAME;
  proxyUrl.searchParams.delete("hh");
  proxyUrl.searchParams.delete("ww");
  proxyUrl.searchParams.delete("mp4");
  proxyUrl.searchParams.delete("webm");
  if (slug) {
    const ext = isSafari() ? "mp4" : "webm";
    const parts = proxyUrl.pathname.split("/");
    parts[parts.length - 1] = `${slug}.${ext}`;
    proxyUrl.pathname = parts.join("/");
    return { videoUri: proxyUrl.href, aspectRatio };
  }
  if (!/\.gif$/i.test(proxyUrl.pathname)) return null;
  return { imageUri: proxyUrl.href, aspectRatio };
}

function isGifUrl(uri) {
  return isTenorGifUrl(uri) || !!parseKlipyGif(uri);
}

export function gifExternalTemplate({ uri, alt }) {
  if (isTenorGifUrl(uri)) {
    return gifPlayerTemplate({ uri: getTenorGifPlayerUri(uri), alt });
  }
  const klipyGif = parseKlipyGif(uri);
  if (klipyGif) {
    return gifPlayerTemplate({
      type: klipyGif.videoUri ? "video" : "image",
      uri: klipyGif.videoUri ?? klipyGif.imageUri,
      alt,
      aspectRatio: klipyGif.aspectRatio,
    });
  }
  console.warn("Uri has unknown gif type: " + uri);
  return null;
}

function externalTemplate({ external, lazyLoadImages }) {
  if (isGifUrl(external.uri)) {
    return gifExternalTemplate({
      uri: external.uri,
      alt: parseAltFromGifDescription(external.description).alt,
    });
  }
  const youtubeVideo = parseYouTubeVideoFromUrl(external.uri);
  if (youtubeVideo) {
    return youtubeEmbedTemplate({ youtubeVideo, external });
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
  const avatarUrl =
    cdnImageUrl(feedGenerator.avatar) ?? "/img/feed-avatar-fallback.svg";
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
  const avatarUrl = cdnImageUrl(list.avatar) ?? "/img/list-avatar-fallback.svg";
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

export function recordEmbedTemplate({
  record,
  lazyLoadImages,
  isAuthenticated,
  condensed = false,
  pluginService,
}) {
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
        condensed,
        pluginService,
      });
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
  lazyLoadImages = false,
  isAuthenticated,
  currentConvoId = null,
  pluginService,
}) {
  switch (embed.$type) {
    case "app.bsky.embed.record#view":
      return recordEmbedTemplate({
        record: embed.record,
        lazyLoadImages,
        isAuthenticated,
        pluginService,
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
          pluginService,
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
