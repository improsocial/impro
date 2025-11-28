import { html } from "/js/lib/lit-html.js";
import { classnames } from "/js/utils.js";

// Source: https://github.com/halfmage/majesticons/blob/main/solid/bell.svg
export function notificationsIconTemplate({ filled = false } = {}) {
  return html`<div
    class=${classnames("icon notifications-icon", {
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
            d="M6 11c0-4.8 4-6 6-6 4.8 0 6 4 6 6v4l2 2H4l2-2v-4z"
          />
          <path
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 5c-2 0-6 1.2-6 6v4l-2 2h16l-2-2v-4c0-2-1.2-6-6-6zm0 0V3M9 18c0 1 .6 3 3 3s3-2 3-3"
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
            d="M12 5c-2 0-6 1.2-6 6v4l-2 2h5m3-12c4.8 0 6 4 6 6v4l2 2h-5M12 5V3M9 17v1c0 1 .6 3 3 3s3-2 3-3v-1m-6 0h6"
          />
        </svg>`}
  </div>`;
}
