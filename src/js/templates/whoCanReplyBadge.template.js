import { html } from "/js/lib/lit-html.js";
import { normalizeThreadgateAllowSettings } from "/js/dataHelpers.js";
import { usersIconTemplate } from "/js/templates/icons/usersIcon.template.js";
import { globeIconTemplate } from "/js/templates/icons/globeIcon.template.js";

export function whoCanReplyBadgeTemplate({ post, linkStyle = false, onClick }) {
  const settings = normalizeThreadgateAllowSettings(
    post?.threadgate?.record?.allow,
  );
  const isEverybody = settings.some((rule) => rule.type === "everybody");
  let label;
  let icon;
  if (isEverybody) {
    label = "Everybody can reply";
    icon = globeIconTemplate();
  } else if (settings.some((rule) => rule.type === "nobody")) {
    label = "Replies disabled";
    icon = usersIconTemplate();
  } else {
    label = "Some people can reply";
    icon = usersIconTemplate();
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
