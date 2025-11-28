import { html } from "/js/lib/lit-html.js";
import { classnames } from "/js/utils.js";

// Source: https://github.com/halfmage/majesticons/blob/main/solid/chat-2.svg
// Modified to use ellipsis
export function chatIconTemplate({ filled = false } = {}) {
  return html`<div
    class=${classnames("icon chat-icon", {
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
            d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10a9.96 9.96 0 0 1-4.935-1.3l-3.749 1.249a1 1 0 0 1-1.265-1.265l1.25-3.749A9.959 9.959 0 0 1 2 12z"
            clip-rule="evenodd"
          ></path>
          <!-- Set these in CSS, since I dont't know how to clip them... -->
          <circle cx="8" cy="12" r="1.5" fill="none" />
          <circle cx="12" cy="12" r="1.5" fill="none" />
          <circle cx="16" cy="12" r="1.5" fill="none" />
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
            d="M21 12a9 9 0 0 1-13.815 7.605L3 21l1.395-4.185A9 9 0 1 1 21 12z"
          />
          <circle cx="8" cy="12" r="1.5" fill="currentColor" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
          <circle cx="16" cy="12" r="1.5" fill="currentColor" />
        </svg>`}
  </div>`;
}
