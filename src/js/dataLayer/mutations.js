import { parseUri, createNotFoundPost } from "/js/dataHelpers.js";
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
      this.dataStore.setPost(post.uri, {
        ...post,
        viewer: { ...post.viewer, like: like.uri },
        likeCount: post.likeCount + 1,
      });
      // If the "likes" feed is loaded, add the post to it.
      const currentUser = this.dataStore.getCurrentUser();
      if (currentUser) {
        const feedURI = `${currentUser.did}-likes`;
        const likedFeed = this.dataStore.getAuthorFeed(feedURI);
        if (likedFeed) {
          this.dataStore.setAuthorFeed(feedURI, {
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
      this.dataStore.setPost(post.uri, {
        ...post,
        viewer: { ...post.viewer, like: null },
        likeCount: post.likeCount - 1,
      });
      // If the "likes" feed is loaded, remove the post from it.
      const currentUser = this.dataStore.getCurrentUser();
      if (currentUser) {
        const feedURI = `${currentUser.did}-likes`;
        const likedFeed = this.dataStore.getAuthorFeed(feedURI);
        if (likedFeed) {
          this.dataStore.setAuthorFeed(feedURI, {
            feed: likedFeed.feed.filter((p) => p.post?.uri !== post.uri),
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

  async createRepost(post) {
    const patchId = this.patchStore.addPostPatch(post.uri, {
      type: "createRepost",
    });
    try {
      const repost = await this.api.createRepostRecord(post);
      this.dataStore.setPost(post.uri, {
        ...post,
        viewer: { ...post.viewer, repost: repost.uri },
        repostCount: post.repostCount + 1,
      });
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
      this.dataStore.setPost(post.uri, {
        ...post,
        viewer: { ...post.viewer, repost: null },
        repostCount: post.repostCount - 1,
      });
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
      this.dataStore.setPost(post.uri, {
        ...post,
        viewer: { ...post.viewer, bookmarked: true },
        bookmarkCount: post.bookmarkCount + 1,
      });
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
      this.dataStore.setPost(post.uri, {
        ...post,
        viewer: { ...post.viewer, bookmarked: false },
        bookmarkCount: post.bookmarkCount - 1,
      });
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
      this.dataStore.setProfile(profile.did, {
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

  async unfollowProfile(profile) {
    const patchId = this.patchStore.addProfilePatch(profile.did, {
      type: "unfollowProfile",
    });
    try {
      await this.api.deleteFollowRecord(profile);
      this.dataStore.setProfile(profile.did, {
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
    this.dataStore.addShowLessInteraction(showLessInteraction);
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
    this.dataStore.addShowMoreInteraction(showMoreInteraction);
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
    });
    const preferences = this.preferencesProvider.requirePreferences();
    const newPreferences = preferences.pinFeed(feedUri);
    try {
      await this.preferencesProvider.updatePreferences(newPreferences);
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      // clear patch
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
      // clear patch
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
      this.dataStore.setProfile(profile.did, {
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
      this.dataStore.setProfile(profile.did, {
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
      this.dataStore.setProfile(profile.did, {
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
      this.dataStore.setProfile(profile.did, {
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
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      this.patchStore.removeProfilePatch(profile.did, patchId);
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
  }) {
    const post = await this.postCreator.createPost({
      postText,
      facets,
      external,
      replyTo,
      replyRoot,
      quotedPost,
      images,
    });
    // NOTE: LEXICON DEVIATION
    post.viewer.priorityReply = true;
    // Update the post in the store
    this.dataStore.setPost(post.uri, post);
    // If it's a reply, update the reply post thread in the store
    if (replyTo) {
      const replyPostThread = this.dataStore.getPostThread(replyTo.uri);
      if (replyPostThread) {
        this.dataStore.setPostThread(replyTo.uri, {
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
    const authorFeed = this.dataStore.getAuthorFeed(authorFeedURI);
    if (authorFeed) {
      this.dataStore.setAuthorFeed(authorFeedURI, {
        feed: [{ post }, ...authorFeed.feed],
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
    this.dataStore.setPost(post.uri, createNotFoundPost(post.uri));
  }

  async createMessage(convoId, { text, facets }) {
    // no optimistic update
    const res = await this.api.sendMessage(convoId, {
      text,
      facets,
    });
    this.dataStore.setMessage(res.id, res);
    // Add the new message to the chat messages array in the dataStore
    const convoMessages = this.dataStore.getConvoMessages(convoId);
    if (convoMessages) {
      this.dataStore.setConvoMessages(convoId, {
        messages: [res, ...convoMessages.messages],
        cursor: convoMessages.cursor,
      });
    }
    // Update the last message in the convo
    const convo = this.dataStore.getConvo(convoId);
    if (convo) {
      this.dataStore.setConvo(convoId, {
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

    this.dataStore.setConvo(convo.id, updatedConvo);

    // Update the convo in the convo list
    const convoList = this.dataStore.getConvoList();
    if (convoList) {
      const updatedList = convoList.map((c) =>
        c.id === convo.id ? updatedConvo : c,
      );
      this.dataStore.setConvoList(updatedList);
    }

    return updatedConvo;
  }

  async rejectConvo(convo) {
    await this.api.leaveConvo(convo.id);
    this.dataStore.clearConvo(convo.id);
    const convoList = this.dataStore.getConvoList();
    if (convoList) {
      const updatedList = convoList.filter((c) => c.id !== convo.id);
      this.dataStore.setConvoList(updatedList);
    }
  }

  async markConvoAsRead(convoId) {
    await this.api.markConvoAsRead(convoId);
    const convo = this.dataStore.getConvo(convoId);
    if (convo) {
      this.dataStore.setConvo(convoId, {
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
      this.dataStore.setMessage(messageId, message);
      // Update the last reaction in the convo
      const convo = this.dataStore.getConvo(convoId);
      if (convo) {
        this.dataStore.setConvo(convoId, {
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
      this.dataStore.setMessage(messageId, message);
      // Update the last reaction in the convo
      const convo = this.dataStore.getConvo(convoId);
      if (convo) {
        this.dataStore.setConvo(convoId, {
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
    const posts = this.dataStore.getAllPosts();
    for (const post of posts) {
      if (post.author?.did === profileDid) {
        this.dataStore.setPost(post.uri, updateFunc(post));
      }
    }
  }
}
