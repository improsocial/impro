import { html } from "/js/lib/lit-html.js";
import { getLabelNameAndDescription } from "/js/dataHelpers.js";
import "/js/components/plugin-slot.js";

export function authorBadgesTemplate({ badgeLabels, did, pluginService }) {
  return html`<div class="author-badges">
    ${badgeLabels?.length ? labelBadgesTemplate({ badgeLabels }) : ""}
    ${pluginService
      ? html`<plugin-slot
          name="author-badges"
          context-did=${did ?? ""}
          .pluginService=${pluginService}
        ></plugin-slot>`
      : ""}
  </div>`;
}

function labelBadgesTemplate({ badgeLabels }) {
  return html`<div class="label-badges" data-testid="label-badges">
    ${badgeLabels.map(({ labelDefinition, labeler }) => {
      const { name: displayName } = getLabelNameAndDescription(labelDefinition);
      return html`<a
        class="label-badge"
        data-testid="label-badge"
        href="/profile/${labeler.creator.handle}"
      >
        <img
          class="label-badge-image"
          data-testid="label-badge-image"
          src="${labeler.creator?.avatar ?? "/img/labeler-avatar-fallback.svg"}"
          alt="${labeler.creator?.handle ?? "Labeler avatar"}"
        />
        <span class="label-badge-text" data-testid="label-badge-text"
          >${displayName}</span
        >
      </a>`;
    })}
  </div>`;
}
