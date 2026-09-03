import {
  bindToPage,
  pageEffect,
  bindPageTitle,
  onPageShow,
} from "/js/router.js";
import { html, render } from "/js/lib/lit-html.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { formatRelativeTime } from "/js/utils.js";
import {
  getConvoPreviewText,
  getDisplayName,
  getGroupConvoDetails,
  getLastInteraction,
  getInteractionTimestamp,
  MISSING_HANDLE,
} from "/js/dataHelpers.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { avatarGroupTemplate } from "/js/templates/avatarGroup.template.js";
import "/js/components/infinite-scroll-container.js";
import "/js/components/container-link.js";
import "/js/components/app-icon.js";
import { tryAgainButtonTemplate } from "/js/templates/tryAgainButton.template.js";

export default async function chatView({
  root,
  router,
  layout,
  context: { auth, dataLayer, chatNotificationService, newChatService },
}) {
  await auth.requireAuth();

  async function handleMenuClick() {
    layout.openSidebar();
  }

  function handleNewChatClick() {
    newChatService.openNewChatDialog();
  }

  function newChatButtonTemplate() {
    return html`
      <button
        class="new-chat-button"
        aria-label="New chat"
        data-testid="new-chat-button"
        @click=${() => handleNewChatClick()}
      >
        <app-icon icon="message-plus-line"></app-icon>
      </button>
    `;
  }

  function convoItemTemplate({ convo, currentUser }) {
    const groupDetails = getGroupConvoDetails(convo);
    const lastInteraction = getLastInteraction(convo);
    const otherMembers = convo.members.filter(
      (member) => member.did !== currentUser?.did,
    );
    const otherUser = groupDetails ? null : otherMembers[0];
    const timeAgo = lastInteraction
      ? formatRelativeTime(getInteractionTimestamp(lastInteraction))
      : "";
    const isUnread = convo.unreadCount > 0;
    return html`
      <container-link
        class="convo-item ${isUnread ? "unread" : ""} ${convo.muted
          ? "is-muted"
          : ""}"
        data-testid=${groupDetails ? "convo-item-group" : "convo-item-direct"}
        data-teststate=${convo.muted ? "muted" : "unmuted"}
        href=${`/messages/${convo.id}`}
      >
        <div class="convo-avatar">
          ${(() => {
            if (groupDetails) {
              return avatarGroupTemplate({ authors: otherMembers });
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
              ${convo.muted
                ? html`<app-icon
                    class="convo-muted-icon"
                    icon="bell-off"
                    data-testid="convo-muted-icon"
                  ></app-icon>`
                : ""}
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
              ? getConvoPreviewText(lastInteraction, {
                  currentUser,
                  convo,
                  profiles: dataLayer.derived.$convoProfiles.get(convo.id),
                })
              : "No messages yet"}
          </div>
        </div>
      </container-link>
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

  function inboxButtonTemplate({ hasUnreadRequests }) {
    return html`
      <a
        class="icon-button inbox-button"
        href="/messages/inbox"
        aria-label=${hasUnreadRequests ? "Requests (unread)" : "Requests"}
        data-testid="inbox-button"
        data-teststate=${hasUnreadRequests ? "unread" : "read"}
      >
        <app-icon icon="inbox"></app-icon>
        ${hasUnreadRequests
          ? html`<div class="unread-dot" data-testid="unread-dot"></div>`
          : ""}
      </a>
    `;
  }

  function convosTemplate({ convos, hasMore, currentUser }) {
    if (convos.length === 0) {
      return html`<div class="feed-end-message">
        <div>No conversations yet!</div>
        <button
          class="rounded-button rounded-button-primary"
          data-testid="new-chat-button-empty-state"
          @click=${() => handleNewChatClick()}
        >
          New chat
        </button>
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
      ${tryAgainButtonTemplate()}
    </div>`;
  }

  async function loadPageData() {
    await loadConvoList({ reload: true });
  }

  onPageShow(root, ({ action }) => {
    if (action === "restore") return;
    loadPageData();
  });

  bindToPage(root, layout, "active-nav-click", () => {
    loadPageData();
  });

  bindPageTitle(root, () => "Messages");

  pageEffect(root, () => {
    const currentUser = dataLayer.derived.$currentUser.get();
    const convos = dataLayer.derived.$convoList.get();
    const convosRequestStatus =
      dataLayer.requests.statusStore.$statuses.get("loadConvoList");
    const cursor = dataLayer.derived.$convoListCursor.get();
    const hasMore = !!cursor;
    const hasUnreadRequests =
      (chatNotificationService?.$numUnreadRequestConvos.get() ?? 0) > 0;

    render(
      html`<div id="chat-view">
        ${headerTemplate({
          title: "Chats",
          showLoadingSpinner: convosRequestStatus.loading && !!convos,
          leftButton: "menu",
          onClickMenuButton: () => handleMenuClick(),
          rightItemTemplate: () => html`
            <div class="chat-header-buttons">
              ${inboxButtonTemplate({ hasUnreadRequests })}
              ${newChatButtonTemplate()}
            </div>
          `,
        })}
        <main class="chat-main">
          ${(() => {
            if (convosRequestStatus.error) {
              return convosErrorTemplate({
                error: convosRequestStatus.error,
              });
            } else if (convos && currentUser) {
              const acceptedConvos = convos.filter(
                (convo) => convo.status === "accepted",
              );
              return convosTemplate({
                currentUser,
                convos: acceptedConvos,
                hasMore,
              });
            } else {
              return convoSkeletonTemplate();
            }
          })()}
        </main>
        <button
          class="fab new-chat-fab"
          aria-label="New chat"
          data-testid="new-chat-fab"
          @click=${() => handleNewChatClick()}
        >
          <app-icon icon="message-plus-line"></app-icon>
        </button>
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
}
