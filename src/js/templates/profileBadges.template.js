import { html } from "/js/lib/lit-html.js";
import {
  getVerificationState,
  verificationBadgeTemplate,
} from "/js/templates/verificationBadge.template.js";
import { automatedAccountBadgeTemplate } from "/js/templates/automatedAccountBadge.template.js";
import { isAutomatedAccount } from "/js/dataHelpers.js";

export function profileBadgesTemplate({ profile }) {
  if (
    !getVerificationState(profile).isVerified &&
    !isAutomatedAccount(profile)
  ) {
    return "";
  }
  return html`<span class="profile-badges"
    >${verificationBadgeTemplate({ profile })}${automatedAccountBadgeTemplate({
      profile,
    })}</span
  >`;
}
