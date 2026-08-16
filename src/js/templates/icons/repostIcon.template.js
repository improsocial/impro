import { html } from "/js/lib/lit-html.js";

// Source: src/img/icons/custom/repost.svg
export function repostIconTemplate() {
  return html`<svg
    class="icon repost-icon"
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
      d="M4 11V9a3 3 0 0 1 3-3h13M17 3l3 3-3 3"
    />
    <path
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      d="M20 13v2a3 3 0 0 1-3 3H4M7 15l-3 3 3 3"
    />
  </svg>`;
}
