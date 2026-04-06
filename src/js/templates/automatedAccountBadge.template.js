import { html } from "/js/lib/lit-html.js";
import { isAutomatedAccount } from "/js/dataHelpers.js";
import { automatedAccountIconTemplate } from "/js/templates/icons/automatedAccountIcon.template.js";
import { showInfoModal } from "/js/modals.js";

export function automatedAccountBadgeTemplate({ profile }) {
  if (!isAutomatedAccount(profile)) return "";

  return html`<button
    class="automated-account-badge"
    title="Automated Account"
    @click=${(e) => {
      e.preventDefault();
      e.stopPropagation();
      showInfoModal({
        title: "Automated account",
        message: "This account has been marked as automated by its owner.",
        confirmButtonText: "Okay",
      });
    }}
  >
    ${automatedAccountIconTemplate()}
  </button>`;
}
