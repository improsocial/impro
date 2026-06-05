import { html } from "/js/lib/lit-html.js";
import { classnames } from "/js/utils.js";

// Variant of userIcon with a "+" badge, used for follow notifications.
export function userPlusIconTemplate({ filled = false } = ({} = {})) {
  return html`<div
    class=${classnames("icon user-plus-icon", {
      filled,
    })}
  >
    ${filled
      ? html`<svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
        >
          <mask id="user-plus-cutout">
            <rect width="24" height="24" fill="white" />
            <circle cx="18.5" cy="18.5" r="6" fill="black" />
          </mask>
          <g mask="url(#user-plus-cutout)">
            <circle
              cx="10"
              cy="7"
              r="4.5"
              fill="currentColor"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
            />
            <path
              fill="currentColor"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10 11.5a7.5 7.5 0 0 0-7.5 7.5v1a1 1 0 0 0 1 1h10.062A5.5 5.5 0 0 1 13 18.5a5.5 5.5 0 0 1 3.04-4.917A7.48 7.48 0 0 0 10 11.5z"
            />
          </g>
          <path
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M18.5 15v7M15 18.5h7"
          />
        </svg>`
      : html`<svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            cx="10"
            cy="7"
            r="4.5"
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
            d="M3 20a7.5 7.5 0 0 1 13.04-5.083"
          />
          <path
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M18.5 15v7M15 18.5h7"
          />
        </svg>`}
  </div>`;
}
