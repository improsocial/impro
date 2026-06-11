import { View } from "/js/views/view.js";
import { pageEffect } from "/js/router.js";
import { html, render } from "/js/lib/lit-html.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { auth } from "/js/auth.js";
import { displayRelativeTime } from "/js/utils.js";
import {
  getDisplayName,
  getGroupConvoDetails,
  getLastInteraction,
  getInteractionTimestamp,
  getSystemMessageDisplayText,
  isGroupConvo,
  MISSING_HANDLE,
} from "/js/dataHelpers.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import "/js/components/infinite-scroll-container.js";

function memberAvatarStackTemplate({ members }) {
  if (members.length === 0) {
    return html`<div class="avatar-placeholder"></div>`;
  }
  if (members.length === 1) {
    return avatarTemplate({ author: members[0], clickAction: "none" });
  }
  const shownMembers = members.slice(0, 3);
  return html`<div
    class="member-avatar-stack member-avatar-stack-${shownMembers.length}"
    data-testid="member-avatar-stack"
  >
    ${shownMembers.map(
      (member) =>
        html`<div class="member-avatar-stack-item">
          ${avatarTemplate({ author: member, clickAction: "none" })}
        </div>`,
    )}
  </div>`;
}

class ChatView extends View {
  async render({ root, router, context: { dataLayer, mainLayout } }) {
    await auth.requireAuth();

    async function handleMenuClick() {
      const sidebar = root.querySelector("animated-sidebar");
      sidebar.open();
    }

    function getSenderDisplayName(senderDid, currentUser, convo) {
      if (senderDid === currentUser.did) {
        return "You";
      }
      const sender = convo.members.find((member) => member.did === senderDid);
      // Group convo member lists are partial, so the sender may be missing
      return sender ? getDisplayName(sender) : "Someone";
    }

    function getPreviewText(interaction, currentUser, convo) {
      switch (interaction.$type) {
        case "chat.bsky.convo.defs#messageView": {
          if (isGroupConvo(convo)) {
            const senderName = getSenderDisplayName(
              interaction.sender.did,
              currentUser,
              convo,
            );
            return `${senderName}: ${interaction.text}`;
          }
          return interaction.sender.did === currentUser.did
            ? "You: " + interaction.text
            : interaction.text;
        }
        case "chat.bsky.convo.defs#messageAndReactionView": {
          const displayName = getSenderDisplayName(
            interaction.reaction.sender.did,
            currentUser,
            convo,
          );
          return `${displayName} reacted ${interaction.reaction.value} to "${interaction.message.text}"`;
        }
        case "chat.bsky.convo.defs#deletedMessageView":
          return "Deleted message";
        case "chat.bsky.convo.defs#systemMessageView": {
          const memberDid = interaction.data?.member?.did;
          const memberProfile = memberDid
            ? (convo.members.find((member) => member.did === memberDid) ??
              dataLayer.derived.$hydratedProfiles.get(memberDid))
            : null;
          return getSystemMessageDisplayText(interaction, {
            memberName: memberProfile ? getDisplayName(memberProfile) : null,
          });
        }
        default:
          throw new Error(`Unknown interaction type: ${interaction.$type}`);
      }
    }

    function convoItemTemplate({ convo, currentUser }) {
      const groupDetails = getGroupConvoDetails(convo);
      const lastInteraction = getLastInteraction(convo);
      const otherMembers = convo.members.filter(
        (member) => member.did !== currentUser?.did,
      );
      const otherUser = groupDetails ? null : otherMembers[0];
      const timeAgo = lastInteraction
        ? displayRelativeTime(getInteractionTimestamp(lastInteraction))
        : "";
      const isUnread = convo.unreadCount > 0;
      return html`
        <div
          class="convo-item ${isUnread ? "unread" : ""}"
          data-testid=${groupDetails ? "convo-item-group" : "convo-item-direct"}
          @click=${() => {
            router.go(`/messages/${convo.id}`);
          }}
        >
          <div class="convo-avatar">
            ${(() => {
              if (groupDetails) {
                return memberAvatarStackTemplate({ members: otherMembers });
              }
              return otherUser
                ? avatarTemplate({ author: otherUser })
                : html`<div class="avatar-placeholder"></div>`;
            })()}
          </div>
          <div class="convo-content">
            <div class="convo-header">
              <div class="convo-name">
                ${groupDetails ? groupDetails.name : getDisplayName(otherUser)}
              </div>

              ${timeAgo ? html`<div class="convo-time">${timeAgo}</div>` : ""}
            </div>
            <div class="convo-handle">
              ${!groupDetails &&
              otherUser?.handle &&
              otherUser?.handle !== MISSING_HANDLE
                ? `@${otherUser.handle}`
                : ""}
            </div>
            <div class="convo-preview ${isUnread ? "unread" : ""}">
              ${lastInteraction
                ? getPreviewText(lastInteraction, currentUser, convo)
                : "No messages yet"}
            </div>
          </div>
        </div>
      `;
    }

    function convoSkeletonTemplate() {
      return html`
        ${Array.from({ length: 8 }).map(
          () => html`
            <div class="convo-item skeleton">
              <div class="convo-avatar">
                <div class="convo-skeleton-avatar skeleton-animate"></div>
              </div>
              <div class="convo-content">
                <div class="convo-header">
                  <div class="convo-skeleton-name skeleton-animate"></div>
                </div>
                <div class="convo-skeleton-handle skeleton-animate"></div>
                <div class="convo-skeleton-preview skeleton-animate"></div>
              </div>
            </div>
          `,
        )}
      `;
    }

    function chatRequestsTemplate({ chatRequests }) {
      const hasUnreadRequests = chatRequests.some(
        (convo) => convo.unreadCount > 0,
      );
      return html`
        <div
          class="chat-requests-banner ${hasUnreadRequests ? "unread" : ""}"
          @click=${() => {
            router.go("/messages/inbox");
          }}
        >
          <div class="chat-requests-content">
            <div class="chat-requests-title">Chat requests</div>
          </div>
          <div class="chat-requests-arrow">→</div>
        </div>
      `;
    }

    function convosTemplate({ convos, hasMore, currentUser }) {
      if (convos.length === 0) {
        return html`<div class="feed-end-message">
          <div>No conversations yet!</div>
        </div>`;
      }

      return html`
        <infinite-scroll-container
          @load-more=${async (e) => {
            if (hasMore) {
              await loadConvoList();
              e.detail.resume();
            }
          }}
        >
          ${convos.map((convo) => convoItemTemplate({ convo, currentUser }))}
          ${hasMore ? convoSkeletonTemplate() : ""}
        </infinite-scroll-container>
      `;
    }

    function convosErrorTemplate({ error }) {
      console.error(error);
      return html`<div class="error-state">
        <div>There was an error loading conversations.</div>
        <button @click=${() => window.location.reload()}>Try again</button>
      </div>`;
    }

    pageEffect(root, () => {
      const currentUser = dataLayer.derived.$currentUser.get();
      const convos = dataLayer.derived.$convoList.get();
      const convosRequestStatus =
        dataLayer.requests.statusStore.$statuses.get("loadConvoList");
      const cursor = dataLayer.derived.$convoListCursor.get();
      const hasMore = !!cursor;

      render(
        html`<div id="chat-view">
          ${mainLayout({
            activeNavItem: "chat",
            onClickActiveNavItem: async () => {
              window.scrollTo(0, 0);
              await loadConvoList({ reload: true });
            },
            children: html`
              ${headerTemplate({
                title: "Chats",
                showLoadingSpinner: convosRequestStatus.loading && !!convos,
                leftButton: "menu",
                onClickMenuButton: () => handleMenuClick(),
              })}
              <main class="chat-main">
                ${(() => {
                  if (convosRequestStatus.error) {
                    return convosErrorTemplate({
                      error: convosRequestStatus.error,
                    });
                  } else if (convos && currentUser) {
                    const chatRequests = convos.filter(
                      (convo) =>
                        convo.status === "request" && !isGroupConvo(convo),
                    );
                    const acceptedConvos = convos.filter(
                      (convo) => convo.status === "accepted",
                    );
                    return html`
                      <div>
                        ${chatRequests.length > 0
                          ? chatRequestsTemplate({ chatRequests })
                          : ""}
                        ${convosTemplate({
                          currentUser,
                          convos: acceptedConvos,
                          hasMore,
                        })}
                      </div>
                    `;
                  } else {
                    return convoSkeletonTemplate();
                  }
                })()}
              </main>
            `,
          })}
        </div>`,
        root,
      );
    });

    async function loadConvoList({ reload = false } = {}) {
      await dataLayer.requests.loadConvoList({
        reload,
        limit: 30,
      });
    }

    root.addEventListener("page-enter", async () => {
      await dataLayer.declarative.ensureCurrentUser();
      await loadConvoList({ reload: true });
    });

    root.addEventListener("page-restore", async (e) => {
      const scrollY = e.detail?.scrollY ?? 0;
      const isBack = e.detail?.isBack ?? false;
      if (isBack) {
        window.scrollTo(0, scrollY);
      } else {
        window.scrollTo(0, 0);
        await loadConvoList({ reload: true });
      }
    });
  }
}

export default new ChatView();
