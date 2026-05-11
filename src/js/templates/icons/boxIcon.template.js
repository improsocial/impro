import { html } from "/js/lib/lit-html.js";
import { classnames } from "/js/utils.js";

// Source: https://github.com/halfmage/majesticons/blob/main/line/box-line.svg
export function boxIconTemplate({ filled = false } = {}) {
  return html`<div
    class=${classnames("icon box-icon", {
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
            d="M11.47 2.152a1 1 0 0 1 1.06 0l6.904 4.315L12 10.84 4.566 6.467l6.904-4.315zM3.008 7.871A1.001 1.001 0 0 0 3 8v8a1 1 0 0 0 .47.848L11 21.554v-8.982L3.008 7.87zM13 21.554l7.53-4.706A1 1 0 0 0 21 16V8c0-.043-.003-.087-.008-.129L13 12.571v8.983z"
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
            d="m4 8 8-5 4 2.5M4 8v8l8 5M4 8l4 2.5m4 2.5 8-5m-8 5v8m0-8-4-2.5M20 8v8l-8 5m8-13-4-2.5m-8 5 8-5"
          />
        </svg>`}
  </div>`;
}
