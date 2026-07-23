import { html } from "/js/lib/lit-html.js";

//github.com/halfmage/majesticons/blob/main/line/more-menu-line.svg

export function moreMenuIconTemplate() {
  return html`<div class="icon more-menu-icon">
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
        d="M12 12h.01M8 12h.01M16 12h.01"
      />
    </svg>
  </div>`;
}
