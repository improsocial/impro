import { html } from "/js/lib/lit-html.js";
import { cdnImageUrl } from "/js/dataHelpers.js";
import "/js/components/app-icon.js";

export function profileLinkIconTemplate({ iconUrl }) {
  return html`<span class="profile-link-icon">
    ${iconUrl
      ? html`<img
          src=${cdnImageUrl(iconUrl)}
          alt=""
          @error=${(event) => {
            event.target.parentElement.classList.add("favicon-failed");
          }}
        />`
      : ""}
    <app-icon icon="globe-earth-line"></app-icon>
  </span>`;
}
