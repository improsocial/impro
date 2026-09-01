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
  if (isEverybody) {
    label = "Everybody can reply";
    icon = html`<app-icon icon="globe-grid-line"></app-icon>`;
  } else if (settings.some((rule) => rule.type === "nobody")) {
    label = "Replies disabled";
    icon = html`<app-icon icon="users-line"></app-icon>`;
  } else {
    label = "Some people can reply";
    icon = html`<app-icon icon="users-line"></app-icon>`;
  }
  return html`
    <button
      type="button"
      class="who-can-reply-badge ${linkStyle ? "who-can-reply-badge-link" : ""}"
      data-testid="who-can-reply-badge"
      data-teststate=${linkStyle ? "link" : "plain"}
      @click=${(event) => {
        event.stopPropagation();
        onClick(post);
      }}
    >
      ${icon} ${label}
    </button>
  `;
}
