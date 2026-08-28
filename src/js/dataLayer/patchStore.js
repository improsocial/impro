import { deepClone, SimpleUUID } from "/js/utils.js";
import { pinPostInFeed, unpinPostInFeed } from "/js/dataHelpers.js";
import { Signal, SignalMap, ReactiveStore } from "/js/signals.js";

// The store saves patch data for optimistic updates.
// Patches are convergent - if the target has already
// been updated they have no effect.
export class PatchStore extends ReactiveStore {
  constructor() {
    super("patchStore");
    this.$postPatches = new SignalMap();
    this.$profilePatches = new SignalMap();
    this.$messagePatches = new SignalMap();
    this.$convoPatches = new SignalMap();
    this.$preferencePatches = new Signal.State([]);
    this.$currentUserPatches = new Signal.State([]);
    this.$authorFeedPatches = new SignalMap();
    this.uuid = new SimpleUUID();
  }

  /* Post Patches */

  _getPostPatches(postURI) {
    return this.$postPatches.get(postURI) || [];
  }

  addPostPatch(postURI, patchBody) {
    const patchId = this.uuid.create();
    this.$postPatches.set(postURI, [
      ...this._getPostPatches(postURI),
      { id: patchId, body: patchBody },
    ]);
    return patchId;
  }

  removePostPatch(postURI, patchId) {
    this.$postPatches.set(
      postURI,
      this._getPostPatches(postURI).filter(({ id }) => id !== patchId),
    );
  }

  applyPostPatches(post, patches) {
    let patchedPost = deepClone(post);
    for (const patch of patches) {
      patchedPost = this.applyPostPatch(patchedPost, patch.body);
    }
    return patchedPost;
  }

  applyPostPatch(post, patchBody) {
    switch (patchBody.type) {
      case "createRepost":
        if (post.viewer?.repost) return post;
        return {
          ...post,
          viewer: {
            ...post.viewer,
            repost: "fake repost",
          },
          repostCount: post.repostCount + 1,
        };
      case "deleteRepost":
        if (!post.viewer?.repost) return post;
        return {
          ...post,
          viewer: {
            ...post.viewer,
            repost: null,
          },
          repostCount: post.repostCount - 1,
        };
      case "addLike":
        if (post.viewer?.like) return post;
        return {
          ...post,
          viewer: {
            ...post.viewer,
            like: "fake like",
          },
          likeCount: post.likeCount + 1,
        };
      case "removeLike":
        if (!post.viewer?.like) return post;
        return {
          ...post,
          viewer: {
            ...post.viewer,
            like: null,
          },
          likeCount: post.likeCount - 1,
        };
      case "addBookmark":
        if (post.viewer?.bookmarked) return post;
        return {
          ...post,
          viewer: {
            ...post.viewer,
            bookmarked: true,
          },
          bookmarkCount: post.bookmarkCount + 1,
        };
      case "removeBookmark":
        if (!post.viewer?.bookmarked) return post;
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
    return this.$profilePatches.get(profileURI) || [];
  }

  hasPendingProfilePatch(did, types) {
    const patches = this.$profilePatches.get(did) ?? [];
    const set = Array.isArray(types) ? new Set(types) : new Set([types]);
    return patches.some((patch) => set.has(patch.body?.type));
  }

  addProfilePatch(profileURI, patchBody) {
    const patchId = this.uuid.create();
    this.$profilePatches.set(profileURI, [
      ...this._getProfilePatches(profileURI),
      { id: patchId, body: patchBody },
    ]);
    return patchId;
  }

  removeProfilePatch(profileURI, patchId) {
    this.$profilePatches.set(
      profileURI,
      this._getProfilePatches(profileURI).filter(({ id }) => id !== patchId),
    );
  }

  applyProfilePatches(profile, patches) {
    let patchedProfile = deepClone(profile);
    for (const patch of patches) {
      patchedProfile = this.applyProfilePatch(patchedProfile, patch.body);
    }
    return patchedProfile;
  }

  applyProfilePatch(profile, patchBody) {
    switch (patchBody.type) {
      case "followProfile":
        if (profile.viewer?.following) return profile;
        return {
          ...profile,
          followersCount: profile.followersCount + 1,
          viewer: {
            ...profile.viewer,
            following: "fake following",
          },
        };
      case "unfollowProfile":
        if (!profile.viewer?.following) return profile;
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
        if (profile.viewer?.blocking) return profile;
        return {
          ...profile,
          viewer: {
            ...profile.viewer,
            blocking: "fake blocking",
          },
        };
      case "unblockProfile":
        if (!profile.viewer?.blocking) return profile;
        return {
          ...profile,
          viewer: {
            ...profile.viewer,
            blocking: null,
          },
        };
      case "updatePostNotificationSubscription":
        return {
          ...profile,
          viewer: {
            ...profile.viewer,
            activitySubscription: patchBody.activitySubscription,
          },
        };
      default:
        throw new Error("Unknown patch type", patchBody.type);
    }
  }

  /* Message Patches */

  _getMessagePatches(messageId) {
    return this.$messagePatches.get(messageId) || [];
  }

  addMessagePatch(messageId, patchBody) {
    const patchId = this.uuid.create();
    this.$messagePatches.set(messageId, [
      ...this._getMessagePatches(messageId),
      { id: patchId, body: patchBody },
    ]);
    return patchId;
  }

  removeMessagePatch(messageId, patchId) {
    this.$messagePatches.set(
      messageId,
      this._getMessagePatches(messageId).filter(({ id }) => id !== patchId),
    );
  }

  applyMessagePatches(message, patches) {
    let patchedMessage = deepClone(message);
    for (const patch of patches) {
      patchedMessage = this.applyMessagePatch(patchedMessage, patch.body);
    }
    return patchedMessage;
  }

  applyMessagePatch(message, patchBody) {
    switch (patchBody.type) {
      case "addReaction": {
        const { reaction } = patchBody;
        const alreadyPresent = message.reactions.some(
          (existing) =>
            existing.sender.did === reaction.sender.did &&
            existing.value === reaction.value,
        );
        if (alreadyPresent) return message;
        return {
          ...message,
          reactions: [...message.reactions, reaction],
        };
      }
      case "removeReaction":
        const { currentUserDid, value } = patchBody;
        return {
          ...message,
          reactions: message.reactions.filter(
            (reaction) =>
              !(
                reaction.sender.did === currentUserDid &&
                reaction.value === value
              ),
          ),
        };
      default:
        throw new Error("Unknown patch type", patchBody.type);
    }
  }

  /* Convo Patches */

  _getConvoPatches(convoId) {
    return this.$convoPatches.get(convoId) || [];
  }

  addConvoPatch(convoId, patchBody) {
    const patchId = this.uuid.create();
    this.$convoPatches.set(convoId, [
      ...this._getConvoPatches(convoId),
      { id: patchId, body: patchBody },
    ]);
    return patchId;
  }

  removeConvoPatch(convoId, patchId) {
    this.$convoPatches.set(
      convoId,
      this._getConvoPatches(convoId).filter(({ id }) => id !== patchId),
    );
  }

  applyConvoPatches(convo, patches) {
    let patchedConvo = convo;
    for (const patch of patches) {
      patchedConvo = this.applyConvoPatch(patchedConvo, patch.body);
    }
    return patchedConvo;
  }

  applyConvoPatch(convo, patchBody) {
    switch (patchBody.type) {
      case "setConvoMuted":
        return { ...convo, muted: patchBody.muted };
      default:
        throw new Error(`Unknown patch type: ${patchBody.type}`);
    }
  }

  /* Preference Patches */

  addPreferencePatch(patchBody) {
    const patchId = this.uuid.create();
    const patches = this.$preferencePatches.get();
    this.$preferencePatches.set([...patches, { id: patchId, body: patchBody }]);
    return patchId;
  }

  removePreferencePatch(patchId) {
    const patches = this.$preferencePatches.get();
    this.$preferencePatches.set(patches.filter(({ id }) => id !== patchId));
  }

  applyPreferencePatches(preferences, patches) {
    let patchedPreferences = preferences.clone();
    for (const patch of patches) {
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
        return preferences.pinFeed(patchBody.feedUri, patchBody.entryType);
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
      case "removeRecentSearch":
        return preferences.removeRecentSearch(patchBody.q);
      case "removeRecentSearchProfile":
        return preferences.removeRecentSearchProfile(patchBody.did);
      default:
        throw new Error("Unknown patch type", patchBody.type);
    }
  }

  /* Current User Patches */

  addCurrentUserPatch(patchBody) {
    const patchId = this.uuid.create();
    const patches = this.$currentUserPatches.get();
    this.$currentUserPatches.set([
      ...patches,
      { id: patchId, body: patchBody },
    ]);
    return patchId;
  }

  removeCurrentUserPatch(patchId) {
    const patches = this.$currentUserPatches.get();
    this.$currentUserPatches.set(patches.filter(({ id }) => id !== patchId));
  }

  applyCurrentUserPatches(user, patches) {
    if (!user) return user;
    let patched = deepClone(user);
    for (const patch of patches) {
      patched = this.applyCurrentUserPatch(patched, patch.body);
    }
    return patched;
  }

  applyCurrentUserPatch(user, patchBody) {
    switch (patchBody.type) {
      case "setPinnedPost":
        return { ...user, pinnedPost: patchBody.pinnedPost };
      case "clearPinnedPost": {
        const { pinnedPost: _, ...rest } = user;
        return rest;
      }
      default:
        throw new Error("Unknown patch type", patchBody.type);
    }
  }

  /* Author Feed Patches */

  _getAuthorFeedPatches(feedURI) {
    return this.$authorFeedPatches.get(feedURI) || [];
  }

  addAuthorFeedPatch(feedURI, patchBody) {
    const patchId = this.uuid.create();
    this.$authorFeedPatches.set(feedURI, [
      ...this._getAuthorFeedPatches(feedURI),
      { id: patchId, body: patchBody },
    ]);
    return patchId;
  }

  removeAuthorFeedPatch(feedURI, patchId) {
    this.$authorFeedPatches.set(
      feedURI,
      this._getAuthorFeedPatches(feedURI).filter(({ id }) => id !== patchId),
    );
  }

  applyAuthorFeedPatches(feedURI, feed) {
    if (!feed) return feed;
    const patches = this._getAuthorFeedPatches(feedURI);
    let patched = { feed: [...feed.feed], cursor: feed.cursor };
    for (const patch of patches) {
      patched = this.applyAuthorFeedPatch(patched, patch.body);
    }
    return patched;
  }

  applyAuthorFeedPatch(feed, patchBody) {
    switch (patchBody.type) {
      case "pinPost":
        return { ...feed, feed: pinPostInFeed(feed.feed, patchBody.post) };
      case "unpinPost":
        return { ...feed, feed: unpinPostInFeed(feed.feed, patchBody.post) };
      default:
        throw new Error("Unknown patch type", patchBody.type);
    }
  }
}
