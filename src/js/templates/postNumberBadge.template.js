import { html } from "/js/lib/lit-html.js";

export function postNumberBadgeTemplate({ numbering, inline }) {
  const { index, count } = numbering;
  const placement = inline ? "inline" : "standalone";
  return html`<span
    class="post-number-badge post-number-badge-${placement}"
    data-testid="post-number-badge"
    data-teststate=${placement}
    role="img"
    aria-label="Post ${index} of ${count}"
    >${index}/${count}</span
  >`;
}
