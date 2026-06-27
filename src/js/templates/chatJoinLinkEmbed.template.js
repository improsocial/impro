import { html } from "/js/lib/lit-html.js";
import { avatarGroupTemplate } from "/js/templates/avatarGroup.template.js";
import { infoIconTemplate } from "/js/templates/icons/infoIcon.template.js";
import { checkIconTemplate } from "/js/templates/icons/checkIcon.template.js";
import { chevronRightIconTemplate } from "/js/templates/icons/chevronRight.template.js";
import { userPlusIconTemplate } from "/js/templates/icons/userPlusIcon.template.js";
import { lockIconTemplate } from "/js/templates/icons/lockIcon.template.js";
import { linkIconTemplate } from "/js/templates/icons/linkIcon.template.js";
import { getDisplayName, isAvailableJoinLinkPreview } from "/js/dataHelpers.js";
import { linkToProfile } from "/js/navigation.js";

function deriveJoinLinkAction({ preview, currentConvoId }) {
  if (!isAvailableJoinLinkPreview(preview)) return null;
  const convoId = preview.convo?.id ?? preview.convoId ?? null;
  const isFollowing = preview.owner?.viewer?.followedBy ?? false;
  const hasRequested = !convoId && preview.viewer?.requestedAt != null;

  if (convoId && convoId === currentConvoId) {
    return {
      type: "copy",
      label: "Copy link",
      icon: "link",
      side: "left",
      disabled: false,
    };
  }
  if (convoId) {
    return {
      type: "open",
      label: "Open chat",
      icon: "arrow-right",
      side: "right",
      disabled: false,
    };
  }

  if (preview.memberCount >= preview.memberLimit) {
    return {
      type: "full",
      label: "This chat is full",
      icon: "hand",
      side: "left",
      disabled: true,
    };
  }
  if (preview.joinRule === "followedByOwner" && !isFollowing) {
    return {
      type: "follow-required",
      label: "Only people the chat owner follows can join",
      icon: "hand",
      side: "left",
      disabled: true,
    };
  }
  if (hasRequested) {
    return {
      type: "requested",
      label: "Requested",
      icon: "check",
      side: "left",
      disabled: false,
    };
  }
  return {
    type: preview.requireApproval ? "request" : "join",
    label: preview.requireApproval ? "Request to join" : "Join",
    icon: "join",
    side: "left",
    disabled: false,
  };
}

const ACTION_ICONS = {
  link: linkIconTemplate,
  "arrow-right": chevronRightIconTemplate,
  join: userPlusIconTemplate,
  check: checkIconTemplate,
  hand: lockIconTemplate,
};

function unavailableTemplate() {
  return html`<div
    class="chat-join-link-embed-unavailable"
    data-testid="join-link-embed-unavailable"
  >
    ${infoIconTemplate()}
    <span>Chat invite link no longer available</span>
  </div>`;
}

function ownerRowTemplate({ owner }) {
  const displayName = getDisplayName(owner);
  return html`<div
    class="chat-join-link-embed-owner"
    data-testid="join-link-embed-owner"
  >
    <span>By </span>
    <a
      class="chat-join-link-embed-owner-name"
      href=${linkToProfile(owner)}
      @click=${(event) => event.stopPropagation()}
      >${displayName}</a
    >
    <span class="chat-join-link-embed-owner-handle">@${owner.handle}</span>
  </div>`;
}

function actionButtonTemplate({ action, preview }) {
  if (!action) return null;
  const iconFn = ACTION_ICONS[action.icon];
  const icon = iconFn ? iconFn() : null;
  return html`<button
    class="chat-join-link-action chat-join-link-action-${action.type}"
    data-testid="join-link-embed-action"
    data-teststate=${action.type}
    ?disabled=${action.disabled}
    @click=${function (event) {
      event.stopPropagation();
      if (action.disabled) return;
      this.dispatchEvent(
        new CustomEvent("chat-join-link:click", {
          detail: { actionType: action.type, preview },
          bubbles: true,
        }),
      );
    }}
  >
    ${action.side === "left" ? icon : null}
    <span class="chat-join-link-action-label">${action.label}</span>
    ${action.side === "right" ? icon : null}
  </button>`;
}

export function chatJoinLinkEmbedTemplate({ embed, currentConvoId }) {
  const preview = embed?.joinLinkPreview;

  if (!isAvailableJoinLinkPreview(preview)) {
    return html`<div
      class="chat-join-link-embed embed-card chat-join-link-embed-state-unavailable"
      data-testid="join-link-embed"
      data-teststate="unavailable"
    >
      ${unavailableTemplate()}
    </div>`;
  }

  const action = deriveJoinLinkAction({ preview, currentConvoId });
  const avatarProfiles = preview.convo?.members ?? [preview.owner];

  return html`<div
    class="chat-join-link-embed embed-card"
    data-testid="join-link-embed"
    data-teststate="available"
  >
    <div class="chat-join-link-embed-header">
      <div
        class="chat-join-link-embed-avatars"
        data-testid="join-link-embed-avatars"
      >
        ${avatarGroupTemplate({ authors: avatarProfiles })}
      </div>
      <div class="chat-join-link-embed-text">
        <div
          class="chat-join-link-embed-name"
          data-testid="join-link-embed-name"
        >
          ${preview.name}
        </div>
        <div
          class="chat-join-link-embed-meta"
          data-testid="join-link-embed-meta"
        >
          Group chat · ${preview.memberCount}/${preview.memberLimit} members
        </div>
        ${ownerRowTemplate({ owner: preview.owner })}
      </div>
    </div>
    ${actionButtonTemplate({ action, preview })}
  </div>`;
}
