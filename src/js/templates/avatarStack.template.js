import { html } from "/js/lib/lit-html.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";

export function avatarStackTemplate({ authors }) {
  if (authors.length === 0) {
    return html`<div class="avatar-placeholder"></div>`;
  }
  if (authors.length === 1) {
    return avatarTemplate({ author: authors[0], clickAction: "none" });
  }
  const shownAuthors = authors.slice(0, 3);
  return html`<div
    class="member-avatar-stack member-avatar-stack-${shownAuthors.length}"
    data-testid="member-avatar-stack"
  >
    ${shownAuthors.map(
      (author) =>
        html`<div class="member-avatar-stack-item">
          ${avatarTemplate({ author, clickAction: "none" })}
        </div>`,
    )}
  </div>`;
}
