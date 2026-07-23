import { html } from "/js/lib/lit-html.js";
import { classnames } from "/js/utils.js";

// Source: src/img/icons/custom/hashtag-line.svg, src/img/icons/custom/hashtag-solid.svg
export function hashtagIconTemplate({ filled = false } = {}) {
  return html`<div class=${classnames("icon hashtag-icon", { filled })}>
    ${filled
      ? html`<svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="24"
          height="24"
          fill="none"
        >
          <path
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="3"
            d="M4 8h16M4 16h16M9 4 7 20M17 4l-2 16"
          />
        </svg>`
      : html`<svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="24"
          height="24"
          fill="none"
        >
          <path
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 8h16M4 16h16M9 4 7 20M17 4l-2 16"
          />
        </svg>`}
  </div>`;
}
