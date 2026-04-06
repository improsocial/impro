import { html } from "/js/lib/lit-html.js";
import { verifiedCheckIconTemplate } from "/js/templates/icons/verifiedCheckIcon.template.js";
import { verifierCheckIconTemplate } from "/js/templates/icons/verifierCheckIcon.template.js";

export function getVerificationState(profile) {
  if (!profile?.verification) {
    return { role: "default", isVerified: false };
  }
  const { verifiedStatus, trustedVerifierStatus } = profile.verification;
  const isVerifierUser = ["valid", "invalid"].includes(trustedVerifierStatus);
  const isVerified =
    (["valid", "invalid"].includes(verifiedStatus) &&
      verifiedStatus === "valid") ||
    (isVerifierUser && trustedVerifierStatus === "valid");
  return {
    role: isVerifierUser ? "verifier" : "default",
    isVerified,
  };
}

export function verificationBadgeTemplate({ profile }) {
  const { role, isVerified } = getVerificationState(profile);
  if (!isVerified) return "";

  const isVerifier = role === "verifier";
  return html`<span
    class="verification-badge"
    title="${isVerifier ? "Trusted Verifier" : "Verified"}"
    >${isVerifier
      ? verifierCheckIconTemplate()
      : verifiedCheckIconTemplate()}</span
  >`;
}
