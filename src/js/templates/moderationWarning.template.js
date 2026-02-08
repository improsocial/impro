import { html } from "/js/lib/lit-html.js";
import { getLabelNameAndDescription } from "/js/dataHelpers.js";
import { linkToLabeler } from "/js/navigation.js";
import { classnames } from "/js/utils.js";

export function moderationWarningTemplate({
  className = "",
  isAuthorLabel,
  labelDefinition,
  labeler,
  children,
}) {
  let { name: labelName } = getLabelNameAndDescription(labelDefinition);
  if (isAuthorLabel) {
    labelName += " (Account)";
  }
  // If no labeler, the labeler is the author of the post
  const labelerName = labeler
    ? "@" + labeler.creator.handle
    : "the post author";
  const labelerLink = labeler ? linkToLabeler(labeler) : null;
  return html`<moderation-warning
    class=${classnames("post-moderation-warning", className)}
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
