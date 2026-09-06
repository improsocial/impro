import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { scrollLocks } from "/js/scrollLocks.js";
import { closeWithAnimation } from "/js/dialogHelpers.js";
import { enableDragToDismiss } from "/js/dragHelpers.js";
import { getLoginErrorMessage } from "/js/auth.js";
import { Signal, ReactiveStore, effect } from "/js/signals.js";
import { showToast } from "/js/toasts.js";
import { linkToLogin } from "/js/navigation.js";
import { accountSwitcherListTemplate } from "/js/templates/accountSwitcherList.template.js";
import "/js/components/app-icon.js";

class AccountSwitcherDialog extends Component {
  connectedCallback() {
    if (this.initialized) {
      return;
    }
    this.setAttribute("data-dialog-wrapper", "");
    this.scrollLock = null;
    this.state = new ReactiveStore("account-switcher-dialog");
    this.state.$currentDid = new Signal.State(null);
    this.state.$accounts = new Signal.State(null);
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
    this.scrollLock?.release();
    this.scrollLock = null;
  }

  async _load() {
    const session = await this.auth.getSession();
    this.state.$currentDid.set(session?.did ?? null);
    const accounts = await this.auth.listAccounts();
    this.state.$accounts.set(accounts);
    try {
      await this.dataLayer.declarative.ensureDetailedProfiles(
        accounts.map((account) => account.did),
      );
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
    const profilesByDid = {};
    for (const account of orderedAccounts) {
      const profile = this.dataLayer.derived.$hydratedDetailedProfiles.get(
        account.did,
      );
      if (profile) {
        profilesByDid[account.did] = profile;
      }
    }
    render(
      html`
        <dialog
          class="bottom-sheet account-switcher-dialog"
          data-testid="account-switcher-dialog"
          @click=${(event) => {
            if (
              event.target === event.currentTarget &&
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
          @close=${() => {
            this.scrollLock?.release();
            this.scrollLock = null;
            this.dispatchEvent(new CustomEvent("dialog-closed"));
          }}
        >
          <div class="account-switcher-content">
            <div class="account-switcher-header">
              <h2 class="account-switcher-title" data-testid="modal-title">
                Switch account
              </h2>
              <button
                class="dialog-close-button"
                data-testid="account-switcher-close"
                aria-label="Close"
                ?disabled=${pendingAction !== null}
                @click=${() => this.close()}
              >
                <app-icon icon="close-line"></app-icon>
              </button>
            </div>
            ${accountSwitcherListTemplate({
              accounts: orderedAccounts,
              profilesByDid,
              currentDid,
              pendingDid:
                pendingAction?.type === "switch" ? pendingAction.did : null,
              profilesLoading,
              onSelect: (account) => this._onSelect(account),
              onAdd: () => this._onAdd(),
              addLabel: "Add account",
              addPending: pendingAction?.type === "add",
            })}
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
      try {
        await this.auth.login({
          handle: account.handle,
          returnTo: window.location.pathname + window.location.search,
        });
      } catch (error) {
        this.state.$pendingAction.set(null);
        showToast(getLoginErrorMessage(error), { style: "error" });
      }
      return;
    }
    this.state.$pendingAction.set({ type: "switch", did: account.did });
    try {
      await this.auth.switchAccount(account.did);
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
    this.scrollLock ??= scrollLocks.acquire({ target: this });
    const dialog = this.querySelector("dialog");
    if (dialog?.open) return;
    dialog.showModal();
    enableDragToDismiss(dialog, {
      onDismiss: () => this.close(),
      confirmDismiss: () => this.state.$pendingAction.get() === null,
      allowOppositeStretch: true,
      ignoreTouchTarget: (element) => element.closest("button") !== null,
    });
  }

  close() {
    return closeWithAnimation(this.querySelector("dialog"));
  }
}

AccountSwitcherDialog.register();
