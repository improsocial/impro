import { html } from "/js/lib/lit-html.js";
import { linkToProfileKnownFollowers } from "/js/navigation.js";
import { getDisplayName } from "/js/dataHelpers.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";

export function getKnownFollowersText({ count, followers }) {
  // count includes blocked users, followers does not
  const totalCount = count ?? followers.length;
  const firstName = getDisplayName(followers[0]);
  if (followers.length === 1) {
    if (totalCount > 1) {
      const others = totalCount - 1;
      return `Followed by ${firstName} and ${others} ${others === 1 ? "other" : "others"}`;
    }
    return `Followed by ${firstName}`;
  }
  const secondName = getDisplayName(followers[1]);
  if (totalCount > 2) {
    const others = totalCount - 2;
    return `Followed by ${firstName}, ${secondName}, and ${others} ${others === 1 ? "other" : "others"}`;
  }
  return `Followed by ${firstName} and ${secondName}`;
}

export function knownFollowersSummaryTemplate({
  profile,
  showPlaceholder = false,
}) {
  const knownFollowers = profile?.viewer?.knownFollowers;
  if (!knownFollowers || knownFollowers.followers.length === 0) {
    if (!showPlaceholder) {
      return null;
    }
    return html`<div class="known-followers-text">
      Not followed by anyone you're following
    </div>`;
  }
  const avatars = knownFollowers.followers.slice(0, 3);
  return html`<a
    class="known-followers-summary"
    data-testid="known-followers-summary"
    href=${linkToProfileKnownFollowers(profile)}
  >
    <div class="known-followers-avatars">
      ${avatars.map(
        (follower) => html`
          <div class="known-followers-avatar">
            ${avatarTemplate({ author: follower, clickAction: "none" })}
          </div>
        `,
      )}
    </div>
    <div class="known-followers-text">
      ${getKnownFollowersText(knownFollowers)}
    </div>
  </a>`;
}
