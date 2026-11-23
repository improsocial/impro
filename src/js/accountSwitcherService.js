import { haptics } from "/js/haptics.js";
import { confirmModal } from "/js/modals/confirm.modal.js";
import { logAuthEvent } from "/js/errorLogs.js";
import { Signal } from "/js/signals.js";
import { getLoginErrorMessage } from "/js/auth.js";
import { showToast } from "/js/toasts.js";
import "/js/components/account-switcher-dialog.js";

export class AccountSwitcherService {
  constructor(dataLayer, auth, pushNotificationService) {
    this.dataLayer = dataLayer;
    this.auth = auth;
    this.pushNotificationService = pushNotificationService;
    this.currentDialog = null;
    this.$otherAccounts = new Signal.State(null);
    this.$pendingSwitchDid = new Signal.State(null);
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) {
        this.$pendingSwitchDid.set(null);
      }
    });
  }

  async switchToAccount(account) {
    if (this.$pendingSwitchDid.get() !== null) {
      return;
    }
    this.$pendingSwitchDid.set(account.did);
    try {
      if (account.needsReauth) {
        await this.auth.login({
          handle: account.handle,
          returnTo: window.location.pathname + window.location.search,
        });
      } else {
        await this.auth.switchAccount(account.did);
      }
    } catch (error) {
      this.$pendingSwitchDid.set(null);
      showToast(
        account.needsReauth
          ? getLoginErrorMessage(error)
          : "Failed to switch account",
        { style: "error" },
      );
    }
  }

  async loadOtherAccounts() {
    const session = await this.auth.getSession();
    const accounts = await this.auth.listAccounts();
    const otherAccounts = accounts.filter(
      (account) => account.did !== session?.did,
    );
    this.$otherAccounts.set(otherAccounts);
    if (otherAccounts.length > 0) {
      this.dataLayer.declarative
        .ensureDetailedProfiles(otherAccounts.map((account) => account.did))
        .catch((error) => {
          console.warn("Failed to load other account profiles", error);
        });
    }
  }

  openAccountSwitcherDialog() {
    if (this.currentDialog !== null) {
      console.warn("Account switcher dialog already open");
      return;
    }
    haptics.impactHeavy();
    this.currentDialog = document.createElement("account-switcher-dialog");
    this.currentDialog.dataLayer = this.dataLayer;
    this.currentDialog.auth = this.auth;
    this.currentDialog.onSignOut = () => this.signOut();
    this.currentDialog.onSwitchAccount = (account) =>
      this.switchToAccount(account);
    this.currentDialog.addEventListener("dialog-closed", () => {
      if (this.currentDialog) {
        this.currentDialog.remove();
        this.currentDialog = null;
      }
    });
    document.body.appendChild(this.currentDialog);
    this.currentDialog.open();
  }

  async signOut() {
    const confirmed = await confirmModal("Are you sure you want to sign out?", {
      title: "Sign out?",
      confirmButtonStyle: "danger",
      confirmButtonText: "Sign out",
    });
    if (!confirmed) {
      return;
    }
    logAuthEvent("user-sign-out", {});
    if (this.pushNotificationService?.isEnabled) {
      await this.pushNotificationService.disable();
    }
    await this.auth.logout();
    window.location.href = "/login";
  }
}
