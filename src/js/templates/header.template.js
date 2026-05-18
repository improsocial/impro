import { html } from "/js/lib/lit-html.js";
import { menuIconTemplate } from "/js/templates/icons/menuIcon.template.js";
import { classnames } from "/js/utils.js";

export function headerTemplate({
  title = null,
  subtitle = null,
  avatarTemplate = null,
  showLoadingSpinner = false,
  leftButton = "back",
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
            class="menu-button"
            data-testid="menu-button"
            @click=${onClickMenuButton}
          >
            ${menuIconTemplate()}
          </button>`
        : html`<button
            class="back-button"
            data-testid="back-button"
            @click=${onClickBackButton
              ? () => onClickBackButton()
              : () => router.back()}
          >
            ←
          </button>`}
      ${avatarTemplate ? avatarTemplate() : ""}
      ${title
        ? html`<div
            class="header-title-container"
            data-testid="header-title-container"
          >
            <span class="header-title" data-testid="header-title"
              >${title}</span
            >
            ${subtitle
              ? html`<span class="header-subtitle" data-testid="header-subtitle"
                  >${subtitle}</span
                >`
              : ""}
          </div>`
        : ""}
      ${showLoadingSpinner
        ? html`<div class="header-spacer"></div>
            <div class="loading-spinner" data-testid="loading-spinner"></div>`
        : ""}
      ${rightItemTemplate
        ? html`<div class="header-spacer"></div>
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
