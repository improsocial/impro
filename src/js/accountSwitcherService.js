import { haptics } from "/js/haptics.js";
import { confirmModal } from "/js/modals/confirm.modal.js";
import { logAuthEvent } from "/js/errorLogs.js";
import "/js/components/account-switcher-dialog.js";

export class AccountSwitcherService {
  constructor(dataLayer, auth, pushNotificationService) {
    this.dataLayer = dataLayer;
    this.auth = auth;
    this.pushNotificationService = pushNotificationService;
    this.currentDialog = null;
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
