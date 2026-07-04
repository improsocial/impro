import { html } from "/js/lib/lit-html.js";
import { sanitizeUri } from "/js/utils.js";
import { isVideoLink } from "/js/dataHelpers.js";
import { playIconTemplate } from "/js/templates/icons/playIcon.template.js";

function getDomainFromUri(uri) {
  return new URL(uri).hostname;
}

export function externalLinkTemplate({
  url,
  title,
  description,
  image,
  lazyLoadImages,
  disableNavigation,
}) {
  return html`<div class="external-link embed-card" data-testid="external-link">
    <a
      href="${sanitizeUri(url)}"
      target="_blank"
      @click=${disableNavigation ? (e) => e.preventDefault() : null}
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
              ${isVideoLink(url) ? playIconTemplate() : ""}
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
