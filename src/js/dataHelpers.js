import { unique } from "/js/utils.js";

export function avatarThumbnailUrl(avatarUrl) {
  if (!avatarUrl) {
    console.warn("avatarUrl is null");
    return "";
  }
  return avatarUrl.replace(
    "/img/avatar/plain/",
    "/img/avatar_thumbnail/plain/"
  );
}

export function parseUri(uri) {
  // e.g. at://did:plc:p572wxnsuoogcrhlfrlizlrb/app.bsky.feed.repost/3m47r3v7spm2b
  // -> { repo: "did:plc:p572wxnsuoogcrhlfrlizlrb", rkey: "3m47r3v7spm2b", collection: "app.bsky.feed.repost" }
  const [repo, collection, rkey] = uri.replace("at://", "").split("/");
  return { repo, collection, rkey };
}

export function buildUri({ repo, collection, rkey }) {
  return `at://${repo}/${collection}/${rkey}`;
}

export function getRKey(record) {
  return record.uri.split("/").pop();
}
export function getIsLiked(post) {
  return !!post.viewer?.like;
}
export function getQuotedPost(post) {
  const embed = post.embed;
  if (!embed) {
    return null;
  }
  if (embed.$type === "app.bsky.embed.record#view") {
    return embed.record;
  }
  if (embed.$type === "app.bsky.embed.recordWithMedia#view") {
    return embed.record.record;
  }
  return null;
}

export function isBlockingUser(blockedQuote) {
  return blockedQuote.author.viewer?.blockedBy;
}

export function getBlockedQuote(post) {
  const quotedPost = getQuotedPost(post);
  if (!quotedPost) {
    return null;
  }
  if (quotedPost.$type === "app.bsky.embed.record#viewBlocked") {
    return quotedPost;
  }
  return null;
}

export function getMutedQuote(post) {
  const quotedPost = getQuotedPost(post);
  if (!quotedPost) {
    return null;
  }
  // Note - using a custom property here
  if (quotedPost.author?.viewer?.muted || quotedPost.hasMutedWord) {
    return true;
  }
  return false;
}

export function isMutedPost(post) {
  return post.author?.viewer?.muted || post.viewer?.hasMutedWord;
}

export function createEmbedFromPost(post) {
  return {
    $type: "app.bsky.embed.record#viewRecord",
    author: { ...post.author },
    value: { ...post.record },
    uri: post.uri,
  };
}

export function createThreadViewPostFromPost(post) {
  return {
    $type: "app.bsky.feed.defs#threadViewPost",
    post: { ...post },
  };
}

export function flattenParents(postThread) {
  const parents = [];
  let current = postThread.parent;
  while (current) {
    parents.unshift(current);
    current = current.parent;
  }
  return parents;
}

export function getParentPosts(postThread) {
  return flattenParents(postThread)
    .map((parent) => parent.post)
    .filter(Boolean);
}

export function getReplyPosts(postThread) {
  if (!postThread.replies) {
    return [];
  }
  return postThread.replies.map((reply) => reply.post).filter(Boolean);
}

export function getNestedReplyPosts(postThread) {
  if (!postThread.replies) {
    return [];
  }
  const posts = [];
  for (const reply of postThread.replies) {
    if (reply.post) {
      posts.push(reply.post);
    }
    posts.push(...getNestedReplyPosts(reply));
  }
  return posts;
}

function updateNested(objOrArray, updater) {
  if (Array.isArray(objOrArray)) {
    return objOrArray.map((item) => updateNested(item, updater));
  } else if (objOrArray !== null && typeof objOrArray === "object") {
    // Apply updater to the object itself before recursing
    const updated = updater(objOrArray);
    // If updater returns a different object, stop recursion
    if (updated !== objOrArray) {
      return updated;
    }
    const newObj = {};
    for (let key in objOrArray) {
      if (Object.prototype.hasOwnProperty.call(objOrArray, key)) {
        newObj[key] = updateNested(objOrArray[key], updater);
      }
    }
    return newObj;
  } else {
    return updater(objOrArray);
  }
}

export function replaceBlockedQuote(post, fullBlockedQuote) {
  return updateNested(post, (obj) => {
    if (
      obj.$type === "app.bsky.embed.record#viewBlocked" &&
      obj.uri === fullBlockedQuote.uri
    ) {
      return fullBlockedQuote;
    }
    return obj;
  });
}

export function isBlockedPost(post) {
  return post.$type === "app.bsky.feed.defs#blockedPost";
}

export function isNotFoundPost(post) {
  return post.$type === "app.bsky.feed.defs#notFoundPost";
}

export function createNotFoundPost(uri) {
  return {
    $type: "app.bsky.feed.defs#notFoundPost",
    uri,
  };
}

export function isUnavailablePost(post) {
  return post.$type === "social.impro.feed.defs#unavailablePost";
}

export function createUnavailablePost(uri) {
  return {
    $type: "social.impro.feed.defs#unavailablePost",
    uri,
  };
}

export function isPostView(post) {
  return post.$type === "app.bsky.feed.defs#postView";
}

export function isSelfOrFollowing(profile, userDid) {
  return profile.did === userDid || profile.viewer?.following;
}

export function getReplyAuthors(reply) {
  return {
    parentAuthor: reply?.parent?.author,
    grandparentAuthor: reply?.grandparentAuthor,
    rootAuthor: reply?.root?.author,
  };
}

export function getRootUri(feedItem) {
  const reply = feedItem.reply;
  if (reply && reply.root) {
    return reply.root.uri;
  }
  return feedItem.post.uri;
}

export function getPostLabels(post) {
  const authorLabels = post.author?.labels || [];
  const postLabels = post.labels || [];
  return [...authorLabels, ...postLabels];
}

export function getPostUrisFromNotifications(notifications) {
  const postUris = [];

  for (const notification of notifications) {
    // For likes and reposts, fetch the post
    if (notification.reason === "like" || notification.reason === "repost") {
      postUris.push(notification.reasonSubject);
    }
    // For replies, mentions and quotes, fetch the post and the parent post(s)
    else if (
      notification.reason === "reply" ||
      notification.reason === "mention" ||
      notification.reason === "quote"
    ) {
      postUris.push(notification.uri);
      if (notification.reasonSubject) {
        postUris.push(notification.reasonSubject);
      }
      if (notification.record?.reply?.parent?.uri) {
        postUris.push(notification.record.reply.parent.uri);
      }
      if (notification.record?.reply?.root?.uri) {
        postUris.push(notification.record.reply.root.uri);
      }
    } else if (notification.reason === "subscribed-post") {
      postUris.push(notification.uri);
    }
  }
  return unique(postUris);
}

export function getRepostUrisFromNotifications(notifications) {
  const repostUris = [];
  for (const notification of notifications) {
    if (notification.reason === "like-via-repost") {
      repostUris.push(notification.reasonSubject);
    }
    if (notification.reason === "repost-via-repost") {
      repostUris.push(notification.reasonSubject);
    }
  }
  return unique(repostUris);
}

export function getPostAndRepostUrisFromNotifications(notifications) {
  const postUris = getPostUrisFromNotifications(notifications);
  const repostUris = getRepostUrisFromNotifications(notifications);
  return { postUris, repostUris };
}

export function getPostUriFromRepost(repost) {
  return repost.value.subject.uri;
}

export function getPostUrisFromReposts(reposts) {
  return unique(reposts.map((repost) => getPostUriFromRepost(repost)));
}

export function getImagesFromPost(post) {
  if (post?.embed?.$type === "app.bsky.embed.images#view") {
    return post.embed.images;
  }
  if (post?.embed?.$type === "app.bsky.embed.recordWithMedia#view") {
    if (post.embed.media?.$type === "app.bsky.embed.images#view") {
      return post.embed.media.images;
    }
  }
  return [];
}

export function getDisplayName(profile) {
  if (profile.displayName) {
    return profile.displayName;
  }
  if (profile.handle === "missing.invalid") {
    return "Deleted Account";
  }
  return profile.handle;
}
