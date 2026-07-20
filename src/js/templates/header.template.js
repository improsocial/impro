import { html } from "/js/lib/lit-html.js";
import { menuIconTemplate } from "/js/templates/icons/menuIcon.template.js";
import { arrowLeftIconTemplate } from "/js/templates/icons/arrowLeft.template.js";
import { classnames } from "/js/utils.js";
import "/js/components/container-link.js";

function avatarAndTitleTemplate({ title, subtitle, avatarTemplate }) {
  return html`${avatarTemplate
    ? html`<div class="header-avatar">${avatarTemplate()}</div>`
    : ""}
  ${title
    ? html`<div
        class="header-title-container"
        data-testid="header-title-container"
      >
        <span class="header-title" data-testid="header-title">${title}</span>
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
            ${menuIconTemplate()}
          </button>`
        : html`<button
            class="icon-button back-button"
            data-testid="back-button"
            @click=${onClickBackButton
              ? () => onClickBackButton()
              : () => router.back({ fallbackRoute: backButtonFallbackRoute })}
          >
            ${arrowLeftIconTemplate()}
          </button>`}
      ${titleHref
        ? html`<container-link class="header-title-link" href=${titleHref}>
            ${avatarAndTitleTemplate({ title, subtitle, avatarTemplate })}
          </container-link>`
        : avatarAndTitleTemplate({ title, subtitle, avatarTemplate })}
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
