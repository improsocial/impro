import { html } from "/js/lib/lit-html.js";

export function playIconTemplate() {
  return html`<div class="icon play-icon">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
      <path
        fill="currentColor"
        d="M9.528 7.118a1 1 0 0 1 1.027.05l6 4a1 1 0 0 1 0 1.664l-6 4A1 1 0 0 1 9 16V8a1 1 0 0 1 .528-.882z"
      />
    </svg>
  </div>`;
}
