import { html } from "/js/lib/lit-html.js";
import { SOURCE_CODE_URL, SUPPORT_URL } from "/js/config.js";

export function siteLinksTemplate({ className }) {
  return html`<div class="site-links ${className}">
    <a href="/tos.html" data-testid="footer-link-terms" data-external="true"
      >Terms</a
    >
    <a
      href="/privacy.html"
      data-testid="footer-link-privacy"
      data-external="true"
      >Privacy Policy</a
    >
    <a href=${SOURCE_CODE_URL} data-testid="footer-link-source">Source</a>
    <a href=${SUPPORT_URL} data-testid="footer-link-support">Support</a>
  </div>`;
}
