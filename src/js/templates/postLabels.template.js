import { html } from "/js/lib/lit-html.js";
import { getLabelNameAndDescription } from "/js/dataHelpers.js";

export function postLabelsTemplate({ badgeLabels }) {
  return html`<div class="post-labels">
    ${badgeLabels.map(({ labelDefinition, labeler }) => {
      const { name: displayName } = getLabelNameAndDescription(labelDefinition);
      return html`<a
        class="label-badge"
        href="/profile/${labeler.creator.handle}"
      >
        <img
          class="label-badge-image"
          src="${labeler.creator?.avatar ?? "/img/labeler-avatar-fallback.svg"}"
          alt="${labeler.creator?.handle ?? "Labeler avatar"}"
        />
        <span class="label-badge-text">${displayName}</span>
      </a>`;
    })}
  </div>`;
}
