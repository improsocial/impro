import { html } from "/js/lib/lit-html.js";

//github.com/halfmage/majesticons/blob/main/line/chevron-left-line.svg

export function chevronLeftIconTemplate() {
  return html`<div class="icon chevron-left-icon">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
      <path
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="m14 7-5 5 5 5"
      />
    </svg>
  </div>`;
}
