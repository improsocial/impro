import { deepClone, SimpleUUID } from "/js/utils.js";
import { pinPostInFeed, unpinPostInFeed } from "/js/dataHelpers.js";
import { Signal, SignalMap, ComputedMap, ReactiveStore } from "/js/signals.js";

// The store saves patch data for optimistic updates.
export class PatchStore extends ReactiveStore {
  constructor(dataStore) {
    super("patchStore");
    this.dataStore = dataStore;
    this.postPatches = new Map();
    this.$postPatches = new SignalMap();

    this.$patchedPosts = new ComputedMap((postURI) => {
      const post = this.dataStore.$posts.get(postURI).get();
      if (!post) return null;
      const patches = this.$postPatches.get(postURI).get() || [];
      return this.applyPostPatches(post, patches);
    });

    this.$profilePatches = new SignalMap();
    this.$patchedProfiles = new ComputedMap((did) => {
      const profile = this.dataStore.$profiles.get(did).get();
      if (!profile) return null;
      const patches = this.$profilePatches.get(did).get() || [];
      return this.applyProfilePatches(profile, patches);
    });

    this.$messagePatches = new SignalMap();
    this.$patchedMessages = new ComputedMap((messageId) => {
      const message = this.dataStore.$messages.get(messageId).get();
      if (!message) return null;
      const patches = this.$messagePatches.get(messageId).get() || [];
      let patchedMessage = message;
      for (const patch of patches) {
        patchedMessage = this.applyMessagePatch(patchedMessage, patch.body);
      }
      return patchedMessage;
    });
    this.$preferencePatches = new Signal.State([]);
    this.$currentUserPatches = new Signal.State([]);
    this.$authorFeedPatches = new SignalMap();
    this.uuid = new SimpleUUID();
  }

  /* Post Patches */

  _getPostPatches(postURI) {
    return this.postPatches.get(postURI) || [];
  }

  addPostPatch(postURI, patchBody) {
    const patchId = this.uuid.create();
    const patchesForPost = this.$postPatches.get(postURI);
    let patchArray = patchesForPost.get() || [];
    patchArray = [...patchArray, { id: patchId, body: patchBody }];
    patchesForPost.set(patchArray);
    return patchId;
  }

  removePostPatch(postURI, patchId) {
    const patchesForPost = this.$postPatches.get(postURI);
    let patchArray = patchesForPost.get() || [];
    patchArray = patchArray.filter(({ id }) => id !== patchId);
    patchesForPost.set(patchArray);
  }

  applyPostPatches(post, patches) {
    let patchedPost = deepClone(post);
    for (const patch of patches) {
      patchedPost = this.applyPostPatch(patchedPost, patch.body);
    }
    if (patchedPost.author) {
      patchedPost = {
        ...patchedPost,
        author: this.applyProfilePatches(patchedPost.author),
      };
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
    return this.$profilePatches.get(profileURI).get() || [];
  }

  addProfilePatch(profileURI, patchBody) {
    const patchId = this.uuid.create();
    const signal = this.$profilePatches.get(profileURI);
    const patches = signal.get() || [];
    signal.set([...patches, { id: patchId, body: patchBody }]);
    return patchId;
  }

  removeProfilePatch(profileURI, patchId) {
    const signal = this.$profilePatches.get(profileURI);
    const patches = signal.get() || [];
    signal.set(patches.filter(({ id }) => id !== patchId));
  }

  applyProfilePatches(profile, patches) {
    const profilePatches = patches ?? this._getProfilePatches(profile.did);
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
    return this.$messagePatches.get(messageId).get() || [];
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
    const preferencePatches = patches ?? this.$preferencePatches.get();
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
    const currentUserPatches = patches ?? this.$currentUserPatches.get();
    let patched = deepClone(user);
    for (const patch of currentUserPatches) {
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
    return this.$authorFeedPatches.get(feedURI).get() || [];
  }

  addAuthorFeedPatch(feedURI, patchBody) {
    const patchId = this.uuid.create();
    const signal = this.$authorFeedPatches.get(feedURI);
    const patches = signal.get() || [];
    signal.set([...patches, { id: patchId, body: patchBody }]);
    return patchId;
  }

  removeAuthorFeedPatch(feedURI, patchId) {
    const signal = this.$authorFeedPatches.get(feedURI);
    const patches = signal.get() || [];
    signal.set(patches.filter(({ id }) => id !== patchId));
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
