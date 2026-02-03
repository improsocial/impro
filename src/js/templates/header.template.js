import { html } from "/js/lib/lit-html.js";
import { menuIconTemplate } from "/js/templates/icons/menuIcon.template.js";
import { classnames } from "/js/utils.js";

export function headerTemplate({
  className = "",
  showLoadingSpinner = false,
  leftButton = "back",
  onClickMenuButton = null,
  rightItemTemplate = null,
  children,
} = {}) {
  return html`<header
    class=${classnames("header", className)}
    data-testid="header"
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
          @click=${() => router.back()}
        >
          ←
        </button>`}
    ${children}
    ${showLoadingSpinner
      ? html`<div class="header-spacer"></div>
          <div class="loading-spinner" data-testid="loading-spinner"></div>`
      : ""}
    ${rightItemTemplate
      ? html`<div class="header-spacer"></div>
          ${rightItemTemplate()}`
      : ""}
  </header>`;
}
