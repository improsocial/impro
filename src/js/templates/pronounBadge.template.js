import { html } from "/js/lib/lit-html.js";
import { sanitizePronouns } from "/js/dataHelpers.js";
import { alertModal } from "/js/modals/alert.modal.js";

export function pronounBadgeTemplate({ profile }) {
  const pronouns = sanitizePronouns(profile.pronouns);
  if (!pronouns) {
    return "";
  }
  return html`<button
    class="pronoun-badge"
    data-testid="pronoun-badge"
    title="Pronouns"
    @click=${(event) => {
      event.preventDefault();
      event.stopPropagation();
      alertModal(`This user uses pronouns: "${pronouns}"`, {
        title: "Pronouns",
        confirmButtonText: "Okay",
      });
    }}
    >${pronouns}</button
  >`;
}
