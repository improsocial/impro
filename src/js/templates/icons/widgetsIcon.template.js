import { html } from "/js/lib/lit-html.js";
import { classnames } from "/js/utils.js";

// Source: src/img/icons/custom/widgets-line.svg, src/img/icons/custom/widgets-solid.svg
export function widgetsIconTemplate({ filled = false } = {}) {
  return html`<div class=${classnames("icon widgets-icon", { filled })}>
    ${filled
      ? html`<svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="24"
          height="24"
          fill="none"
        >
          <g
            fill="currentColor"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
          >
            <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
            <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
            <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
            <rect
              x="13.75"
              y="3.75"
              width="6.5"
              height="6.5"
              rx="1.5"
              transform="rotate(45 17 7)"
            />
          </g>
        </svg>`
      : html`<svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="24"
          height="24"
          fill="none"
        >
          <g
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
          >
            <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
            <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
            <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
            <rect
              x="13.75"
              y="3.75"
              width="6.5"
              height="6.5"
              rx="1.5"
              transform="rotate(45 17 7)"
            />
          </g>
        </svg>`}
  </div>`;
}
