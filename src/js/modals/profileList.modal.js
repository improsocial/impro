import { html } from "/js/lib/lit-html.js";
import { Modal } from "/js/modals/modal.js";
import { profileFeedTemplate } from "/js/templates/profileFeed.template.js";

class ProfileListModal extends Modal {
  get className() {
    return "bottom-sheet text-modal profile-list-modal";
  }

  get attributes() {
    return { "data-testid": "profile-list-modal" };
  }

  render({
    props: {
      title,
      profiles,
      isAuthenticated,
      currentUserDid,
      profileInteractionHandler,
    },
  }) {
    return html`
      <div class="modal-dialog-content">
        ${title
          ? html`<h2 class="modal-dialog-title" data-testid="modal-title">
              ${title}
            </h2>`
          : null}
        <div class="profile-list-modal-body">
          ${profileFeedTemplate({
            profiles,
            hasMore: false,
            skeletonCount: 0,
            emptyMessage: "No one to show",
            isAuthenticated,
            currentUserDid,
            profileInteractionHandler,
          })}
        </div>
      </div>
    `;
  }
}

// Shows a fixed, already-fetched list of profiles (e.g. everyone in a
// notification group, or a full known-followers list) in a scrollable
// modal. Unlike postLikes/postReposts, this doesn't paginate against the
// network — pass the complete list you already have.
export async function profileListModal(profiles, options = {}) {
  return ProfileListModal.open({ profiles, ...options });
}
