import { View } from "/js/views/view.js";
import { pageEffect } from "/js/router.js";
import { html, render } from "/js/lib/lit-html.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { auth } from "/js/auth.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import { displayRelativeTime } from "/js/utils.js";
import { getDisplayName, MISSING_HANDLE } from "/js/dataHelpers.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { showToast } from "/js/toasts.js";

class ChatRequestsView extends View {
  async render({
    root,
    router,
    context: {
      dataLayer,
      notificationService,
      chatNotificationService,
      postComposerService,
      pluginService,
    },
  }) {
    await auth.requireAuth();

    async function handleAccept(convo) {
      try {
        await dataLayer.mutations.acceptConvo(convo);
        // on accept, navigate to the chat detail page
        window.router.go(`/messages/${convo.id}`);
      } catch (error) {
        console.error(error);
        showToast("Failed to accept chat request", { style: "error" });
      }
    }

    async function handleReject(convo) {
      try {
        await dataLayer.mutations.rejectConvo(convo);
      } catch (error) {
        console.error(error);
        showToast("Failed to reject chat request", { style: "error" });
      }
    }

    function requestItemTemplate({ convo }) {
      const lastMessage = convo.lastMessage;
      const members = convo.members.filter(
        (member) => member.did !== dataLayer.derived.$currentUser.get()?.did,
      );
      const otherMember = members[0];
      const timeAgo = lastMessage
        ? displayRelativeTime(lastMessage.sentAt)
        : "";
      const messagePreview = lastMessage?.text || "No messages yet";

      return html`
        <div class="chat-request-item">
          <div
            class="chat-request-header"
            @click=${() => {
              router.go(`/messages/${convo.id}`);
            }}
          >
            <div class="convo-avatar">
              ${otherMember
                ? avatarTemplate({ author: otherMember })
                : html`<div class="avatar-placeholder"></div>`}
            </div>
            <div class="convo-content">
              <div class="convo-header">
                <div class="convo-name">${getDisplayName(otherMember)}</div>
                ${timeAgo ? html`<div class="convo-time">${timeAgo}</div>` : ""}
              </div>
              <div class="convo-handle">
                ${otherMember?.handle && otherMember?.handle !== MISSING_HANDLE
                  ? `@${otherMember.handle}`
                  : ""}
              </div>
              <div class="convo-preview">${messagePreview}</div>
              <div class="chat-request-follow-status">
                Not followed by anyone you're following
              </div>
            </div>
          </div>
          <div class="chat-request-actions">
            <button
              class="chat-request-button accept"
              @click=${(e) => {
                e.stopPropagation();
                handleAccept(convo);
              }}
            >
              Accept
            </button>
            <button
              class="chat-request-button reject"
              @click=${(e) => {
                e.stopPropagation();
                handleReject(convo);
              }}
            >
              Reject
            </button>
          </div>
        </div>
      `;
    }

    function requestSkeletonTemplate() {
      return html`
        ${Array.from({ length: 3 }).map(
          () => html`
            <div class="chat-request-item skeleton">
              <div class="chat-request-header">
                <div class="convo-avatar">
                  <div class="convo-skeleton-avatar skeleton-animate"></div>
                </div>
                <div class="convo-content">
                  <div class="convo-header">
                    <div class="convo-skeleton-name skeleton-animate"></div>
                    <div class="convo-skeleton-time skeleton-animate"></div>
                  </div>
                  <div class="convo-skeleton-handle skeleton-animate"></div>
                  <div class="convo-skeleton-preview skeleton-animate"></div>
                </div>
              </div>
              <div class="chat-request-actions">
                <div
                  class="chat-request-skeleton-button skeleton-animate"
                ></div>
                <div
                  class="chat-request-skeleton-button skeleton-animate"
                ></div>
              </div>
            </div>
          `,
        )}
      `;
    }

    function requestsTemplate({ requests, hasMore }) {
      if (requests.length === 0) {
        return html`<div class="feed-end-message">
          <div>No chat requests</div>
        </div>`;
      }

      return html`<div class="chat-requests-list">
        ${requests.map((convo) => requestItemTemplate({ convo }))}
      </div>`;
    }

    function requestsErrorTemplate({ error }) {
      console.error(error);
      return html`<div class="error-state">
        <div>There was an error loading chat requests.</div>
        <button @click=${() => window.location.reload()}>Try again</button>
      </div>`;
    }

    function renderPage() {
      const currentUser = dataLayer.derived.$currentUser.get();
      const numNotifications =
        notificationService?.$numNotifications.get() ?? null;
      const numChatNotifications =
        chatNotificationService?.$numNotifications.get() ?? null;
      const convos = dataLayer.derived.$convoList.get();
      const convosRequestStatus =
        dataLayer.requests.statusStore.$statuses.get("loadConvoList");
      const cursor = dataLayer.derived.$convoListCursor.get();
      const hasMore = !!cursor;

      // Filter to only show chat requests
      const chatRequests =
        convos?.filter((convo) => convo.status === "request") || [];

      render(
        html`<div id="chat-requests-view">
          ${mainLayoutTemplate({
            currentUser,
            numNotifications,
            numChatNotifications,
            activeNavItem: "chat",
            onClickActiveNavItem: () => {
              router.go("/messages");
            },
            onClickComposeButton: () =>
              postComposerService.composePost({ currentUser }),
            pluginService,
            children: html`
              ${headerTemplate({
                title: "Chat requests",
                showLoadingSpinner: convosRequestStatus.loading && !!convos,
                leftButton: "back",
                onClickBackButton: () => router.back(),
              })}
              <main class="chat-requests-main">
                ${(() => {
                  if (convosRequestStatus.error) {
                    return requestsErrorTemplate({
                      error: convosRequestStatus.error,
                    });
                  } else if (convos) {
                    return requestsTemplate({
                      requests: chatRequests,
                      hasMore,
                    });
                  } else {
                    return requestSkeletonTemplate();
                  }
                })()}
              </main>
            `,
          })}
        </div>`,
        root,
      );
    }

    pageEffect(root, renderPage);

    root.addEventListener("page-enter", async () => {
      dataLayer.declarative.ensureCurrentUser();
      await dataLayer.declarative.ensureConvoList();
    });

    root.addEventListener("page-restore", async (e) => {
      const scrollY = e.detail?.scrollY ?? 0;
      const isBack = e.detail?.isBack ?? false;
      if (isBack) {
        window.scrollTo(0, scrollY);
      } else {
        window.scrollTo(0, 0);
        await dataLayer.requests.loadConvoList({ reload: true });
      }
    });
  }
}

export default new ChatRequestsView();
