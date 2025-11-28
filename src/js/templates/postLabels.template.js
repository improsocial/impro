import { html } from "/js/lib/lit-html.js";

export function postLabelsTemplate({ displayLabels }) {
  return html`<div class="post-labels">
    ${displayLabels.map(({ displayName, labeler }) => {
      return html`<a
        class="label-badge"
        href="/profile/${labeler.creator.handle}"
      >
        ${labeler.creator.avatar
          ? html`
              <img
                class="label-badge-image"
                src="${labeler.creator.avatar}"
                alt="${labeler.creator.handle}"
              />
            `
          : ""}
        <span class="label-badge-text">${displayName}</span>
      </a>`;
    })}
  </div>`;
}
