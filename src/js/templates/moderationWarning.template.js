import { html } from "/js/lib/lit-html.js";
import { getLabelNameAndDescription } from "/js/dataHelpers.js";
import { linkToLabeler, linkToProfile } from "/js/navigation.js";

export function moderationWarningTemplate({
  labelDefinition,
  labeler,
  children,
}) {
  const { name: labelName } = getLabelNameAndDescription(labelDefinition);
  // If no labeler, the labeler is the author of the post
  const labelerName = labeler
    ? "@" + labeler.creator.handle
    : "the post author";
  const labelerLink = labeler ? linkToLabeler(labeler) : null;
  return html`<moderation-warning
    class="post-moderation-warning"
    @click=${(e) => {
      const clickedBar = !!e.target.closest(".top-bar");
      if (clickedBar) {
        e.preventDefault();
        e.stopPropagation();
      }
    }}
    label=${labelName}
    labelerName=${labelerName}
    labelerLink=${labelerLink}
  >
    ${children}
  </moderation-warning>`;
}
