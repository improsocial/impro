import { html } from "/js/lib/lit-html.js";

export function repostIconTemplate() {
  return html`<svg
    class="icon repost-icon"
    width="60"
    height="60"
    viewBox="0 0 60 60"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M 12 23
               V 20
               Q 12 15, 17 15
               H 43"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M 38 10 L 43 15 L 38 20"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M 43 28
               V 31
               Q 43 36, 38 36
               H 12"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M 17 41 L 12 36 L 17 31"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>`;
}
