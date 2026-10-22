import { html } from "/js/lib/lit-html.js";
import { BSKY_LABELER_DID } from "/js/config.js";
import { getModerationWarningLabelName, isSelfLabel } from "/js/dataHelpers.js";
import { linkToLabeler } from "/js/navigation.js";
import { classnames } from "/js/utils.js";

export function moderationWarningTemplate({
  className = "",
  isAuthorLabel,
  label,
  labelDefinition,
  labeler,
  noOverride,
  children,
}) {
  let labelName = getModerationWarningLabelName(labelDefinition);
  if (isAuthorLabel) {
    labelName += " (Account)";
  }
  let labelerName = "an unknown labeler";
  let labelerLink = null;
  if (isSelfLabel(label)) {
    labelerName = "the author.";
  } else if (labeler) {
    labelerName = "@" + labeler.creator.handle;
    labelerLink = linkToLabeler(labeler);
  } else if (label.src === BSKY_LABELER_DID) {
    labelerName = "moderation.bsky.app";
  }
  return html`<moderation-warning
    class=${classnames("post-moderation-warning", className)}
    data-teststate="label"
    ?no-override=${noOverride}
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
