import { html } from "/js/lib/lit-html.js";

// Smiley face icon for emoji button
export function smileIconTemplate() {
  return html`<div class="icon smile-icon">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
      />
      <path
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"
      />
    </svg>
  </div>`;
}
