import { html } from "/js/lib/lit-html.js";
import "/js/components/muted-parent-toggle.js";

export function mutedParentToggleTemplate({ post, children }) {
  if (post.author?.viewer?.muted) {
    return html`<muted-parent-toggle label="Muted account">
      ${children}
    </muted-parent-toggle>`;
  }
  if (post.viewer?.hasMutedWord) {
    return html`<muted-parent-toggle label="Hidden by muted word">
      ${children}
    </muted-parent-toggle>`;
  }
  if (post.viewer?.isHidden) {
    return html`<muted-parent-toggle label="Post hidden by you">
      ${children}
    </muted-parent-toggle>`;
  }
  return children;
}
