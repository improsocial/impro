import { html } from "/js/lib/lit-html.js";
import { isAutomatedAccount } from "/js/dataHelpers.js";
import { automatedAccountIconTemplate } from "/js/templates/icons/automatedAccountIcon.template.js";
import { alertModal } from "/js/modals/alert.modal.js";

export function automatedAccountBadgeTemplate({ profile }) {
  if (!isAutomatedAccount(profile)) return "";

  return html`<button
    class="automated-account-badge"
    title="Automated Account"
    @click=${(e) => {
      e.preventDefault();
      e.stopPropagation();
      alertModal("This account has been marked as automated by its owner.", {
        title: "Automated account",
        confirmButtonText: "Okay",
      });
    }}
  >
    ${automatedAccountIconTemplate()}
  </button>`;
}
