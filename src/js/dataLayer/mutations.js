import {
  parseUri,
  createNotFoundPost,
  addFeedItemToFeed,
  pinPostInFeed,
  unpinPostInFeed,
} from "/js/dataHelpers.js";
import { getCurrentTimestamp } from "/js/utils.js";
import { PostCreator } from "/js/postCreator.js";

// Handles mutations to the data, making optimistic updates if needed.
export class Mutations {
  constructor(api, dataStore, patchStore, preferencesProvider) {
    this.api = api;
    this.dataStore = dataStore;
    this.patchStore = patchStore;
    this.preferencesProvider = preferencesProvider;
    this.postCreator = new PostCreator(api);
  }

  async addLike(post) {
    // Optimistic update
    const patchId = this.patchStore.addPostPatch(post.uri, {
      type: "addLike",
    });
    try {
      const like = await this.api.createLikeRecord(post);
      // update post in store
      this.dataStore.$posts.set(post.uri, {
        ...post,
        viewer: { ...post.viewer, like: like.uri },
        likeCount: post.likeCount + 1,
      });
      // If the "likes" feed is loaded, add the post to it.
      const currentUser = this.dataStore.$currentUser.get();
      if (currentUser) {
        const feedURI = `${currentUser.did}-likes`;
        const likedFeed = this.dataStore.$authorFeeds.get(feedURI);
        if (likedFeed) {
          this.dataStore.$authorFeeds.set(feedURI, {
            feed: [{ post: post }, ...likedFeed.feed],
            cursor: likedFeed.cursor,
          });
        }
      }
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      // clear patch
      this.patchStore.removePostPatch(post.uri, patchId);
    }
  }

  async removeLike(post) {
    // Optimistic update
    const patchId = this.patchStore.addPostPatch(post.uri, {
      type: "removeLike",
    });
    try {
      await this.api.deleteLikeRecord(post);
      // update post in store
      this.dataStore.$posts.set(post.uri, {
        ...post,
        viewer: { ...post.viewer, like: null },
        likeCount: post.likeCount - 1,
      });
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      // clear patch
      this.patchStore.removePostPatch(post.uri, patchId);
    }
  }

  async createRepost(post) {
    const patchId = this.patchStore.addPostPatch(post.uri, {
      type: "createRepost",
    });
    try {
      const repost = await this.api.createRepostRecord(post);
      this.dataStore.$posts.set(post.uri, {
        ...post,
        viewer: { ...post.viewer, repost: repost.uri },
        repostCount: post.repostCount + 1,
      });
      // If the current user's author feed is loaded, add the repost to it.
      const currentUser = this.dataStore.$currentUser.get();
      if (currentUser) {
        const authorFeedURI = `${currentUser.did}-posts`;
        const authorFeed = this.dataStore.$authorFeeds.get(authorFeedURI);
        if (authorFeed) {
          const newFeedItem = {
            post: post,
            reason: {
              $type: "app.bsky.feed.defs#reasonRepost",
              by: currentUser,
              uri: repost.uri,
              cid: repost.cid,
              indexedAt: new Date().toISOString(),
            },
          };
          this.dataStore.$authorFeeds.set(authorFeedURI, {
            feed: addFeedItemToFeed(newFeedItem, authorFeed.feed),
            cursor: authorFeed.cursor,
          });
        }
      }
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      // clear patch
      this.patchStore.removePostPatch(post.uri, patchId);
    }
  }

  async deleteRepost(post) {
    const patchId = this.patchStore.addPostPatch(post.uri, {
      type: "deleteRepost",
    });
    try {
      await this.api.deleteRepostRecord(post);
      this.dataStore.$posts.set(post.uri, {
        ...post,
        viewer: { ...post.viewer, repost: null },
        repostCount: post.repostCount - 1,
      });
      // If the current user's author feed is loaded, remove the repost from it.
      const currentUser = this.dataStore.$currentUser.get();
      if (currentUser) {
        const authorFeedURI = `${currentUser.did}-posts`;
        const authorFeed = this.dataStore.$authorFeeds.get(authorFeedURI);
        if (authorFeed) {
          this.dataStore.$authorFeeds.set(authorFeedURI, {
            feed: authorFeed.feed.filter((feedItem) => {
              if (
                feedItem.reason?.$type === "app.bsky.feed.defs#reasonRepost" &&
                feedItem.reason?.uri === post.viewer.repost
              ) {
                return false;
              }
              return true;
            }),
            cursor: authorFeed.cursor,
          });
        }
      }
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      // clear patch
      this.patchStore.removePostPatch(post.uri, patchId);
    }
  }

  async addBookmark(post) {
    // Optimistic update
    const patchId = this.patchStore.addPostPatch(post.uri, {
      type: "addBookmark",
    });
    try {
      await this.api.createBookmark(post);
      // update post in store
      this.dataStore.$posts.set(post.uri, {
        ...post,
        viewer: { ...post.viewer, bookmarked: true },
        bookmarkCount: post.bookmarkCount + 1,
      });
      // If the bookmarks feed is loaded, add the post to it.
      const bookmarks = this.dataStore.$bookmarks.get();
      if (bookmarks) {
        this.dataStore.$bookmarks.set({
          feed: [{ post: { ...post } }, ...bookmarks.feed],
          cursor: bookmarks.cursor,
        });
      }
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      // clear patch
      this.patchStore.removePostPatch(post.uri, patchId);
    }
  }

  async removeBookmark(post) {
    // Optimistic update
    const patchId = this.patchStore.addPostPatch(post.uri, {
      type: "removeBookmark",
    });
    try {
      await this.api.deleteBookmark(post);
      // update post in store
      this.dataStore.$posts.set(post.uri, {
        ...post,
        viewer: { ...post.viewer, bookmarked: false },
        bookmarkCount: post.bookmarkCount - 1,
      });
      // If the bookmarks feed is loaded, remove the post from it.
      const bookmarks = this.dataStore.$bookmarks.get();
      if (bookmarks) {
        this.dataStore.$bookmarks.set({
          feed: bookmarks.feed.filter((item) => item.post?.uri !== post.uri),
          cursor: bookmarks.cursor,
        });
      }
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      // clear patch
      this.patchStore.removePostPatch(post.uri, patchId);
    }
  }

  async followProfile(profile) {
    const patchId = this.patchStore.addProfilePatch(profile.did, {
      type: "followProfile",
    });
    try {
      const follow = await this.api.createFollowRecord(profile);
      // todo update followers count
      this.dataStore.$profiles.set(profile.did, {
        ...profile,
        followersCount: profile.followersCount + 1,
        viewer: { ...profile.viewer, following: follow.uri },
      });
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      // clear patch
      this.patchStore.removeProfilePatch(profile.did, patchId);
    }
  }

  async addProfileToList(profile, list) {
    const result = await this.api.createListItemRecord(list.uri, profile.did);
    const current = this.dataStore.$currentUserListMemberships.get() || [];
    this.dataStore.$currentUserListMemberships.set([
      ...current,
      { uri: result.uri, listUri: list.uri, subjectDid: profile.did },
    ]);
    // Add to cached list members
    const cachedMembers = this.dataStore.$listMembers.get(list.uri);
    if (
      cachedMembers &&
      !cachedMembers.members.some((member) => member.did === profile.did)
    ) {
      this.dataStore.$listMembers.set(list.uri, {
        ...cachedMembers,
        members: [profile, ...cachedMembers.members],
      });
    }
  }

  async removeProfileFromList(profile, list, membershipUri) {
    await this.api.deleteListItemRecord(membershipUri);
    const current = this.dataStore.$currentUserListMemberships.get() || [];
    this.dataStore.$currentUserListMemberships.set(
      current.filter((membership) => membership.uri !== membershipUri),
    );
    // Remove from cached list members
    const cachedMembers = this.dataStore.$listMembers.get(list.uri);
    if (cachedMembers) {
      this.dataStore.$listMembers.set(list.uri, {
        ...cachedMembers,
        members: cachedMembers.members.filter(
          (member) => member.did !== profile.did,
        ),
      });
    }
  }

  async unfollowProfile(profile) {
    const patchId = this.patchStore.addProfilePatch(profile.did, {
      type: "unfollowProfile",
    });
    try {
      await this.api.deleteFollowRecord(profile);
      this.dataStore.$profiles.set(profile.did, {
        ...profile,
        followersCount: profile.followersCount - 1,
        viewer: { ...profile.viewer, following: null },
      });
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      // clear patch
      this.patchStore.removeProfilePatch(profile.did, patchId);
    }
  }

  async sendShowLessInteraction(postURI, feedContext, feedProxyUrl) {
    const showLessInteraction = {
      item: postURI,
      event: "app.bsky.feed.defs#requestLess",
      feedContext,
    };
    this.dataStore.$showLessInteractions.set([
      ...this.dataStore.$showLessInteractions.get(),
      showLessInteraction,
    ]);
    try {
      await this.api.sendInteractions([showLessInteraction], feedProxyUrl);
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async sendShowMoreInteraction(postURI, feedContext, feedProxyUrl) {
    const showMoreInteraction = {
      item: postURI,
      event: "app.bsky.feed.defs#requestMore",
      feedContext,
    };
    // Note, we don't really need to store this interaction because we don't use it in the UI (yet).
    // But, let's do it anyway for consistency.
    this.dataStore.$showMoreInteractions.set([
      ...this.dataStore.$showMoreInteractions.get(),
      showMoreInteraction,
    ]);
    try {
      await this.api.sendInteractions([showMoreInteraction], feedProxyUrl);
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async pinFeed(feedUri) {
    const patchId = this.patchStore.addPreferencePatch({
      type: "pinFeed",
      feedUri,
      entryType: "feed",
    });
    const preferences = this.preferencesProvider.requirePreferences();
    const newPreferences = preferences.pinFeed(feedUri, "feed");
    try {
      await this.preferencesProvider.updatePreferences(newPreferences);
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      this.patchStore.removePreferencePatch(patchId);
    }
  }

  async pinList(listUri) {
    const patchId = this.patchStore.addPreferencePatch({
      type: "pinFeed",
      feedUri: listUri,
      entryType: "list",
    });
    const preferences = this.preferencesProvider.requirePreferences();
    const newPreferences = preferences.pinFeed(listUri, "list");
    try {
      await this.preferencesProvider.updatePreferences(newPreferences);
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      this.patchStore.removePreferencePatch(patchId);
    }
  }

  async unpinFeed(feedUri) {
    const patchId = this.patchStore.addPreferencePatch({
      type: "unpinFeed",
      feedUri,
    });
    const preferences = this.preferencesProvider.requirePreferences();
    const newPreferences = preferences.unpinFeed(feedUri);
    try {
      await this.preferencesProvider.updatePreferences(newPreferences);
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      this.patchStore.removePreferencePatch(patchId);
    }
  }

  async unpinList(listUri) {
    const patchId = this.patchStore.addPreferencePatch({
      type: "unpinFeed",
      feedUri: listUri,
    });
    const preferences = this.preferencesProvider.requirePreferences();
    const newPreferences = preferences.unpinFeed(listUri);
    try {
      await this.preferencesProvider.updatePreferences(newPreferences);
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      this.patchStore.removePreferencePatch(patchId);
    }
  }

  async hidePost(post) {
    const patchId = this.patchStore.addPostPatch(post.uri, {
      type: "hidePost",
    });
    const preferences = this.preferencesProvider.requirePreferences();
    const newPreferences = preferences.hidePost(post.uri);
    try {
      await this.preferencesProvider.updatePreferences(newPreferences);
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      // clear patch
      this.patchStore.removePostPatch(post.uri, patchId);
    }
  }

  async addMutedWord({ value, targets, actorTarget, expiresAt }) {
    const preferences = this.preferencesProvider.requirePreferences();
    const newPreferences = preferences.addMutedWord({
      value,
      targets,
      actorTarget,
      expiresAt,
    });
    await this.preferencesProvider.updatePreferences(newPreferences);
  }

  async removeMutedWord(wordId) {
    const preferences = this.preferencesProvider.requirePreferences();
    const newPreferences = preferences.removeMutedWord(wordId);
    await this.preferencesProvider.updatePreferences(newPreferences);
  }

  async updateMutedWord(wordId, updatedFields) {
    const preferences = this.preferencesProvider.requirePreferences();
    const newPreferences = preferences.updateMutedWord(wordId, updatedFields);
    await this.preferencesProvider.updatePreferences(newPreferences);
  }

  async subscribeLabeler(profile, labelerInfo) {
    const patchId = this.patchStore.addPreferencePatch({
      type: "subscribeLabeler",
      did: profile.did,
      labelerInfo,
    });
    const preferences = this.preferencesProvider.requirePreferences();
    const newPreferences = preferences.subscribeLabeler(
      profile.did,
      labelerInfo,
    );

    try {
      await this.preferencesProvider.updatePreferences(newPreferences);
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      this.patchStore.removePreferencePatch(patchId);
    }
  }

  async unsubscribeLabeler(profile) {
    const patchId = this.patchStore.addPreferencePatch({
      type: "unsubscribeLabeler",
      did: profile.did,
    });
    const preferences = this.preferencesProvider.requirePreferences();
    const newPreferences = preferences.unsubscribeLabeler(profile.did);
    try {
      await this.preferencesProvider.updatePreferences(newPreferences);
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      this.patchStore.removePreferencePatch(patchId);
    }
  }

  async updateLabelerSetting({ labelerDid, label, visibility }) {
    const patchId = this.patchStore.addPreferencePatch({
      type: "setContentLabelPref",
      label,
      visibility,
      labelerDid,
    });
    const preferences = this.preferencesProvider.requirePreferences();
    const newPreferences = preferences.setContentLabelPref({
      label,
      visibility,
      labelerDid,
    });
    try {
      await this.preferencesProvider.updatePreferences(newPreferences);
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      this.patchStore.removePreferencePatch(patchId);
    }
  }

  async muteProfile(profile) {
    const patchId = this.patchStore.addProfilePatch(profile.did, {
      type: "muteProfile",
    });
    try {
      await this.api.muteActor(profile.did);
      this.dataStore.$profiles.set(profile.did, {
        ...profile,
        viewer: { ...profile.viewer, muted: true },
      });
      this._updatePostsByAuthor(profile.did, (post) => {
        return {
          ...post,
          author: {
            ...post.author,
            viewer: { ...post.author.viewer, muted: true },
          },
        };
      });
      const mutedProfiles = this.dataStore.$mutedProfiles.get();
      if (mutedProfiles) {
        const alreadyListed = mutedProfiles.mutes.some(
          (muted) => muted.did === profile.did,
        );
        if (!alreadyListed) {
          this.dataStore.$mutedProfiles.set({
            ...mutedProfiles,
            mutes: [
              {
                ...profile,
                viewer: { ...profile.viewer, muted: true },
              },
              ...mutedProfiles.mutes,
            ],
          });
        }
      }
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      this.patchStore.removeProfilePatch(profile.did, patchId);
    }
  }

  async unmuteProfile(profile) {
    const patchId = this.patchStore.addProfilePatch(profile.did, {
      type: "unmuteProfile",
    });
    try {
      await this.api.unmuteActor(profile.did);
      this.dataStore.$profiles.set(profile.did, {
        ...profile,
        viewer: { ...profile.viewer, muted: false },
      });
      this._updatePostsByAuthor(profile.did, (post) => {
        return {
          ...post,
          author: {
            ...post.author,
            viewer: { ...post.author.viewer, muted: false },
          },
        };
      });
      const mutedProfiles = this.dataStore.$mutedProfiles.get();
      if (mutedProfiles) {
        this.dataStore.$mutedProfiles.set({
          ...mutedProfiles,
          mutes: mutedProfiles.mutes.filter(
            (muted) => muted.did !== profile.did,
          ),
        });
      }
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      this.patchStore.removeProfilePatch(profile.did, patchId);
    }
  }

  async blockProfile(profile) {
    const patchId = this.patchStore.addProfilePatch(profile.did, {
      type: "blockProfile",
    });
    try {
      const block = await this.api.blockActor(profile);
      this.dataStore.$profiles.set(profile.did, {
        ...profile,
        viewer: { ...profile.viewer, blocking: block.uri },
      });
      this._updatePostsByAuthor(profile.did, (post) => {
        return {
          ...post,
          author: {
            ...post.author,
            viewer: { ...post.author.viewer, blocking: block.uri },
          },
        };
      });
      const blockedProfiles = this.dataStore.$blockedProfiles.get();
      if (blockedProfiles) {
        const alreadyListed = blockedProfiles.blocks.some(
          (blocked) => blocked.did === profile.did,
        );
        if (!alreadyListed) {
          this.dataStore.$blockedProfiles.set({
            ...blockedProfiles,
            blocks: [
              {
                ...profile,
                viewer: { ...profile.viewer, blocking: block.uri },
              },
              ...blockedProfiles.blocks,
            ],
          });
        }
      }
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      this.patchStore.removeProfilePatch(profile.did, patchId);
    }
  }

  async updatePostNotificationSubscription(profile, activitySubscription) {
    const patchId = this.patchStore.addProfilePatch(profile.did, {
      type: "updatePostNotificationSubscription",
      activitySubscription,
    });
    try {
      await this.api.putActivitySubscription(profile.did, activitySubscription);
      this.dataStore.$profiles.set(profile.did, {
        ...profile,
        viewer: { ...profile.viewer, activitySubscription },
      });
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      this.patchStore.removeProfilePatch(profile.did, patchId);
    }
  }

  async unblockProfile(profile) {
    const patchId = this.patchStore.addProfilePatch(profile.did, {
      type: "unblockProfile",
    });
    try {
      await this.api.unblockActor(profile);
      this.dataStore.$profiles.set(profile.did, {
        ...profile,
        viewer: { ...profile.viewer, blocking: null },
      });
      this._updatePostsByAuthor(profile.did, (post) => {
        return {
          ...post,
          author: {
            ...post.author,
            viewer: { ...post.author.viewer, blocking: null },
          },
        };
      });
      const blockedProfiles = this.dataStore.$blockedProfiles.get();
      if (blockedProfiles) {
        this.dataStore.$blockedProfiles.set({
          ...blockedProfiles,
          blocks: blockedProfiles.blocks.filter(
            (blocked) => blocked.did !== profile.did,
          ),
        });
      }
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      this.patchStore.removeProfilePatch(profile.did, patchId);
    }
  }

  async updateProfile(
    profile,
    {
      displayName,
      description,
      avatarBlob,
      bannerBlob,
      removeAvatar,
      removeBanner,
    },
  ) {
    const [avatarRef, bannerRef] = await Promise.all([
      avatarBlob ? this.api.uploadBlob(avatarBlob) : null,
      bannerBlob ? this.api.uploadBlob(bannerBlob) : null,
    ]);

    let existingRecord = {};
    let swapCid = null;
    try {
      const recordData = await this.api.getProfileRecord();
      existingRecord = recordData.value || {};
      swapCid = recordData.cid;
    } catch (error) {
      if (error.status === 400) {
        // No existing record is ok
      } else {
        throw error;
      }
    }

    const updatedRecord = { ...existingRecord };
    if (displayName !== undefined) {
      updatedRecord.displayName = displayName;
    }
    if (description !== undefined) {
      updatedRecord.description = description;
    }
    if (avatarRef) {
      updatedRecord.avatar = avatarRef;
    } else if (removeAvatar) {
      delete updatedRecord.avatar;
    }
    if (bannerRef) {
      updatedRecord.banner = bannerRef;
    } else if (removeBanner) {
      delete updatedRecord.banner;
    }

    await this.api.putProfileRecord(updatedRecord, swapCid);

    const preferences = this.preferencesProvider.requirePreferences();
    const labelers = preferences.getLabelerDids();
    // Fetch full profile to get updated image urls
    const updatedProfile = await this.api.getProfile(profile.did, { labelers });
    this.dataStore.$profiles.set(updatedProfile.did, updatedProfile);
    const currentUser = this.dataStore.$currentUser.get();
    if (currentUser && currentUser.did === updatedProfile.did) {
      this.dataStore.$currentUser.set({
        ...currentUser,
        ...updatedProfile,
      });
    }
  }

  async pinPost(post) {
    const currentUser = this.dataStore.$currentUser.get();
    if (!currentUser) throw new Error("No current user");
    const authorFeedURI = `${currentUser.did}-posts`;
    const pinnedRef = { uri: post.uri, cid: post.cid };

    // Optimistic update via patches on currentUser and author feed
    const userPatchId = this.patchStore.addCurrentUserPatch({
      type: "setPinnedPost",
      pinnedPost: pinnedRef,
    });
    const feedPatchId = this.patchStore.addAuthorFeedPatch(authorFeedURI, {
      type: "pinPost",
      post,
    });

    try {
      const recordData = await this.api.getProfileRecord();
      const existingRecord = recordData.value || {};
      const swapCid = recordData.cid;
      await this.api.putProfileRecord(
        { ...existingRecord, pinnedPost: pinnedRef },
        swapCid,
      );
      // Commit to dataStore
      const latestUser = this.dataStore.$currentUser.get();
      if (latestUser) {
        this.dataStore.$currentUser.set({
          ...latestUser,
          pinnedPost: pinnedRef,
        });
      }
      const existingFeed = this.dataStore.$authorFeeds.get(authorFeedURI);
      if (existingFeed) {
        this.dataStore.$authorFeeds.set(authorFeedURI, {
          feed: pinPostInFeed(existingFeed.feed, post),
          cursor: existingFeed.cursor,
        });
      }
    } finally {
      this.patchStore.removeCurrentUserPatch(userPatchId);
      this.patchStore.removeAuthorFeedPatch(authorFeedURI, feedPatchId);
    }
  }

  async unpinPost(post) {
    const currentUser = this.dataStore.$currentUser.get();
    if (!currentUser) throw new Error("No current user");
    if (currentUser.pinnedPost?.uri !== post.uri) {
      // Already unpinned (or a different post is pinned); nothing to do.
      return;
    }
    const authorFeedURI = `${currentUser.did}-posts`;

    const userPatchId = this.patchStore.addCurrentUserPatch({
      type: "clearPinnedPost",
    });
    const feedPatchId = this.patchStore.addAuthorFeedPatch(authorFeedURI, {
      type: "unpinPost",
      post,
    });

    try {
      const recordData = await this.api.getProfileRecord();
      const existingRecord = recordData.value || {};
      const swapCid = recordData.cid;
      const { pinnedPost: _, ...updatedRecord } = existingRecord;
      await this.api.putProfileRecord(updatedRecord, swapCid);
      // Commit to dataStore
      const latestUser = this.dataStore.$currentUser.get();
      if (latestUser) {
        const { pinnedPost: _, ...rest } = latestUser;
        this.dataStore.$currentUser.set(rest);
      }
      const existingFeed = this.dataStore.$authorFeeds.get(authorFeedURI);
      if (existingFeed) {
        this.dataStore.$authorFeeds.set(authorFeedURI, {
          feed: unpinPostInFeed(existingFeed.feed, post),
          cursor: existingFeed.cursor,
        });
      }
    } finally {
      this.patchStore.removeCurrentUserPatch(userPatchId);
      this.patchStore.removeAuthorFeedPatch(authorFeedURI, feedPatchId);
    }
  }

  async createPost({
    postText,
    facets,
    external,
    replyTo,
    replyRoot,
    quotedPost,
    images,
    video,
  }) {
    const post = await this.postCreator.createPost({
      postText,
      facets,
      external,
      replyTo,
      replyRoot,
      quotedPost,
      images,
      video,
    });
    // NOTE: LEXICON DEVIATION
    post.viewer.priorityReply = true;
    // Update the post in the store
    this.dataStore.$posts.set(post.uri, post);
    // If it's a reply, update the reply post thread in the store
    if (replyTo) {
      const replyPostThread = this.dataStore.$postThreads.get(replyTo.uri);
      if (replyPostThread) {
        this.dataStore.$postThreads.set(replyTo.uri, {
          ...replyPostThread,
          replies: [
            {
              $type: "app.bsky.feed.defs#threadViewPost",
              post: post,
              replies: [],
            },
            ...replyPostThread.replies,
          ],
        });
      }
    }
    // If the author feed is loaded, add the new post to it
    const { repo: did } = parseUri(post.uri);
    const authorFeedURI = replyTo ? `${did}-replies` : `${did}-posts`; // TODO - handle media tab too?
    const authorFeed = this.dataStore.$authorFeeds.get(authorFeedURI);
    if (authorFeed) {
      this.dataStore.$authorFeeds.set(authorFeedURI, {
        feed: addFeedItemToFeed({ post }, authorFeed.feed),
        cursor: authorFeed.cursor,
      });
    }
    return post;
  }

  async deletePost(post) {
    // no optimistic update
    await this.api.deletePost(post);
    // Replace the post with a not found post.
    // This *should* remove the post from all relevant places in the UI.
    this.dataStore.$posts.set(post.uri, createNotFoundPost(post.uri));
  }

  async createMessage(convoId, { text, facets }) {
    // no optimistic update
    const res = await this.api.sendMessage(convoId, {
      text,
      facets,
    });
    this.dataStore.$messages.set(res.id, res);
    // Add the new message to the chat messages array in the dataStore
    const convoMessages = this.dataStore.$convoMessages.get(convoId);
    if (convoMessages) {
      this.dataStore.$convoMessages.set(convoId, {
        messages: [res, ...convoMessages.messages],
        cursor: convoMessages.cursor,
      });
    }
    // Update the last message in the convo
    const convo = this.dataStore.$convos.get(convoId);
    if (convo) {
      this.dataStore.$convos.set(convoId, {
        ...convo,
        lastMessage: {
          $type: "chat.bsky.convo.defs#messageView",
          ...res,
        },
      });
    }
    return res;
  }

  async acceptConvo(convo) {
    await this.api.acceptConvo(convo.id);

    // Create updated convo with accepted status
    const updatedConvo = {
      ...convo,
      status: "accepted",
    };

    this.dataStore.$convos.set(convo.id, updatedConvo);

    // Update the convo in the convo list
    const convoList = this.dataStore.$convoList.get();
    if (convoList) {
      const updatedList = convoList.map((c) =>
        c.id === convo.id ? updatedConvo : c,
      );
      this.dataStore.$convoList.set(updatedList);
    }

    return updatedConvo;
  }

  async rejectConvo(convo) {
    await this.api.leaveConvo(convo.id);
    this.dataStore.$convos.set(convo.id, null);
    const convoList = this.dataStore.$convoList.get();
    if (convoList) {
      const updatedList = convoList.filter((c) => c.id !== convo.id);
      this.dataStore.$convoList.set(updatedList);
    }
  }

  async markConvoAsRead(convoId) {
    await this.api.markConvoAsRead(convoId);
    const convo = this.dataStore.$convos.get(convoId);
    if (convo) {
      this.dataStore.$convos.set(convoId, {
        ...convo,
        unreadCount: 0,
      });
    }
  }

  async addMessageReaction(convoId, messageId, emoji, currentUserDid) {
    const patchId = this.patchStore.addMessagePatch(messageId, {
      type: "addReaction",
      reaction: {
        createdAt: getCurrentTimestamp(),
        sender: { did: currentUserDid },
        value: emoji,
      },
    });
    try {
      const message = await this.api.addMessageReaction(
        convoId,
        messageId,
        emoji,
      );
      this.dataStore.$messages.set(messageId, message);
      // Update the last reaction in the convo
      const convo = this.dataStore.$convos.get(convoId);
      if (convo) {
        this.dataStore.$convos.set(convoId, {
          ...convo,
          lastReaction: {
            $type: "chat.bsky.convo.defs#messageAndReactionView",
            message: message,
            reaction: message.reactions[0],
          },
        });
      }
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      this.patchStore.removeMessagePatch(messageId, patchId);
    }
  }

  async removeMessageReaction(convoId, messageId, emoji, currentUserDid) {
    const patchId = this.patchStore.addMessagePatch(messageId, {
      type: "removeReaction",
      currentUserDid,
      value: emoji,
    });
    try {
      const message = await this.api.removeMessageReaction(
        convoId,
        messageId,
        emoji,
      );
      this.dataStore.$messages.set(messageId, message);
      // Update the last reaction in the convo
      const convo = this.dataStore.$convos.get(convoId);
      if (convo) {
        this.dataStore.$convos.set(convoId, {
          ...convo,
          lastReaction: null,
        });
      }
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      this.patchStore.removeMessagePatch(messageId, patchId);
    }
  }

  _updatePostsByAuthor(profileDid, updateFunc) {
    for (const post of this.dataStore.$posts.values()) {
      if (post?.author?.did === profileDid) {
        this.dataStore.$posts.set(post.uri, updateFunc(post));
      }
    }
  }
}
