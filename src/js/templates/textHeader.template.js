import { html } from "/js/lib/lit-html.js";
import { headerTemplate } from "/js/templates/header.template.js";

export function textHeaderTemplate({
  title,
  subtitle,
  avatarTemplate = null,
  showLoadingSpinner = false,
  leftButton = "back",
  onClickMenuButton = null,
  rightItemTemplate = null,
} = {}) {
  return headerTemplate({
    showLoadingSpinner,
    leftButton,
    onClickMenuButton,
    rightItemTemplate,
    className: "text-header",
    children: html`
      ${avatarTemplate ? avatarTemplate() : ""}
      <div class="header-title-container" data-testid="header-title-container">
        <span class="header-title" data-testid="header-title">${title}</span>
        ${subtitle
          ? html`<span class="header-subtitle" data-testid="header-subtitle"
              >${subtitle}</span
            >`
          : ""}
      </div>
    `,
  });
}
