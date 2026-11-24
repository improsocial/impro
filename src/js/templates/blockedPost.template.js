import { html } from "/js/lib/lit-html.js";
import { isBlockedByViewer } from "/js/dataHelpers.js";
import "/js/components/app-icon.js";

export function blockedPostTemplate({ post }) {
  const isBlocking = isBlockedByViewer(post);
  return html`<div
    class="post small-post"
    data-testid="post-tombstone-blocked"
    data-teststate=${isBlocking ? "blocking" : "blocked"}
  >
    <div class="missing-post-indicator">
      <app-icon icon="user-x-line"></app-icon>
      ${isBlocking ? "You are blocking this user" : "Blocked"}
    </div>
  </div> `;
}
