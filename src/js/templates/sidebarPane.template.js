import { html } from "/js/lib/lit-html.js";
import "/js/components/app-icon.js";

export function sidebarPaneTemplate({
  className,
  testId,
  title,
  dismissLabel,
  dismissTestId,
  onDismiss,
  children,
}) {
  return html`<section class="sidebar-pane ${className}" data-testid=${testId}>
    <header class="sidebar-pane-header">
      <h2 class="sidebar-pane-title">${title}</h2>
      ${onDismiss
        ? html`<button
            class="sidebar-pane-dismiss-button"
            data-testid=${dismissTestId}
            aria-label=${dismissLabel}
            title=${dismissLabel}
            @click=${onDismiss}
          >
            <app-icon icon="close-line"></app-icon>
          </button>`
        : ""}
    </header>
    ${children}
  </section>`;
}
