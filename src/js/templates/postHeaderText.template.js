import { html } from "/js/lib/lit-html.js";
import { displayRelativeTime } from "/js/utils.js";
import { linkToProfile } from "/js/navigation.js";
import { verificationBadgeTemplate } from "/js/templates/verificationBadge.template.js";
import { automatedAccountBadgeTemplate } from "/js/templates/automatedAccountBadge.template.js";
import { getDisplayName } from "/js/dataHelpers.js";

export function postHeaderTextTemplate({
  author,
  timestamp,
  includeTime = true,
  includeHandle = true,
  enableProfileLink = true,
}) {
  return html`<div class="post-header-text">
    ${enableProfileLink
      ? html`<a
          href="${linkToProfile(author)}"
          class="post-name"
          data-testid="post-author-name"
          data-hover-did=${author.did}
          >${getDisplayName(author)}</a
        >`
      : html`<span class="post-name" data-testid="post-author-name"
          >${getDisplayName(author)}</span
        >`}${verificationBadgeTemplate({
      profile: author,
    })}${automatedAccountBadgeTemplate({ profile: author })}
    ${includeHandle
      ? enableProfileLink
        ? html`<a
            href="${linkToProfile(author)}"
            class="post-username"
            data-testid="post-author-handle"
            data-hover-did=${author.did}
            >@${author.handle}</a
          >`
        : html`<span class="post-username" data-testid="post-author-handle"
            >@${author.handle}</span
          >`
      : ""}
    ${includeTime
      ? html`<span class="post-separator">·</span
          ><span class="post-time" data-testid="post-time"
            >${displayRelativeTime(timestamp)}</span
          >`
      : ""}
  </div>`;
}
