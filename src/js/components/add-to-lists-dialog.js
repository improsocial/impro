import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { ScrollLock } from "/js/scrollLock.js";
import { enableDragToDismiss } from "/js/utils.js";
import { Signal, SignalSet, ReactiveStore, effect } from "/js/signals.js";
import { isModerationList } from "/js/dataHelpers.js";

class AddToListsDialog extends Component {
  connectedCallback() {
    if (this.initialized) {
      return;
    }
    this.setAttribute("data-dialog-wrapper", "");
    this.scrollLock = new ScrollLock(this);
    this.state = new ReactiveStore("add-to-lists-dialog");
    this.state.$pendingByListUri = new SignalSet();
    this.state.$loadError = new Signal.State(null);
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
      await Promise.all([
        this.dataLayer.requests.loadCurrentUserLists({ reload: true }),
        this.dataLayer.requests.loadCurrentUserListMemberships({
          reload: true,
        }),
      ]);
    } catch (error) {
      console.error(error);
      this.state.$loadError.set(error.message || "Could not load your lists.");
    }
  }

  _currentUserDid() {
    return this.dataLayer.derived.$currentUser.get()?.did ?? null;
  }

  _getLists() {
    const did = this._currentUserDid();
    if (!did) return null;
    const actorLists = this.dataLayer.derived.$actorLists.get(did);
    if (!actorLists) return null;
    return actorLists.lists;
  }

  _getMembershipForList(listUri) {
    const memberships =
      this.dataLayer.derived.$currentUserListMemberships.get();
    if (!memberships) return undefined;
    return memberships.find(
      (membership) =>
        membership.listUri === listUri &&
        membership.subjectDid === this.profile.did,
    );
  }

  async _onToggle(list) {
    if (this.state.$pendingByListUri.has(list.uri)) return;
    const membership = this._getMembershipForList(list.uri);
    this.state.$pendingByListUri.add(list.uri);
    try {
      if (membership) {
        await this.profileInteractionHandler.handleRemoveFromList(
          this.profile,
          list,
          membership.uri,
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
    const lists = this._getLists();
    const memberships =
      this.dataLayer.derived.$currentUserListMemberships.get();
    const isLoading = lists === null || memberships === null;
    const loadError = this.state.$loadError.get();
    render(
      html`
        <dialog
          class="bottom-sheet add-to-lists-dialog"
          data-testid="add-to-lists-dialog"
          @click=${(event) => {
            if (event.target.tagName === "DIALOG") {
              this.close();
            }
          }}
          @cancel=${(event) => {
            event.preventDefault();
            this.close();
          }}
        >
          <div class="add-to-lists-dialog-content">
            <button
              class="add-to-lists-dialog-close"
              aria-label="Close"
              @click=${() => this.close()}
            >
              &times;
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
                    ${loadError}
                  </div>`
                : isLoading
                  ? html`<div
                      class="add-to-lists-dialog-loading"
                      data-testid="add-to-lists-loading"
                    >
                      <div class="loading-spinner"></div>
                    </div>`
                  : lists.length === 0
                    ? html`<div
                        class="add-to-lists-dialog-empty"
                        data-testid="add-to-lists-empty"
                      >
                        You haven't created any lists yet.
                      </div>`
                    : html`
                        <div class="add-to-lists-dialog-rows">
                          ${lists.map((list) => this._renderRow(list))}
                        </div>
                      `}
            </div>
          </div>
        </dialog>
      `,
      this,
    );
  }

  _renderRow(list) {
    const membership = this._getMembershipForList(list.uri);
    const isMember = !!membership;
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
            src=${list.avatar || "/img/list-avatar-fallback.svg"}
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
          @click=${() => this._onToggle(list)}
        >
          ${isPending ? "..." : isMember ? "Remove" : "Add"}
        </button>
      </div>
    `;
  }

  open() {
    this.scrollLock.lock();
    const dialog = this.querySelector(".add-to-lists-dialog");
    dialog.showModal();
    enableDragToDismiss(dialog, {
      onClose: () => this.close(),
      allowUpwardStretch: true,
      ignoreTouchTarget: (element) => element.closest("button") !== null,
    });
  }

  close() {
    this.scrollLock.unlock();
    const dialog = this.querySelector(".add-to-lists-dialog");
    if (dialog?.open) {
      dialog.close();
    }
    this.dispatchEvent(new CustomEvent("dialog-closed"));
  }
}

AddToListsDialog.register();
