import { MembershipDialog } from "/js/components/membership-dialog.js";
import { linkToStarterPack } from "/js/navigation.js";
import { STARTER_PACK_AVATAR_FALLBACK_URL } from "/js/avatarFallbacks.js";

class AddToStarterPacksDialog extends MembershipDialog {
  static copy = {
    testIdPrefix: "add-to-starter-packs",
    title: "Add to Starter Packs",
    loadError: "Couldn't load your starter packs.",
    loadMoreError: "Couldn't load more starter packs.",
    empty: "You haven't created any starter packs yet.",
  };

  loadPage({ reload }) {
    return this.dataLayer.requests.loadStarterPacksWithMembershipForActor(
      this.profile.did,
      { reload },
    );
  }

  getCollection() {
    const data = this.dataLayer.derived.$starterPacksWithMembershipByActor.get(
      this.profile.did,
    );
    if (!data) return null;
    return { entries: data.starterPacksWithMembership, cursor: data.cursor };
  }

  getRow(entry) {
    const starterPack = entry.starterPack;
    return {
      uri: starterPack.uri,
      name: starterPack.record.name,
      avatar: STARTER_PACK_AVATAR_FALLBACK_URL,
      href: linkToStarterPack(starterPack),
      subtitle: "Starter pack by you",
    };
  }

  addMember(entry) {
    return this.profileInteractionHandler.handleAddToStarterPack(
      this.profile,
      entry.starterPack,
    );
  }

  removeMember(entry) {
    return this.profileInteractionHandler.handleRemoveFromStarterPack(
      this.profile,
      entry.starterPack,
      entry.listItem.uri,
    );
  }
}

AddToStarterPacksDialog.register();
