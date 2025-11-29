import { View } from "./view.js";
import { html, render } from "/js/lib/lit-html.js";
import { textHeaderTemplate } from "/js/templates/textHeader.template.js";
import { requireAuth } from "/js/auth.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import { displayRelativeTime } from "/js/utils.js";
import { getDisplayName } from "/js/dataHelpers.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import "/js/components/infinite-scroll-container.js";

class ChatView extends View {
  async render({
    root,
    router,
    context: { dataLayer, notificationService, chatNotificationService },
  }) {
    await requireAuth();

    async function handleMenuClick() {
      const sidebar = root.querySelector("animated-sidebar");
      sidebar.open();
    }

    function getPreviewText(interaction, currentUser, otherUser) {
      switch (interaction.$type) {
        case "chat.bsky.convo.defs#messageView":
          return interaction.sender.did === currentUser.did
            ? "You: " + interaction.text
            : interaction.text;
        case "chat.bsky.convo.defs#messageAndReactionView":
          const displayName =
            interaction.reaction.sender.did === currentUser.did
              ? "You"
              : getDisplayName(otherUser);
          return `${displayName} reacted ${interaction.reaction.value} to "${interaction.message.text}"`;
        case "chat.bsky.convo.defs#deletedMessageView":
          return "Deleted message";
        default:
          throw new Error(`Unknown interaction type: ${interaction.$type}`);
      }
    }

    function getLastInteraction(convo) {
      // Interaction = message or reaction
      const lastMessage = convo.lastMessage;
      const lastReaction = convo.lastReaction;
      if (!lastMessage && !lastReaction) {
        return null;
      }
      if (!lastMessage) {
        return lastReaction;
      } else if (!lastReaction) {
        return lastMessage;
      } else {
        return lastMessage.sentAt > lastReaction.reaction.createdAt
          ? lastMessage
          : lastReaction;
      }
    }

    function getInteractionTimestamp(interaction) {
      switch (interaction.$type) {
        case "chat.bsky.convo.defs#messageView":
        case "chat.bsky.convo.defs#deletedMessageView":
          return interaction.sentAt;
        case "chat.bsky.convo.defs#messageAndReactionView":
          return interaction.reaction.createdAt;
        default:
          throw new Error(`Unknown interaction type: ${interaction.$type}`);
      }
    }

    function convoItemTemplate({ convo, currentUser }) {
      const lastInteraction = getLastInteraction(convo);
      const otherUser = convo.members.find(
        (member) => member.did !== currentUser?.did
      );
      const timeAgo = lastInteraction
        ? displayRelativeTime(getInteractionTimestamp(lastInteraction))
        : "";
      const isUnread = convo.unreadCount > 0;
      return html`
        <div
          class="convo-item ${isUnread ? "unread" : ""}"
          @click=${() => {
            router.go(`/messages/${convo.id}`);
          }}
        >
          <div class="convo-avatar">
            ${otherUser
              ? avatarTemplate({ author: otherUser })
              : html`<div class="avatar-placeholder"></div>`}
          </div>
          <div class="convo-content">
            <div class="convo-header">
              <div class="convo-name">${getDisplayName(otherUser)}</div>

              ${timeAgo ? html`<div class="convo-time">${timeAgo}</div>` : ""}
            </div>
            <div class="convo-handle">
              ${otherUser?.handle && otherUser?.handle !== "missing.invalid"
                ? `@${otherUser.handle}`
                : ""}
            </div>
            <div class="convo-preview ${isUnread ? "unread" : ""}">
              ${lastInteraction
                ? getPreviewText(lastInteraction, currentUser, otherUser)
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
          `
        )}
      `;
    }

    function chatRequestsTemplate({ chatRequests }) {
      const hasUnreadRequests = chatRequests.some(
        (convo) => convo.unreadCount > 0
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
      if (!convos.length === 0) {
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

    async function renderPage() {
      const currentUser = dataLayer.selectors.getCurrentUser();
      const numNotifications =
        notificationService?.getNumNotifications() ?? null;
      const numChatNotifications =
        chatNotificationService?.getNumNotifications() ?? null;
      const convos = dataLayer.selectors.getConvoList();
      const convosRequestStatus = dataLayer.requests.getStatus("loadConvoList");
      const cursor = dataLayer.selectors.getConvoListCursor();
      const hasMore = !!cursor;

      render(
        html`<div id="chat-view">
          ${mainLayoutTemplate({
            currentUser,
            numNotifications,
            numChatNotifications,
            activeNavItem: "chat",
            onClickActiveNavItem: async () => {
              window.scrollTo(0, 0);
              await loadConvoList({ reload: true });
            },
            showFloatingComposeButton: false,
            children: html`
              ${textHeaderTemplate({
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
                      (convo) => convo.status === "request"
                    );
                    const acceptedConvos = convos.filter(
                      (convo) => convo.status === "accepted"
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
        root
      );
    }

    async function loadConvoList({ reload = false } = {}) {
      const loadingPromise = dataLayer.requests.loadConvoList({
        reload,
        limit: 30,
      });
      renderPage();
      await loadingPromise;
      renderPage();
    }

    root.addEventListener("page-enter", async () => {
      renderPage();
      await dataLayer.declarations.ensureCurrentUser();
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
      renderPage();
    });

    notificationService?.on("update", () => {
      renderPage();
    });

    chatNotificationService?.on("update", () => {
      renderPage();
    });
  }
}

export default new ChatView();
