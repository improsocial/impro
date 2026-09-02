import {
  pageEffect,
  bindPageTitle,
  bindToPage,
  onPageShow,
  onPageHide,
} from "/js/router.js";
import { html, render, ref } from "/js/lib/lit-html.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { richTextTemplate } from "/js/templates/richText.template.js";
import {
  getFacetsFromText,
  getLinkUrlsFromText,
  stripLeadingOrTrailingLink,
} from "/js/facetHelpers.js";
import {
  getDisplayName,
  getGroupConvoDetails,
  hasValidHandle,
  isGroupConvo,
  getSystemMessageDisplayText,
  groupReactions,
} from "/js/dataHelpers.js";
import { parseRecordLink, resolveRecordFromLink } from "/js/embedHelpers.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { avatarGroupTemplate } from "/js/templates/avatarGroup.template.js";
import { verificationBadgeTemplate } from "/js/templates/verificationBadge.template.js";
import { automatedAccountBadgeTemplate } from "/js/templates/automatedAccountBadge.template.js";
import { authorBadgesTemplate } from "/js/templates/labelBadges.template.js";
import {
  postEmbedTemplate,
  recordEmbedTemplate,
} from "/js/templates/postEmbed.template.js";
import { CHAT_MESSAGES_PAGE_SIZE } from "/js/config.js";
import { showToast } from "/js/toasts.js";
import { confirmModal } from "/js/modals/confirm.modal.js";
import {
  wait,
  raf,
  differenceInMinutes,
  formatShortTime,
  isMobileViewport,
  canHover,
  pinScrollPosition,
  isOnlyEmoji,
} from "/js/utils.js";
import { Signal, ReactiveStore } from "/js/signals.js";
import { ApiError } from "/js/api.js";
import {
  getPermalinkForConvo,
  linkToGroupChatDetails,
  linkToProfile,
} from "/js/navigation.js";
import "/js/components/infinite-scroll-container.js";
import "/js/components/chat-input.js";
import "/js/components/emoji-picker-dialog.js";
import "/js/components/reactions-dialog.js";
import "/js/components/reaction-palette.js";
import "/js/components/context-menu.js";
import "/js/components/context-menu-item.js";
import "/js/components/context-menu-item-group.js";
import "/js/components/app-icon.js";
import { tryAgainButtonTemplate } from "/js/templates/tryAgainButton.template.js";
export default async function chatDetailView({
  root,
  params,
  router,
  layout,
  context: {
    auth,
    dataLayer,
    chatNotificationService,
    identityResolver,
    pluginService,
  },
}) {
  await auth.requireAuth();

  const canViewGroupDetails = await auth.hasScope(
    "rpc:chat.bsky.convo.getConvoMembers",
  );

  const convoId = params.convoId;

  const state = new ReactiveStore("chatDetailView");
  state.$loadingEnabled = new Signal.State(false);
  state.$isSendingMessage = new Signal.State(false);
  state.$isMuteSaving = new Signal.State(false);
  state.$activeMessageId = new Signal.State(null);
  state.$paletteMessageId = new Signal.State(null);
  state.$stagedReply = new Signal.State(null);
  // null | { url, record, status: "loading" | "ready" | "error" }
  state.$stagedRecordEmbed = new Signal.State(null);
  const rejectedRecordLinks = new Set();

  function setReply(message) {
    if (!message) return;
    state.$stagedReply.set(message);
    raf().then(() => focusChatInput());
  }

  function clearReply() {
    state.$stagedReply.set(null);
  }

  function handleComposerInput({ text, inputType }) {
    const commit =
      text.endsWith(" ") ||
      text.endsWith("\n") ||
      inputType === "insertFromPaste";
    const urls = getLinkUrlsFromText(text);
    for (const rejectedUrl of rejectedRecordLinks) {
      if (!urls.includes(rejectedUrl)) {
        rejectedRecordLinks.delete(rejectedUrl);
      }
    }
    if (!commit || state.$stagedRecordEmbed.get()) return;
    for (const url of urls) {
      if (rejectedRecordLinks.has(url) || !parseRecordLink(url)) continue;
      state.$stagedRecordEmbed.set({ url, record: null, status: "loading" });
      loadStagedRecordEmbed(url);
      break;
    }
  }

  async function loadStagedRecordEmbed(url) {
    try {
      const record = await resolveRecordFromLink(url, {
        identityResolver,
        dataLayer,
      });
      // the embed may have been removed while the record was loading
      if (state.$stagedRecordEmbed.get()?.url !== url) return;
      state.$stagedRecordEmbed.set({ url, record, status: "ready" });
    } catch (error) {
      console.warn("Error loading record embed from link: ", error);
      if (state.$stagedRecordEmbed.get()?.url === url) {
        state.$stagedRecordEmbed.set({ url, record: null, status: "error" });
      }
    }
  }

  function clearStagedRecordEmbed() {
    const staged = state.$stagedRecordEmbed.get();
    if (staged) {
      rejectedRecordLinks.add(staged.url);
    }
    state.$stagedRecordEmbed.set(null);
  }

  function stagedEmbedPreviewTemplate({ staged }) {
    const { record, status } = staged;
    let body;
    if (status === "loading") {
      body = html`<div class="message-embed-preview-pending">
        <div class="loading-spinner"></div>
      </div>`;
    } else if (status === "error") {
      body = html`<div class="message-embed-preview-pending">
        Couldn't load embed
      </div>`;
    } else {
      body = html`<div inert>
        ${recordEmbedTemplate({
          record,
          isAuthenticated: true,
          condensed: true,
          pluginService,
        })}
      </div>`;
    }
    return html`<div
      class="message-embed-preview"
      data-testid="message-embed-preview"
      data-teststate=${status}
    >
      <button
        class="embed-preview-close-button"
        type="button"
        aria-label="Remove embed"
        data-testid="message-embed-preview-remove"
        @click=${() => clearStagedRecordEmbed()}
      >
        <app-icon icon="close-line"></app-icon>
      </button>
      ${body}
    </div>`;
  }

  function messageReplyPreviewTemplate({ staged, senderProfile }) {
    const senderName = senderProfile
      ? getDisplayName(senderProfile)
      : "Unknown";
    const { text: previewText, muted } = getReplyQuotePreviewText(staged);
    return html`<div
      class="message-reply-preview"
      data-testid="message-reply-preview"
    >
      <div class="message-reply-preview-accent" aria-hidden="true"></div>
      <div class="message-reply-preview-content">
        <div
          class="message-reply-preview-sender"
          data-testid="reply-preview-sender"
        >
          Replying to ${senderName}
        </div>
        <div
          class="message-reply-preview-text ${muted
            ? "message-reply-preview-text-muted"
            : ""}"
          data-testid="reply-preview-text"
        >
          ${previewText}
        </div>
      </div>
      <button
        class="message-reply-preview-clear"
        type="button"
        aria-label="Clear reply"
        data-testid="reply-preview-clear"
        @click=${() => clearReply()}
      >
        <app-icon icon="close-line"></app-icon>
      </button>
    </div>`;
  }

  function messageContextMenuTemplate({ message }) {
    return html`
      <context-menu-item
        data-testid="message-action-reply"
        icon="corner-down-right-line"
        @click=${() => setReply(message)}
      >
        Reply
      </context-menu-item>
    `;
  }

  function openMessageContextMenu(event, { message }) {
    const menu = document.createElement("context-menu");
    menu.classList.add("message-context-menu");
    const itemHolder = document.createElement("div");
    render(messageContextMenuTemplate({ message }), itemHolder);
    while (itemHolder.firstChild) menu.appendChild(itemHolder.firstChild);
    document.body.appendChild(menu);
    menu.open(event.clientX, event.clientY);
    // Keep the message marked active while the menu is open so the
    // trigger button doesn't lose :hover visibility behind the modal.
    const previousActiveId = state.$activeMessageId.get();
    state.$activeMessageId.set(message.id);
    menu.querySelector("dialog").addEventListener(
      "close",
      () => {
        menu.remove();
        if (state.$activeMessageId.get() === message.id) {
          state.$activeMessageId.set(previousActiveId);
        }
      },
      { once: true },
    );
  }

  function triggerHighlightAnimation(messageEl) {
    messageEl.classList.remove("message-highlighted");
    // Force a reflow
    void messageEl.offsetWidth;
    messageEl.classList.add("message-highlighted");
    messageEl.addEventListener(
      "animationend",
      () => messageEl.classList.remove("message-highlighted"),
      { once: true },
    );
  }

  function scrollToAndHighlightMessage(messageId) {
    const wrapper = root.querySelector(
      `.message-wrapper[data-message-id="${CSS.escape(messageId)}"]`,
    );
    if (!wrapper) {
      return;
    }
    wrapper.scrollIntoView({ block: "center", behavior: "smooth" });
    triggerHighlightAnimation(wrapper);
  }

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
          const lastMessageBottom = lastMessage.getBoundingClientRect().bottom;
          const scrollerBottom = scroller.getBoundingClientRect().bottom;
          if (lastMessageBottom <= scrollerBottom) {
            return;
          }
        }
      }
    }
    scroller.scrollTop = scroller.scrollHeight;
  }

  // Scroll to bottom, re-forcing it every frame for the duration so late
  // layout shifts (images, fonts, embeds) can't leave the view short
  function pinScrollToBottom({ durationMs = 1000 } = {}) {
    const scroller = getMessageScroller();
    if (!scroller) {
      return;
    }
    pinScrollPosition({
      targetY: () => scroller.scrollHeight - scroller.clientHeight,
      durationMs,
      scroller,
      // If the position moved above where we last pinned it, the user
      // (or other code, e.g. a reply-jump scrollIntoView) scrolled up -
      // stop fighting them
      shouldStop: (currentY, lastPinnedY) =>
        lastPinnedY !== null && currentY < lastPinnedY - 1,
    });
  }

  function isScrolledToBottom() {
    const scroller = getMessageScroller();
    if (!scroller) {
      return false;
    }
    return (
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <= 60
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

  function clearMessageSelection() {
    state.$activeMessageId.set(null);
    state.$paletteMessageId.set(null);
  }

  function getMessage(messageId) {
    return dataLayer.derived.$hydratedConvoMessages
      .get(convoId)
      ?.messages.find((message) => message.id === messageId);
  }

  const EMOJI_REACTION_LIMIT = 5;

  function getUserDistinctReactionValues(message, currentUserDid) {
    const values = new Set();
    for (const reaction of message.reactions || []) {
      if (reaction.sender.did === currentUserDid) {
        values.add(reaction.value);
      }
    }
    return values;
  }

  function hasAlreadyReacted(message, currentUserDid, emoji) {
    return (message.reactions || []).some(
      (reaction) =>
        reaction.sender.did === currentUserDid && reaction.value === emoji,
    );
  }

  function hasReachedReactionLimit(message, currentUserDid) {
    return (
      getUserDistinctReactionValues(message, currentUserDid).size >=
      EMOJI_REACTION_LIMIT
    );
  }

  async function handleEmojiSelect(emoji, messageId, currentUserDid) {
    const message = getMessage(messageId);
    if (
      message &&
      !hasAlreadyReacted(message, currentUserDid, emoji) &&
      hasReachedReactionLimit(message, currentUserDid)
    ) {
      showToast(
        `You cannot add more than ${EMOJI_REACTION_LIMIT} emoji reactions`,
        { style: "info" },
      );
      return;
    }
    try {
      await dataLayer.mutations.addMessageReaction(convoId, messageId, emoji);
      clearMessageSelection();
    } catch (error) {
      console.error(error);
      showToast("Failed to add emoji reaction", { style: "error" });
    }
  }

  async function handleReactionRemove(emoji, messageId) {
    try {
      await dataLayer.mutations.removeMessageReaction(
        convoId,
        messageId,
        emoji,
      );
    } catch (error) {
      console.error(error);
      showToast("Failed to remove emoji reaction", { style: "error" });
    }
  }

  function openReactionsDialog(messageId, currentUserDid) {
    if (document.querySelector("reactions-dialog")) return;
    const dialog = document.createElement("reactions-dialog");
    dialog.messageId = messageId;
    dialog.convoId = convoId;
    dialog.currentUserDid = currentUserDid;
    dialog.dataLayer = dataLayer;
    dialog.addEventListener("close", () => dialog.remove());
    dialog.addEventListener("remove-reaction", (event) =>
      handleReactionRemove(event.detail.emoji, messageId),
    );
    document.body.appendChild(dialog);
    dialog.open();
  }

  function handleMessageClick(messageId) {
    if (!isMobileViewport() && canHover()) {
      return;
    }
    const current = state.$activeMessageId.get();
    if (current === messageId) {
      clearMessageSelection();
    } else {
      state.$activeMessageId.set(messageId);
    }
  }

  // Clear the active message when the click lands outside any message wrapper
  function handleActiveOutsideClick(event) {
    if (state.$activeMessageId.get() === null) return;
    if (event.target.closest(".message-wrapper")) return;
    state.$activeMessageId.set(null);
  }

  let paletteTriggerEl = null;

  function handleEmojiTriggerClick(event, messageId) {
    const current = state.$paletteMessageId.get();
    state.$activeMessageId.set(messageId);
    const next = current === messageId ? null : messageId;
    state.$paletteMessageId.set(next);
    paletteTriggerEl = next === null ? null : event.currentTarget;
  }

  function closePalette(reason) {
    if (reason === "escape") {
      const toRestore = paletteTriggerEl;
      paletteTriggerEl = null;
      clearMessageSelection();
      if (toRestore && document.contains(toRestore)) {
        toRestore.focus({ preventScroll: true });
      }
      return;
    }
    paletteTriggerEl = null;
    state.$paletteMessageId.set(null);
  }

  async function handleSendMessage(messageText, onSuccess) {
    state.$isSendingMessage.set(true);
    const stagedReply = state.$stagedReply.get();
    try {
      const staged = state.$stagedRecordEmbed.get();
      let text = messageText;
      let embed = null;
      if (staged) {
        let record = staged.record;
        if (!record) {
          try {
            record = await resolveRecordFromLink(staged.url, {
              identityResolver,
              dataLayer,
            });
          } catch (error) {
            console.warn("Error resolving record embed at send: ", error);
          }
        }
        if (record) {
          text = stripLeadingOrTrailingLink(text, staged.url);
          embed = {
            $type: "app.bsky.embed.record",
            record: { uri: record.uri, cid: record.cid },
          };
        } else if (!text.trim()) {
          showToast("Couldn't load embed", { style: "error" });
          return;
        }
      }
      const facets = await getFacetsFromText(text, identityResolver);
      await dataLayer.mutations.createMessage(convoId, {
        text,
        facets,
        replyTo: stagedReply ? { messageId: stagedReply.id } : null,
        embed,
      });
      state.$stagedReply.set(null);
      state.$stagedRecordEmbed.set(null);
      rejectedRecordLinks.clear();
      onSuccess();
      await raf();
      await raf();
      scrollToBottom();
    } catch (error) {
      console.error(error);
      const serverMessage = error?.data?.message ?? error?.message ?? "";
      const errorMessage = /block between recipient and sender/i.test(
        serverMessage,
      )
        ? "Can't send: block between you and recipient"
        : "Failed to send message";
      showToast(errorMessage, { style: "error" });
    } finally {
      state.$isSendingMessage.set(false);
      await raf();
      focusChatInput();
    }
  }

  async function handleToggleMute(convo, muted) {
    state.$isMuteSaving.set(true);
    try {
      await dataLayer.mutations.setConvoMuted(convo, muted);
      showToast(muted ? "Conversation muted" : "Conversation unmuted");
    } catch (err) {
      console.error(err);
      showToast(
        muted ? "Failed to mute conversation" : "Failed to unmute conversation",
        { style: "error" },
      );
    } finally {
      state.$isMuteSaving.set(false);
    }
  }

  async function handleLeave(convo) {
    const didLeave = await confirmModal(
      "Are you sure you want to leave this conversation? It will be removed from your inbox.",
      {
        title: "Leave conversation",
        confirmButtonText: "Leave conversation",
        confirmButtonStyle: "danger",
        pendingText: "Leaving",
        onConfirm: async () => {
          try {
            await dataLayer.mutations.leaveConvo(convo);
          } catch (err) {
            if (err instanceof ApiError && err.data?.error === "InvalidConvo") {
              showToast("Conversation not found.", { style: "error" });
              throw err;
            }
            console.error(err);
            showToast("Could not leave conversation", { style: "error" });
            throw err;
          }
        },
      },
    );
    if (didLeave) {
      router.go("/messages");
      showToast("Left conversation");
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
        differenceInMinutes(currentGroup.lastSentAt, message.sentAt) > 5 ||
        message.replyTo
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

  function reactionBubblesTemplate({
    message,
    isCurrentUser,
    currentUserDid,
    isGroup,
    convo,
  }) {
    const reactions = message.reactions || [];
    if (reactions.length === 0) {
      return "";
    }
    const groupedReactions = groupReactions(reactions);
    const selfReacted = reactions.some(
      (reaction) => reaction.sender.did === currentUserDid,
    );
    const showTotalCount =
      reactions.length > 1 &&
      (groupedReactions.length !== reactions.length ||
        groupedReactions.length > 10);

    function describeReactions() {
      if (reactions.length === 1) {
        const [reaction] = reactions;
        if (reaction.sender.did === currentUserDid) {
          return `You reacted ${reaction.value}`;
        }
        const profile = getMemberProfile(convo, reaction.sender.did);
        return `${profile ? getDisplayName(profile) : "Someone"} reacted ${reaction.value}`;
      }
      const senderCount = new Set(
        reactions.map((reaction) => reaction.sender.did),
      ).size;
      return `${senderCount === 1 ? "1 person" : `${senderCount} people`} reacted – ${groupedReactions
        .map((group) => group.value)
        .join(" ")}`;
    }

    return html`
      <div
        class="message-reactions ${isCurrentUser
          ? "message-reactions-sent"
          : "message-reactions-received"} ${selfReacted
          ? "message-reactions-own"
          : ""} ${isGroup ? "" : "message-reactions-static"}"
        data-testid="message-reactions"
        data-teststate=${selfReacted ? "own" : "other"}
        @click=${(e) => {
          if (!isGroup) return;
          e.stopPropagation();
          openReactionsDialog(message.id, currentUserDid);
        }}
        aria-label=${isGroup
          ? `${describeReactions()}. Tap to view reactions`
          : describeReactions()}
      >
        ${groupedReactions.slice(0, 10).map((group) => {
          const isOwnReaction = group.senders.some(
            (sender) => sender.did === currentUserDid,
          );
          return html`
            <span
              class="reaction-bubble ${isOwnReaction
                ? "reaction-bubble-own"
                : ""}"
              data-testid="reaction-bubble"
              data-teststate=${isOwnReaction ? "own" : "other"}
            >
              <span class="reaction-emoji">${group.value}</span>
            </span>
          `;
        })}
        ${showTotalCount
          ? html`<span class="reaction-count">${reactions.length}</span>`
          : ""}
      </div>
    `;
  }

  function reactionPaletteTemplate({ message, currentUserDid }) {
    const ownReactions = [
      ...getUserDistinctReactionValues(message, currentUserDid),
    ];
    return html`
      <reaction-palette
        .ownReactions=${ownReactions}
        @select=${(event) =>
          handleEmojiSelect(event.detail.emoji, message.id, currentUserDid)}
        @remove-reaction=${(event) => {
          handleReactionRemove(event.detail.emoji, message.id);
          clearMessageSelection();
        }}
        @close=${(event) => closePalette(event.detail.reason)}
      ></reaction-palette>
    `;
  }

  function getReplyQuotePreviewText(replyTo) {
    const text = replyTo?.text;
    if (text && text.trim()) {
      return { text, muted: false };
    }
    const embedType = replyTo?.embed?.$type;
    if (embedType === "app.bsky.embed.record#view") {
      return { text: "(quoted post)", muted: true };
    }
    if (embedType === "chat.bsky.embed.joinLink#view") {
      return { text: "(chat invite link)", muted: true };
    }
    return { text: "No text", muted: true };
  }

  function messageReplyQuoteTemplate({
    replyTo,
    senderProfile,
    isCurrentUser,
  }) {
    if (!replyTo) return null;
    const { text, muted } = getReplyQuotePreviewText(replyTo);
    const senderName = senderProfile
      ? getDisplayName(senderProfile)
      : "Unknown";
    return html`<div
      class="message-reply-quote ${isCurrentUser
        ? "message-reply-quote-sent"
        : "message-reply-quote-received"}"
      data-testid="message-reply-quote"
      @click=${(event) => {
        event.stopPropagation();
        scrollToAndHighlightMessage(replyTo.id);
      }}
    >
      <div class="message-reply-quote-sender" data-testid="reply-quote-sender">
        ${senderName}
      </div>
      <div
        class="message-reply-quote-text ${muted
          ? "message-reply-quote-text-muted"
          : ""}"
        data-testid="reply-quote-text"
      >
        ${text}
      </div>
    </div>`;
  }

  function messageReplyCaptionTemplate({
    replyTo,
    replierProfile,
    originalSenderProfile,
    isCurrentUserReplier,
    isOriginalSenderCurrentUser,
  }) {
    const originalName = isOriginalSenderCurrentUser
      ? isCurrentUserReplier
        ? "yourself"
        : "you"
      : originalSenderProfile
        ? getDisplayName(originalSenderProfile)
        : "someone";
    const captionText = isCurrentUserReplier
      ? `You replied to ${originalName}`
      : `${
          replierProfile ? getDisplayName(replierProfile) : "Someone"
        } replied to ${originalName}`;
    return html`<div
      class="message-reply-caption ${isCurrentUserReplier
        ? "message-reply-caption-sent"
        : "message-reply-caption-received"}"
      data-testid="message-reply-caption"
      @click=${(event) => {
        event.stopPropagation();
        scrollToAndHighlightMessage(replyTo.id);
      }}
    >
      <span class="message-reply-caption-arrow" aria-hidden="true"
        ><app-icon icon="corner-down-right-line"></app-icon
      ></span>
      <span>${captionText}</span>
    </div>`;
  }

  function isEmojiOnlyMessage(message) {
    return isOnlyEmoji(message?.text ?? "") && !message?.facets?.length;
  }

  function messageTemplate({
    message,
    isCurrentUser,
    currentUserDid,
    showAvatar,
    author,
    isActive,
    isPaletteOpen,
    isGroup,
    canReactNow,
    convo,
  }) {
    const replyTo = message.replyTo;
    const replySenderProfile =
      replyTo && replyTo.sender
        ? getMemberProfile(convo, replyTo.sender.did)
        : null;
    const isEmojiOnly = isEmojiOnlyMessage(message);
    return html`
      <div
        class="message-wrapper ${isActive ? "message-wrapper-active" : ""}"
        data-message-id=${message.id}
      >
        <div
          @click=${() => handleMessageClick(message.id)}
          class="message ${isCurrentUser ? "message-sent" : "message-received"}"
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
          <div class="message-content">
            ${message.embed
              ? html`<div class="message-embed">
                  ${postEmbedTemplate({
                    embed: message.embed,
                    isAuthenticated: true,
                    currentConvoId: convoId,
                    pluginService,
                  })}
                </div>`
              : null}
            ${message.text
              ? html`<div
                  class="message-bubble ${isEmojiOnly
                    ? "message-bubble-emoji-only"
                    : ""}"
                >
                  ${replyTo && !isEmojiOnly
                    ? messageReplyQuoteTemplate({
                        replyTo,
                        senderProfile: replySenderProfile,
                        isCurrentUser,
                      })
                    : null}
                  <div class="message-text">
                    ${richTextTemplate({
                      text: message.text,
                      facets: message.facets,
                      truncateUrls: true,
                    })}
                  </div>
                </div>`
              : null}
            ${reactionBubblesTemplate({
              message,
              isCurrentUser,
              currentUserDid,
              isGroup,
              convo,
            })}
          </div>
          ${canReactNow
            ? html`<div class="message-actions">
                <button
                  class="message-emoji-trigger"
                  aria-label="React to message"
                  data-testid="message-emoji-trigger"
                  @click=${(e) => {
                    e.stopPropagation();
                    handleEmojiTriggerClick(e, message.id);
                  }}
                >
                  <app-icon icon="emoji-smile-line"></app-icon>
                </button>
                <button
                  class="message-more-trigger"
                  aria-label="Message actions"
                  data-testid="message-more-trigger"
                  @click=${(e) => {
                    e.stopPropagation();
                    openMessageContextMenu(e, { message });
                  }}
                >
                  <span>...</span>
                </button>
              </div>`
            : ""}
        </div>
        ${isPaletteOpen
          ? reactionPaletteTemplate({ message, currentUserDid })
          : ""}
      </div>
    `;
  }

  function systemMessageTemplate({ message, convo }) {
    const memberDid = message.data?.member?.did;
    const memberProfile = memberDid ? getMemberProfile(convo, memberDid) : null;
    const memberName = memberProfile ? getDisplayName(memberProfile) : null;
    return html`
      <div class="system-message" data-testid="system-message">
        ${getSystemMessageDisplayText(message, { memberName })}
      </div>
    `;
  }

  function messageGroupTemplate({
    group,
    convo,
    isGroup,
    currentUserDid,
    canReactNow,
  }) {
    const author = group.isCurrentUser
      ? null
      : getMemberProfile(convo, group.senderDid);
    const leadingReplyTo = group.messages[0]?.replyTo ?? null;
    const isLeadingEmojiOnly = isEmojiOnlyMessage(group.messages[0]);
    const replierProfile = group.isCurrentUser
      ? null
      : getMemberProfile(convo, group.senderDid);
    const originalSenderProfile =
      leadingReplyTo && leadingReplyTo.sender
        ? getMemberProfile(convo, leadingReplyTo.sender.did)
        : null;
    return html`
      <div
        class="message-group ${group.isCurrentUser
          ? "message-group-sent"
          : "message-group-received"}"
      >
        ${leadingReplyTo
          ? messageReplyCaptionTemplate({
              replyTo: leadingReplyTo,
              replierProfile,
              originalSenderProfile,
              isCurrentUserReplier: group.isCurrentUser,
              isOriginalSenderCurrentUser:
                leadingReplyTo.sender?.did === currentUserDid,
            })
          : ""}
        ${isGroup &&
        !group.isCurrentUser &&
        !leadingReplyTo &&
        !isLeadingEmojiOnly
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
            isActive: state.$activeMessageId.get() === message.id,
            isPaletteOpen: state.$paletteMessageId.get() === message.id,
            isGroup,
            canReactNow,
            convo,
          }),
        )}
        <div
          class="message-group-time ${group.isCurrentUser
            ? "message-group-time-sent"
            : "message-group-time-received"}"
        >
          ${formatShortTime(group.lastSentAt)}
        </div>
      </div>
    `;
  }

  function messageDayTitleTemplate({ date, startTime }) {
    const isToday = isSameDate(date, new Date());
    return html`<div class="message-day-title">
      <strong>${isToday ? "Today" : getDayOfWeek(date)}</strong> at
      ${formatShortTime(startTime)}
    </div>`;
  }

  function directInfoPanelTemplate({ profile }) {
    const isFollowedBy =
      !!profile.viewer?.followedBy &&
      !profile.viewer?.blocking &&
      !profile.viewer?.blockedBy;
    return html`<div class="chat-info-panel" data-testid="chat-info-panel">
      ${avatarTemplate({ author: profile })}
      <div class="chat-info-panel-name">
        ${getDisplayName(profile)}${verificationBadgeTemplate({
          profile,
        })}${automatedAccountBadgeTemplate({ profile })}
      </div>
      ${hasValidHandle(profile)
        ? html`<div class="chat-info-panel-handle">@${profile.handle}</div>`
        : ""}
      ${isFollowedBy
        ? html`<div class="profile-follows-you" data-testid="follows-you-badge">
            Follows you
          </div>`
        : ""}
      ${authorBadgesTemplate({
        badgeLabels: profile.badgeLabels,
        did: profile.did,
        pluginService,
      })}
      <a
        class="rounded-button chat-info-panel-go-to-profile-button"
        data-testid="chat-info-panel-go-to-profile"
        href="${linkToProfile(profile)}"
      >
        Go to profile
      </a>
    </div>`;
  }

  function getNewGroupChatDescription({ otherMembers, memberCount }) {
    const names = otherMembers.map((member) => getDisplayName(member));
    if (names.length === 0) {
      return "New group chat.";
    }
    if (names.length === 1) {
      return `New chat with ${names[0]}.`;
    }
    // memberCount includes the current user, so subtract them plus the
    // two named members
    const remainingCount = memberCount - 3;
    if (remainingCount > 0) {
      return `New chat with ${names[0]}, ${names[1]}, and ${remainingCount} more.`;
    }
    return `New chat with ${names[0]} and ${names[1]}.`;
  }

  function groupInfoPanelTemplate({ convo, groupDetails, currentUserDid }) {
    const otherMembers = convo.members.filter(
      (member) => member.did !== currentUserDid,
    );
    return html`<div class="chat-info-panel" data-testid="chat-info-panel">
      <div class="chat-info-panel-avatars">
        ${avatarGroupTemplate({ authors: otherMembers })}
      </div>
      ${groupDetails.name
        ? html`<div class="chat-info-panel-name">${groupDetails.name}</div>`
        : ""}
      <div class="chat-info-panel-handle">
        ${getNewGroupChatDescription({
          otherMembers,
          memberCount: groupDetails.memberCount,
        })}
      </div>
    </div>`;
  }

  function chatInfoPanelTemplate({ convo, isGroup, currentUserDid }) {
    if (!convo) {
      return null;
    }
    if (isGroup) {
      return groupInfoPanelTemplate({
        convo,
        groupDetails: getGroupConvoDetails(convo),
        currentUserDid,
      });
    }
    const otherMember = convo.members.find(
      (member) => member.did !== currentUserDid,
    );
    if (!otherMember) {
      return null;
    }
    const profile = getMemberProfile(convo, otherMember.did) ?? otherMember;
    return directInfoPanelTemplate({ profile });
  }

  function chatEmptyTemplate({ convo, isGroup, currentUserDid }) {
    const infoPanel = chatInfoPanelTemplate({
      convo,
      isGroup,
      currentUserDid,
    });
    return html`<div class="chat-detail-empty">
      ${infoPanel ?? html`<div>No messages yet!</div>`}
    </div>`;
  }

  function messagesTemplate({
    loadingEnabled,
    messages,
    currentUserDid,
    convo,
    isGroup,
    hasMore,
    canReactNow,
  }) {
    if (!messages || messages.length === 0) {
      return chatEmptyTemplate({ convo, isGroup, currentUserDid });
    }
    const reversedMessages = messages.toReversed();
    const messageGroups = groupMessages(reversedMessages, currentUserDid);
    const days = groupMessageGroupsByDay(messageGroups);
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
            // In a short chat the top sentinel is visible while the user
            // sits at the bottom; when the fetch inserts the info panel
            // above, keep them pinned to the bottom instead of restoring
            // a stale offset
            const shouldStickToBottom = isScrolledToBottom();
            // Maintain scroll position using scrollHeight difference
            const previousScrollHeight = scrollContainer.scrollHeight;
            const previousScrollTop = scrollContainer.scrollTop;
            await loadMessages();
            await raf();
            await raf();
            if (shouldStickToBottom) {
              pinScrollToBottom();
            } else {
              // Restore scroll position
              const newScrollHeight = scrollContainer.scrollHeight;
              const heightDifference = newScrollHeight - previousScrollHeight;
              scrollContainer.scrollTop = previousScrollTop + heightDifference;
            }
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
        ${hasMore
          ? ""
          : chatInfoPanelTemplate({ convo, isGroup, currentUserDid })}
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
                      canReactNow,
                    }),
              )}
            </div>`;
          })}
        </div>
      </infinite-scroll-container>
    `;
  }

  function messagesErrorTemplate({ error }) {
    if (error instanceof ApiError && error.data?.error === "InvalidConvo") {
      return html`<div class="error-state" data-testid="convo-not-found">
        <h3>Not Found</h3>
        <div>Conversation not found</div>
        ${tryAgainButtonTemplate()}
      </div>`;
    }
    console.error(error);
    return html`<div class="error-state" data-testid="messages-error">
      <div>There was an error loading messages.</div>
      ${tryAgainButtonTemplate()}
    </div>`;
  }

  async function loadMessages({ reload = false } = {}) {
    await dataLayer.requests.loadConvoMessages(convoId, {
      reload,
      limit: CHAT_MESSAGES_PAGE_SIZE,
    });
  }

  function getOtherMember(currentUser, convo) {
    if (!currentUser || !convo) {
      return null;
    }
    if (isGroupConvo(convo)) {
      return null;
    }
    return convo.members.find((member) => member.did !== currentUser?.did);
  }

  bindPageTitle(root, () => "Chat");

  pageEffect(root, () => {
    const currentUser = dataLayer.derived.$currentUser.get();
    const convo = dataLayer.derived.$convos.get(convoId);
    const groupDetails = convo ? getGroupConvoDetails(convo) : null;
    const messagesData = dataLayer.derived.$hydratedConvoMessages.get(convoId);
    const messages = messagesData?.messages ?? null;
    const convoRequestStatus = dataLayer.requests.statusStore.$statuses.get(
      "loadConvo-" + convoId,
    );
    const messagesRequestStatus = dataLayer.requests.statusStore.$statuses.get(
      "loadConvoMessages-" + convoId,
    );
    const requestError =
      convoRequestStatus.error || messagesRequestStatus.error;
    const hasMore = !!messagesData?.cursor;
    const isSendingMessage = state.$isSendingMessage.get();
    const isMuteSaving = state.$isMuteSaving.get();
    const isLocked = !!groupDetails && groupDetails.lockStatus !== "unlocked";
    const canReactNow = !!convo && convo.status !== "disabled" && !isLocked;
    const convoPermalink = getPermalinkForConvo(convoId);
    const stagedReply = state.$stagedReply.get();
    const stagedRecordEmbed = state.$stagedRecordEmbed.get();
    const stagedReplySenderProfile =
      stagedReply && stagedReply.sender
        ? getMemberProfile(convo, stagedReply.sender.did)
        : null;
    const otherMember =
      !groupDetails && convo ? getOtherMember(currentUser, convo) : null;
    let title = "";
    let subtitle = "";
    if (groupDetails) {
      title = groupDetails.name;
      subtitle = `${groupDetails.memberCount} ${
        groupDetails.memberCount === 1 ? "member" : "members"
      }`;
    } else if (otherMember) {
      title = getDisplayName(otherMember);
      subtitle = otherMember?.handle ? `@${otherMember.handle}` : "";
    }

    render(
      html`<div id="chat-detail-view">
        ${headerTemplate({
          avatarTemplate: () => {
            if (groupDetails) {
              const otherMembers = convo.members.filter(
                (member) => member.did !== currentUser?.did,
              );
              return avatarGroupTemplate({ authors: otherMembers });
            }
            const otherMember = getOtherMember(currentUser, convo);
            return otherMember ? avatarTemplate({ author: otherMember }) : "";
          },
          title,
          subtitle,
          titleRightItemTemplate: convo?.muted
            ? () =>
                html`<app-icon
                  class="header-title-muted-icon"
                  icon="bell-off"
                  data-testid="header-muted-icon"
                ></app-icon>`
            : null,
          titleHref:
            groupDetails && canViewGroupDetails
              ? linkToGroupChatDetails(convoId)
              : null,
          backButtonFallbackRoute: "/messages",
          rightItemTemplate: () => html`
            <button
              class="context-menu-button"
              data-testid="chat-menu-button"
              @click=${function (e) {
                const contextMenu = this.nextElementSibling;
                contextMenu.open(e.clientX, e.clientY);
              }}
            >
              <span>...</span>
            </button>
            <context-menu>
              <context-menu-item
                data-testid="menu-action-chat-open-in-bsky"
                icon="open-line"
                @click=${() => {
                  window.open(convoPermalink, "_blank");
                }}
              >
                Open in bsky.app
              </context-menu-item>
              ${groupDetails && canViewGroupDetails
                ? html`<context-menu-item
                    data-testid="menu-action-group-chat-details"
                    icon="settings-cog-line"
                    @click=${() => {
                      router.go(linkToGroupChatDetails(convoId));
                    }}
                  >
                    Group chat settings
                  </context-menu-item>`
                : ""}
              ${convo && !groupDetails
                ? html`
                    <context-menu-item-group>
                      ${otherMember
                        ? html`<context-menu-item
                            data-testid="menu-action-go-to-profile"
                            icon="user-line"
                            @click=${() => {
                              router.go(linkToProfile(otherMember));
                            }}
                          >
                            Go to profile
                          </context-menu-item>`
                        : ""}
                      <context-menu-item
                        data-testid="menu-action-mute"
                        data-teststate=${convo.muted ? "muted" : "unmuted"}
                        icon=${convo.muted ? "bell-line" : "bell-off-line"}
                        ?disabled=${isMuteSaving}
                        @click=${() => handleToggleMute(convo, !convo.muted)}
                      >
                        ${convo.muted
                          ? "Unmute conversation"
                          : "Mute conversation"}
                      </context-menu-item>
                    </context-menu-item-group>
                    <context-menu-item
                      data-testid="menu-action-leave"
                      icon="door-exit-line"
                      item-style="danger"
                      @click=${() => handleLeave(convo)}
                    >
                      Leave conversation
                    </context-menu-item>
                  `
                : ""}
            </context-menu>
          `,
        })}
        <main class="chat-detail-main">
          ${requestError
            ? messagesErrorTemplate({
                error: requestError,
              })
            : messages
              ? messagesTemplate({
                  loadingEnabled: state.$loadingEnabled.get(),
                  messages,
                  currentUserDid: currentUser?.did,
                  convo,
                  isGroup: !!groupDetails,
                  hasMore,
                  canReactNow,
                })
              : html`<div
                  class="loading-spinner-container"
                  style="padding-top: 16px;"
                >
                  <div class="loading-spinner"></div>
                </div>`}
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
              : html`
                  ${stagedReply
                    ? messageReplyPreviewTemplate({
                        staged: stagedReply,
                        senderProfile: stagedReplySenderProfile,
                      })
                    : ""}
                  ${stagedRecordEmbed
                    ? stagedEmbedPreviewTemplate({
                        staged: stagedRecordEmbed,
                      })
                    : ""}
                  <chat-input
                    @send=${(e) =>
                      handleSendMessage(e.detail.message, e.detail.onSuccess)}
                    @input-change=${(e) => handleComposerInput(e.detail)}
                    @height-change=${handleInputHeightChange}
                    ?has-embed=${!!stagedRecordEmbed}
                    ?disabled=${!messages || isSendingMessage}
                    ?loading=${isSendingMessage}
                  ></chat-input>
                `}
          </div>
        </main>
      </div>`,
      root,
    );
  });

  // Scroll to bottom on initial load, and stay scrolled when
  // new messages arrive (if the user is already at the bottom)
  let initialLoad = true;
  let newestMessageId = null;
  pageEffect(root, () => {
    const messagesData = dataLayer.derived.$hydratedConvoMessages.get(convoId);
    const currentUser = dataLayer.derived.$currentUser.get();
    const convo = dataLayer.derived.$convos.get(convoId);
    if (!messagesData || !currentUser || !convo) {
      return;
    }
    // Messages are stored newest-first
    const latestMessageId = messagesData.messages?.[0]?.id ?? null;
    if (initialLoad) {
      initialLoad = false;
      newestMessageId = latestMessageId;
      requestAnimationFrame(() => {
        pinScrollToBottom();
        // Only enable loading after scroll, otherwise the infinite scroll container will start loading immediately
        state.$loadingEnabled.set(true);
      });
      return;
    }
    if (latestMessageId !== newestMessageId) {
      newestMessageId = latestMessageId;
      if (wasAtBottom) {
        requestAnimationFrame(() => {
          scrollToBottom();
        });
      }
    }
  });

  // Timestamp of the latest (non-current-user) message
  const $latestMessageTimestamp = new Signal.Computed(() => {
    const currentUser = dataLayer.derived.$currentUser.get();
    const messagesData = dataLayer.derived.$hydratedConvoMessages.get(convoId);
    const messages = messagesData?.messages ?? null;
    if (!messages || !currentUser) {
      return null;
    }
    const otherMessages = messages.filter(
      (message) => message.sender?.did !== currentUser.did,
    );
    if (!otherMessages.length) {
      return null;
    }
    // Messages are ordered newest -> oldest
    return otherMessages[0].sentAt;
  });

  // Clear the staged reply and record embed if the conversation becomes
  // locked or disabled (e.g. a lock-status change arrives while the user
  // is composing).
  pageEffect(root, () => {
    if (!state.$stagedReply.get() && !state.$stagedRecordEmbed.get()) return;
    const convo = dataLayer.derived.$convos.get(convoId);
    const groupDetails = convo ? getGroupConvoDetails(convo) : null;
    const isLocked = !!groupDetails && groupDetails.lockStatus !== "unlocked";
    if (isLocked || convo?.status === "disabled") {
      state.$stagedReply.set(null);
      state.$stagedRecordEmbed.set(null);
    }
  });

  // Mark messages as read when new messages are loaded
  pageEffect(root, () => {
    const latestMessageTimestamp = $latestMessageTimestamp.get();
    if (!latestMessageTimestamp) return;
    const convo = dataLayer.derived.$convos.get(convoId);
    if (!convo?.unreadCount) return;
    dataLayer.mutations.markConvoAsRead(convoId);
    chatNotificationService?.markNotificationsAsReadForConvo(convoId, {
      isRequest: convo.status === "request",
    });
  });

  async function loadPageData() {
    await dataLayer.declarative.ensureConvo(convoId);
    await loadMessages({ reload: true });
  }

  onPageShow(root, ({ action, scrollY }) => {
    if (action === "restore") {
      window.scrollTo(0, scrollY);
    } else {
      scrollToBottom();
      loadPageData();
    }
    // The fetcher runs whenever the page is visible, in both restore directions
    messageFetcher.start();
  });

  onPageHide(root, () => {
    messageFetcher.stop();
  });

  bindToPage(root, document, "click", handleActiveOutsideClick);
}
