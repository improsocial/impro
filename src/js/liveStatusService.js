import "/js/components/live-status-dialog.js";
import "/js/components/edit-live-dialog.js";
import "/js/components/go-live-dialog.js";

// Handles clicks on avatars with live badge
export class LiveStatusService {
  constructor(dataLayer) {
    this.dataLayer = dataLayer;
  }

  handleAvatarClick(did) {
    const liveStatus = this.dataLayer.derived.$actorLiveStatus.get(did);
    if (liveStatus?.state !== "active") return;
    const currentUser = this.dataLayer.derived.$currentUser.get();
    if (currentUser?.did === did) {
      this._openEditLiveDialog(liveStatus);
      return;
    }
    const profile =
      this.dataLayer.derived.$hydratedProfiles.get(did) ??
      this.dataLayer.derived.$hydratedDetailedProfiles.get(did);
    if (!profile) return;
    this._openLiveStatusDialog(profile, liveStatus);
  }

  _openLiveStatusDialog(profile, liveStatus) {
    const dialog = document.createElement("live-status-dialog");
    dialog.profile = profile;
    dialog.liveStatus = liveStatus;
    dialog.addEventListener("close", () => dialog.remove());
    document.body.appendChild(dialog);
    dialog.open();
  }

  _openEditLiveDialog(liveStatus) {
    const dialog = document.createElement("edit-live-dialog");
    dialog.dataLayer = this.dataLayer;
    dialog.liveStatus = liveStatus;
    dialog.addEventListener("close", () => dialog.remove());
    document.body.appendChild(dialog);
    dialog.open();
  }
}
