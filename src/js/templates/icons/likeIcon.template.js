import { html } from "/js/lib/lit-html.js";

export function likeIconTemplate() {
  return html` <svg
    class="icon like-icon"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 15.2 L7.6 11.2 C6 9.99 6 7.2 7.6 6 C9.2 4.8 12 6 12 7.2 C12 6 14.8 4.8 16.4 6 C18 7.2 18 9.99 16.4 11.2 Z"
      stroke-width="1"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>`;
}
