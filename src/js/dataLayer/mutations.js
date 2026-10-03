import { isInvalidSwapError, isRecordNotFoundError } from "/js/api.js";
import {
  parseUri,
  buildUri,
  hasDisableEmbeddingRule,
  createNotFoundPost,
  createStatusView,
  createNestedThreadViewPost,
  addFeedItemToFeed,
  pinPostInFeed,
  unpinPostInFeed,
  valueForPinnedItem,
  buildCdnUrl,
} from "/js/dataHelpers.js";
import {
  batch,
  getCurrentTimestamp,
  truncateGraphemes,
  wait,
} from "/js/utils.js";
import { fetchAndCompressLinkCardImage } from "/js/embedHelpers.js";
import { getFacetsFromText } from "/js/facetHelpers.js";
import { PostCreator } from "/js/postCreator.js";
import { untrack } from "/js/signals.js";
import { generateTid } from "/js/atproto.js";

// Handles mutations to the data, making optimistic updates if needed.
export class Mutations {
  constructor(
    api,
    dataStore,
    sessionState,
    patchStore,
    preferencesProvider,
    identityResolver,
    draftMediaStore,
  ) {
    this.api = api;
    this.dataStore = dataStore;
    this.sessionState = sessionState;
    this.patchStore = patchStore;
    this.preferencesProvider = preferencesProvider;
    this.draftMediaStore = draftMediaStore;
    this.identityResolver = identityResolver;
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
        const feedURI = `${currentUser.did}-likes`;
        const likedFeed = this.dataStore.$authorFeeds.get(feedURI);
        if (
          likedFeed &&
          !likedFeed.feed.some((feedItem) => feedItem.post?.uri === post.uri)
        ) {
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
        const authorFeedURI = `${currentUser.did}-posts`;
        const authorFeed = this.dataStore.$authorFeeds.get(authorFeedURI);
        if (
          authorFeed &&
          !authorFeed.feed.some(
            (feedItem) =>
              feedItem.post?.uri === post.uri &&
              feedItem.reason?.$type === "app.bsky.feed.defs#reasonRepost" &&
              feedItem.reason?.by?.did === currentUser.did,
          )
        ) {
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
      const latestPost = this.dataStore.$posts.get(post.uri) ?? post;
      if (!latestPost.viewer?.bookmarked) {
        this.dataStore.$posts.set(post.uri, {
          ...latestPost,
          viewer: { ...latestPost.viewer, bookmarked: true },
          bookmarkCount: latestPost.bookmarkCount + 1,
        });
      }
      // If the bookmarks feed is loaded, add the post to it.
      const bookmarks = this.dataStore.$bookmarks.get();
      if (
        bookmarks &&
        !bookmarks.bookmarks.some((bookmark) => bookmark.item?.uri === post.uri)
      ) {
        this.dataStore.$bookmarks.set({
          bookmarks: [{ item: { ...post } }, ...bookmarks.bookmarks],
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
      const latestPost = this.dataStore.$posts.get(post.uri) ?? post;
      if (latestPost.viewer?.bookmarked) {
        this.dataStore.$posts.set(post.uri, {
          ...latestPost,
          viewer: { ...latestPost.viewer, bookmarked: false },
          bookmarkCount: latestPost.bookmarkCount - 1,
        });
      }
      // If the bookmarks feed is loaded, remove the post from it.
      const bookmarks = this.dataStore.$bookmarks.get();
      if (bookmarks) {
        this.dataStore.$bookmarks.set({
          bookmarks: bookmarks.bookmarks.filter(
            (bookmark) => bookmark.item?.uri !== post.uri,
          ),
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

  async followAllStarterPackMembers(starterPack) {
    const currentUserDid = this.api.session.did;
    const listItems = await this.api.getAllListItems(starterPack.list.uri);
    const dids = listItems
      .map((item) => item.subject)
      .filter(
        (profile) =>
          profile.did !== currentUserDid &&
          !profile.viewer?.blocking &&
          !profile.viewer?.blockedBy &&
          !profile.viewer?.muted &&
          !profile.viewer?.mutedByList &&
          !profile.viewer?.following,
      )
      .map((profile) => profile.did);
    const writes = dids.map((did) => ({
      $type: "com.atproto.repo.applyWrites#create",
      collection: "app.bsky.graph.follow",
      rkey: generateTid(),
      value: {
        $type: "app.bsky.graph.follow",
        subject: did,
        createdAt: getCurrentTimestamp(),
        via: { uri: starterPack.uri, cid: starterPack.cid },
      },
    }));
    for (const chunk of batch(writes, 50)) {
      await this.api.applyWrites(chunk);
    }
    for (const write of writes) {
      const did = write.value.subject;
      const followUri = `at://${currentUserDid}/app.bsky.graph.follow/${write.rkey}`;
      const profile = this.dataStore.$profiles.get(did);
      if (profile && !profile.viewer?.following) {
        this.dataStore.$profiles.set(did, {
          ...profile,
          viewer: { ...profile.viewer, following: followUri },
        });
      }
      const detailed = this.dataStore.$detailedProfiles.get(did);
      if (detailed && !detailed.viewer?.following) {
        this.dataStore.$detailedProfiles.set(did, {
          ...detailed,
          followersCount: detailed.followersCount + 1,
          viewer: { ...detailed.viewer, following: followUri },
        });
      }
    }
    return dids.length;
  }

  async addProfileToList(profile, list) {
    const result = await this.api.createListItemRecord(list.uri, profile.did);
    this._patchListMembershipForActor(profile.did, list.uri, {
      uri: result.uri,
      subject: profile.did,
    });
    // Add to cached list members
    const cachedMembers = this.dataStore.$listMembers.get(list.uri);
    if (
      cachedMembers &&
      !cachedMembers.items.some((item) => item.subject.did === profile.did)
    ) {
      this.dataStore.$listMembers.set(list.uri, {
        ...cachedMembers,
        items: [{ uri: result.uri, subject: profile }, ...cachedMembers.items],
      });
    }
  }

  async removeProfileFromList(profile, list, membershipUri) {
    await this.api.deleteListItemRecord(membershipUri);
    this._patchListMembershipForActor(profile.did, list.uri, null);
    // Remove from cached list members
    const cachedMembers = this.dataStore.$listMembers.get(list.uri);
    if (cachedMembers) {
      this.dataStore.$listMembers.set(list.uri, {
        ...cachedMembers,
        items: cachedMembers.items.filter(
          (item) => item.subject.did !== profile.did,
        ),
      });
    }
  }

  _patchListMembershipForActor(actorDid, listUri, listItem) {
    const existing = this.dataStore.$listsWithMembershipByActor.get(actorDid);
    if (!existing) return;
    this.dataStore.$listsWithMembershipByActor.set(actorDid, {
      ...existing,
      listsWithMembership: existing.listsWithMembership.map((entry) =>
        entry.list.uri === listUri
          ? { ...entry, listItem: listItem || undefined }
          : entry,
      ),
    });
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
    const pinnedItems = untrack(() => this.dataStore.$pinnedItems.get());
    if (pinnedItems) {
      const byValue = new Map(
        pinnedItems.map((item) => [valueForPinnedItem(item), item]),
      );
      const next = values.map((value) => byValue.get(value)).filter(Boolean);
      this.dataStore.setPinnedItems(next);
    }
  }

  setSelectedFeedUri(feedUri) {
    this.sessionState.$selectedFeedUri.set(feedUri);
  }

  setTrendingHidden(hidden) {
    this.sessionState.$trendingHidden.set(hidden);
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

  async updatePostInteractionSettings({
    threadgateAllowRules,
    postgateEmbeddingRules,
  }) {
    const preferences = await this.preferencesProvider.requirePreferences();
    const newPreferences = preferences.setPostInteractionSettings({
      threadgateAllowRules,
      postgateEmbeddingRules,
    });
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
      this._updateStoredProfile(profile, (stored) => ({
        ...stored,
        viewer: { ...stored.viewer, muted: true },
      }));
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
            mutes: [profile, ...mutedProfiles.mutes],
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
      this._updateStoredProfile(profile, (stored) => ({
        ...stored,
        viewer: { ...stored.viewer, muted: false },
      }));
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
      this._updateStoredProfile(profile, (stored) => ({
        ...stored,
        viewer: { ...stored.viewer, blocking: block.uri },
      }));
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
            blocks: [profile, ...blockedProfiles.blocks],
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
      this._updateStoredProfile(profile, (stored) => ({
        ...stored,
        viewer: { ...stored.viewer, activitySubscription },
      }));
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
      this._updateStoredProfile(profile, (stored) => ({
        ...stored,
        viewer: { ...stored.viewer, blocking: null },
      }));
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

  async optOutOfReferenceList(list) {
    try {
      const created = await this.api.createReferenceListOptOutRecord(list.uri);
      await this._pollReferenceListOptOut(list.uri, true);
      this.dataStore.$referenceListOptOuts.set(list.uri, created.uri);
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async undoReferenceListOptOut(list) {
    const optOutUri = list.viewer?.referenceListOptOut;
    if (!optOutUri) return;
    try {
      try {
        await this.api.deleteReferenceListOptOutRecord(optOutUri);
      } catch (error) {
        if (!isRecordNotFoundError(error)) throw error;
      }
      await this._pollReferenceListOptOut(list.uri, false);
      this.dataStore.$referenceListOptOuts.set(list.uri, null);
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  // Check that opted out state has reached the appview
  async _pollReferenceListOptOut(listUri, expectOptedOut) {
    const maxTries = 5;
    for (let tries = 0; tries < maxTries; tries++) {
      try {
        const data = await this.api.getList(listUri, { limit: 1 });
        const isOptedOut = !!data.list?.viewer?.referenceListOptOut;
        if (isOptedOut === expectOptedOut) return true;
      } catch (error) {
        console.warn(error);
      }
      if (tries < maxTries - 1) {
        await wait(1000);
      }
    }
    return false;
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

    this._updateCurrentUserProfile((existing) => ({ ...existing, ...patch }));
  }

  async setLiveStatus({
    linkMeta,
    durationMinutes,
    createdAt: passedCreatedAt = null,
  }) {
    const currentUser = untrack(() => this.dataStore.$currentUser.get());
    if (!currentUser) throw new Error("No current user");
    const createdAt = passedCreatedAt ?? getCurrentTimestamp();

    // Upload thumbnail (best-effort — failure here doesn't block the publish)
    let thumbBlob = null;
    if (linkMeta.image) {
      try {
        const compressed = await fetchAndCompressLinkCardImage(linkMeta.image);
        const uploaded = await this.api.uploadBlob(compressed.blob);
        thumbBlob = {
          $type: "blob",
          mimeType: uploaded.mimeType,
          ref: { $link: uploaded.ref.$link },
          size: uploaded.size,
        };
      } catch (error) {
        if (error?.name === "AbortError") throw error;
        console.warn("Error uploading live status thumb", error);
      }
    }

    const record = {
      $type: "app.bsky.actor.status",
      status: "app.bsky.actor.status#live",
      createdAt,
      durationMinutes,
      embed: {
        $type: "app.bsky.embed.external",
        external: {
          $type: "app.bsky.embed.external#external",
          uri: linkMeta.url,
          title: linkMeta.title,
          description: linkMeta.description,
          ...(thumbBlob ? { thumb: thumbBlob } : {}),
        },
      },
    };

    let attempts = 0;
    let putResult;
    while (true) {
      let priorCid = null;
      try {
        const prior = await this.api.getStatusRecord();
        priorCid = prior.cid ?? null;
      } catch (error) {
        if (!isRecordNotFoundError(error)) throw error;
      }
      try {
        putResult = await this.api.putStatusRecord(record, priorCid);
        break;
      } catch (error) {
        if (
          isInvalidSwapError(error) &&
          attempts < 5 // retry up to 5 times
        ) {
          attempts += 1;
          continue;
        }
        throw error;
      }
    }
    const statusView = createStatusView({
      did: currentUser.did,
      cid: putResult?.cid ?? null,
      record,
    });
    this.dataStore.$profileStatuses.set(currentUser.did, statusView);
  }

  async clearLiveStatus() {
    const currentUser = untrack(() => this.dataStore.$currentUser.get());
    if (!currentUser) throw new Error("No current user");
    try {
      await this.api.deleteStatusRecord();
    } catch (error) {
      if (!isRecordNotFoundError(error)) throw error;
    }
    this.dataStore.$profileStatuses.set(currentUser.did, null);
  }

  async createList({ purpose, name, description, avatarBlob }) {
    const currentUser = this.dataStore.$currentUser.get();
    if (!currentUser) throw new Error("No current user");
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
    const actorLists = untrack(() =>
      this.dataStore.$actorLists.get(creator.did),
    );
    if (actorLists) {
      this.dataStore.$actorLists.set(creator.did, {
        ...actorLists,
        lists: [listView, ...actorLists.lists],
      });
    }
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

  // Scans the current user's listitem records on the PDS for the ones
  // belonging to the given list. Returns [{ rkey, subjectDid }].
  async _findListItemRecords(listUri) {
    const records = [];
    let cursor = "";
    const MAX_PAGES = 100;
    let hitCap = true;
    for (let i = 0; i < MAX_PAGES; i++) {
      const res = await this.api.getListItems({ cursor, limit: 100 });
      for (const record of res.records) {
        if (record.value?.list === listUri) {
          records.push({
            rkey: parseUri(record.uri).rkey,
            subjectDid: record.value.subject,
          });
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
        `_findListItemRecords: stopped scanning listitems after ${MAX_PAGES} pages`,
      );
    }
    return records;
  }

  async deleteList(list) {
    const { rkey } = parseUri(list.uri);
    const listItemRecords = await this._findListItemRecords(list.uri);
    const writes = [
      ...listItemRecords.map((item) => ({
        $type: "com.atproto.repo.applyWrites#delete",
        collection: "app.bsky.graph.listitem",
        rkey: item.rkey,
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
    this.dataStore.$listMembers.set(list.uri, null);
    if (list.creator?.did) {
      const actorLists = this.dataStore.$actorLists.get(list.creator.did);
      if (actorLists) {
        this.dataStore.$actorLists.set(list.creator.did, {
          ...actorLists,
          lists: actorLists.lists.filter((entry) => entry.uri !== list.uri),
        });
      }
    }
    for (const [
      actorDid,
      entry,
    ] of this.dataStore.$listsWithMembershipByActor.entries()) {
      if (!entry?.listsWithMembership) continue;
      const filtered = entry.listsWithMembership.filter(
        (item) => item.list.uri !== list.uri,
      );
      if (filtered.length !== entry.listsWithMembership.length) {
        this.dataStore.$listsWithMembershipByActor.set(actorDid, {
          ...entry,
          listsWithMembership: filtered,
        });
      }
    }
    const pinnedItems = untrack(() => this.dataStore.$pinnedItems.get());
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

  async _buildStarterPackDescription(description) {
    const trimmed = (description ?? "").trim();
    if (!trimmed) return { description: null, descriptionFacets: null };
    const facets = await getFacetsFromText(trimmed, this.identityResolver);
    return {
      description: trimmed,
      descriptionFacets: facets.length > 0 ? facets : null,
    };
  }

  _buildStarterPackName(name, currentUser) {
    const trimmed = (name ?? "").trim();
    if (trimmed) return trimmed;
    const fallback = `${currentUser.displayName || currentUser.handle}'s Starter Pack`;
    return truncateGraphemes(fallback, 50);
  }

  _listItemCreateWrite({ listUri, did }) {
    return {
      $type: "com.atproto.repo.applyWrites#create",
      collection: "app.bsky.graph.listitem",
      rkey: generateTid(),
      value: {
        $type: "app.bsky.graph.listitem",
        subject: did,
        list: listUri,
        createdAt: getCurrentTimestamp(),
      },
    };
  }

  _listItemUri(rkey) {
    return `at://${this.api.session.did}/app.bsky.graph.listitem/${rkey}`;
  }

  async createStarterPack({ name, description, profiles, feeds }) {
    const currentUser = untrack(() => this.dataStore.$currentUser.get());
    if (!currentUser) throw new Error("No current user");
    const resolvedName = this._buildStarterPackName(name, currentUser);
    const resolvedDescription =
      await this._buildStarterPackDescription(description);
    const createdAt = getCurrentTimestamp();
    const did = currentUser.did;

    const listRkey = generateTid();
    const listUri = `at://${did}/app.bsky.graph.list/${listRkey}`;
    const listRecord = {
      $type: "app.bsky.graph.list",
      purpose: "app.bsky.graph.defs#referencelist",
      name: resolvedName,
      createdAt,
    };
    if (resolvedDescription.description) {
      listRecord.description = resolvedDescription.description;
      if (resolvedDescription.descriptionFacets) {
        listRecord.descriptionFacets = resolvedDescription.descriptionFacets;
      }
    }

    const listItemWrites = profiles.map((profile) =>
      this._listItemCreateWrite({ listUri, did: profile.did }),
    );

    const packRkey = generateTid();
    const packUri = `at://${did}/app.bsky.graph.starterpack/${packRkey}`;
    const packRecord = {
      $type: "app.bsky.graph.starterpack",
      name: resolvedName,
      list: listUri,
      createdAt,
    };
    if (resolvedDescription.description) {
      packRecord.description = resolvedDescription.description;
      if (resolvedDescription.descriptionFacets) {
        packRecord.descriptionFacets = resolvedDescription.descriptionFacets;
      }
    }
    if (feeds.length > 0) {
      packRecord.feeds = feeds.map((feed) => ({ uri: feed.uri }));
    }

    const writes = [
      {
        $type: "com.atproto.repo.applyWrites#create",
        collection: "app.bsky.graph.list",
        rkey: listRkey,
        value: listRecord,
      },
      ...listItemWrites,
      {
        $type: "com.atproto.repo.applyWrites#create",
        collection: "app.bsky.graph.starterpack",
        rkey: packRkey,
        value: packRecord,
      },
    ];
    const res = await this.api.applyWrites(writes);
    const results = res?.results ?? [];
    const listCid = results[0]?.cid ?? null;
    const packCid = results[writes.length - 1]?.cid ?? null;

    const creator = {
      did: currentUser.did,
      handle: currentUser.handle,
      displayName: currentUser.displayName,
      avatar: currentUser.avatar,
    };
    const listView = {
      $type: "app.bsky.graph.defs#listViewBasic",
      uri: listUri,
      cid: listCid,
      name: resolvedName,
      purpose: "app.bsky.graph.defs#referencelist",
      listItemCount: profiles.length,
      indexedAt: createdAt,
      viewer: {},
    };
    const items = listItemWrites.map((write, i) => ({
      uri: this._listItemUri(write.rkey),
      subject: profiles[i],
    }));
    const starterPackView = {
      $type: "app.bsky.graph.defs#starterPackView",
      uri: packUri,
      cid: packCid,
      record: packRecord,
      creator,
      list: listView,
      listItemsSample: items.slice(0, 12),
      feeds,
      joinedWeekCount: 0,
      joinedAllTimeCount: 0,
      indexedAt: createdAt,
    };

    this.dataStore.$starterPacks.set(packUri, starterPackView);
    this.dataStore.$starterPackUrisByList.set(listUri, packUri);
    this.dataStore.$listMembers.set(listUri, { items, cursor: null });
    const actorStarterPacks = untrack(() =>
      this.dataStore.$actorStarterPacks.get(did),
    );
    if (actorStarterPacks) {
      this.dataStore.$actorStarterPacks.set(did, {
        ...actorStarterPacks,
        starterPacks: [starterPackView, ...actorStarterPacks.starterPacks],
      });
    }
    this._updateCurrentUserProfile((profile) =>
      profile.associated
        ? {
            ...profile,
            associated: {
              ...profile.associated,
              starterPacks: (profile.associated.starterPacks ?? 0) + 1,
              lists: (profile.associated.lists ?? 0) + 1,
            },
          }
        : profile,
    );
    return starterPackView;
  }

  async updateStarterPack(starterPack, { name, description, profiles, feeds }) {
    const currentUser = untrack(() => this.dataStore.$currentUser.get());
    if (!currentUser) throw new Error("No current user");
    if (starterPack.creator.did !== currentUser.did) {
      throw new Error("Cannot edit a starter pack owned by another account");
    }
    const listUri = starterPack.list?.uri;
    if (!listUri) throw new Error("Starter pack has no list");
    const existingMembers = untrack(() =>
      this.dataStore.$listMembers.get(listUri),
    );
    const optedOutItems = (existingMembers?.items ?? []).filter(
      (item) => item.subjectOptedOut,
    );
    const optedOutDids = new Set(optedOutItems.map((item) => item.subject.did));

    const resolvedName = this._buildStarterPackName(name, currentUser);
    const resolvedDescription =
      await this._buildStarterPackDescription(description);

    const selectedDids = new Set(profiles.map((profile) => profile.did));
    const existingRecords = await this._findListItemRecords(listUri);
    const rkeysByDid = new Map();
    for (const record of existingRecords) {
      const rkeys = rkeysByDid.get(record.subjectDid) ?? [];
      rkeys.push(record.rkey);
      rkeysByDid.set(record.subjectDid, rkeys);
    }

    const deleteWrites = [];
    for (const [did, rkeys] of rkeysByDid) {
      const keep =
        selectedDids.has(did) ||
        did === currentUser.did ||
        optedOutDids.has(did);
      const surplus = keep ? rkeys.slice(1) : rkeys;
      for (const rkey of surplus) {
        deleteWrites.push({
          $type: "com.atproto.repo.applyWrites#delete",
          collection: "app.bsky.graph.listitem",
          rkey,
        });
      }
    }
    const createWrites = profiles
      .filter((profile) => !rkeysByDid.has(profile.did))
      .map((profile) =>
        this._listItemCreateWrite({ listUri, did: profile.did }),
      );

    for (const chunk of batch(deleteWrites, 50)) {
      await this.api.applyWrites(chunk);
    }
    for (const chunk of batch(createWrites, 50)) {
      await this.api.applyWrites(chunk);
    }

    const listRkey = parseUri(listUri).rkey;
    const listRecordData = await this.api.getListRecord(listRkey);
    const listRecord = { ...listRecordData.value, name: resolvedName };
    delete listRecord.description;
    delete listRecord.descriptionFacets;
    if (resolvedDescription.description) {
      listRecord.description = resolvedDescription.description;
      if (resolvedDescription.descriptionFacets) {
        listRecord.descriptionFacets = resolvedDescription.descriptionFacets;
      }
    }
    await this.api.putListRecord(listRkey, listRecord, listRecordData.cid);

    const packRkey = parseUri(starterPack.uri).rkey;
    const packRecordData = await this.api.getStarterPackRecord(packRkey);
    const packRecord = {
      ...packRecordData.value,
      name: resolvedName,
      updatedAt: getCurrentTimestamp(),
    };
    delete packRecord.description;
    delete packRecord.descriptionFacets;
    delete packRecord.feeds;
    if (resolvedDescription.description) {
      packRecord.description = resolvedDescription.description;
      if (resolvedDescription.descriptionFacets) {
        packRecord.descriptionFacets = resolvedDescription.descriptionFacets;
      }
    }
    if (feeds.length > 0) {
      packRecord.feeds = feeds.map((feed) => ({ uri: feed.uri }));
    }
    const putRes = await this.api.putStarterPackRecord(
      packRkey,
      packRecord,
      packRecordData.cid,
    );

    const createdRkeyByDid = new Map(
      createWrites.map((write) => [write.value.subject, write.rkey]),
    );
    const items = [
      ...profiles.map((profile) => ({
        uri: this._listItemUri(
          rkeysByDid.get(profile.did)?.[0] ?? createdRkeyByDid.get(profile.did),
        ),
        subject: profile,
      })),
      ...optedOutItems,
    ];
    const current =
      untrack(() => this.dataStore.$starterPacks.get(starterPack.uri)) ??
      starterPack;
    const patchedList = {
      ...current.list,
      name: resolvedName,
      listItemCount: items.length,
    };
    this.dataStore.$starterPacks.set(starterPack.uri, {
      ...current,
      cid: putRes?.cid ?? current.cid,
      record: packRecord,
      list: patchedList,
      listItemsSample: items.slice(0, 12),
      feeds,
    });
    this.dataStore.$listMembers.set(listUri, { items, cursor: null });
    const list = untrack(() => this.dataStore.$lists.get(listUri));
    if (list) {
      this.dataStore.$lists.set(listUri, {
        ...list,
        name: resolvedName,
        description: resolvedDescription.description ?? "",
        descriptionFacets: resolvedDescription.descriptionFacets ?? [],
        listItemCount: items.length,
      });
    }
    const actorStarterPacks = untrack(() =>
      this.dataStore.$actorStarterPacks.get(currentUser.did),
    );
    if (actorStarterPacks) {
      this.dataStore.$actorStarterPacks.set(currentUser.did, {
        ...actorStarterPacks,
        starterPacks: actorStarterPacks.starterPacks.map((entry) =>
          entry.uri === starterPack.uri
            ? { ...entry, record: packRecord, listItemCount: items.length }
            : entry,
        ),
      });
    }
  }

  async deleteStarterPack(starterPack) {
    const { rkey } = parseUri(starterPack.uri);
    const listUri = starterPack.list?.uri ?? null;
    const writes = [];
    if (listUri) {
      const listItemRecords = await this._findListItemRecords(listUri);
      writes.push(
        ...listItemRecords.map((item) => ({
          $type: "com.atproto.repo.applyWrites#delete",
          collection: "app.bsky.graph.listitem",
          rkey: item.rkey,
        })),
        {
          $type: "com.atproto.repo.applyWrites#delete",
          collection: "app.bsky.graph.list",
          rkey: parseUri(listUri).rkey,
        },
      );
    }
    writes.push({
      $type: "com.atproto.repo.applyWrites#delete",
      collection: "app.bsky.graph.starterpack",
      rkey,
    });
    for (const chunk of batch(writes, 50)) {
      await this.api.applyWrites(chunk);
    }

    this.dataStore.$starterPacks.set(starterPack.uri, null);
    if (listUri) {
      this.dataStore.$starterPackUrisByList.set(listUri, null);
      this.dataStore.$lists.set(listUri, null);
      this.dataStore.$listMembers.set(listUri, null);
    }
    const creatorDid = starterPack.creator?.did ?? null;
    if (creatorDid) {
      const actorStarterPacks = untrack(() =>
        this.dataStore.$actorStarterPacks.get(creatorDid),
      );
      if (actorStarterPacks) {
        this.dataStore.$actorStarterPacks.set(creatorDid, {
          ...actorStarterPacks,
          starterPacks: actorStarterPacks.starterPacks.filter(
            (entry) => entry.uri !== starterPack.uri,
          ),
        });
      }
      if (listUri) {
        const actorLists = untrack(() =>
          this.dataStore.$actorLists.get(creatorDid),
        );
        if (actorLists) {
          this.dataStore.$actorLists.set(creatorDid, {
            ...actorLists,
            lists: actorLists.lists.filter((entry) => entry.uri !== listUri),
          });
        }
      }
    }
    const searchResults = untrack(() =>
      this.dataStore.$starterPackSearchResults.get(),
    );
    if (searchResults) {
      this.dataStore.$starterPackSearchResults.set({
        ...searchResults,
        starterPacks: searchResults.starterPacks.filter(
          (entry) => entry.uri !== starterPack.uri,
        ),
      });
    }
    const listDelta = listUri ? 1 : 0;
    this._updateCurrentUserProfile((profile) =>
      profile.associated
        ? {
            ...profile,
            associated: {
              ...profile.associated,
              starterPacks: Math.max(
                0,
                (profile.associated.starterPacks ?? 0) - 1,
              ),
              lists: Math.max(0, (profile.associated.lists ?? 0) - listDelta),
            },
          }
        : profile,
    );
  }

  // A profile lives in $profiles and, once opened, $detailedProfiles; the
  // current user's is also mirrored in $currentUser. Apply a change to each
  _updateStoredProfile(profile, update) {
    const { did } = profile;
    const stored = untrack(() => this.dataStore.$profiles.get(did)) ?? profile;
    this.dataStore.$profiles.set(did, update(stored));
    const detailed = untrack(() => this.dataStore.$detailedProfiles.get(did));
    if (detailed) {
      this.dataStore.$detailedProfiles.set(did, update(detailed));
    }
    const currentUser = untrack(() => this.dataStore.$currentUser.get());
    if (currentUser?.did === did) {
      this.dataStore.$currentUser.set(update(currentUser));
    }
  }

  _updateCurrentUserProfile(update) {
    const currentUser = untrack(() => this.dataStore.$currentUser.get());
    if (!currentUser) return;
    this._updateStoredProfile(currentUser, update);
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
      this._updateCurrentUserProfile((user) => ({
        ...user,
        pinnedPost: pinnedRef,
      }));
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
      this._updateCurrentUserProfile(({ pinnedPost: _, ...rest }) => rest);
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

  async updatePostgateEmbeddingRules(post, embeddingRules) {
    const currentUser = this.dataStore.$currentUser.get();
    if (!currentUser) throw new Error("No current user");
    const { repo, rkey } = parseUri(post.uri);
    if (currentUser.did !== repo) {
      throw new Error("Only the post author can edit the postgate");
    }
    const embeddingDisabled = hasDisableEmbeddingRule(embeddingRules);
    const hasEmbeddingRules = embeddingRules?.length > 0;

    const patchId = this.patchStore.addPostPatch(post.uri, {
      type: "setEmbeddingDisabled",
      embeddingDisabled,
    });
    try {
      let priorPostgateRecord = null;
      try {
        priorPostgateRecord = await this.api.getPostgateRecord(rkey);
      } catch (error) {
        if (!isRecordNotFoundError(error)) throw error;
      }
      const doUpdate = priorPostgateRecord || hasEmbeddingRules;
      if (doUpdate) {
        const record = {
          ...priorPostgateRecord?.value,
          $type: "app.bsky.feed.postgate",
          post: post.uri,
          createdAt: getCurrentTimestamp(),
        };
        if (hasEmbeddingRules) {
          record.embeddingRules = embeddingRules;
        } else {
          delete record.embeddingRules;
        }
        await this.api.putPostgateRecord(
          rkey,
          record,
          priorPostgateRecord?.cid ?? null,
        );
      }

      const latestPost = this.dataStore.$posts.get(post.uri);
      if (latestPost) {
        this.dataStore.$posts.set(post.uri, {
          ...latestPost,
          viewer: { ...latestPost.viewer, embeddingDisabled },
        });
      }
    } finally {
      this.patchStore.removePostPatch(post.uri, patchId);
    }
  }

  async updateThreadgateAllow(post, threadgateAllow) {
    const currentUser = this.dataStore.$currentUser.get();
    if (!currentUser) throw new Error("No current user");
    const { repo, rkey } = parseUri(post.uri);
    if (currentUser.did !== repo) {
      throw new Error("Only the thread author can edit the threadgate");
    }

    const patchId = this.patchStore.addPostPatch(post.uri, {
      type: "setThreadgateAllow",
      allow: threadgateAllow,
    });
    try {
      let priorThreadgateRecord = null;
      try {
        priorThreadgateRecord = await this.api.getThreadgateRecord(rkey);
      } catch (error) {
        if (!isRecordNotFoundError(error)) throw error;
      }
      const record = {
        ...priorThreadgateRecord?.value,
        $type: "app.bsky.feed.threadgate",
        post: post.uri,
        createdAt: getCurrentTimestamp(),
      };
      if (threadgateAllow === null) {
        delete record.allow;
      } else {
        record.allow = threadgateAllow;
      }
      const result = await this.api.putThreadgateRecord(
        rkey,
        record,
        priorThreadgateRecord?.cid ?? null,
      );
      const written = { record, cid: result.cid };

      const latestPost = this.dataStore.$posts.get(post.uri);
      if (latestPost) {
        this.dataStore.$posts.set(post.uri, {
          ...latestPost,
          threadgate: {
            uri: buildUri({
              repo,
              collection: "app.bsky.feed.threadgate",
              rkey,
            }),
            lists: [],
            ...latestPost.threadgate,
            cid: written.cid,
            record: written.record,
          },
        });
      }
    } finally {
      this.patchStore.removePostPatch(post.uri, patchId);
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
        const replyPostThread = this.dataStore.$postThreads.get(replyTo.uri);
        if (replyPostThread) {
          this.dataStore.setPostThread(replyTo.uri, {
            ...replyPostThread,
            replies: [
              createNestedThreadViewPost(hydratedPosts),
              ...replyPostThread.replies,
            ],
          });
        }
      }
      const { repo: did } = parseUri(rootPost.uri);
      const rootFeedURI = replyTo ? `${did}-replies` : `${did}-posts`;
      const rootFeed = this.dataStore.$authorFeeds.get(rootFeedURI);
      if (rootFeed) {
        this.dataStore.$authorFeeds.set(rootFeedURI, {
          feed: addFeedItemToFeed({ post: rootPost }, rootFeed.feed),
          cursor: rootFeed.cursor,
        });
      }
      // Later thread posts are self-replies, so they go in the replies tab
      const repliesFeedURI = `${did}-replies`;
      for (const post of hydratedPosts.slice(1)) {
        const repliesFeed = this.dataStore.$authorFeeds.get(repliesFeedURI);
        if (repliesFeed) {
          this.dataStore.$authorFeeds.set(repliesFeedURI, {
            feed: addFeedItemToFeed({ post }, repliesFeed.feed),
            cursor: repliesFeed.cursor,
          });
        }
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

  async createGroupChat(name, memberDids) {
    const res = await this.api.createGroupChat(name, memberDids);
    this.dataStore.setConvo(res.convo);
    return res.convo;
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
    const list = this.dataStore.$convoList.get();
    if (list) {
      this.dataStore.$convoList.set({
        convos: list.convos.filter((listConvo) => listConvo.id !== convoId),
        cursor: list.cursor,
      });
    }
  }

  async rejectConvo(convo) {
    const convoId = convo.id;
    await this.api.leaveConvo(convoId);
    this.dataStore.$convos.set(convoId, null);
    const requestList = this.dataStore.$convoRequestList.get();
    if (requestList) {
      this.dataStore.$convoRequestList.set({
        convos: requestList.convos.filter(
          (listConvo) => listConvo.id !== convoId,
        ),
        cursor: requestList.cursor,
      });
    }
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

  async addMessageReaction(convoId, messageId, emoji) {
    const currentUser = this.dataStore.$currentUser.get();
    if (!currentUser) throw new Error("No current user");
    const patchId = this.patchStore.addMessagePatch(messageId, {
      type: "addReaction",
      reaction: {
        createdAt: getCurrentTimestamp(),
        sender: { did: currentUser.did },
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

  async removeMessageReaction(convoId, messageId, emoji) {
    const currentUser = this.dataStore.$currentUser.get();
    if (!currentUser) throw new Error("No current user");
    const patchId = this.patchStore.addMessagePatch(messageId, {
      type: "removeReaction",
      currentUserDid: currentUser.did,
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
    if (untrack(() => this.dataStore.$drafts.get()) !== null) {
      this.dataStore.$drafts.set(null);
    }
  }

  async deleteDraft({ draftId, localRefs }) {
    await this.api.deleteDraft(draftId);
    await this._deleteDraftMedia(localRefs);
    const data = untrack(() => this.dataStore.$drafts.get());
    if (data) {
      this.dataStore.$drafts.set({
        ...data,
        drafts: data.drafts.filter((draftView) => draftView.id !== draftId),
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
