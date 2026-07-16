import { html } from "/js/lib/lit-html.js";

// Source: src/img/icons/custom/hashtag-line.svg
export function hashtagIconTemplate() {
  return html`<div class="icon hashtag-icon">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
      <path
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M4 8h16M4 16h16M9 4 7 20M17 4l-2 16"
      />
    </svg>
  </div>`;
}
