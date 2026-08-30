import "/js/components/live-status-dialog.js";

export class LiveStatusService {
  constructor(dataLayer) {
    this.dataLayer = dataLayer;
  }

  handleAvatarClick(did) {
    const liveStatus = this.dataLayer.derived.$actorLiveStatus.get(did);
    if (liveStatus?.state !== "active") return;
    const profile =
      this.dataLayer.derived.$hydratedProfiles.get(did) ??
      this.dataLayer.derived.$hydratedDetailedProfiles.get(did);
    if (!profile) return;
    const dialog = document.createElement("live-status-dialog");
    dialog.profile = profile;
    dialog.liveStatus = liveStatus;
    dialog.addEventListener("close", () => {
      dialog.remove();
    });
    document.body.appendChild(dialog);
    dialog.open();
  }
}
