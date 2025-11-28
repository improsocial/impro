import { parseUri, createNotFoundPost } from "/js/dataHelpers.js";
import { wait, getCurrentTimestamp } from "/js/utils.js";

class PostCreator {
  constructor(api) {
    this.api = api;
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
    const externalEmbed = await this.prepareExternalEmbed(external);
    const imagesEmbed = await this.prepareImagesEmbed(images);
    let reply = null;
    // Add reply reference if provided
    if (replyTo) {
      if (!replyRoot) {
        throw new Error("replyRoot is required when replyTo is provided");
      }
      reply = {
        root: {
          uri: replyRoot.uri,
          cid: replyRoot.cid,
          $type: "com.atproto.repo.strongRef",
        },
        parent: { uri: replyTo.uri, cid: replyTo.cid },
      };
    }

    // Build embed(s)
    let embed = null;

    let quotedPostEmbed = null;
    if (quotedPost) {
      quotedPostEmbed = {
        $type: "app.bsky.embed.record",
        record: {
          uri: quotedPost.uri,
          cid: quotedPost.cid,
        },
      };
    }

    // Prioritize images over external links (can't have both external and images)
    const mediaEmbed = imagesEmbed || externalEmbed;

    if (mediaEmbed && quotedPostEmbed) {
      embed = {
        $type: "app.bsky.embed.recordWithMedia",
        media: mediaEmbed,
        record: quotedPostEmbed,
      };
    } else if (mediaEmbed) {
      embed = mediaEmbed;
    } else if (quotedPostEmbed) {
      embed = quotedPostEmbed;
    }

    const res = await this.api.createPost({
      text: postText,
      facets,
      embed,
      reply,
    });

    // Get full post from the app view
    let fullPost = null;
    let tries = 0;
    do {
      try {
        fullPost = await this.api.getPost(res.uri);
      } catch (e) {}
      await wait(200);
    } while (!fullPost && tries < 3);
    if (!fullPost) {
      throw new Error(`Failed to get post: ${res.uri}`);
    }

    return fullPost;
  }

  async prepareImagesEmbed(images) {
    if (!images || images.length === 0) {
      return null;
    }

    const uploadedImages = [];
    for (const img of images) {
      const blob = await this.api.uploadBlob(img.file);

      // Get image dimensions
      const aspectRatio = await this.getImageAspectRatio(img.dataUrl);

      uploadedImages.push({
        $type: "app.bsky.embed.images#image",
        alt: img.alt || "",
        image: {
          $type: "blob",
          ref: {
            $link: blob.ref.$link,
          },
          mimeType: blob.mimeType,
          size: blob.size,
        },
        aspectRatio: {
          $type: "app.bsky.embed.defs#aspectRatio",
          width: aspectRatio.width,
          height: aspectRatio.height,
        },
      });
    }

    return {
      $type: "app.bsky.embed.images",
      images: uploadedImages,
    };
  }

  async getImageAspectRatio(dataUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = () => {
        // Default aspect ratio if image can't be loaded
        resolve({ width: 1, height: 1 });
      };
      img.src = dataUrl;
    });
  }

  async prepareExternalEmbed(external) {
    if (!external) {
      return null;
    }
    const externalImage = external.image;
    const externalEmbed = {
      $type: "app.bsky.embed.external",
      external: {
        title: external.title,
        description: external.description,
        uri: external.url, // note - renaming url to uri
      },
    };
    // If there's an external link, upload the preview image
    if (externalImage) {
      try {
        const imageRes = await fetch(
          "https://cardyb.bsky.app/v1/image?url=http://gracekind.net/img/og-image.png"
        );
        const imageBlob = await imageRes.blob();
        const blob = await this.api.uploadBlob(imageBlob);
        externalEmbed.external.thumb = {
          $type: "blob",
          mimeType: blob.mimeType,
          ref: {
            $link: blob.ref.$link,
          },
          size: blob.size,
        };
      } catch (error) {
        // Don't fail the post creation if the image can't be uploaded
        console.error("Error uploading external link image: ", error);
      }
    }
    return externalEmbed;
  }
}

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
        c.id === convo.id ? updatedConvo : c
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
        emoji
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
        emoji
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
