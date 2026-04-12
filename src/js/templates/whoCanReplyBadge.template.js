import { html } from "/js/lib/lit-html.js";
import { getThreadgateAllowSettings } from "/js/dataHelpers.js";
import { showWhoCanReplyModal } from "/js/modals.js";
import { usersIconTemplate } from "/js/templates/icons/usersIcon.template.js";
import { globeIconTemplate } from "/js/templates/icons/globeIcon.template.js";

export function whoCanReplyBadgeTemplate({ post }) {
  const settings = getThreadgateAllowSettings(post);
  const embeddingDisabled = !!post?.viewer?.embeddingDisabled;
  const isEverybody = !Array.isArray(settings) && settings.type === "everybody";
  let label;
  let icon;
  if (isEverybody) {
    label = "Everybody can reply";
    icon = globeIconTemplate();
  } else if (!Array.isArray(settings) && settings.type === "nobody") {
    label = "Replies disabled";
    icon = usersIconTemplate();
  } else {
    label = "Some people can reply";
    icon = usersIconTemplate();
  }
  return html`
    <button
      type="button"
      class="who-can-reply-badge"
      data-testid="who-can-reply-badge"
      @click=${(e) => {
        e.stopPropagation();
        showWhoCanReplyModal({ post });
      }}
    >
      ${icon} ${label}
    </button>
  `;
}
