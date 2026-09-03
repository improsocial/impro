import { html } from "/js/lib/lit-html.js";
import { sanitizeUri } from "/js/utils.js";
import { isVideoLink } from "/js/dataHelpers.js";
import "/js/components/app-icon.js";

function getDomainFromUri(uri) {
  try {
    return new URL(uri).hostname;
  } catch (error) {
    return null;
  }
}

export function externalLinkTemplate({
  url,
  title,
  description,
  image,
  lazyLoadImages,
  disableNavigation,
  onClick,
  ariaLabel = null,
}) {
  let clickHandler = null;
  if (onClick) {
    clickHandler = (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      onClick(event);
    };
  } else if (disableNavigation) {
    clickHandler = (event) => event.preventDefault();
  }
  return html`<div class="external-link embed-card" data-testid="external-link">
    <a
      href="${sanitizeUri(url)}"
      target="_blank"
      aria-label=${ariaLabel ?? (title || url)}
      @click=${clickHandler}
    >
      <div class="external-link-content">
        ${image
          ? html`<div class="external-link-image-wrapper">
              <img
                class="external-link-image"
                src="${image}"
                alt=${title}
                loading=${lazyLoadImages ? "lazy" : "eager"}
              />
              ${isVideoLink(url) ? html`<app-icon icon="play"></app-icon>` : ""}
            </div>`
          : isVideoLink(url)
            ? html`<div
                class="external-link-image-wrapper external-link-video-placeholder"
              >
                <app-icon icon="play"></app-icon>
              </div>`
            : ""}
        <div class="external-link-text">
          <div class="external-link-title" data-testid="external-link-title">
            ${title || url}
          </div>
          ${description
            ? html`<div
                class="external-link-description"
                data-testid="external-link-description"
              >
                ${description}
              </div>`
            : ""}
          <hr />
          <span class="external-link-uri" data-testid="external-link-domain"
            >${getDomainFromUri(url)}</span
          >
        </div>
      </div>
    </a>
  </div>`;
}
