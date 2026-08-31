import { html, keyed } from "/js/lib/lit-html.js";
import {
  avatarThumbnailUrl,
  cdnImageUrl,
  getDisplayName,
  isLabelerProfile,
} from "/js/dataHelpers.js";
import { classnames, isNative, isTouchOnlyDevice } from "/js/utils.js";
import { linkToProfile } from "/js/navigation.js";
import "/js/components/lightbox-image-group.js";

// Click actions: "default", "link", "lightbox", "live", "none".
// "default" links to the profile, except live avatars on touch devices open
// the live status dialog instead; "link" always navigates.

// Bubbles up to the main layout, which opens the live status dialog
function dispatchLiveAvatarClick(event, author) {
  event.currentTarget.dispatchEvent(
    new CustomEvent("live-avatar:click", {
      detail: { did: author.did },
      bubbles: true,
    }),
  );
}

// Wraps a live avatar's frame so the LIVE badge can hang below it
function liveWrapperTemplate({ isLive, showLiveBadge, children }) {
  if (!isLive) return children;
  return html`<div class="avatar-live-frame">
    ${children}
    ${showLiveBadge
      ? html`<div class="avatar-live-badge" data-testid="live-badge">LIVE</div>`
      : null}
  </div>`;
}

function avatarWrapperTemplate({ author, clickAction, isLive, children }) {
  if (clickAction === "live") {
    return html`<button
      class="avatar-live-button"
      data-testid="avatar-live-button"
      aria-label="${getDisplayName(author)} is live"
      @click=${(event) => dispatchLiveAvatarClick(event, author)}
    >
      ${children}
    </button>`;
  } else if (clickAction === "link") {
    return html`<a
      class="avatar-link"
      href="${linkToProfile(author)}"
      data-hover-did=${author.did}
      >${children}</a
    >`;
  } else if (clickAction === "lightbox") {
    return html`<lightbox-image-group hide-alt-text="true" image-shape="circle"
      >${children}</lightbox-image-group
    >`;
  } else if (clickAction === "none") {
    return children;
  } else {
    // "default" has "link" behavior unless user is live,
    // in which case it opens the live status dialog on touch devices
    return html`<a
      class="avatar-link"
      href="${linkToProfile(author)}"
      data-hover-did=${author.did}
      @click=${(event) => {
        if (isLive && (isNative() || isTouchOnlyDevice())) {
          event.preventDefault();
          dispatchLiveAvatarClick(event, author);
        }
      }}
      >${children}</a
    >`;
  }
}

function getAvatarFallbackUrl(isLabeler) {
  if (isLabeler) {
    return "/img/labeler-avatar-fallback.svg";
  } else {
    return "/img/avatar-fallback.svg";
  }
}

function getAvataThumbnailUrl(author, isLabeler) {
  if (author.avatar) {
    return cdnImageUrl(avatarThumbnailUrl(author.avatar));
  } else {
    return getAvatarFallbackUrl(isLabeler);
  }
}

function getAvatarFullSizeUrl(author, isLabeler) {
  if (author.avatar) {
    return cdnImageUrl(author.avatar);
  } else {
    return getAvatarFallbackUrl(isLabeler);
  }
}

export function avatarTemplate({
  author,
  clickAction = "default",
  lazyLoad = false,
  // lazyLoad = true,
  showLiveStatus = true,
  showLiveBadge = true,
}) {
  const isLabeler = isLabelerProfile(author);
  const isBlurred = !!author.blurLabel;
  const isLive = showLiveStatus && !!author.isLive;
  const avatarThumbnailUrl = getAvataThumbnailUrl(author, isLabeler);
  const avatarFullSizeUrl = getAvatarFullSizeUrl(author, isLabeler);
  return html`<div class="avatar" data-testid="avatar">
    ${avatarWrapperTemplate({
      author,
      clickAction,
      isLive,
      children: keyed(
        author.handle,
        liveWrapperTemplate({
          isLive,
          showLiveBadge,
          children: html`<div
            class=${classnames("avatar-image-frame", {
              "labeler-avatar": isLabeler,
              "avatar-live": isLive,
            })}
          >
            <span class="hack-x">x</span>
            <img
              src="${avatarThumbnailUrl}"
              alt="${getDisplayName(author)} profile picture"
              class=${classnames("avatar-image", {
                "labeler-avatar": isLabeler,
                "avatar-image--blurred": isBlurred,
              })}
              data-testid="avatar-image"
              data-lightbox-src="${avatarFullSizeUrl}"
              loading=${lazyLoad ? "lazy" : "eager"}
            />
          </div>`,
        }),
      ),
    })}
  </div>`;
}
