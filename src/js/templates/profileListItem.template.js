import { html } from "/js/lib/lit-html.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { linkToProfile } from "/js/navigation.js";

export function profileListItemTemplate({ actor }) {
  const displayName = actor.displayName || actor.handle;
  return html`<div
    @click=${() => window.router.go(linkToProfile(actor.handle))}
    class="profile-list-item"
  >
    ${avatarTemplate({ author: actor })}
    <div class="profile-list-item-body">
      <a class="profile-list-item-name" href="${linkToProfile(actor.handle)}">
        <span class="profile-list-item-display-name"> ${displayName} </span>
      </a>
      <div class="profile-list-item-handle">@${actor.handle}</div>
    </div>
  </div>`;
}

export function profileListItemSkeletonTemplate() {
  return html`<div class="profile-list-item profile-skeleton">
    <div class="skeleton-avatar skeleton-animate"></div>
    <div class="profile-list-item-body">
      <div class="skeleton-line-short skeleton-animate"></div>
      <div class="skeleton-line-shorter skeleton-animate"></div>
    </div>
  </div>`;
}
