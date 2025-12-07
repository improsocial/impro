import { View } from "./view.js";
import { html, render, ref } from "/js/lib/lit-html.js";
import { textHeaderTemplate } from "/js/templates/textHeader.template.js";
import { richTextTemplate } from "/js/templates/richText.template.js";
import { getFacetsFromText } from "/js/facetHelpers.js";
import { requireAuth } from "/js/auth.js";
import { mainLayoutTemplate } from "/js/templates/mainLayout.template.js";
import { getDisplayName } from "/js/dataHelpers.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { postEmbedTemplate } from "/js/templates/postEmbed.template.js";
import { CHAT_MESSAGES_PAGE_SIZE } from "/js/config.js";
import { showToast } from "/js/toasts.js";
import { wait, raf } from "/js/utils.js";
import { EventEmitter } from "/js/eventEmitter.js";
import { hapticsImpactMedium } from "/js/haptics.js";
import "/js/components/infinite-scroll-container.js";
import "/js/components/chat-input.js";
import "/js/lib/emoji-picker-element.js";

function enableLongPress(el, timeout = 500) {
  if (el.__longPressEnabled) {
    return;
  }
  el.addEventListener("touchstart", (e) => {
    el.__longPressTimeout = setTimeout(() => {
      el.dispatchEvent(new CustomEvent("long-press"));
    }, timeout);
  });
  el.addEventListener("touchend", (e) => {
    clearTimeout(el.__longPressTimeout);
  });
  // Also enable for clicks
  el.addEventListener("mousedown", (e) => {
    el.__longPressTimeout = setTimeout(() => {
      el.dispatchEvent(new CustomEvent("long-press"));
    }, timeout);
  });
  el.addEventListener("mouseup", (e) => {
    clearTimeout(el.__longPressTimeout);
  });
  el.__longPressEnabled = true;
}

class ChatDetailView extends View {
  async render({
    root,
    params,
    context: {
      dataLayer,
      notificationService,
      api,
      chatNotificationService,
      identityResolver,
    },
  }) {
    await requireAuth();

    const convoId = params.convoId;

    const state = {
      loadingEnabled: false,
      isSendingMessage: false,
      selectedMessageId: null,
    };

    function focusChatInput() {
      const chatInput = root.querySelector("chat-input");
      if (chatInput) {
        chatInput.focus();
      }
    }

    function scrollToBottom({ onlyIfNeeded = false } = {}) {
      const scrollingElement = document.scrollingElement || document.body;
      // Only scroll if content overflows the viewport
      if (scrollingElement.scrollHeight <= scrollingElement.clientHeight) {
        return;
      }
      if (onlyIfNeeded) {
        // Don't scroll if last message is already visible on screen
        const messageList = root.querySelector(".message-list");
        if (messageList) {
          const lastMessage = messageList.querySelector(
            ".message-group:last-child"
          );
          if (lastMessage) {
            const lastMessageBottom =
              lastMessage.getBoundingClientRect().bottom;
            const viewportHeight = window.innerHeight;
            if (lastMessageBottom <= viewportHeight) {
              return;
            }
          }
        }
      }
      scrollingElement.scrollTop = scrollingElement.scrollHeight;
    }

    function isScrolledToBottom() {
      const scrollingElement = document.scrollingElement || document.body;
      // 10px threshold
      return (
        scrollingElement.scrollHeight -
          scrollingElement.scrollTop -
          scrollingElement.clientHeight <=
        10
      );
    }

    class MessageFetcher extends EventEmitter {
      constructor(dataLayer, api, convoId, currentUser) {
        super();
        this.dataLayer = dataLayer;
        this.api = api;
        this.convoId = convoId;
        this.currentUser = currentUser;
        this._isPolling = false;
        this._cursor = "";
      }

      start() {
        if (this._isPolling) {
          return;
        }
        this._isPolling = true;
        this.runLoop();
      }

      stop() {
        this._isPolling = false;
      }

      async runLoop() {
        while (this._isPolling) {
          await this.fetchMessages();
          await wait(5000);
        }
      }

      async fetchMessages() {
        const res = await this.api.getChatLogs({ cursor: this._cursor });
        this._cursor = res.cursor;
        const logsForConvo = res.logs.filter(
          (log) => log.convoId === this.convoId
        );
        for (const log of logsForConvo) {
          if (log.$type === "chat.bsky.convo.defs#logCreateMessage") {
            if (log.message.sender.did === this.currentUser.did) {
              // Skip if the message is from the current user, since we already set it in the store
              continue;
            }
            const convoMessages = this.dataLayer.selectors.getConvoMessages(
              this.convoId
            );
            if (!convoMessages) {
              console.warn("No messages data found for convoId", this.convoId);
              return;
            }
            // set new message in store
            this.dataLayer.dataStore.setMessage(log.message.id, log.message);
            this.dataLayer.dataStore.setConvoMessages(this.convoId, {
              messages: [log.message, ...convoMessages.messages],
              cursor: convoMessages.cursor,
            });
            this.emit("message");
          }
        }
      }
    }

    let messageFetcher = null;

    function closeReactionPalette() {
      state.selectedMessageId = null;
      renderPage();
    }

    async function handleEmojiSelect(emoji, messageId, currentUserDid) {
      try {
        await dataLayer.mutations.addMessageReaction(
          convoId,
          messageId,
          emoji,
          currentUserDid
        );
        closeReactionPalette();
        renderPage();
      } catch (error) {
        console.error(error);
        showToast("Failed to add reaction", { error: true });
      }
    }

    async function handleReactionClick(emoji, messageId, isOwnReaction) {
      if (isOwnReaction) {
        // Remove reaction
        try {
          const promise = dataLayer.mutations.removeMessageReaction(
            convoId,
            messageId,
            emoji
          );
          // optimistic update
          renderPage();
          await promise;
          renderPage();
        } catch (error) {
          console.error(error);
          showToast("Failed to remove reaction", { error: true });
        }
      } else {
        // Add reaction
        try {
          const promise = dataLayer.mutations.addMessageReaction(
            convoId,
            messageId,
            emoji
          );
          // optimistic update
          renderPage();
          await promise;
          renderPage();
        } catch (error) {
          console.error(error);
          showToast("Failed to add reaction", { error: true });
        }
      }
    }

    function handleLongPress(message) {
      hapticsImpactMedium();
      state.selectedMessageId = message.id;
      renderPage();
      // close on click outside
      setTimeout(() => {
        document.addEventListener("click", () => closeReactionPalette(), {
          once: true,
        });
      }, 500);
    }

    async function handleSendMessage(messageText) {
      state.isSendingMessage = true;
      renderPage();
      try {
        const facets = await getFacetsFromText(messageText, identityResolver);
        await dataLayer.mutations.createMessage(convoId, {
          text: messageText,
          facets,
        });
        renderPage();
        scrollToBottom();
      } catch (error) {
        console.error(error);
        showToast("Failed to send message", { error: true });
      } finally {
        state.isSendingMessage = false;
        renderPage();
        focusChatInput();
      }
    }

    function differenceInMinutes(a, b) {
      const date1 = typeof a === "string" ? new Date(a) : a;
      const date2 = typeof b === "string" ? new Date(b) : b;
      const diff = Math.abs(date1.getTime() - date2.getTime());
      return Math.floor(diff / (1000 * 60));
    }

    function groupMessages(messages, currentUserDid) {
      const groups = [];
      let currentGroup = null;

      for (const message of messages) {
        const isCurrentUser = message.sender.did === currentUserDid;
        if (
          !currentGroup ||
          currentGroup.isCurrentUser !== isCurrentUser ||
          differenceInMinutes(currentGroup.lastSentAt, message.sentAt) > 5
        ) {
          // Start a new group
          currentGroup = {
            isCurrentUser,
            messages: [message],
            lastSentAt: message.sentAt,
          };
          groups.push(currentGroup);
        } else {
          // Add to current group
          currentGroup.messages.push(message);
          currentGroup.lastSentAt = message.sentAt;
        }
      }

      return groups;
    }

    function getDateFromTimestamp(timestamp) {
      // Get date by setting the time to 00:00:00
      return new Date(new Date(timestamp).setHours(0, 0, 0, 0));
    }

    function getDayOfWeek(date) {
      return date.toLocaleDateString("en-US", { weekday: "long" });
    }

    function isSameDate(date1, date2) {
      return (
        date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate()
      );
    }

    function groupMessageGroupsByDay(messageGroups) {
      const days = [];
      let currentDay = null;
      for (const group of messageGroups) {
        const groupDate = getDateFromTimestamp(group.lastSentAt);
        if (!currentDay || !isSameDate(currentDay.date, groupDate)) {
          currentDay = {
            date: groupDate,
            messageGroups: [group],
          };
          days.push(currentDay);
        } else {
          currentDay.messageGroups.push(group);
        }
      }
      return days;
    }

    function reactionBubblesTemplate({ message, isCurrentUser }) {
      const reactions = message.reactions || [];
      if (reactions.length === 0) {
        return "";
      }

      const currentUser = dataLayer.selectors.getCurrentUser();

      // Group reactions by emoji
      const reactionGroups = reactions.reduce((acc, reaction) => {
        if (!acc[reaction.value]) {
          acc[reaction.value] = {
            emoji: reaction.value,
            count: 0,
            dids: [],
          };
        }
        acc[reaction.value].count++;
        acc[reaction.value].dids.push(reaction.sender.did);
        return acc;
      }, {});

      const groupedReactions = Object.values(reactionGroups);

      return html`
        <div
          class="message-reactions ${isCurrentUser
            ? "message-reactions-sent"
            : "message-reactions-received"}"
        >
          ${groupedReactions.map((group) => {
            const isOwnReaction = group.dids.includes(currentUser?.did);
            return html`
              <button
                class="reaction-bubble ${isOwnReaction
                  ? "reaction-bubble-own"
                  : ""}"
                @click=${() =>
                  handleReactionClick(group.emoji, message.id, isOwnReaction)}
              >
                <span class="reaction-emoji">${group.emoji}</span>
                ${group.count > 1
                  ? html`<span class="reaction-count">${group.count}</span>`
                  : ""}
              </button>
            `;
          })}
        </div>
      `;
    }

    function reactionPaletteTemplate({ message, currentUserDid }) {
      const emojis = ["👍", "😂", "❤️", "👀", "😢"];

      return html`
        <div class="reaction-palette" @click=${(e) => e.stopPropagation()}>
          ${emojis.map(
            (emoji) => html`
              <button
                class="reaction-palette-button"
                @click=${(e) => {
                  e.stopPropagation();
                  handleEmojiSelect(emoji, message.id, currentUserDid);
                }}
              >
                <span class="reaction-palette-button-inner">${emoji}</span>
              </button>
            `
          )}
          <button
            class="reaction-palette-button reaction-palette-button-more"
            @click=${(e) => {
              const openEmojiPicker = root.querySelector("emoji-picker");
              if (openEmojiPicker) {
                openEmojiPicker.remove();
                return;
              }
              const emojiPicker = document.createElement("emoji-picker");
              emojiPicker.addEventListener("emoji-click", (e) => {
                handleEmojiSelect(e.detail.unicode, message.id, currentUserDid);
              });
              emojiPicker.addEventListener("click", (e) => {
                e.stopPropagation();
              });
              e.target.parentElement.appendChild(emojiPicker);
            }}
          >
            <span class="reaction-palette-button-inner">...</span>
          </button>
        </div>
      `;
    }

    function messageTemplate({
      message,
      isCurrentUser,
      currentUserDid,
      showAvatar,
      otherMember,
      onLongPress,
      isSelected,
    }) {
      // return "This is a message";
      return html`
        <div
          class="message-wrapper ${isSelected ? "message-wrapper-active" : ""}"
        >
          <div
            ref=${ref((el) => {
              if (el) {
                enableLongPress(el);
              }
            })}
            @long-press=${(e) => onLongPress(message, e)}
            class="message ${isCurrentUser
              ? "message-sent"
              : "message-received"}"
          >
            ${!isCurrentUser && showAvatar
              ? html`<div class="message-avatar">
                  ${otherMember
                    ? avatarTemplate({ author: otherMember })
                    : html`<div class="avatar-placeholder"></div>`}
                </div>`
              : !isCurrentUser && !showAvatar
              ? html`<div class="message-avatar-spacer"></div>`
              : ""}
            <div class="message-bubble">
              <div class="message-text">
                ${richTextTemplate({
                  text: message.text,
                  facets: message.facets,
                })}
              </div>
            </div>
            ${reactionBubblesTemplate({ message, isCurrentUser })}
          </div>
          ${message.embed
            ? html`<div
                class="message ${isCurrentUser
                  ? "message-sent"
                  : "message-received"}"
              >
                <div class="message-embed">
                  ${postEmbedTemplate({ embed: message.embed })}
                </div>
              </div>`
            : ""}
          ${isSelected
            ? reactionPaletteTemplate({ message, currentUserDid })
            : ""}
        </div>
      `;
    }

    function formatTime(timestamp) {
      return new Date(timestamp).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    }

    function messageGroupTemplate({ group, otherMember, currentUserDid }) {
      return html`
        <div
          class="message-group ${group.isCurrentUser
            ? "message-group-sent"
            : "message-group-received"}"
        >
          ${group.messages.map((message, index) =>
            messageTemplate({
              message,
              isCurrentUser: group.isCurrentUser,
              currentUserDid,
              showAvatar: index === 0,
              otherMember,
              onLongPress: (msg, e) => handleLongPress(msg, e),
              isSelected: state.selectedMessageId === message.id,
            })
          )}
          <div
            class="message-group-time ${group.isCurrentUser
              ? "message-group-time-sent"
              : "message-group-time-received"}"
          >
            ${formatTime(group.lastSentAt)}
          </div>
        </div>
      `;
    }

    function messageDayTitleTemplate({ date, startTime }) {
      const isToday = isSameDate(date, new Date());
      return html`<div class="message-day-title">
        <strong>${isToday ? "Today" : getDayOfWeek(date)}</strong> at
        ${formatTime(startTime)}
      </div>`;
    }

    function messagesTemplate({
      loadingEnabled,
      messages,
      currentUserDid,
      otherMember,
      hasMore,
    }) {
      if (!messages || messages.length === 0) {
        return html`<div class="chat-detail-empty">
          <div>No messages yet!</div>
        </div>`;
      }
      const reversedMessages = messages.toReversed();
      const messageGroups = groupMessages(reversedMessages, currentUserDid);
      const days = groupMessageGroupsByDay(messageGroups);
      // const message
      return html`
        <infinite-scroll-container
          ?disabled=${!loadingEnabled}
          lookahead="0px"
          inverted
          @load-more=${async (e) => {
            if (hasMore) {
              const scrollContainer =
                document.querySelector(".chat-detail-main");
              await loadMessages({ renderOnLoad: false });
              // Maintain scroll position using scrollHeight difference
              const previousScrollHeight = scrollContainer.scrollHeight;
              const previousScrollTop = window.scrollY;
              renderPage();
              await raf();
              await raf();
              // Restore scroll position
              const newScrollHeight = scrollContainer.scrollHeight;
              const heightDifference = newScrollHeight - previousScrollHeight;
              window.scrollTo(0, previousScrollTop + heightDifference);
              await wait(100); // wait for the scroll to complete so that we don't accidentally trigger the load more event again
              e.detail.resume();
            }
          }}
        >
          ${hasMore && loadingEnabled
            ? html`<div class="loading-spinner-container">
                <div class="loading-spinner"></div>
              </div>`
            : ""}
          <div class="message-list">
            ${days.map((day) => {
              return html`<div class="message-day">
                ${messageDayTitleTemplate({
                  date: day.date,
                  startTime: day.messageGroups[0].lastSentAt,
                })}
                ${day.messageGroups.map((group) =>
                  messageGroupTemplate({
                    group,
                    otherMember,
                    currentUserDid,
                  })
                )}
              </div>`;
            })}
          </div>
        </infinite-scroll-container>
      `;
    }

    function messagesErrorTemplate({ error }) {
      console.error(error);
      return html`<div class="error-state">
        <div>There was an error loading messages.</div>
        <button @click=${() => window.location.reload()}>Try again</button>
      </div>`;
    }

    function getOtherMember(currentUser, convo) {
      if (!currentUser || !convo) {
        return null;
      }
      return convo.members.find((member) => member.did !== currentUser?.did);
    }

    async function renderPage() {
      const currentUser = dataLayer.selectors.getCurrentUser();
      const numNotifications =
        notificationService?.getNumNotifications() ?? null;
      const numChatNotifications =
        chatNotificationService?.getNumNotifications() ?? 0;
      const messagesData = dataLayer.selectors.getConvoMessages(convoId);
      const messages = messagesData?.messages ?? null;
      const messagesRequestStatus =
        dataLayer.requests.getStatus("loadMessages");
      const hasMore = !!messagesData?.cursor;

      // Get convo details to show other member info
      const convo = dataLayer.selectors.getConvo(convoId);
      const otherMember = getOtherMember(currentUser, convo);
      const title = otherMember ? getDisplayName(otherMember) : "";

      render(
        html`<div id="chat-detail-view">
          ${mainLayoutTemplate({
            currentUser,
            numNotifications,
            numChatNotifications,
            showSidebarOverlay: false,
            showFloatingComposeButton: false,
            children: html`
              ${textHeaderTemplate({
                avatarTemplate: () => {
                  return otherMember
                    ? avatarTemplate({ author: otherMember })
                    : "";
                },
                title,
                subtitle: otherMember?.handle ? `@${otherMember.handle}` : "",
                leftButton: "back",
              })}
              <main class="chat-detail-main">
                ${(() => {
                  if (messagesRequestStatus.error) {
                    return messagesErrorTemplate({
                      error: messagesRequestStatus.error,
                    });
                  } else if (messages) {
                    return messagesTemplate({
                      loadingEnabled: state.loadingEnabled,
                      messages,
                      currentUserDid: currentUser?.did,
                      otherMember,
                      hasMore,
                    });
                  } else {
                    return html`<div
                      class="loading-spinner-container"
                      style="padding-top: 16px;"
                    >
                      <div class="loading-spinner"></div>
                    </div>`;
                  }
                })()}
              </main>
              <div class="message-input-wrapper">
                <chat-input
                  @send=${(e) => handleSendMessage(e.detail.message)}
                  @resize=${function () {
                    // update the padding bottom of the message list to match the height of the input
                    const messageList = root.querySelector(".message-list");
                    if (messageList) {
                      const wasScrolledToBottom = isScrolledToBottom();
                      messageList.style.paddingBottom =
                        this.clientHeight + "px";
                      if (wasScrolledToBottom) {
                        scrollToBottom();
                      }
                    }
                  }}
                  ?disabled=${!messages || state.isSendingMessage}
                  ?loading=${state.isSendingMessage}
                ></chat-input>
              </div>
            `,
          })}
        </div>`,
        root
      );
    }

    async function loadMessages({ reload = false, renderOnLoad = true } = {}) {
      const loadingPromise = dataLayer.requests.loadConvoMessages(convoId, {
        reload,
        limit: CHAT_MESSAGES_PAGE_SIZE,
      });
      renderPage();
      await loadingPromise;
      if (renderOnLoad) {
        renderPage();
      }
      // can be async
      dataLayer.mutations.markConvoAsRead(convoId);
      chatNotificationService?.markNotificationsAsReadForConvo(convoId);
    }

    root.addEventListener("page-enter", async () => {
      renderPage();
      dataLayer.declarative.ensureCurrentUser().then((currentUser) => {
        renderPage();
        // Initialize message fetcher
        messageFetcher = new MessageFetcher(
          dataLayer,
          api,
          convoId,
          currentUser
        );
        messageFetcher.on("message", () => {
          renderPage();
        });
        messageFetcher.start();
      });
      await dataLayer.declarative.ensureConvo(convoId);
      await loadMessages({ reload: true });
      // Scroll to bottom of messages
      scrollToBottom({ onlyIfNeeded: true });
      // Only enable loading after scroll, otherwise the infinite scroll container will start loading immediately
      state.loadingEnabled = true;
      renderPage();
      // Sometimes it jumps after the render, so we scroll to bottom again
      scrollToBottom({ onlyIfNeeded: true });
    });

    root.addEventListener("page-restore", async (e) => {
      messageFetcher.start();
      const scrollY = e.detail?.scrollY ?? 0;
      const isBack = e.detail?.isBack ?? false;
      if (isBack) {
        window.scrollTo(0, scrollY);
      } else {
        scrollToBottom();
        await loadMessages({ reload: true });
      }
      renderPage();
    });

    root.addEventListener("page-exit", () => {
      messageFetcher.stop();
    });

    notificationService?.on("update", () => {
      renderPage();
    });

    chatNotificationService?.on("update", () => {
      renderPage();
    });
  }
}

export default new ChatDetailView();
