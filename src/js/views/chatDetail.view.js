import { View } from "/js/views/view.js";
import { pageEffect } from "/js/router.js";
import { html, render, ref } from "/js/lib/lit-html.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { richTextTemplate } from "/js/templates/richText.template.js";
import { getFacetsFromText } from "/js/facetHelpers.js";
import { auth } from "/js/auth.js";
import {
  getDisplayName,
  getGroupConvoDetails,
  getSystemMessageDisplayText,
} from "/js/dataHelpers.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { postEmbedTemplate } from "/js/templates/postEmbed.template.js";
import { CHAT_MESSAGES_PAGE_SIZE } from "/js/config.js";
import { showToast } from "/js/toasts.js";
import { wait, raf, differenceInMinutes, enableLongPress } from "/js/utils.js";
import { Signal, ReactiveStore } from "/js/signals.js";
import { hapticsImpactMedium } from "/js/haptics.js";
import "/js/components/infinite-scroll-container.js";
import "/js/components/chat-input.js";
import "/js/lib/emoji-picker-element.js";

class ChatDetailView extends View {
  async render({
    root,
    params,
    context: {
      dataLayer,
      chatNotificationService,
      identityResolver,
      mainLayout,
    },
  }) {
    await auth.requireAuth();

    const convoId = params.convoId;

    const state = new ReactiveStore("chatDetailView");
    state.$loadingEnabled = new Signal.State(false);
    state.$isSendingMessage = new Signal.State(false);
    state.$selectedMessageId = new Signal.State(null);

    function focusChatInput() {
      const chatInput = root.querySelector("chat-input");
      if (chatInput) {
        chatInput.focus();
      }
    }

    function getMessageScroller() {
      return root.querySelector(".chat-detail-main infinite-scroll-container");
    }

    function scrollToBottom({ onlyIfNeeded = false } = {}) {
      const scroller = getMessageScroller();
      if (!scroller) {
        return;
      }
      if (scroller.scrollHeight <= scroller.clientHeight) {
        return;
      }
      if (onlyIfNeeded) {
        const messageList = scroller.querySelector(".message-list");
        if (messageList) {
          const lastMessage = [
            ...messageList.querySelectorAll(".message-bubble"),
          ].at(-1);
          if (lastMessage) {
            const lastMessageBottom =
              lastMessage.getBoundingClientRect().bottom;
            const scrollerBottom = scroller.getBoundingClientRect().bottom;
            if (lastMessageBottom <= scrollerBottom) {
              return;
            }
          }
        }
      }
      scroller.scrollTop = scroller.scrollHeight;
    }

    function isScrolledToBottom() {
      const scroller = getMessageScroller();
      if (!scroller) {
        return false;
      }
      // 10px threshold
      return (
        scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <= 10
      );
    }

    // Tracked via the scroller's scroll events so when the input bar grows
    // we can pin using PRE-resize state. By the time the height-change event
    // fires the scroller has already shrunk, so a post-hoc check is unreliable.
    let wasAtBottom = true;
    let scrollListenerEl = null;

    function onScroll() {
      wasAtBottom = isScrolledToBottom();
    }

    function attachScrollListener() {
      const scroller = getMessageScroller();
      if (scroller === scrollListenerEl) {
        return;
      }
      if (scrollListenerEl) {
        scrollListenerEl.removeEventListener("scroll", onScroll);
      }
      scrollListenerEl = scroller;
      if (scroller) {
        scroller.addEventListener("scroll", onScroll, { passive: true });
      }
    }

    function handleInputHeightChange(e) {
      const height = e.detail?.height;
      const main = root.querySelector(".chat-detail-main");
      if (main && typeof height === "number") {
        main.style.setProperty("--input-bar-height", height + "px");
      }
      if (wasAtBottom) {
        scrollToBottom();
      }
    }

    class MessageFetcher {
      constructor(dataLayer, convoId) {
        this.dataLayer = dataLayer;
        this.convoId = convoId;
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
          this._cursor = await this.dataLayer.requests.pollConvoMessages(
            this.convoId,
            { cursor: this._cursor },
          );
          await wait(5000);
        }
      }
    }

    const messageFetcher = new MessageFetcher(dataLayer, convoId);

    function closeReactionPalette() {
      state.$selectedMessageId.set(null);
    }

    async function handleEmojiSelect(emoji, messageId, currentUserDid) {
      try {
        await dataLayer.mutations.addMessageReaction(
          convoId,
          messageId,
          emoji,
          currentUserDid,
        );
        closeReactionPalette();
      } catch (error) {
        console.error(error);
        showToast("Failed to add reaction", { style: "error" });
      }
    }

    async function handleReactionClick(emoji, messageId, isOwnReaction) {
      try {
        if (isOwnReaction) {
          await dataLayer.mutations.removeMessageReaction(
            convoId,
            messageId,
            emoji,
          );
        } else {
          await dataLayer.mutations.addMessageReaction(
            convoId,
            messageId,
            emoji,
          );
        }
      } catch (error) {
        console.error(error);
        showToast(
          isOwnReaction
            ? "Failed to remove reaction"
            : "Failed to add reaction",
          { style: "error" },
        );
      }
    }

    function handleLongPress(message) {
      hapticsImpactMedium();
      state.$selectedMessageId.set(message.id);
      // close on click outside
      setTimeout(() => {
        document.addEventListener("click", () => closeReactionPalette(), {
          once: true,
        });
      }, 500);
    }

    async function handleSendMessage(messageText) {
      state.$isSendingMessage.set(true);
      try {
        const facets = await getFacetsFromText(messageText, identityResolver);
        await dataLayer.mutations.createMessage(convoId, {
          text: messageText,
          facets,
        });
        await raf();
        await raf();
        scrollToBottom();
      } catch (error) {
        console.error(error);
        showToast("Failed to send message", { style: "error" });
      } finally {
        state.$isSendingMessage.set(false);
        await raf();
        focusChatInput();
      }
    }

    function groupMessages(messages, currentUserDid) {
      const groups = [];
      let currentGroup = null;

      for (const message of messages) {
        if (message.$type === "chat.bsky.convo.defs#systemMessageView") {
          // System messages render standalone and break up sender clusters
          currentGroup = null;
          groups.push({
            isSystemMessage: true,
            message,
            lastSentAt: message.sentAt,
          });
          continue;
        }
        const senderDid = message.sender.did;
        const isCurrentUser = senderDid === currentUserDid;
        if (
          !currentGroup ||
          currentGroup.senderDid !== senderDid ||
          differenceInMinutes(currentGroup.lastSentAt, message.sentAt) > 5
        ) {
          // Start a new group
          currentGroup = {
            isCurrentUser,
            senderDid,
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

    function getMemberProfile(convo, memberDid) {
      if (!convo) {
        return null;
      }
      const profiles = dataLayer.derived.$convoProfiles.get(convo.id);
      return profiles.find((profile) => profile.did === memberDid) ?? null;
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

      const currentUser = dataLayer.derived.$currentUser.get();

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
            `,
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
      author,
      onLongPress,
      isSelected,
    }) {
      return html`
        <div
          class="message-wrapper ${isSelected ? "message-wrapper-active" : ""}"
        >
          <div
            ${ref((el) => {
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
                  ${author
                    ? avatarTemplate({ author })
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
                  truncateUrls: true,
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
                  ${postEmbedTemplate({
                    embed: message.embed,
                    isAuthenticated: true,
                  })}
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

    function systemMessageTemplate({ message, convo }) {
      const memberDid = message.data?.member?.did;
      const memberProfile = memberDid
        ? getMemberProfile(convo, memberDid)
        : null;
      const memberName = memberProfile ? getDisplayName(memberProfile) : null;
      return html`
        <div class="system-message" data-testid="system-message">
          ${getSystemMessageDisplayText(message, { memberName })}
        </div>
      `;
    }

    function messageGroupTemplate({ group, convo, isGroup, currentUserDid }) {
      const author = group.isCurrentUser
        ? null
        : getMemberProfile(convo, group.senderDid);
      return html`
        <div
          class="message-group ${group.isCurrentUser
            ? "message-group-sent"
            : "message-group-received"}"
        >
          ${isGroup && !group.isCurrentUser
            ? html`<div
                class="message-author-name"
                data-testid="message-author-name"
              >
                ${author ? getDisplayName(author) : "Unknown member"}
              </div>`
            : ""}
          ${group.messages.map((message, index) =>
            messageTemplate({
              message,
              isCurrentUser: group.isCurrentUser,
              currentUserDid,
              showAvatar: index === 0,
              author,
              onLongPress: (msg, e) => handleLongPress(msg, e),
              isSelected: state.$selectedMessageId.get() === message.id,
            }),
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
      convo,
      isGroup,
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
          ${ref((el) => {
            if (el) {
              attachScrollListener();
            }
          })}
          ?disabled=${!loadingEnabled}
          lookahead="0px"
          inverted
          @load-more=${async (e) => {
            if (hasMore) {
              const scrollContainer = getMessageScroller();
              // Maintain scroll position using scrollHeight difference
              const previousScrollHeight = scrollContainer.scrollHeight;
              const previousScrollTop = scrollContainer.scrollTop;
              await loadMessages({ renderOnLoad: false });
              await raf();
              await raf();
              // Restore scroll position
              const newScrollHeight = scrollContainer.scrollHeight;
              const heightDifference = newScrollHeight - previousScrollHeight;
              scrollContainer.scrollTop = previousScrollTop + heightDifference;
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
                  group.isSystemMessage
                    ? systemMessageTemplate({ message: group.message, convo })
                    : messageGroupTemplate({
                        group,
                        convo,
                        isGroup,
                        currentUserDid,
                      }),
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

    async function loadMessages({ reload = false } = {}) {
      await dataLayer.requests.loadConvoMessages(convoId, {
        reload,
        limit: CHAT_MESSAGES_PAGE_SIZE,
      });
      // can be async
      dataLayer.mutations.markConvoAsRead(convoId);
      chatNotificationService?.markNotificationsAsReadForConvo(convoId);
    }

    // Put this in a computed to avoid an extra render when we mark a convo as read
    state.$otherMember = new Signal.Computed(() => {
      const currentUser = dataLayer.derived.$currentUser.get();
      const convo = dataLayer.derived.$convos.get(convoId);
      return getOtherMember(currentUser, convo);
    });

    pageEffect(root, () => {
      const currentUser = dataLayer.derived.$currentUser.get();
      const convo = dataLayer.derived.$convos.get(convoId);
      const groupDetails = convo ? getGroupConvoDetails(convo) : null;
      const messagesData = dataLayer.derived.$convoMessages.get(convoId);
      const messages = messagesData?.messages ?? null;
      const messagesRequestStatus =
        dataLayer.requests.statusStore.$statuses.get(
          "loadConvoMessages-" + convoId,
        );
      const hasMore = !!messagesData?.cursor;
      const isSendingMessage = state.$isSendingMessage.get();
      const isLocked = !!groupDetails && groupDetails.lockStatus !== "unlocked";

      const otherMember = state.$otherMember.get();
      const title = groupDetails
        ? groupDetails.name
        : otherMember
          ? getDisplayName(otherMember)
          : "";
      const subtitle = groupDetails
        ? `${groupDetails.memberCount} ${
            groupDetails.memberCount === 1 ? "member" : "members"
          }`
        : otherMember?.handle
          ? `@${otherMember.handle}`
          : "";

      render(
        html`<div id="chat-detail-view">
          ${mainLayout({
            showSidebarOverlay: false,
            children: html`
              ${headerTemplate({
                avatarTemplate: () => {
                  if (groupDetails) {
                    return "";
                  }
                  return otherMember
                    ? avatarTemplate({ author: otherMember })
                    : "";
                },
                title,
                subtitle,
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
                      loadingEnabled: state.$loadingEnabled.get(),
                      messages,
                      currentUserDid: currentUser?.did,
                      convo,
                      isGroup: !!groupDetails,
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
                <div class="message-input-wrapper">
                  ${isLocked
                    ? html`<div
                        class="chat-locked-notice"
                        data-testid="chat-locked-notice"
                      >
                        ${groupDetails.lockStatus === "locked-permanently"
                          ? "This chat has ended."
                          : "This chat is locked. New messages can't be sent."}
                      </div>`
                    : html`<chat-input
                        @send=${(e) => handleSendMessage(e.detail.message)}
                        @height-change=${handleInputHeightChange}
                        ?disabled=${!messages || isSendingMessage}
                        ?loading=${isSendingMessage}
                      ></chat-input>`}
                </div>
              </main>
            `,
          })}
        </div>`,
        root,
      );
    });

    // Scroll to bottom on initial load
    let initialLoad = true;
    pageEffect(root, () => {
      const messages = dataLayer.derived.$convoMessages.get(convoId);
      const currentUser = dataLayer.derived.$currentUser.get();
      const convo = dataLayer.derived.$convos.get(convoId);
      if (!messages || !currentUser || !convo) {
        return;
      }
      if (initialLoad) {
        initialLoad = false;
        requestAnimationFrame(() => {
          scrollToBottom({ onlyIfNeeded: true });
          // Only enable loading after scroll, otherwise the infinite scroll container will start loading immediately
          state.$loadingEnabled.set(true);
        });
      }
    });

    root.addEventListener("page-enter", async () => {
      dataLayer.declarative.ensureCurrentUser().then(() => {
        messageFetcher.start();
      });
      await dataLayer.declarative.ensureConvo(convoId);
      await loadMessages({ reload: true });
    });

    root.addEventListener("page-restore", async (e) => {
      messageFetcher.start();
      const isBack = e.detail?.isBack ?? false;
      if (!isBack) {
        scrollToBottom();
        await loadMessages({ reload: true });
      }
    });

    root.addEventListener("page-exit", () => {
      messageFetcher.stop();
    });
  }
}

export default new ChatDetailView();
