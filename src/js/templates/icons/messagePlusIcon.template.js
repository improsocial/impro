import { html } from "/js/lib/lit-html.js";

// Source: src/img/icons/custom/message-plus-line.svg
export function messagePlusIconTemplate() {
  return html`<div class="icon message-plus-icon">
    <svg
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
        d="M7 4h10a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4h-4l-5 4v-4H7a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4z"
      />
      <path
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M12 8.5v5M9.5 11h5"
      />
    </svg>
  </div>`;
}
