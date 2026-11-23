import { html, render } from "/js/lib/lit-html.js";
import { paginatedListTemplate } from "/js/templates/paginatedList.template.js";
import { Component } from "/js/components/component.js";
import { scrollLocks } from "/js/scrollLocks.js";
import { closeWithAnimation } from "/js/dialogHelpers.js";
import { enableDragToDismiss } from "/js/dragHelpers.js";
import { Signal, SignalSet, ReactiveStore, effect } from "/js/signals.js";
import { classnames } from "/js/utils.js";
import { tryAgainButtonTemplate } from "/js/templates/tryAgainButton.template.js";
import "/js/components/app-icon.js";
import "/js/components/infinite-scroll-container.js";

function loadErrorTemplate({ testIdPrefix, message, onRetry }) {
  return html`<div
    class="membership-dialog-error error-state error-state-inline"
    data-testid="${testIdPrefix}-error"
  >
    <div>${message}</div>
    ${tryAgainButtonTemplate({ onClick: onRetry })}
  </div>`;
}

function loadMoreErrorTemplate({ testIdPrefix, message, onRetry }) {
  return html`<div
    class="error-state error-state-inline"
    data-testid="${testIdPrefix}-load-more-error"
  >
    <div>${message}</div>
    ${tryAgainButtonTemplate({ onClick: onRetry })}
  </div>`;
}

function membershipRowTemplate({
  testIdPrefix,
  row,
  isMember,
  isPending,
  onOpen,
  onToggle,
}) {
  return html`
    <div
      class="feeds-list-item membership-row"
      data-testid="${testIdPrefix}-row"
      data-uri=${row.uri}
    >
      <div class="feeds-list-item-avatar">
        <img src=${row.avatar} alt=${row.name} class="feed-avatar" />
      </div>
      <div class="feeds-list-item-content">
        <div class="feeds-list-item-title">
          <a
            class="membership-row-link"
            href=${row.href}
            data-testid="${testIdPrefix}-row-link"
            @click=${onOpen}
            >${row.name}</a
          >
        </div>
        <div class="feeds-list-item-creator">${row.subtitle}</div>
      </div>
      <button
        class=${classnames("rounded-button membership-toggle", {
          "rounded-button-primary": !isMember,
        })}
        data-testid="${testIdPrefix}-toggle"
        data-teststate=${isMember ? "member" : "not-member"}
        ?disabled=${isPending}
        @click=${onToggle}
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

export class MembershipDialog extends Component {
  connectedCallback() {
    if (this.initialized) {
      return;
    }
    this.setAttribute("data-dialog-wrapper", "");
    this.scrollLock = null;
    this.state = new ReactiveStore(this.constructor.copy.testIdPrefix);
    this.state.$pendingUris = new SignalSet();
    this.state.$loadError = new Signal.State(null);
    this.state.$loadMoreError = new Signal.State(null);
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
      await this.loadPage({ reload: true });
    } catch (error) {
      console.error(error);
      this.state.$loadError.set(error);
    }
  }

  _retry() {
    this.state.$loadError.set(null);
    this._load();
  }

  async _loadMore() {
    this.state.$loadMoreError.set(null);
    try {
      await this.loadPage({ reload: false });
    } catch (error) {
      console.error(error);
      this.state.$loadMoreError.set(error);
    }
  }

  async _onToggle(entry) {
    const uri = this.getRow(entry).uri;
    if (this.state.$pendingUris.has(uri)) return;
    this.state.$pendingUris.add(uri);
    try {
      if (entry.listItem) {
        await this.removeMember(entry);
      } else {
        await this.addMember(entry);
      }
    } catch {
      // pass
    } finally {
      this.state.$pendingUris.delete(uri);
    }
  }

  render() {
    const copy = this.constructor.copy;
    const { testIdPrefix } = copy;
    const collection = this.getCollection();
    const entries = collection ? collection.entries : null;
    const hasMore = !!collection?.cursor;
    const isLoading = entries === null;
    const loadError = this.state.$loadError.get();
    const loadMoreError = this.state.$loadMoreError.get();
    const currentUserDid = this.dataLayer.derived.$currentUser.get()?.did;
    const pendingUris = new Set(this.state.$pendingUris.values());
    render(
      html`
        <dialog
          class="bottom-sheet membership-dialog"
          data-testid="${testIdPrefix}-dialog"
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
          <div class="membership-dialog-content">
            <button
              class="dialog-close-button dialog-close-button-floating"
              aria-label="Close"
              @click=${() => this.close()}
            >
              <app-icon icon="close-line"></app-icon>
            </button>
            <div class="membership-dialog-body">
              <div class="membership-dialog-header">
                <h2 class="membership-dialog-title">${copy.title}</h2>
                <p class="membership-dialog-subtitle">
                  @${this.profile.handle}
                </p>
              </div>
              ${loadError
                ? loadErrorTemplate({
                    testIdPrefix,
                    message: copy.loadError,
                    onRetry: () => this._retry(),
                  })
                : isLoading
                  ? html`<div
                      class="membership-dialog-loading loading-block loading-block-soon"
                      data-testid="${testIdPrefix}-loading"
                    >
                      <div class="loading-spinner"></div>
                    </div>`
                  : entries.length === 0
                    ? html`<div
                        class="membership-dialog-empty"
                        data-testid="${testIdPrefix}-empty"
                      >
                        ${copy.empty}
                      </div>`
                    : html`
                        <div class="membership-dialog-rows">
                          ${paginatedListTemplate({
                            items: entries,
                            renderItem: (entry) => {
                              const row = this.getRow(entry, currentUserDid);
                              return membershipRowTemplate({
                                testIdPrefix,
                                row,
                                isMember: !!entry.listItem,
                                isPending: pendingUris.has(row.uri),
                                onOpen: (event) => this._open(event, row.href),
                                onToggle: () => this._onToggle(entry),
                              });
                            },
                            hasMore,
                            onLoadMore: () => this._loadMore(),
                            errorTemplate: loadMoreError
                              ? loadMoreErrorTemplate({
                                  testIdPrefix,
                                  message: copy.loadMoreError,
                                  onRetry: () => this._loadMore(),
                                })
                              : null,
                            lookahead: "400px",
                          })}
                        </div>
                      `}
            </div>
          </div>
        </dialog>
      `,
      this,
    );
  }

  async _open(event, href) {
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.button === 1
    ) {
      return;
    }
    event.preventDefault();
    await this.close();
    this.scrollLock?.release();
    this.scrollLock = null;
    window.router.go(href);
  }

  open() {
    this.scrollLock ??= scrollLocks.acquire({ target: this });
    const dialog = this.querySelector(".membership-dialog");
    if (dialog?.open) return;
    dialog.showModal();
    enableDragToDismiss(dialog, {
      onDismiss: () => this.close(),
      allowOppositeStretch: true,
      scrollContainer: this.querySelector(".membership-dialog-rows"),
      ignoreTouchTarget: (element) => element.closest("button, a") !== null,
    });
  }

  close() {
    return closeWithAnimation(this.querySelector(".membership-dialog"));
  }
}
