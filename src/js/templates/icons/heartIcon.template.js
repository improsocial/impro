import { html } from "/js/lib/lit-html.js";
import { classnames } from "/js/utils.js";

const heartPath =
  "M17 5c-3.2 0-5 2.667-5 4 0-1.333-1.8-4-5-4S3 7.667 3 9c0 7 9 12 9 12s9-5 9-12c0-1.333-.8-4-4-4z";

export function heartIconTemplate({ filled = false } = {}) {
  return html`<div class=${classnames("icon heart-icon", { filled })}>
    ${filled
      ? html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <path
            fill="currentColor"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d=${heartPath}
          />
        </svg>`
      : html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <path
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d=${heartPath}
          />
        </svg>`}
  </div>`;
}
