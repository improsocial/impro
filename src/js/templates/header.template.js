import { html } from "/js/lib/lit-html.js";
import { classnames } from "/js/utils.js";
import "/js/components/container-link.js";
import "/js/components/app-icon.js";

function avatarAndTitleTemplate({
  title,
  subtitle,
  avatarTemplate,
  titleRightItemTemplate,
}) {
  return html`${avatarTemplate
    ? html`<div class="header-avatar">${avatarTemplate()}</div>`
    : ""}
  ${title
    ? html`<div
        class="header-title-container"
        data-testid="header-title-container"
      >
        <span class="header-title" data-testid="header-title"
          ><span class="header-title-text">${title}</span
          >${titleRightItemTemplate ? titleRightItemTemplate() : ""}</span
        >
        ${subtitle
          ? html`<span class="header-subtitle" data-testid="header-subtitle"
              >${subtitle}</span
            >`
          : ""}
      </div>`
    : ""}`;
}

export function headerTemplate({
  title = null,
  subtitle = null,
  titleHref = null,
  avatarTemplate = null,
  titleRightItemTemplate = null,
  showLoadingSpinner = false,
  leftButton = "back",
  backButtonFallbackRoute = null,
  onClickBackButton = null,
  onClickMenuButton = null,
  rightItemTemplate = null,
  bottomItemTemplate = null,
} = {}) {
  return html`<header class="header" data-testid="header">
    <div
      class=${classnames("header-row", {
        "has-bottom-row": !!bottomItemTemplate,
      })}
    >
      ${leftButton === "menu"
        ? html`<button
            class="icon-button menu-button"
            data-testid="menu-button"
            @click=${onClickMenuButton}
          >
            <app-icon icon="hamburger-menu"></app-icon>
          </button>`
        : html`<button
            class="icon-button back-button"
            data-testid="back-button"
            @click=${onClickBackButton
              ? () => onClickBackButton()
              : () => router.back({ fallbackRoute: backButtonFallbackRoute })}
          >
            <app-icon icon="arrow-left-line"></app-icon>
          </button>`}
      ${titleHref
        ? html`<container-link class="header-title-link" href=${titleHref}>
            ${avatarAndTitleTemplate({
              title,
              subtitle,
              avatarTemplate,
              titleRightItemTemplate,
            })}
          </container-link>`
        : avatarAndTitleTemplate({
            title,
            subtitle,
            avatarTemplate,
            titleRightItemTemplate,
          })}
      ${showLoadingSpinner
        ? html`<div class="header-spacer"></div>
            <div class="loading-spinner" data-testid="loading-spinner"></div>`
        : ""}
      ${rightItemTemplate
        ? html`${showLoadingSpinner
            ? ""
            : html`<div class="header-spacer"></div>`}
          ${rightItemTemplate()}`
        : ""}
    </div>
    ${bottomItemTemplate
      ? html`<div class="header-bottom-row">
          <div class="bottom-item">${bottomItemTemplate()}</div>
        </div>`
      : ""}
  </header>`;
}
