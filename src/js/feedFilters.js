import {
  isBlockingUser,
  getQuotedPost,
  getBlockedQuote,
  getReplyAuthors,
  getRootUri,
  isSelfOrFollowing,
  getMutedQuote,
  isMutedPost,
  isBlockedPost,
  isNotFoundPost,
  isUnavailablePost,
} from "/js/dataHelpers.js";

function filterByFollowing(feed, currentUser) {
  // Filter the feed items to only show posts from self or people you follow
  // Logic stolen from social-app: https://github.com/bluesky-social/social-app/blob/185fd39092cd4c43db060439b03c6c49be60a34e/src/lib/api/feed-manip.ts#L324
  if (!currentUser) {
    return feed;
  }
  const userDid = currentUser.did;

  // Filter the feed items
  const filteredFeedItems = [];
  for (const feedItem of feed.feed) {
    // Show all non-reply posts
    if (!feedItem.reply) {
      filteredFeedItems.push(feedItem);
      continue;
    }

    const author = feedItem.post.author;
    if (!author) {
      continue;
    }
    const { parentAuthor, grandparentAuthor, rootAuthor } = getReplyAuthors(
      feedItem.reply,
    );

    if (!isSelfOrFollowing(author, userDid)) {
      // Only show replies from self or people you follow.
      continue;
    }

    if (
      parentAuthor?.did === author.did ||
      rootAuthor?.did === author.did ||
      grandparentAuthor?.did === author.did
    ) {
      // Always show self-threads.
      filteredFeedItems.push(feedItem);
      continue;
    }

    // From this point on we need at least one more reason to show it.
    if (parentAuthor && isSelfOrFollowing(parentAuthor, userDid)) {
      filteredFeedItems.push(feedItem);
      continue;
    }

    if (grandparentAuthor && isSelfOrFollowing(grandparentAuthor, userDid)) {
      filteredFeedItems.push(feedItem);
      continue;
    }

    if (rootAuthor && isSelfOrFollowing(rootAuthor, userDid)) {
      filteredFeedItems.push(feedItem);
      continue;
    }
  }

  return {
    feed: filteredFeedItems,
    cursor: feed.cursor,
  };
}

function isRepost(feedItem) {
  return feedItem.reason?.$type === "app.bsky.feed.defs#reasonRepost";
}

function filterReposts(feed) {
  const filteredFeedItems = feed.feed.filter((item) => !isRepost(item));
  return {
    feed: filteredFeedItems,
    cursor: feed.cursor,
  };
}

function filterReplies(feed) {
  const filteredFeedItems = feed.feed.filter((item) => !item.reply);
  return {
    feed: filteredFeedItems,
    cursor: feed.cursor,
  };
}

function filterQuotePosts(feed) {
  const filteredFeedItems = feed.feed.filter(
    (item) => !getQuotedPost(item.post),
  );
  return {
    feed: filteredFeedItems,
    cursor: feed.cursor,
  };
}

function dedupeFeed(feed) {
  const rootUris = new Set();
  const dedupedFeedItems = [];
  for (const item of feed.feed) {
    const rootUri = getRootUri(item);
    if (rootUris.has(rootUri)) {
      continue;
    }
    rootUris.add(rootUri);
    dedupedFeedItems.push(item);
  }
  return {
    feed: dedupedFeedItems,
    cursor: feed.cursor,
  };
}

function filterBlockedQuotes(feed) {
  const filteredFeedItems = feed.feed.filter((item) => {
    const blockedQuote = getBlockedQuote(item.post);
    if (blockedQuote && isBlockingUser(blockedQuote)) {
      return false;
    }
    return true;
  });
  return {
    feed: filteredFeedItems,
    cursor: feed.cursor,
  };
}

function filterMutedQuotes(feed) {
  const filteredFeedItems = feed.feed.filter(
    (item) => !getMutedQuote(item.post),
  );
  return {
    feed: filteredFeedItems,
    cursor: feed.cursor,
  };
}

function filterMutedPosts(feed) {
  // Filter out muted posts, including the reply context.
  const filteredFeedItems = feed.feed.filter((item) => {
    if (isMutedPost(item.post)) {
      return false;
    }
    if (item.reply?.parent && isMutedPost(item.reply.parent)) {
      return false;
    }
    if (item.reply?.root && isMutedPost(item.reply.root)) {
      return false;
    }
    return true;
  });
  return {
    feed: filteredFeedItems,
    cursor: feed.cursor,
  };
}

function isEmptyPost(post) {
  return isBlockedPost(post) || isNotFoundPost(post) || isUnavailablePost(post);
}

function filterEmptyPosts(feed) {
  const filteredFeedItems = [];
  for (const item of feed.feed) {
    if (isEmptyPost(item.post)) {
      continue;
    }
    if (item.reply?.parent && isEmptyPost(item.reply.parent)) {
      continue;
    }
    if (item.reply?.root && isEmptyPost(item.reply.root)) {
      continue;
    }
    filteredFeedItems.push(item);
  }
  return {
    feed: filteredFeedItems,
    cursor: feed.cursor,
  };
}

export function filterFollowingFeed(feed, currentUser, preferences) {
  const followingFeedPreference = preferences.getFollowingFeedPreference();
  let filteredFeed = filterByFollowing(feed, currentUser);
  if (followingFeedPreference?.hideReposts) {
    filteredFeed = filterReposts(filteredFeed);
  }
  if (followingFeedPreference?.hideReplies) {
    filteredFeed = filterReplies(filteredFeed);
  }
  if (followingFeedPreference?.hideQuotePosts) {
    filteredFeed = filterQuotePosts(filteredFeed);
  }
  filteredFeed = dedupeFeed(filteredFeed);
  filteredFeed = filterBlockedQuotes(filteredFeed);
  filteredFeed = filterMutedQuotes(filteredFeed);
  filteredFeed = filterMutedPosts(filteredFeed);
  filteredFeed = filterEmptyPosts(filteredFeed);
  return filteredFeed;
}

export function filterAlgorithmicFeed(feed) {
  let filteredFeed = filterBlockedQuotes(feed);
  filteredFeed = dedupeFeed(filteredFeed);
  filteredFeed = filterMutedQuotes(filteredFeed);
  filteredFeed = filterMutedPosts(filteredFeed);
  filteredFeed = filterEmptyPosts(filteredFeed);
  return filteredFeed;
}

export function filterAuthorFeed(feed) {
  let filteredFeed = dedupeFeed(feed);
  filteredFeed = filterEmptyPosts(filteredFeed);
  return filteredFeed;
}
