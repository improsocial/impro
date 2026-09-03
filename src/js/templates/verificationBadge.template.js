import { html } from "/js/lib/lit-html.js";
import "/js/components/app-icon.js";

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
      ? html`<app-icon icon="verifier-check"></app-icon>`
      : html`<app-icon icon="verified-check"></app-icon>`}</span
  >`;
}
