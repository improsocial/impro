import {
  parseUri,
  createNotFoundPost,
  addFeedItemToFeed,
  pinPostInFeed,
  unpinPostInFeed,
  valueForPinnedItem,
  buildCdnUrl,
} from "/js/dataHelpers.js";
import { batch, getCurrentTimestamp } from "/js/utils.js";
import { PostCreator } from "/js/postCreator.js";
import { untrack } from "/js/signals.js";
import {
  Resources,
  actorListsQueryKey,
  authorFeedQueryKey,
  convoMessagesQueryKey,
  draftsQueryKey,
  listMembersQueryKey,
  pinnedItemsQueryKey,
  postThreadQueryKey,
} from "/js/dataLayer/queryKeys.js";

function updateAuthorFeedItems(queryStore, { did, feedType }, updateItems) {
  const queryKey = authorFeedQueryKey({ did, feedType });
  const collection = queryStore.get(queryKey);
  if (!collection?.pages?.length) {
    return;
  }
  const items = collection.pages.flatMap((page) => page.items);
  const nextItems = updateItems(items);
  if (nextItems === items) {
    return;
  }
  const cursor = collection.pages[collection.pages.length - 1].cursor;
  queryStore.set(queryKey, { pages: [{ items: nextItems, cursor }] });
}

// Handles mutations to the data, making optimistic updates if needed.
export class Mutations {
  constructor(
    api,
    dataStore,
    patchStore,
    preferencesProvider,
    identityResolver,
    draftMediaStore,
    queryStore,
  ) {
    this.api = api;
    this.dataStore = dataStore;
    this.queryStore = queryStore;
    this.patchStore = patchStore;
    this.preferencesProvider = preferencesProvider;
    this.draftMediaStore = draftMediaStore;
    this.postCreator = new PostCreator(api, identityResolver);
  }

  async addLike(post) {
    // Optimistic update
    const patchId = this.patchStore.addPostPatch(post.uri, {
      type: "addLike",
    });
    try {
      const like = await this.api.createLikeRecord(post);
      const latestPost = this.dataStore.$posts.get(post.uri) ?? post;
      if (!latestPost.viewer?.like) {
        this.dataStore.$posts.set(post.uri, {
          ...latestPost,
          viewer: { ...latestPost.viewer, like: like.uri },
          likeCount: latestPost.likeCount + 1,
        });
      }
      // If the "likes" feed is loaded, add the post to it.
      const currentUser = this.dataStore.$currentUser.get();
      if (currentUser) {
        updateAuthorFeedItems(
          this.queryStore,
          { did: currentUser.did, feedType: "likes" },
          (feedItems) =>
            feedItems.some((feedItem) => feedItem.post?.uri === post.uri)
              ? feedItems
              : [{ post: post }, ...feedItems],
        );
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
      const latestPost = this.dataStore.$posts.get(post.uri) ?? post;
      if (latestPost.viewer?.like) {
        this.dataStore.$posts.set(post.uri, {
          ...latestPost,
          viewer: { ...latestPost.viewer, like: null },
          likeCount: latestPost.likeCount - 1,
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

  async createRepost(post) {
    const patchId = this.patchStore.addPostPatch(post.uri, {
      type: "createRepost",
    });
    try {
      const repost = await this.api.createRepostRecord(post);
      const latestPost = this.dataStore.$posts.get(post.uri) ?? post;
      if (!latestPost.viewer?.repost) {
        this.dataStore.$posts.set(post.uri, {
          ...latestPost,
          viewer: { ...latestPost.viewer, repost: repost.uri },
          repostCount: latestPost.repostCount + 1,
        });
      }
      // If the current user's author feed is loaded, add the repost to it.
      const currentUser = this.dataStore.$currentUser.get();
      if (currentUser) {
        updateAuthorFeedItems(
          this.queryStore,
          { did: currentUser.did, feedType: "posts" },
          (feedItems) => {
            if (
              feedItems.some(
                (feedItem) =>
                  feedItem.post?.uri === post.uri &&
                  feedItem.reason?.$type ===
                    "app.bsky.feed.defs#reasonRepost" &&
                  feedItem.reason?.by?.did === currentUser.did,
              )
            ) {
              return feedItems;
            }
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
            return addFeedItemToFeed(newFeedItem, feedItems);
          },
        );
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
      const latestPost = this.dataStore.$posts.get(post.uri) ?? post;
      if (latestPost.viewer?.repost) {
        this.dataStore.$posts.set(post.uri, {
          ...latestPost,
          viewer: { ...latestPost.viewer, repost: null },
          repostCount: latestPost.repostCount - 1,
        });
      }
      // If the current user's author feed is loaded, remove the repost from it.
      const currentUser = this.dataStore.$currentUser.get();
      if (currentUser) {
        updateAuthorFeedItems(
          this.queryStore,
          { did: currentUser.did, feedType: "posts" },
          (feedItems) =>
            feedItems.filter((feedItem) => {
              if (
                feedItem.reason?.$type === "app.bsky.feed.defs#reasonRepost" &&
                feedItem.reason?.uri === post.viewer.repost
              ) {
                return false;
              }
              return true;
            }),
        );
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
      const latestPost = this.dataStore.$posts.get(post.uri) ?? post;
      if (!latestPost.viewer?.bookmarked) {
        this.dataStore.$posts.set(post.uri, {
          ...latestPost,
          viewer: { ...latestPost.viewer, bookmarked: true },
          bookmarkCount: latestPost.bookmarkCount + 1,
        });
      }
      // Add the post to every loaded bookmarks query.
      this.queryStore.prependToResource(Resources.BOOKMARKS, post.uri);
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
      const latestPost = this.dataStore.$posts.get(post.uri) ?? post;
      if (latestPost.viewer?.bookmarked) {
        this.dataStore.$posts.set(post.uri, {
          ...latestPost,
          viewer: { ...latestPost.viewer, bookmarked: false },
          bookmarkCount: latestPost.bookmarkCount - 1,
        });
      }
      // Remove the post from every loaded bookmarks query.
      this.queryStore.removeFromResource(Resources.BOOKMARKS, post.uri);
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
      const latestProfile =
        this.dataStore.$profiles.get(profile.did) ?? profile;
      if (!latestProfile.viewer?.following) {
        this.dataStore.$profiles.set(profile.did, {
          ...latestProfile,
          viewer: { ...latestProfile.viewer, following: follow.uri },
        });
      }
      const detailed = this.dataStore.$detailedProfiles.get(profile.did);
      if (detailed && !detailed.viewer?.following) {
        this.dataStore.$detailedProfiles.set(profile.did, {
          ...detailed,
          followersCount: detailed.followersCount + 1,
          viewer: { ...detailed.viewer, following: follow.uri },
        });
      }
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
    this.dataStore.setProfiles([profile]);
    this.dataStore.setListItemUri(list.uri, profile.did, result.uri);
    this.queryStore.prependToQuery(
      listMembersQueryKey({ listUri: list.uri }),
      profile.did,
    );
  }

  async removeProfileFromList(profile, list, membershipUri) {
    await this.api.deleteListItemRecord(membershipUri);
    this.dataStore.deleteListItemUri(list.uri, profile.did);
    this.queryStore.removeFromQuery(
      listMembersQueryKey({ listUri: list.uri }),
      profile.did,
    );
  }

  async unfollowProfile(profile) {
    const patchId = this.patchStore.addProfilePatch(profile.did, {
      type: "unfollowProfile",
    });
    try {
      await this.api.deleteFollowRecord(profile);
      const latestProfile =
        this.dataStore.$profiles.get(profile.did) ?? profile;
      if (latestProfile.viewer?.following) {
        this.dataStore.$profiles.set(profile.did, {
          ...latestProfile,
          viewer: { ...latestProfile.viewer, following: null },
        });
      }
      const detailed = this.dataStore.$detailedProfiles.get(profile.did);
      if (detailed?.viewer?.following) {
        this.dataStore.$detailedProfiles.set(profile.did, {
          ...detailed,
          followersCount: detailed.followersCount - 1,
          viewer: { ...detailed.viewer, following: null },
        });
      }
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      // clear patch
      this.patchStore.removeProfilePatch(profile.did, patchId);
    }
  }

  async sendShowLessInteraction(postURI, feedUri, feedContext, feedProxyUrl) {
    const showLessInteraction = {
      item: postURI,
      event: "app.bsky.feed.defs#requestLess",
      ...(feedContext != null ? { feedContext } : {}),
    };
    this.dataStore.$showLessInteractions.set(feedUri, [
      ...(this.dataStore.$showLessInteractions.get(feedUri) ?? []),
      showLessInteraction,
    ]);
    if (feedProxyUrl == null) {
      return;
    }
    try {
      await this.api.sendInteractions([showLessInteraction], feedProxyUrl);
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async sendShowMoreInteraction(postURI, feedUri, feedContext, feedProxyUrl) {
    const showMoreInteraction = {
      item: postURI,
      event: "app.bsky.feed.defs#requestMore",
      ...(feedContext != null ? { feedContext } : {}),
    };
    // Note, we don't really need to store this interaction because we don't use it in the UI (yet).
    // But, let's do it anyway for consistency.
    this.dataStore.$showMoreInteractions.set(feedUri, [
      ...(this.dataStore.$showMoreInteractions.get(feedUri) ?? []),
      showMoreInteraction,
    ]);
    if (feedProxyUrl == null) {
      return;
    }
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
    const preferences = await this.preferencesProvider.requirePreferences();
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
    const preferences = await this.preferencesProvider.requirePreferences();
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
    const preferences = await this.preferencesProvider.requirePreferences();
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
    const preferences = await this.preferencesProvider.requirePreferences();
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

  async setPinnedItems(values) {
    const preferences = await this.preferencesProvider.requirePreferences();
    const newPreferences = preferences.setPinnedItems(values);
    try {
      await this.preferencesProvider.updatePreferences(newPreferences);
    } catch (error) {
      console.error(error);
      throw error;
    }

    // Update pinned items in memory
    const pinnedItems = untrack(() =>
      this.queryStore.getItems(pinnedItemsQueryKey()),
    );
    if (pinnedItems) {
      const byValue = new Map(
        pinnedItems.map((item) => [valueForPinnedItem(item), item]),
      );
      const next = values.map((value) => byValue.get(value)).filter(Boolean);
      this.dataStore.setPinnedItems(next);
    }
  }

  setSelectedFeedUri(feedUri) {
    this.dataStore.$selectedFeedUri.set(feedUri);
  }

  async hidePost(post) {
    const patchId = this.patchStore.addPostPatch(post.uri, {
      type: "hidePost",
    });
    const preferences = await this.preferencesProvider.requirePreferences();
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

  async addRecentSearch(q) {
    const preferences = await this.preferencesProvider.requirePreferences();
    const newPreferences = preferences.addRecentSearch(q);
    await this.preferencesProvider.updatePreferences(newPreferences);
  }

  async removeRecentSearch(q) {
    const patchId = this.patchStore.addPreferencePatch({
      type: "removeRecentSearch",
      q,
    });
    const preferences = await this.preferencesProvider.requirePreferences();
    const newPreferences = preferences.removeRecentSearch(q);
    try {
      await this.preferencesProvider.updatePreferences(newPreferences);
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      this.patchStore.removePreferencePatch(patchId);
    }
  }

  async addRecentGif(gif) {
    const preferences = await this.preferencesProvider.requirePreferences();
    const newPreferences = preferences.addRecentGif(gif);
    await this.preferencesProvider.updatePreferences(newPreferences);
  }

  async addRecentSearchProfile(did) {
    const preferences = await this.preferencesProvider.requirePreferences();
    const newPreferences = preferences.addRecentSearchProfile(did);
    await this.preferencesProvider.updatePreferences(newPreferences);
  }

  async removeRecentSearchProfile(did) {
    const patchId = this.patchStore.addPreferencePatch({
      type: "removeRecentSearchProfile",
      did,
    });
    const preferences = await this.preferencesProvider.requirePreferences();
    const newPreferences = preferences.removeRecentSearchProfile(did);
    try {
      await this.preferencesProvider.updatePreferences(newPreferences);
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      this.patchStore.removePreferencePatch(patchId);
    }
  }

  async removeRecentSearchProfiles(dids) {
    const preferences = await this.preferencesProvider.requirePreferences();
    const newPreferences = preferences.removeRecentSearchProfiles(dids);
    await this.preferencesProvider.updatePreferences(newPreferences);
  }

  async addMutedWord({ value, targets, actorTarget, expiresAt }) {
    const preferences = await this.preferencesProvider.requirePreferences();
    const newPreferences = preferences.addMutedWord({
      value,
      targets,
      actorTarget,
      expiresAt,
    });
    await this.preferencesProvider.updatePreferences(newPreferences);
  }

  async removeMutedWord(wordId) {
    const preferences = await this.preferencesProvider.requirePreferences();
    const newPreferences = preferences.removeMutedWord(wordId);
    await this.preferencesProvider.updatePreferences(newPreferences);
  }

  async updateMutedWord(wordId, updatedFields) {
    const preferences = await this.preferencesProvider.requirePreferences();
    const newPreferences = preferences.updateMutedWord(wordId, updatedFields);
    await this.preferencesProvider.updatePreferences(newPreferences);
  }

  async subscribeLabeler(profile, labelerInfo) {
    const patchId = this.patchStore.addPreferencePatch({
      type: "subscribeLabeler",
      did: profile.did,
      labelerInfo,
    });
    const preferences = await this.preferencesProvider.requirePreferences();
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
    const preferences = await this.preferencesProvider.requirePreferences();
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
    const preferences = await this.preferencesProvider.requirePreferences();
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
      const latestProfile =
        this.dataStore.$profiles.get(profile.did) ?? profile;
      this.dataStore.$profiles.set(profile.did, {
        ...latestProfile,
        viewer: { ...latestProfile.viewer, muted: true },
      });
      const detailed = this.dataStore.$detailedProfiles.get(profile.did);
      if (detailed) {
        this.dataStore.$detailedProfiles.set(profile.did, {
          ...detailed,
          viewer: { ...detailed.viewer, muted: true },
        });
      }
      this._updatePostsByAuthor(profile.did, (post) => {
        return {
          ...post,
          author: {
            ...post.author,
            viewer: { ...post.author.viewer, muted: true },
          },
        };
      });
      this.queryStore.prependToResource(Resources.MUTED_PROFILES, profile.did);
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
      const latestProfile =
        this.dataStore.$profiles.get(profile.did) ?? profile;
      this.dataStore.$profiles.set(profile.did, {
        ...latestProfile,
        viewer: { ...latestProfile.viewer, muted: false },
      });
      const detailed = this.dataStore.$detailedProfiles.get(profile.did);
      if (detailed) {
        this.dataStore.$detailedProfiles.set(profile.did, {
          ...detailed,
          viewer: { ...detailed.viewer, muted: false },
        });
      }
      this._updatePostsByAuthor(profile.did, (post) => {
        return {
          ...post,
          author: {
            ...post.author,
            viewer: { ...post.author.viewer, muted: false },
          },
        };
      });
      this.queryStore.removeFromResource(Resources.MUTED_PROFILES, profile.did);
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
      const latestProfile =
        this.dataStore.$profiles.get(profile.did) ?? profile;
      this.dataStore.$profiles.set(profile.did, {
        ...latestProfile,
        viewer: { ...latestProfile.viewer, blocking: block.uri },
      });
      const detailed = this.dataStore.$detailedProfiles.get(profile.did);
      if (detailed) {
        this.dataStore.$detailedProfiles.set(profile.did, {
          ...detailed,
          viewer: { ...detailed.viewer, blocking: block.uri },
        });
      }
      this._updatePostsByAuthor(profile.did, (post) => {
        return {
          ...post,
          author: {
            ...post.author,
            viewer: { ...post.author.viewer, blocking: block.uri },
          },
        };
      });
      this.queryStore.prependToResource(
        Resources.BLOCKED_PROFILES,
        profile.did,
      );
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
      const latestProfile =
        this.dataStore.$profiles.get(profile.did) ?? profile;
      this.dataStore.$profiles.set(profile.did, {
        ...latestProfile,
        viewer: { ...latestProfile.viewer, activitySubscription },
      });
      const detailed = this.dataStore.$detailedProfiles.get(profile.did);
      if (detailed) {
        this.dataStore.$detailedProfiles.set(profile.did, {
          ...detailed,
          viewer: { ...detailed.viewer, activitySubscription },
        });
      }
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
      const latestProfile =
        this.dataStore.$profiles.get(profile.did) ?? profile;
      this.dataStore.$profiles.set(profile.did, {
        ...latestProfile,
        viewer: { ...latestProfile.viewer, blocking: null },
      });
      const detailed = this.dataStore.$detailedProfiles.get(profile.did);
      if (detailed) {
        this.dataStore.$detailedProfiles.set(profile.did, {
          ...detailed,
          viewer: { ...detailed.viewer, blocking: null },
        });
      }
      this._updatePostsByAuthor(profile.did, (post) => {
        return {
          ...post,
          author: {
            ...post.author,
            viewer: { ...post.author.viewer, blocking: null },
          },
        };
      });
      this.queryStore.removeFromResource(
        Resources.BLOCKED_PROFILES,
        profile.did,
      );
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      this.patchStore.removeProfilePatch(profile.did, patchId);
    }
  }

  async muteModList(list) {
    try {
      await this.api.muteModList(list.uri);
      this.dataStore.$lists.set(list.uri, {
        ...list,
        viewer: { ...list.viewer, muted: true },
      });
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async unmuteModList(list) {
    try {
      await this.api.unmuteModList(list.uri);
      this.dataStore.$lists.set(list.uri, {
        ...list,
        viewer: { ...list.viewer, muted: false },
      });
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async blockModList(list) {
    try {
      const block = await this.api.blockModList(list.uri);
      this.dataStore.$lists.set(list.uri, {
        ...list,
        viewer: { ...list.viewer, blocked: block.uri },
      });
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async unblockModList(list) {
    const blockUri = list.viewer?.blocked;
    if (!blockUri) return;
    try {
      await this.api.unblockModList(blockUri);
      this.dataStore.$lists.set(list.uri, {
        ...list,
        viewer: { ...list.viewer, blocked: null },
      });
    } catch (error) {
      console.error(error);
      throw error;
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
      delete updatedRecord.descriptionFacets;
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

    // Update in memory
    const patch = { displayName, description };
    if (avatarRef) {
      patch.avatar = buildCdnUrl("avatar", profile.did, avatarRef.ref.$link);
    } else if (removeAvatar) {
      patch.avatar = "";
    }
    if (bannerRef) {
      patch.banner = buildCdnUrl("banner", profile.did, bannerRef.ref.$link);
    } else if (removeBanner) {
      patch.banner = "";
    }

    const existingProfile = this.dataStore.$profiles.get(profile.did);
    if (existingProfile) {
      this.dataStore.$profiles.set(profile.did, {
        ...existingProfile,
        ...patch,
      });
    }
    const existingDetailed = this.dataStore.$detailedProfiles.get(profile.did);
    if (existingDetailed) {
      this.dataStore.$detailedProfiles.set(profile.did, {
        ...existingDetailed,
        ...patch,
      });
    }
    const currentUser = this.dataStore.$currentUser.get();
    if (currentUser && currentUser.did === profile.did) {
      this.dataStore.$currentUser.set({ ...currentUser, ...patch });
    }
  }

  async createList({ currentUser, purpose, name, description, avatarBlob }) {
    const avatarRef = avatarBlob ? await this.api.uploadBlob(avatarBlob) : null;
    const record = {
      purpose,
      name,
      description,
      createdAt: getCurrentTimestamp(),
    };
    if (avatarRef) record.avatar = avatarRef;

    const res = await this.api.createListRecord(record);

    const creator = {
      did: currentUser.did,
      handle: currentUser.handle,
      displayName: currentUser.displayName,
      avatar: currentUser.avatar,
    };
    const listView = {
      $type: "app.bsky.graph.defs#listView",
      uri: res.uri,
      cid: res.cid,
      name,
      purpose,
      description,
      descriptionFacets: [],
      avatar: avatarRef?.ref?.$link
        ? buildCdnUrl("avatar", creator.did, avatarRef.ref.$link)
        : undefined,
      creator,
      indexedAt: record.createdAt,
      listItemCount: 0,
      viewer: {},
    };
    this.dataStore.$lists.set(res.uri, listView);
    untrack(() =>
      this.queryStore.prependToQuery(
        actorListsQueryKey({ did: creator.did }),
        res.uri,
      ),
    );
    return listView;
  }

  async updateList(list, { name, description, avatarBlob, removeAvatar }) {
    const rkey = list.uri.split("/").pop();
    const avatarRef = avatarBlob ? await this.api.uploadBlob(avatarBlob) : null;

    const recordData = await this.api.getListRecord(rkey);
    const existingRecord = recordData.value || {};
    const swapCid = recordData.cid;

    const updatedRecord = { ...existingRecord };
    if (name !== undefined) {
      updatedRecord.name = name;
    }
    if (description !== undefined) {
      updatedRecord.description = description;
      delete updatedRecord.descriptionFacets;
    }
    if (avatarRef) {
      updatedRecord.avatar = avatarRef;
    } else if (removeAvatar) {
      delete updatedRecord.avatar;
    }

    await this.api.putListRecord(rkey, updatedRecord, swapCid);

    // Update in memory
    const current = this.dataStore.$lists.get(list.uri) ?? list;
    const patched = { ...current };
    if (name !== undefined) patched.name = name;
    if (description !== undefined) {
      patched.description = description;
      patched.descriptionFacets = [];
    }
    if (avatarRef?.ref?.$link && list.creator?.did) {
      patched.avatar = buildCdnUrl(
        "avatar",
        list.creator.did,
        avatarRef.ref.$link,
      );
    } else if (removeAvatar) {
      patched.avatar = "";
    }
    this.dataStore.$lists.set(list.uri, patched);
  }

  async deleteList(list) {
    const { rkey } = parseUri(list.uri);
    const listItemUris = [];
    let cursor = "";
    const MAX_PAGES = 100;
    let hitCap = true;
    for (let i = 0; i < MAX_PAGES; i++) {
      const res = await this.api.getListItems({ cursor, limit: 100 });
      for (const record of res.records) {
        if (record.value?.list === list.uri) {
          listItemUris.push(record.uri);
        }
      }
      cursor = res.cursor;
      if (!cursor) {
        hitCap = false;
        break;
      }
    }
    if (hitCap) {
      console.warn(
        `deleteList: stopped scanning listitems after ${MAX_PAGES} pages`,
      );
    }
    const writes = [
      ...listItemUris.map((uri) => ({
        $type: "com.atproto.repo.applyWrites#delete",
        collection: "app.bsky.graph.listitem",
        rkey: parseUri(uri).rkey,
      })),
      {
        $type: "com.atproto.repo.applyWrites#delete",
        collection: "app.bsky.graph.list",
        rkey,
      },
    ];
    for (const chunk of batch(writes, 10)) {
      await this.api.applyWrites(chunk);
    }
    this.dataStore.$lists.set(list.uri, null);
    this.queryStore.set(listMembersQueryKey({ listUri: list.uri }), null);
    this.dataStore.$listItemUris.set(list.uri, null);
    if (list.creator?.did) {
      this.queryStore.removeFromQuery(
        actorListsQueryKey({ did: list.creator.did }),
        list.uri,
      );
    }
    this.queryStore.removeFromResource(
      Resources.LISTS_WITH_MEMBERSHIP,
      list.uri,
    );
    const pinnedItems = untrack(() =>
      this.queryStore.getItems(pinnedItemsQueryKey()),
    );
    if (pinnedItems?.some((item) => item.data?.uri === list.uri)) {
      this.dataStore.setPinnedItems(
        pinnedItems.filter((item) => item.data?.uri !== list.uri),
      );
    }
    const preferences = await this.preferencesProvider.requirePreferences();
    if (preferences.isFeedPinned(list.uri)) {
      const newPreferences = preferences.unpinFeed(list.uri);
      try {
        await this.preferencesProvider.updatePreferences(newPreferences);
      } catch (error) {
        console.error(error);
      }
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
      updateAuthorFeedItems(
        this.queryStore,
        { did: currentUser.did, feedType: "posts" },
        (feedItems) => pinPostInFeed(feedItems, post),
      );
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
      updateAuthorFeedItems(
        this.queryStore,
        { did: currentUser.did, feedType: "posts" },
        (feedItems) => unpinPostInFeed(feedItems, post),
      );
    } finally {
      this.patchStore.removeCurrentUserPatch(userPatchId);
      this.patchStore.removeAuthorFeedPatch(authorFeedURI, feedPatchId);
    }
  }

  async createThread({
    posts,
    replyTo,
    replyRoot,
    threadgateAllow,
    postgateEmbeddingRules,
    signal = null,
  }) {
    const { uris, posts: hydratedPosts } = await this.postCreator.createThread({
      posts,
      replyTo,
      replyRoot,
      threadgateAllow,
      postgateEmbeddingRules,
      signal,
    });
    if (hydratedPosts) {
      for (const post of hydratedPosts) {
        // NOTE: LEXICON DEVIATION
        post.viewer.priorityReply = true;
      }
      this.dataStore.setPosts(hydratedPosts);
      const rootPost = hydratedPosts[0];
      // If it's a reply, update the reply post thread in the store
      if (replyTo) {
        const replyThreadKey = postThreadQueryKey({ uri: replyTo.uri });
        const replyPostThread = this.queryStore.getValue(replyThreadKey);
        if (replyPostThread) {
          this.queryStore.setValue(replyThreadKey, {
            ...replyPostThread,
            replies: [
              {
                $type: "app.bsky.feed.defs#threadViewPost",
                post: rootPost,
                replies: [],
              },
              ...replyPostThread.replies,
            ],
          });
        }
      }
      const { repo: did } = parseUri(rootPost.uri);
      updateAuthorFeedItems(
        this.queryStore,
        { did, feedType: replyTo ? "replies" : "posts" },
        (feedItems) => addFeedItemToFeed({ post: rootPost }, feedItems),
      );
      // Later thread posts are self-replies, so they go in the replies tab
      for (const post of hydratedPosts.slice(1)) {
        updateAuthorFeedItems(
          this.queryStore,
          { did, feedType: "replies" },
          (feedItems) => addFeedItemToFeed({ post }, feedItems),
        );
      }
    }
    return { uris, posts: hydratedPosts };
  }

  async deletePost(post) {
    // no optimistic update
    await this.api.deletePost(post);
    // Replace the post with a not found post.
    // This *should* remove the post from all relevant places in the UI.
    this.dataStore.$posts.set(post.uri, createNotFoundPost(post.uri));
  }

  async createMessage(convoId, { text, facets, replyTo, embed }) {
    // no optimistic update
    const res = await this.api.sendMessage(convoId, {
      text,
      facets,
      replyTo,
      embed,
    });
    this.dataStore.$messages.set(res.id, res);
    // Add the new message to the head of the loaded message list
    this.queryStore.prependToQuery(convoMessagesQueryKey({ convoId }), res.id);
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

  async requestJoinGroupChat(code) {
    const res = await this.api.requestJoinGroupChat(code);
    const preview = this.dataStore.$joinLinkPreviewsByCode.get(code);
    if (
      preview?.$type === "chat.bsky.group.defs#joinLinkPreviewView" &&
      preview.code === code
    ) {
      const updatedPreview = { ...preview };
      if (res.status === "joined" && res.convo) {
        updatedPreview.convo = res.convo;
      } else {
        updatedPreview.viewer = {
          ...(preview.viewer ?? {}),
          requestedAt: getCurrentTimestamp(),
        };
      }
      this.dataStore.$joinLinkPreviewsByCode.set(code, updatedPreview);
    }
    if (res.status === "joined" && res.convo) {
      this.dataStore.setConvo(res.convo);
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

    this.dataStore.setConvo(updatedConvo);

    return updatedConvo;
  }

  async leaveConvo(convo) {
    const convoId = convo.id;
    await this.api.leaveConvo(convoId);
    this.dataStore.$convos.set(convoId, null);
    this.queryStore.removeFromResource(Resources.CONVO_LIST, convoId);
  }

  async rejectConvo(convo) {
    const convoId = convo.id;
    await this.api.leaveConvo(convoId);
    this.dataStore.$convos.set(convoId, null);
    this.queryStore.removeFromResource(Resources.CONVO_REQUEST_LIST, convoId);
  }

  async setConvoMuted(convo, muted) {
    const convoId = convo.id;
    const patchId = this.patchStore.addConvoPatch(convoId, {
      type: "setConvoMuted",
      muted,
    });
    try {
      if (muted) {
        await this.api.muteConvo(convoId);
      } else {
        await this.api.unmuteConvo(convoId);
      }
      const latest = this.dataStore.$convos.get(convoId);
      if (latest) {
        this.dataStore.$convos.set(convoId, { ...latest, muted });
      }
    } finally {
      this.patchStore.removeConvoPatch(convoId, patchId);
    }
  }

  async markConvoAsRead(convoId) {
    const convo = untrack(() => this.dataStore.$convos.get(convoId));
    if (!convo?.unreadCount) return;
    await this.api.markConvoAsRead(convoId);
    const latest = this.dataStore.$convos.get(convoId);
    if (latest) {
      this.dataStore.$convos.set(convoId, {
        ...latest,
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

  async createDraft({ draft, media }) {
    const res = await this.api.createDraft(draft);
    await this._saveDraftMedia(media);
    this._invalidateCachedDrafts();
    return res.id;
  }

  async updateDraft({ draftId, draft, media, pruneLocalRefs }) {
    await this.api.updateDraft(draftId, draft);
    await this._saveDraftMedia(media);
    await this._deleteDraftMedia(pruneLocalRefs);
    this._invalidateCachedDrafts();
  }

  async _saveDraftMedia(media) {
    const storedMedia = this.draftMediaStore.$media.get();
    for (const { path, source } of media) {
      if (storedMedia[path]) continue;
      try {
        await this.draftMediaStore.save(path, source);
      } catch (error) {
        console.error("Failed to save draft media locally", error);
      }
    }
  }

  async _deleteDraftMedia(localRefs) {
    for (const key of localRefs) {
      try {
        await this.draftMediaStore.delete(key);
      } catch (error) {
        console.error("Failed to delete draft media", error);
      }
    }
  }

  // Delete the cached drafts list so the next dialog open refetches it
  _invalidateCachedDrafts() {
    const queryKey = draftsQueryKey();
    if (untrack(() => this.queryStore.get(queryKey))) {
      this.queryStore.set(queryKey, null);
    }
  }

  async deleteDraft({ draftId, localRefs }) {
    await this.api.deleteDraft(draftId);
    await this._deleteDraftMedia(localRefs);
    const queryKey = draftsQueryKey();
    const collection = untrack(() => this.queryStore.get(queryKey));
    if (collection) {
      this.queryStore.set(queryKey, {
        pages: collection.pages.map((page) => ({
          ...page,
          items: page.items.filter((draftView) => draftView.id !== draftId),
        })),
      });
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
