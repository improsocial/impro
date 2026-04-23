import { html } from "/js/lib/lit-html.js";

// https://github.com/halfmage/majesticons/blob/main/line/code-line.svg

export function codeIconTemplate() {
  return html`<div class="icon code-icon">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
      <path
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="m8 7-5 5 5 5m8 0 5-5-5-5"
      />
    </svg>
  </div>`;
}
