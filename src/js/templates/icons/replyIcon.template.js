import { html } from "/js/lib/lit-html.js";

export function replyIconTemplate() {
  return html`<svg
    class="icon reply-icon"
    width="60"
    height="60"
    viewBox="0 0 60 60"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M23 18
         h17
         a4 4 0 0 1 4 4
         v16
         a4 4 0 0 1 -4 4
         h-10
         l-6 6
         v-6
         h-9
         a4 4 0 0 1 -4 -4
         v-16
         a4 4 0 0 1 4 -4
         z"
      stroke-width="2.7"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg> `;
}
