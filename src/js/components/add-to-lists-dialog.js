import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { scrollLocks } from "/js/scrollLocks.js";
import { closeWithAnimation } from "/js/dialogHelpers.js";
import { enableDragToDismiss } from "/js/dragHelpers.js";
import { SignalSet, ReactiveStore, effect } from "/js/signals.js";
import { cdnImageUrl, isModerationList } from "/js/dataHelpers.js";
import { closeIconTemplate } from "/js/templates/icons/closeIcon.template.js";
import "/js/components/infinite-scroll-container.js";

class AddToListsDialog extends Component {
  connectedCallback() {
    if (this.initialized) {
      return;
    }
    this.setAttribute("data-dialog-wrapper", "");
    this.scrollLock = null;
    this.state = new ReactiveStore("add-to-lists-dialog");
    this.state.$pendingByListUri = new SignalSet();
    this.innerHTML = "";
    this._disposeEffect = effect(() => {
      this.render();
    });
    this._load();
    this.initialized = true;
  }

  disconnectedCallback() {
    this._disposeEffect?.();
    this._disposeEffect = null;
  }

  async _load() {
    try {
      await this.dataLayer.requests.loadListsWithMembershipForActor(
        {
          did: this.profile.did,
        },
        { reload: true },
      );
    } catch (error) {
      console.error(error);
    }
  }

  _currentUserDid() {
    return this.dataLayer.derived.$currentUser.get()?.did ?? null;
  }

  _getListsWithMembership() {
    return (
      this.dataLayer.derived.$listsWithMembershipByActor.get(
        this.profile.did,
      ) ?? null
    );
  }

  async _loadMore() {
    try {
      await this.dataLayer.requests.loadListsWithMembershipForActor({
        did: this.profile.did,
      });
    } catch (error) {
      console.error(error);
    }
  }

  async _onToggle(entry) {
    const list = entry.list;
    if (this.state.$pendingByListUri.has(list.uri)) return;
    this.state.$pendingByListUri.add(list.uri);
    try {
      if (entry.listItem) {
        await this.profileInteractionHandler.handleRemoveFromList(
          this.profile,
          list,
          entry.listItem.uri,
        );
      } else {
        await this.profileInteractionHandler.handleAddToList(
          this.profile,
          list,
        );
      }
    } catch {
      // pass
    } finally {
      this.state.$pendingByListUri.delete(list.uri);
    }
  }

  render() {
    const listsWithMembership = this._getListsWithMembership();
    const entries = listsWithMembership
      ? listsWithMembership.listsWithMembership
      : null;
    const hasMore = !!listsWithMembership?.cursor;
    const isLoading = entries === null;
    const loadError = this.dataLayer.derived.$listsWithMembershipError.get(
      this.profile.did,
    );
    render(
      html`
        <dialog
          class="bottom-sheet add-to-lists-dialog"
          data-testid="add-to-lists-dialog"
          @click=${(event) => {
            if (event.target === event.currentTarget) {
              this.close();
            }
          }}
          @cancel=${(event) => {
            event.preventDefault();
            this.close();
          }}
          @close=${() => {
            this.scrollLock?.release();
            this.scrollLock = null;
            this.dispatchEvent(new CustomEvent("dialog-closed"));
          }}
        >
          <div class="add-to-lists-dialog-content">
            <button
              class="add-to-lists-dialog-close"
              aria-label="Close"
              @click=${() => this.close()}
            >
              ${closeIconTemplate()}
            </button>
            <div class="add-to-lists-dialog-body">
              <div class="add-to-lists-dialog-header">
                <h2 class="add-to-lists-dialog-title">Add to Lists</h2>
                <p class="add-to-lists-dialog-subtitle">
                  @${this.profile.handle}
                </p>
              </div>
              ${loadError
                ? html`<div class="add-to-lists-dialog-error">
                    ${loadError.message || "Could not load your lists."}
                  </div>`
                : isLoading
                  ? html`<div
                      class="add-to-lists-dialog-loading"
                      data-testid="add-to-lists-loading"
                    >
                      <div class="loading-spinner"></div>
                    </div>`
                  : entries.length === 0
                    ? html`<div
                        class="add-to-lists-dialog-empty"
                        data-testid="add-to-lists-empty"
                      >
                        You haven't created any lists yet.
                      </div>`
                    : html`
                        <div class="add-to-lists-dialog-rows">
                          <infinite-scroll-container
                            lookahead="400px"
                            ?disabled=${!hasMore}
                            @load-more=${async (event) => {
                              if (!hasMore) return;
                              await this._loadMore();
                              event.detail.resume();
                            }}
                          >
                            ${entries.map((entry) => this._renderRow(entry))}
                            ${hasMore
                              ? html`<div
                                  class="add-to-lists-dialog-loading-more"
                                  data-testid="add-to-lists-loading-more"
                                >
                                  <div class="loading-spinner"></div>
                                </div>`
                              : null}
                          </infinite-scroll-container>
                        </div>
                      `}
            </div>
          </div>
        </dialog>
      `,
      this,
    );
  }

  _renderRow(entry) {
    const list = entry.list;
    const isMember = !!entry.listItem;
    const isPending = this.state.$pendingByListUri.has(list.uri);
    const isModList = isModerationList(list);
    const currentUserDid = this._currentUserDid();
    const isOwnList = list.creator?.did === currentUserDid;
    const authorLabel = isModList
      ? isOwnList
        ? "Moderation list by you"
        : `Moderation list by @${list.creator?.handle ?? ""}`
      : isOwnList
        ? "User list by you"
        : `User list by @${list.creator?.handle ?? ""}`;
    return html`
      <div
        class="feeds-list-item add-to-lists-row"
        data-testid="add-to-lists-row"
        data-list-uri=${list.uri}
        data-list-purpose=${isModList ? "mod" : "curate"}
      >
        <div class="feeds-list-item-avatar">
          <img
            src=${cdnImageUrl(list.avatar) || "/img/list-avatar-fallback.svg"}
            alt=${list.name}
            class="feed-avatar"
          />
        </div>
        <div class="feeds-list-item-content">
          <div class="feeds-list-item-title">${list.name}</div>
          <div class="feeds-list-item-creator">${authorLabel}</div>
        </div>
        <button
          class="rounded-button ${isMember
            ? "rounded-button-secondary"
            : "rounded-button-primary"} add-to-lists-toggle"
          data-testid="add-to-lists-toggle"
          data-teststate=${isMember ? "member" : "not-member"}
          ?disabled=${isPending}
          @click=${() => this._onToggle(entry)}
        >
          ${isPending
            ? html`<div
                class="loading-spinner"
                data-testid="loading-spinner"
              ></div>`
            : isMember
              ? "Remove"
              : "Add"}
        </button>
      </div>
    `;
  }

  open() {
    this.scrollLock ??= scrollLocks.acquire({ target: this });
    const dialog = this.querySelector(".add-to-lists-dialog");
    if (dialog?.open) return;
    dialog.showModal();
    enableDragToDismiss(dialog, {
      onDismiss: () => this.close(),
      allowOppositeStretch: true,
      scrollContainer: this.querySelector(".add-to-lists-dialog-rows"),
      ignoreTouchTarget: (element) => element.closest("button") !== null,
    });
  }

  close() {
    return closeWithAnimation(this.querySelector(".add-to-lists-dialog"));
  }
}

AddToListsDialog.register();
