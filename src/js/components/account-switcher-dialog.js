import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { ScrollLock } from "/js/scrollLock.js";
import { enableDragToDismiss } from "/js/utils.js";
import { auth } from "/js/auth.js";
import { Signal, ReactiveStore, effect } from "/js/signals.js";
import { showToast } from "/js/toasts.js";
import { linkToLogin } from "/js/navigation.js";
import { getDisplayName } from "/js/dataHelpers.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { circleCheckIconTemplate } from "/js/templates/icons/circleCheckIcon.template.js";
import { chevronRightIconTemplate } from "/js/templates/icons/chevronRight.template.js";
import { userPlusIconTemplate } from "/js/templates/icons/userPlusIcon.template.js";

class AccountSwitcherDialog extends Component {
  connectedCallback() {
    if (this.initialized) {
      return;
    }
    this.setAttribute("data-dialog-wrapper", "");
    this.scrollLock = new ScrollLock(this);
    this.state = new ReactiveStore("account-switcher-dialog");
    this.state.$currentDid = new Signal.State(null);
    this.state.$accounts = new Signal.State(null);
    this.state.$profilesByDid = new Signal.State({});
    this.state.$profilesLoading = new Signal.State(true);
    this.state.$pendingAction = new Signal.State(null); // { type: "switch"|"add", did? }
    this.innerHTML = "";
    this._disposeEffect = effect(() => {
      this.render();
    });
    // Account actions navigate away with the pending spinner showing; if the
    // user comes back via the back/forward cache the document is restored
    // as-is, so reset the stuck pending state.
    this._onPageShow = (event) => {
      if (event.persisted) {
        this.state.$pendingAction.set(null);
      }
    };
    window.addEventListener("pageshow", this._onPageShow);
    this._load();
    this.initialized = true;
  }

  disconnectedCallback() {
    this._disposeEffect?.();
    this._disposeEffect = null;
    window.removeEventListener("pageshow", this._onPageShow);
  }

  async _load() {
    const session = await auth.getSession();
    this.state.$currentDid.set(session?.did ?? null);
    const accounts = await auth.listAccounts();
    this.state.$accounts.set(accounts);
    try {
      const profiles = await this.dataLayer.declarative.ensureDetailedProfiles(
        accounts.map((account) => account.did),
      );
      const profilesByDid = {};
      for (const profile of profiles) {
        if (profile) {
          profilesByDid[profile.did] = profile;
        }
      }
      this.state.$profilesByDid.set(profilesByDid);
    } catch {
      // pass
    } finally {
      this.state.$profilesLoading.set(false);
    }
  }

  render() {
    const accounts = this.state.$accounts.get() ?? [];
    const pendingAction = this.state.$pendingAction.get();
    const profilesLoading = this.state.$profilesLoading.get();
    const currentDid = this.state.$currentDid.get();
    // Put current account at the top of the list
    const orderedAccounts = [
      ...accounts.filter((account) => account.did === currentDid),
      ...accounts.filter((account) => account.did !== currentDid),
    ];
    render(
      html`
        <dialog
          class="bottom-sheet account-switcher-dialog"
          data-testid="account-switcher-dialog"
          @click=${(event) => {
            if (
              event.target.tagName === "DIALOG" &&
              this.state.$pendingAction.get() === null
            ) {
              this.close();
            }
          }}
          @cancel=${(event) => {
            event.preventDefault();
            if (this.state.$pendingAction.get() === null) {
              this.close();
            }
          }}
        >
          <div class="account-switcher-content">
            <div class="account-switcher-header">
              <h2 class="account-switcher-title" data-testid="modal-title">
                Switch account
              </h2>
              <button
                class="account-switcher-close"
                data-testid="account-switcher-close"
                aria-label="Close"
                ?disabled=${pendingAction !== null}
                @click=${() => this.close()}
              >
                &times;
              </button>
            </div>
            <div
              class="account-switcher-list"
              data-testid="account-switcher-list"
            >
              ${orderedAccounts.map((account) => {
                const profile =
                  this.state.$profilesByDid.get()[account.did] ?? null;
                const isCurrent = account.did === currentDid;
                const isPendingRow =
                  pendingAction?.type === "switch" &&
                  pendingAction.did === account.did;
                const handle = profile?.handle ?? account.handle;
                const showSkeleton = profile === null && profilesLoading;
                return html`
                  <button
                    class="account-switcher-item ${account.needsReauth
                      ? "account-switcher-item-reauth"
                      : ""}"
                    data-testid="account-switcher-item"
                    data-did=${account.did}
                    data-teststate=${isPendingRow
                      ? "pending"
                      : isCurrent
                        ? "current"
                        : account.needsReauth
                          ? "reauth"
                          : "other"}
                    ?disabled=${pendingAction !== null}
                    @click=${() => this._onSelect(account)}
                  >
                    ${showSkeleton
                      ? html`
                          <span class="account-switcher-avatar">
                            <span
                              class="skeleton-avatar skeleton-animate"
                            ></span>
                          </span>
                          <span
                            class="account-switcher-names account-switcher-names-skeleton"
                            data-testid="account-switcher-skeleton"
                          >
                            <span
                              class="skeleton-line-short skeleton-animate"
                            ></span>
                            <span
                              class="skeleton-line-shorter skeleton-animate"
                            ></span>
                          </span>
                        `
                      : html`
                          <span class="account-switcher-avatar">
                            ${profile
                              ? avatarTemplate({
                                  author: profile,
                                  clickAction: "none",
                                })
                              : html`<div
                                  class="avatar-image-placeholder"
                                ></div>`}
                          </span>
                          <span class="account-switcher-names">
                            <span class="account-switcher-display-name">
                              ${profile
                                ? getDisplayName(profile)
                                : (account.handle ?? account.did)}
                            </span>
                            ${handle
                              ? html`<span class="account-switcher-handle"
                                  >@${handle}</span
                                >`
                              : null}
                            ${account.needsReauth
                              ? html`<span class="account-switcher-reauth-hint"
                                  >Sign in again</span
                                >`
                              : null}
                          </span>
                        `}
                    ${isPendingRow
                      ? html`<span
                          class="account-spinner"
                          data-testid="account-spinner"
                          ><span class="loading-spinner"></span
                        ></span>`
                      : isCurrent
                        ? html`<span class="account-switcher-current-check"
                            >${circleCheckIconTemplate()}</span
                          >`
                        : html`<span class="account-switcher-chevron"
                            >${chevronRightIconTemplate()}</span
                          >`}
                  </button>
                `;
              })}
              <button
                class="account-switcher-item account-switcher-add"
                data-testid="account-switcher-add"
                ?disabled=${pendingAction !== null}
                @click=${() => this._onAdd()}
              >
                <span class="account-switcher-avatar account-switcher-add-icon">
                  ${userPlusIconTemplate()}
                </span>
                <span class="account-switcher-names">
                  <span class="account-switcher-display-name">Add account</span>
                </span>
                ${pendingAction?.type === "add"
                  ? html`<span
                      class="account-spinner"
                      data-testid="account-spinner"
                      ><span class="loading-spinner"></span
                    ></span>`
                  : null}
              </button>
            </div>
          </div>
        </dialog>
      `,
      this,
    );
  }

  async _onSelect(account) {
    if (this.state.$pendingAction.get() !== null) {
      return;
    }
    if (account.did === this.state.$currentDid.get()) {
      this.close();
      return;
    }
    if (account.needsReauth) {
      this.state.$pendingAction.set({ type: "switch", did: account.did });
      window.location.href = linkToLogin({
        query: { addAccount: 1, handle: account.handle },
      });
      return;
    }
    this.state.$pendingAction.set({ type: "switch", did: account.did });
    try {
      await auth.switchAccount(account.did);
    } catch {
      this.state.$pendingAction.set(null);
      showToast("Failed to switch account", { style: "error" });
    }
  }

  _onAdd() {
    if (this.state.$pendingAction.get() !== null) {
      return;
    }
    this.state.$pendingAction.set({ type: "add" });
    window.location.href = linkToLogin({ query: { addAccount: 1 } });
  }

  open() {
    this.scrollLock.lock();
    const dialog = this.querySelector("dialog");
    dialog.showModal();
    enableDragToDismiss(dialog, {
      onClose: () => this.close(),
      confirmDismiss: () => this.state.$pendingAction.get() === null,
      allowUpwardStretch: true,
      ignoreTouchTarget: (element) => element.closest("button") !== null,
    });
  }

  close() {
    this.scrollLock.unlock();
    const dialog = this.querySelector("dialog");
    if (dialog?.open) {
      dialog.close();
    }
    this.dispatchEvent(new CustomEvent("dialog-closed"));
  }
}

AccountSwitcherDialog.register();
