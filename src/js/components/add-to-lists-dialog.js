import { MembershipDialog } from "/js/components/membership-dialog.js";
import { cdnImageUrl, isModerationList } from "/js/dataHelpers.js";
import { linkToList } from "/js/navigation.js";
import { LIST_AVATAR_FALLBACK_URL } from "/js/avatarFallbacks.js";

class AddToListsDialog extends MembershipDialog {
  static copy = {
    testIdPrefix: "add-to-lists",
    title: "Add to Lists",
    loadError: "Couldn't load your lists.",
    loadMoreError: "Couldn't load more lists.",
    empty: "You haven't created any lists yet.",
  };

  loadPage({ reload }) {
    return this.dataLayer.requests.loadListsWithMembershipForActor(
      this.profile.did,
      { reload },
    );
  }

  getCollection() {
    const data = this.dataLayer.derived.$listsWithMembershipByActor.get(
      this.profile.did,
    );
    if (!data) return null;
    return { entries: data.listsWithMembership, cursor: data.cursor };
  }

  getRow(entry, currentUserDid) {
    const list = entry.list;
    const isOwnList = list.creator?.did === currentUserDid;
    const kind = isModerationList(list) ? "Moderation list" : "User list";
    return {
      uri: list.uri,
      name: list.name,
      avatar: cdnImageUrl(list.avatar) || LIST_AVATAR_FALLBACK_URL,
      href: linkToList(list),
      subtitle: isOwnList
        ? `${kind} by you`
        : `${kind} by @${list.creator?.handle ?? ""}`,
    };
  }

  addMember(entry) {
    return this.profileInteractionHandler.handleAddToList(
      this.profile,
      entry.list,
    );
  }

  removeMember(entry) {
    return this.profileInteractionHandler.handleRemoveFromList(
      this.profile,
      entry.list,
      entry.listItem.uri,
    );
  }
}

AddToListsDialog.register();
