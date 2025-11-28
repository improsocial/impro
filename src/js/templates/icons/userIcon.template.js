import { html } from "/js/lib/lit-html.js";
import { classnames } from "/js/utils.js";

// Source: https://github.com/halfmage/majesticons/blob/main/solid/user.svg
export function userIconTemplate({ filled = false } = ({} = {})) {
  return html`<div
    class=${classnames("icon user-icon", {
      filled,
    })}
  >
    ${filled
      ? html`<svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            cx="12"
            cy="8"
            r="5"
            fill="currentColor"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
          />
          <path
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M20 21a8 8 0 1 0-16 0"
          />
          <path
            fill="currentColor"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 13a8 8 0 0 0-8 8h16a8 8 0 0 0-8-8z"
          />
        </svg>`
      : html`<svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            cx="12"
            cy="8"
            r="5"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
          />
          <path
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M20 21a8 8 0 1 0-16 0m16 0a8 8 0 1 0-16 0"
          />
        </svg>`}
  </div>`;
}
