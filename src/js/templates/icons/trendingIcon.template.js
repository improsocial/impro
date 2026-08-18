import { html } from "/js/lib/lit-html.js";

// Source: .context/majesticons/line/pulse-line.svg
export function trendingIconTemplate() {
  return html`<div class="icon trending-icon">
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
        d="M3 12h4l3 7 4-14 3 7h4"
      />
    </svg>
  </div>`;
}
