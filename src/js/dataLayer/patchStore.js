import { deepClone } from "/js/utils.js";

class SimpleUUID {
  constructor() {
    this._id = 0;
  }

  create() {
    return this._id++;
  }
}

// The store saves patch data for optimistic updates.
export class PatchStore {
  constructor() {
    this.postPatches = new Map();
    this.profilePatches = new Map();
    this.messagePatches = new Map();
    this.preferencePatches = [];
    this.uuid = new SimpleUUID();
  }

  /* Post Patches */

  _getPostPatches(postURI) {
    return this.postPatches.get(postURI) || [];
  }

  addPostPatch(postURI, patchBody) {
    const patchId = this.uuid.create();
    const postPatches = this._getPostPatches(postURI);
    postPatches.push({ id: patchId, body: patchBody });
    this.postPatches.set(postURI, postPatches);
    return patchId;
  }

  removePostPatch(postURI, patchId) {
    const postPatches = this._getPostPatches(postURI);
    this.postPatches.set(
      postURI,
      postPatches.filter(({ id }) => id !== patchId),
    );
  }

  applyPostPatches(post) {
    const postPatches = this._getPostPatches(post.uri);
    let patchedPost = deepClone(post);
    for (const patch of postPatches) {
      patchedPost = this.applyPostPatch(patchedPost, patch.body);
    }
    // apply profile patches to the post's author
    if (patchedPost.author) {
      const patchedAuthor = this.applyProfilePatches(patchedPost.author);
      patchedPost = { ...patchedPost, author: patchedAuthor };
    }
    return patchedPost;
  }

  applyPostPatch(post, patchBody) {
    switch (patchBody.type) {
      case "createRepost":
        return {
          ...post,
          viewer: {
            ...post.viewer,
            repost: "fake repost",
          },
          repostCount: post.repostCount + 1,
        };
      case "deleteRepost":
        return {
          ...post,
          viewer: {
            ...post.viewer,
            repost: null,
          },
          repostCount: post.repostCount - 1,
        };
      case "addLike":
        return {
          ...post,
          viewer: {
            ...post.viewer,
            like: "fake like",
          },
          likeCount: post.likeCount + 1,
        };
      case "removeLike":
        return {
          ...post,
          viewer: {
            ...post.viewer,
            like: null,
          },
          likeCount: post.likeCount - 1,
        };
      case "addBookmark":
        return {
          ...post,
          viewer: {
            ...post.viewer,
            bookmarked: true,
          },
          bookmarkCount: post.bookmarkCount + 1,
        };
      case "removeBookmark":
        return {
          ...post,
          viewer: {
            ...post.viewer,
            bookmarked: false,
          },
          bookmarkCount: post.bookmarkCount - 1,
        };
      case "hidePost":
        return {
          ...post,
          viewer: {
            ...post.viewer,
            isHidden: true,
          },
        };
      default:
        throw new Error("Unknown patch type", patchBody.type);
    }
  }

  /* Profile Patches */

  _getProfilePatches(profileURI) {
    return this.profilePatches.get(profileURI) || [];
  }

  addProfilePatch(profileURI, patchBody) {
    const patchId = this.uuid.create();
    const profilePatches = this._getProfilePatches(profileURI);
    profilePatches.push({ id: patchId, body: patchBody });
    this.profilePatches.set(profileURI, profilePatches);
    return patchId;
  }

  removeProfilePatch(profileURI, patchId) {
    const profilePatches = this._getProfilePatches(profileURI);
    this.profilePatches.set(
      profileURI,
      profilePatches.filter(({ id }) => id !== patchId),
    );
  }

  applyProfilePatches(profile) {
    const profilePatches = this._getProfilePatches(profile.did);
    let patchedProfile = deepClone(profile);
    for (const patch of profilePatches) {
      patchedProfile = this.applyProfilePatch(patchedProfile, patch.body);
    }
    return patchedProfile;
  }

  applyProfilePatch(profile, patchBody) {
    switch (patchBody.type) {
      case "followProfile":
        return {
          ...profile,
          followersCount: profile.followersCount + 1,
          viewer: {
            ...profile.viewer,
            following: "fake following",
          },
        };
      case "unfollowProfile":
        return {
          ...profile,
          followersCount: profile.followersCount - 1,
          viewer: {
            ...profile.viewer,
            following: null,
          },
        };
      case "muteProfile":
        return {
          ...profile,
          viewer: {
            ...profile.viewer,
            muted: true,
          },
        };
      case "unmuteProfile":
        return {
          ...profile,
          viewer: {
            ...profile.viewer,
            muted: false,
          },
        };
      case "blockProfile":
        return {
          ...profile,
          viewer: {
            ...profile.viewer,
            blocking: "fake blocking",
          },
        };
      case "unblockProfile":
        return {
          ...profile,
          viewer: {
            ...profile.viewer,
            blocking: null,
          },
        };
      default:
        throw new Error("Unknown patch type", patchBody.type);
    }
  }

  /* Message Patches */

  _getMessagePatches(messageId) {
    return this.messagePatches.get(messageId) || [];
  }

  addMessagePatch(messageId, patchBody) {
    const patchId = this.uuid.create();
    const messagePatches = this._getMessagePatches(messageId);
    messagePatches.push({ id: patchId, body: patchBody });
    this.messagePatches.set(messageId, messagePatches);
    return patchId;
  }

  removeMessagePatch(messageId, patchId) {
    const messagePatches = this._getMessagePatches(messageId);
    this.messagePatches.set(
      messageId,
      messagePatches.filter(({ id }) => id !== patchId),
    );
  }

  applyMessagePatches(message) {
    const messagePatches = this._getMessagePatches(message.id);
    let patchedMessage = deepClone(message);
    for (const patch of messagePatches) {
      patchedMessage = this.applyMessagePatch(patchedMessage, patch.body);
    }
    return patchedMessage;
  }

  applyMessagePatch(message, patchBody) {
    switch (patchBody.type) {
      case "addReaction":
        return {
          ...message,
          reactions: [...message.reactions, patchBody.reaction],
        };
      case "removeReaction":
        const { currentUserDid, value } = patchBody;
        return {
          ...message,
          reactions: message.reactions.filter(
            (reaction) =>
              reaction.sender.did !== currentUserDid &&
              reaction.value !== value,
          ),
        };
      default:
        throw new Error("Unknown patch type", patchBody.type);
    }
  }

  /* Preference Patches */

  _getPreferencePatches() {
    return this.preferencePatches;
  }

  addPreferencePatch(patchBody) {
    const patchId = this.uuid.create();
    const preferencePatches = this._getPreferencePatches();
    preferencePatches.push({ id: patchId, body: patchBody });
    return patchId;
  }

  removePreferencePatch(patchId) {
    const preferencePatches = this._getPreferencePatches();
    this.preferencePatches = preferencePatches.filter(
      ({ id }) => id !== patchId,
    );
  }

  applyPreferencePatches(preferences) {
    const preferencePatches = this._getPreferencePatches();
    let patchedPreferences = preferences.clone();
    for (const patch of preferencePatches) {
      patchedPreferences = this.applyPreferencePatch(
        patchedPreferences,
        patch.body,
      );
    }
    return patchedPreferences;
  }

  applyPreferencePatch(preferences, patchBody) {
    switch (patchBody.type) {
      case "pinFeed":
        return preferences.pinFeed(patchBody.feedUri);
      case "unpinFeed":
        return preferences.unpinFeed(patchBody.feedUri);
      case "subscribeLabeler":
        return preferences.subscribeLabeler(
          patchBody.did,
          patchBody.labelerInfo,
        );
      case "unsubscribeLabeler":
        return preferences.unsubscribeLabeler(patchBody.did);
      case "setContentLabelPref":
        return preferences.setContentLabelPref({
          label: patchBody.label,
          visibility: patchBody.visibility,
          labelerDid: patchBody.labelerDid,
        });
      default:
        throw new Error("Unknown patch type", patchBody.type);
    }
  }
}
