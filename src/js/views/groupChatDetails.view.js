import { html, render } from "/js/lib/lit-html.js";
import { auth } from "/js/auth.js";
import { View } from "/js/views/view.js";
import { pageEffect, bindPageTitle } from "/js/router.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { avatarGroupTemplate } from "/js/templates/avatarGroup.template.js";
import { profileFeedTemplate } from "/js/templates/profileFeed.template.js";
import {
  getDisplayName,
  getGroupConvoDetails,
  getGroupConvoOwner,
} from "/js/dataHelpers.js";
import { formatFullDate } from "/js/utils.js";
import { Signal } from "/js/signals.js";
import { ApiError } from "/js/api.js";
import { showToast } from "/js/toasts.js";
import { confirmModal } from "/js/modals/confirm.modal.js";
import "/js/components/infinite-scroll-container.js";
import "/js/components/app-icon.js";

function sortMembers({ members, ownerDid, currentUserDid }) {
  const rank = (member) => {
    if (ownerDid && member.did === ownerDid) return 0;
    if (currentUserDid && member.did === currentUserDid) return 1;
    return 2;
  };
  return members
    .filter(
      (member) =>
        // deleted accounts can still be rendered
        member.kind == null ||
        member.kind.$type === "chat.bsky.actor.defs#groupConvoMember",
    )
    .map((member, index) => ({ member, index }))
    .sort((a, b) => rank(a.member) - rank(b.member) || a.index - b.index)
    .map((entry) => entry.member);
}

function adminBadgeTemplate() {
  return html`<div class="group-chat-admin-badge" data-testid="admin-badge">
    Admin
  </div>`;
}

function memberTrailingTemplate({ member, ownerDid }) {
  if (ownerDid && member.did === ownerDid) {
    return adminBadgeTemplate();
  }
  if (member.kind?.$type !== "chat.bsky.actor.defs#groupConvoMember") {
    return null;
  }
  const addedBy = member.kind.addedBy;
  return html`<div
    class="group-chat-member-added-by"
    data-testid="member-added-by"
  >
    ${addedBy ? `Added by ${getDisplayName(addedBy)}` : "Added by invite link"}
  </div>`;
}

function groupHeaderCardTemplate({
  convo,
  groupDetails,
  currentUserDid,
  isMuteSaving,
  onToggleMute,
  onLeave,
}) {
  const otherMembers = convo.members.filter(
    (member) => member.did !== currentUserDid,
  );
  return html`<div class="chat-info-panel">
    <div class="chat-info-panel-avatars">
      ${avatarGroupTemplate({ authors: otherMembers })}
    </div>
    ${groupDetails.name
      ? html`<div class="chat-info-panel-name" data-testid="group-name">
          ${groupDetails.name}
        </div>`
      : ""}
    ${groupDetails.createdAt
      ? html`<div class="chat-info-panel-handle" data-testid="group-created-at">
          Created ${formatFullDate(groupDetails.createdAt)}
        </div>`
      : ""}
    <div class="chat-info-panel-actions">
      <button
        class="rounded-button chat-info-panel-action ${convo.muted
          ? "muted"
          : ""}"
        data-testid="group-settings-mute-toggle"
        data-teststate=${convo.muted ? "muted" : "unmuted"}
        aria-label=${convo.muted
          ? "Unmute this group chat"
          : "Mute this group chat"}
        ?disabled=${isMuteSaving}
        @click=${() => onToggleMute(!convo.muted)}
      >
        <app-icon
          icon=${convo.muted ? "bell-off-line" : "bell-line"}
        ></app-icon>
        <span>${convo.muted ? "Muted" : "Mute"}</span>
      </button>
      <button
        class="rounded-button chat-info-panel-action"
        data-testid="group-settings-leave-button"
        aria-label="Leave this group chat"
        @click=${() => onLeave(groupDetails)}
      >
        <app-icon icon="door-exit-line"></app-icon>
        <span>Leave</span>
      </button>
    </div>
  </div>`;
}

function groupHeaderCardSkeletonTemplate() {
  return html`<div class="chat-info-panel group-chat-header-skeleton">
    <div class="chat-info-panel-avatars">
      <div
        class="skeleton-avatar skeleton-animate group-chat-header-skeleton-avatar"
        data-testid="skeleton-avatar"
      ></div>
    </div>
    <div class="chat-info-panel-name">
      &#8203;
      <div class="skeleton-line-short skeleton-animate"></div>
    </div>
    <div class="chat-info-panel-handle">
      &#8203;<span
        class="skeleton-line-shorter skeleton-animate group-chat-header-skeleton-handle-line"
      ></span>
    </div>
    <div class="chat-info-panel-actions">
      <div
        class="rounded-button chat-info-panel-action chat-info-panel-action-skeleton skeleton-animate"
      ></div>
      <div
        class="rounded-button chat-info-panel-action chat-info-panel-action-skeleton skeleton-animate"
      ></div>
    </div>
  </div>`;
}

function membersHeadingTemplate({ groupDetails = null } = {}) {
  return html`<div class="group-chat-members-heading">
    <span>Members</span>
    ${groupDetails
      ? html`<span class="group-chat-member-count" data-testid="member-count"
          >${groupDetails.memberCount}/${groupDetails.memberLimit}</span
        >`
      : ""}
  </div>`;
}

function detailsErrorTemplate({ error }) {
  if (error instanceof ApiError && error.data?.error === "InvalidConvo") {
    return html`<div class="error-state" data-testid="convo-not-found">
      <h3>Not Found</h3>
      <div>Conversation not found</div>
      <button class="rounded-button" @click=${() => window.location.reload()}>
        Try again
      </button>
    </div>`;
  }
  console.error(error);
  return html`<div class="error-state" data-testid="group-details-error">
    <div>There was an error loading the group chat.</div>
    <button class="rounded-button" @click=${() => window.location.reload()}>
      Try again
    </button>
  </div>`;
}

function notGroupConvoTemplate() {
  return html`<div class="error-state" data-testid="not-group-convo">
    <div>This screen is only available for group conversations.</div>
  </div>`;
}

class GroupChatDetailsView extends View {
  async render({
    root,
    params,
    router,
    context: { dataLayer, isAuthenticated },
  }) {
    await auth.requireAuth();

    const convoId = params.convoId;
    const $isMuteSaving = new Signal.State(false);

    const $requestError = new Signal.Computed(() => {
      return (
        dataLayer.requests.statusStore.$errors.get("loadConvo-" + convoId) ??
        dataLayer.requests.statusStore.$errors.get(
          "loadConvoMembers-" + convoId,
        ) ??
        null
      );
    });

    async function loadMoreMembers() {
      await dataLayer.requests.loadConvoMembers(convoId);
    }

    async function handleToggleMute(convo, muted) {
      $isMuteSaving.set(true);
      try {
        await dataLayer.mutations.setConvoMuted(convo, muted);
        showToast(muted ? "Group chat muted" : "Group chat unmuted");
      } catch (err) {
        console.error(err);
        showToast("Failed to mute group chat", { style: "error" });
      } finally {
        $isMuteSaving.set(false);
      }
    }

    async function handleLeave(convo, groupDetails) {
      const groupName = groupDetails?.name ?? "this group chat";
      const didLeave = await confirmModal(
        `Are you sure you want to leave "${groupName}"? You won't be able to rejoin unless you're invited.`,
        {
          title: "Leave group chat",
          confirmButtonText: "Leave group chat",
          confirmButtonStyle: "danger",
          pendingText: "Leaving",
          onConfirm: async () => {
            try {
              await dataLayer.mutations.leaveConvo(convo);
            } catch (err) {
              if (err instanceof ApiError) {
                if (err.data?.error === "OwnerCannotLeave") {
                  showToast("Owner must lock the group before leaving.", {
                    style: "error",
                  });
                  throw err;
                }
                if (err.data?.error === "InvalidConvo") {
                  showToast("Conversation not found.", { style: "error" });
                  throw err;
                }
              }
              console.error(err);
              showToast("Could not leave chat", { style: "error" });
              throw err;
            }
          },
        },
      );
      if (didLeave) {
        router.go("/messages");
        showToast("Left group chat");
      }
    }

    bindPageTitle(root, () => "Group chat settings");

    pageEffect(root, () => {
      const currentUser = dataLayer.derived.$currentUser.get();
      const convo = dataLayer.derived.$convos.get(convoId);
      const memberFeed = dataLayer.derived.$groupConvoMemberList.get(convoId);
      const requestError = $requestError.get();
      const groupDetails = convo ? getGroupConvoDetails(convo) : null;
      const ownerDid = convo ? getGroupConvoOwner(convo)?.did : null;
      const members = memberFeed
        ? sortMembers({
            members: memberFeed.members,
            ownerDid,
            currentUserDid: currentUser?.did ?? null,
          })
        : null;
      const hasMore = !!memberFeed?.cursor;
      const isMuteSaving = $isMuteSaving.get();

      render(
        html`<div id="group-chat-details-view">
          ${headerTemplate({
            title: "Group chat settings",
            backButtonFallbackRoute: `/messages/${encodeURIComponent(convoId)}`,
          })}
          <main>
            ${(() => {
              if (convo && !groupDetails) {
                return notGroupConvoTemplate();
              }
              if (requestError && (!convo || !memberFeed)) {
                return detailsErrorTemplate({ error: requestError });
              }
              return html`${convo
                ? groupHeaderCardTemplate({
                    convo,
                    groupDetails,
                    currentUserDid: currentUser?.did ?? null,
                    isMuteSaving,
                    onToggleMute: (muted) => handleToggleMute(convo, muted),
                    onLeave: (details) => handleLeave(convo, details),
                  })
                : groupHeaderCardSkeletonTemplate()}
              ${membersHeadingTemplate({ groupDetails })}
              ${profileFeedTemplate({
                profiles: members,
                hasMore,
                onLoadMore: loadMoreMembers,
                isAuthenticated,
                compact: true,
                rightItemTemplate: (actor) =>
                  memberTrailingTemplate({ member: actor, ownerDid }),
              })}`;
            })()}
          </main>
        </div>`,
        root,
      );
    });

    function loadConvoDetails({ reload = false } = {}) {
      return Promise.all([
        dataLayer.requests.loadConvo(convoId).catch((error) => {
          console.error("Failed to load convo", error);
        }),
        dataLayer.requests
          .loadConvoMembers(convoId, { reload })
          .catch((error) => {
            console.error("Failed to load convo members", error);
          }),
      ]);
    }

    root.addEventListener("page-enter", () => {
      loadConvoDetails({ reload: true });
    });

    root.addEventListener("page-restore", async (e) => {
      const scrollY = e.detail?.scrollY ?? 0;
      const isBack = e.detail?.isBack ?? false;
      if (isBack) {
        if (scrollY > 0) {
          window.scrollTo(0, scrollY);
        }
      } else {
        window.scrollTo(0, 0);
        await loadConvoDetails({ reload: true });
      }
    });
  }
}

export default new GroupChatDetailsView();
