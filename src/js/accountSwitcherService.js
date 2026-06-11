import { hapticsImpactLight } from "/js/haptics.js";
import "/js/components/account-switcher-dialog.js";

export class AccountSwitcherService {
  constructor(dataLayer) {
    this.dataLayer = dataLayer;
    this.currentDialog = null;
  }

  openAccountSwitcherDialog() {
    if (this.currentDialog !== null) {
      console.warn("Account switcher dialog already open");
      return;
    }
    hapticsImpactLight();
    this.currentDialog = document.createElement("account-switcher-dialog");
    this.currentDialog.dataLayer = this.dataLayer;
    this.currentDialog.addEventListener("dialog-closed", () => {
      if (this.currentDialog) {
        this.currentDialog.remove();
        this.currentDialog = null;
      }
    });
    document.body.appendChild(this.currentDialog);
    this.currentDialog.open();
  }
}
