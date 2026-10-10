import { html } from "/js/lib/lit-html.js";
import { normalizeThreadgateAllowSettings } from "/js/dataHelpers.js";
import "/js/components/app-icon.js";

export function whoCanReplyBadgeTemplate({ post, linkStyle = false, onClick }) {
  const settings = normalizeThreadgateAllowSettings(
    post?.threadgate?.record?.allow,
  );
  const isEverybody = settings.some((rule) => rule.type === "everybody");
  let label;
  let icon;
  let replySetting;
  if (isEverybody) {
    label = "Everybody can reply";
    replySetting = "everybody";
    icon = html`<app-icon icon="globe-grid-line"></app-icon>`;
  } else if (settings.some((rule) => rule.type === "nobody")) {
    label = "Replies disabled";
    replySetting = "nobody";
    icon = html`<app-icon icon="users-line"></app-icon>`;
  } else {
    label = "Some people can reply";
    replySetting = "limited";
    icon = html`<app-icon icon="users-line"></app-icon>`;
  }
  return html`
    <button
      type="button"
      class="who-can-reply-badge ${linkStyle ? "who-can-reply-badge-link" : ""}"
      data-testid="who-can-reply-badge"
      data-teststate=${replySetting}
      @click=${(event) => {
        event.stopPropagation();
        onClick(post);
      }}
    >
      ${icon} ${label}
    </button>
  `;
}
