import { html } from "/js/lib/lit-html.js";
import { classnames } from "/js/utils.js";

// Source: https://github.com/halfmage/majesticons/blob/main/solid/search.svg
export function searchIconTemplate({ filled = false } = ({} = {})) {
  return html`<div
    class=${classnames("icon search-icon", {
      filled,
    })}
  >
    ${filled
      ? html`<svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            fill="currentColor"
            fill-rule="evenodd"
            d="M5 11a6 6 0 1 1 12 0 6 6 0 0 1-12 0zm6-8a8 8 0 1 0 4.906 14.32l3.387 3.387a1 1 0 0 0 1.414-1.414l-3.387-3.387A8 8 0 0 0 11 3zm0 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
            clip-rule="evenodd"
          />
        </svg>`
      : html`<svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="m20 20-4.05-4.05m0 0a7 7 0 1 0-9.9-9.9 7 7 0 0 0 9.9 9.9z"
          />
        </svg>`}
  </div>`;
}
