import { html } from "/js/lib/lit-html.js";
import {
  avatarPlaceholderTemplate,
  avatarTemplate,
} from "/js/templates/avatar.template.js";

export function avatarGroupTemplate({ authors }) {
  if (authors.length === 0) {
    return html`<div class="avatar-group">${avatarPlaceholderTemplate()}</div>`;
  }
  if (authors.length === 1) {
    return avatarTemplate({
      author: authors[0],
      clickAction: "none",
    });
  }
  const shownAuthors = authors.slice(0, 4);
  return html`<div
    class="avatar-group avatar-group-${shownAuthors.length}"
    data-testid="avatar-group"
  >
    ${shownAuthors.map(
      (author) =>
        html`<div class="avatar-group-item">
          ${avatarTemplate({
            author,
            clickAction: "none",
            showLiveBadge: false,
          })}
        </div>`,
    )}
  </div>`;
}
