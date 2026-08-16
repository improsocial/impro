import { html } from "/js/lib/lit-html.js";

// Source: src/img/icons/majesticons/share-line.svg
export function shareIconTemplate() {
  return html`<svg
    class="icon share-icon"
    viewBox="0 0 24 24"
    width="24"
    height="24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      d="m20 12-6.4-7v3.5C10.4 8.5 4 10.6 4 19c0-1.167 1.92-3.5 9.6-3.5V19l6.4-7z"
    />
  </svg>`;
}
