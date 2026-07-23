import { html } from "/js/lib/lit-html.js";

//github.com/halfmage/majesticons/blob/main/line/plus-line.svg

export function plusIconTemplate() {
  return html`<div class="icon plus-icon">
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
        d="M5 12h7m7 0h-7m0 0V5m0 7v7"
      />
    </svg>
  </div>`;
}
