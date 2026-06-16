import { Component } from "/js/components/component.js";
import { html, render } from "/js/lib/lit-html.js";
import { effect } from "/js/signals.js";
import { ScrollLock } from "/js/scrollLock.js";
import { enableDragToDismiss } from "/js/utils.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { getDisplayName, groupReactions } from "/js/dataHelpers.js";

class ReactionsDialog extends Component {
  connectedCallback() {
    if (this._initialized) return;
    this._initialized = true;
    this.setAttribute("data-dialog-wrapper", "");
    this._activeFilter = "all";
    this.scrollLock = new ScrollLock(this);
    this._dispose = effect(() => {
      this.render();
    });
    requestAnimationFrame(() => {
      const dialog = this.querySelector(".reactions-dialog");
      if (dialog && !dialog.open) {
        dialog.showModal();
        this.scrollLock.lock();
        enableDragToDismiss(dialog, {
          onClose: () => this._close(),
          scrollContainer: this.querySelector(".reactions-list"),
          ignoreTouchTarget: (element) => element.closest("button") !== null,
        });
      }
    });
  }

  disconnectedCallback() {
    if (this._dispose) this._dispose();
    this.scrollLock?.unlock();
  }

  _close() {
    const dialog = this.querySelector(".reactions-dialog");
    if (dialog?.open) dialog.close();
    this.dispatchEvent(new CustomEvent("close"));
  }

  _getMessage() {
    if (!this.dataLayer || !this.convoId || !this.messageId) return null;
    const convoMessages = this.dataLayer.derived.$convoMessages.get(
      this.convoId,
    );
    if (!convoMessages) return null;
    return (
      convoMessages.messages.find((message) => message.id === this.messageId) ??
      null
    );
  }

  _getProfile(did) {
    const profiles = this.dataLayer.derived.$convoProfiles.get(this.convoId);
    return profiles?.find((profile) => profile.did === did) ?? null;
  }

  _onTabClick(filter) {
    this._activeFilter = filter;
    this.render();
    requestAnimationFrame(() => this._scrollActiveTabIntoView());
  }

  _scrollActiveTabIntoView() {
    const active = this.querySelector(
      '[data-testid="reactions-tab"][data-teststate="selected"]',
    );
    if (active && typeof active.scrollIntoView === "function") {
      active.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }

  _onRemoveSelfReaction(emoji) {
    this.dispatchEvent(
      new CustomEvent("remove-reaction", { detail: { emoji } }),
    );
  }

  render() {
    const message = this._getMessage();
    const reactions = message?.reactions || [];

    if (reactions.length === 0) {
      render(html``, this);
      this._close();
      return;
    }

    const groups = groupReactions(reactions);
    if (
      this._activeFilter !== "all" &&
      !groups.some((group) => group.value === this._activeFilter)
    ) {
      this._activeFilter = "all";
    }
    const visibleReactions =
      this._activeFilter === "all"
        ? reactions
        : reactions.filter((reaction) => reaction.value === this._activeFilter);

    render(
      html`
        <dialog
          class="bottom-sheet reactions-dialog"
          data-testid="reactions-dialog"
          @click=${(event) => {
            if (event.target.tagName === "DIALOG") this._close();
          }}
          @cancel=${(event) => {
            event.preventDefault();
            this._close();
          }}
        >
          <div class="reactions-dialog-content">
            <div class="reactions-dialog-header">
              <h2
                class="reactions-dialog-title"
                data-testid="reactions-dialog-title"
              >
                Reactions
              </h2>
              <button
                class="reactions-dialog-close"
                data-testid="reactions-dialog-close"
                aria-label="Close reactions"
                @click=${() => this._close()}
              >
                &times;
              </button>
            </div>
            <div
              class="reactions-tabs"
              role="tablist"
              data-testid="reactions-tabs"
            >
              <button
                role="tab"
                class="reactions-tab ${this._activeFilter === "all"
                  ? "reactions-tab-selected"
                  : ""}"
                data-testid="reactions-tab"
                data-teststate=${this._activeFilter === "all"
                  ? "selected"
                  : "default"}
                aria-selected=${this._activeFilter === "all" ? "true" : "false"}
                @click=${() => this._onTabClick("all")}
              >
                All ${reactions.length}
              </button>
              ${groups.map(
                (group) => html`
                  <button
                    role="tab"
                    class="reactions-tab ${this._activeFilter === group.value
                      ? "reactions-tab-selected"
                      : ""}"
                    data-testid="reactions-tab"
                    data-teststate=${this._activeFilter === group.value
                      ? "selected"
                      : "default"}
                    aria-selected=${this._activeFilter === group.value
                      ? "true"
                      : "false"}
                    @click=${() => this._onTabClick(group.value)}
                  >
                    <span class="reactions-tab-emoji">${group.value}</span>
                    <span class="reactions-tab-count">${group.count}</span>
                  </button>
                `,
              )}
            </div>
            <ul class="reactions-list">
              ${visibleReactions.map((reaction) => {
                const profile = this._getProfile(reaction.sender.did);
                const isSelf = reaction.sender.did === this.currentUserDid;
                const displayName = profile
                  ? getDisplayName(profile)
                  : "Someone";
                const handle = profile?.handle ? `@${profile.handle}` : "";
                return html`
                  <li>
                    <button
                      class="reaction-row ${isSelf ? "reaction-row-own" : ""}"
                      data-testid="reaction-row"
                      data-teststate=${isSelf ? "own" : "other"}
                      ?disabled=${!isSelf}
                      aria-label=${isSelf
                        ? `Tap to remove your ${reaction.value} reaction`
                        : `${displayName} reacted ${reaction.value}`}
                      @click=${() => {
                        if (isSelf) this._onRemoveSelfReaction(reaction.value);
                      }}
                    >
                      <div class="reaction-row-avatar">
                        ${profile
                          ? avatarTemplate({
                              author: profile,
                              clickAction: "none",
                            })
                          : html`<div class="avatar-placeholder"></div>`}
                      </div>
                      <div class="reaction-row-info">
                        <div class="reaction-row-name">${displayName}</div>
                        <div class="reaction-row-handle">
                          ${isSelf ? "Tap to remove" : handle}
                        </div>
                      </div>
                      <div class="reaction-row-emoji">${reaction.value}</div>
                    </button>
                  </li>
                `;
              })}
            </ul>
          </div>
        </dialog>
      `,
      this,
    );
  }
}

ReactionsDialog.register();
