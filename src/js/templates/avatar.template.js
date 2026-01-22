import { html, keyed } from "/js/lib/lit-html.js";
import { avatarThumbnailUrl } from "/js/dataHelpers.js";
import "/js/components/lightbox-image-group.js";

// CLick actions: "link", "lightbox", "none"

function avatarWrapperTemplate({ author, clickAction, children }) {
  if (clickAction === "link") {
    // Keyed so that image elements aren't re-used
    return keyed(
      author.handle,
      html` <a
        class="avatar-link"
        href="/profile/${author.handle}"
        @click=${(e) => {
          e.preventDefault();
          e.stopPropagation();
          window.router.go(`/profile/${author.handle}`, {
            transition: "slide-in",
          });
        }}
        >${children}</a
      >`,
    );
  } else if (clickAction === "lightbox") {
    return html`<lightbox-image-group hide-alt-text="true"
      >${children}</lightbox-image-group
    >`;
  } else {
    return children;
  }
}

export function avatarTemplate({
  author,
  clickAction = "link",
  lazyLoad = false,
  // lazyLoad = true,
}) {
  const avatarUrl = author.avatar
    ? avatarThumbnailUrl(author.avatar)
    : "/img/avatar-fallback.svg";
  return html`<div class="avatar">
    ${avatarWrapperTemplate({
      author,
      clickAction,
      children: html`<img
        src="${avatarUrl}"
        alt="${author.displayName} profile picture"
        class="avatar-image"
        loading=${lazyLoad ? "lazy" : "eager"}
      />`,
    })}
    </a>
  </div>`;
}
