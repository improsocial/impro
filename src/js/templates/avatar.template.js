import { html, keyed } from "/js/lib/lit-html.js";
import { avatarThumbnailUrl, isLabelerProfile } from "/js/dataHelpers.js";
import { classnames } from "/js/utils.js";
import { linkToProfile } from "/js/navigation.js";
import "/js/components/lightbox-image-group.js";

// CLick actions: "link", "lightbox", "none"

function avatarWrapperTemplate({ author, clickAction, children }) {
  if (clickAction === "link") {
    return html`<a class="avatar-link" href="${linkToProfile(author.handle)}"
      >${children}</a
    >`;
  } else if (clickAction === "lightbox") {
    return html`<lightbox-image-group hide-alt-text="true"
      >${children}</lightbox-image-group
    >`;
  } else {
    return children;
  }
}

function getAvatarUrl(author, isLabeler) {
  if (author.avatar) {
    return avatarThumbnailUrl(author.avatar);
  } else if (isLabeler) {
    return "/img/labeler-avatar-fallback.svg";
  } else {
    return "/img/avatar-fallback.svg";
  }
}

export function avatarTemplate({
  author,
  clickAction = "link",
  lazyLoad = false,
  // lazyLoad = true,
}) {
  const isLabeler = isLabelerProfile(author);
  const avatarUrl = getAvatarUrl(author, isLabeler);
  return html`<div class="avatar">
    ${avatarWrapperTemplate({
      author,
      clickAction,
      children: keyed(
        author.handle,
        html`<img
          src="${avatarUrl}"
          alt="${author.displayName} profile picture"
          class=${classnames("avatar-image", { "labeler-avatar": isLabeler })}
          loading=${lazyLoad ? "lazy" : "eager"}
        />`,
      ),
    })}
  </div>`;
}
