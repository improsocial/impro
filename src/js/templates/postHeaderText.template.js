import { html } from "/js/lib/lit-html.js";
import { displayRelativeTime } from "/js/utils.js";
import { linkToProfile } from "/js/navigation.js";

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
          href="${linkToProfile(author.handle)}"
          class="post-name"
          data-testid="post-author-name"
          >${author.displayName || author.handle}</a
        >`
      : html`<span class="post-name" data-testid="post-author-name"
          >${author.displayName || author.handle}</span
        >`}
    ${includeHandle
      ? html`<span class="post-username" data-testid="post-author-handle"
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
