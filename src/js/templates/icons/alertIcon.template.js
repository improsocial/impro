import { html } from "/js/lib/lit-html.js";

// https://github.com/halfmage/majesticons/blob/main/line/alert-circle-line.svg

export function alertIconTemplate() {
  return html`<div class="icon alert-icon">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
      <circle
        cx="12"
        cy="12"
        r="9"
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
        d="M12 8v5m0 3v0"
      />
    </svg>
  </div>`;
}
