import { html } from "/js/lib/lit-html.js";

//github.com/halfmage/majesticons/blob/main/line/arrow-left-line.svg

export function arrowLeftIconTemplate() {
  return html`<div class="icon arrow-left-icon">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
      <path
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="m5 12 6-6m-6 6 6 6m-6-6h14"
      />
    </svg>
  </div>`;
}
