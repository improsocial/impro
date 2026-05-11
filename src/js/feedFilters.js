import {
  isBlockingUser,
  getQuotedPost,
  getBlockedQuote,
  getReplyAuthors,
  getRootUri,
  isSelfOrFollowing,
  getMutedQuote,
  isMutedPost,
  isEmptyPost,
  doHideAuthorOnUnauthenticated,
} from "/js/dataHelpers.js";

class FeedFilter {
  filterFeedItems(feedItems) {
    throw new Error("Not implemented");
  }

  static compose(...filters) {
    return new ComposedFeedFilter(filters);
  }
}

class ComposedFeedFilter extends FeedFilter {
  constructor(filters) {
    super();
    this.filters = filters;
  }

  filterFeedItems(feedItems) {
    return this.filters.reduce(
      (acc, filter) => filter.filterFeedItems(acc),
      feedItems,
    );
  }
}

function isRepost(feedItem) {
  return feedItem.reason?.$type === "app.bsky.feed.defs#reasonRepost";
}

function hasHiddenBadgeLabel(post) {
  return post?.badgeLabels?.some((badge) => badge.visibility === "hide");
}

class FilterByFollowing extends FeedFilter {
  constructor(currentUser) {
    super();
    this.currentUser = currentUser;
  }

  filterFeedItems(feedItems) {
    // Filter the feed items to only show posts from self or people you follow
    // Logic stolen from social-app: https://github.com/bluesky-social/social-app/blob/185fd39092cd4c43db060439b03c6c49be60a34e/src/lib/api/feed-manip.ts#L324
    if (!this.currentUser) {
      return feedItems;
    }
    const userDid = this.currentUser.did;

    const filteredFeedItems = [];
    for (const feedItem of feedItems) {
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

    return filteredFeedItems;
  }
}

class FilterReposts extends FeedFilter {
  filterFeedItems(feedItems) {
    return feedItems.filter((item) => !isRepost(item));
  }
}

class FilterReplies extends FeedFilter {
  filterFeedItems(feedItems) {
    return feedItems.filter((item) => {
      // Allow reposts to be replies
      if (isRepost(item)) {
        return true;
      }
      return !item.reply;
    });
  }
}

class FilterQuotePosts extends FeedFilter {
  filterFeedItems(feedItems) {
    return feedItems.filter((item) => {
      // Allow reposts to be quoted posts
      if (isRepost(item)) {
        return true;
      }
      return !getQuotedPost(item.post);
    });
  }
}

class DedupeFeed extends FeedFilter {
  constructor({ includeReposts = true } = {}) {
    super();
    this.includeReposts = includeReposts;
  }

  filterFeedItems(feedItems) {
    const rootUris = new Set();
    const dedupedFeedItems = [];
    for (const item of feedItems) {
      if (isRepost(item) && !this.includeReposts) {
        dedupedFeedItems.push(item);
        continue;
      }
      const rootUri = getRootUri(item);
      if (rootUris.has(rootUri)) {
        continue;
      }
      rootUris.add(rootUri);
      dedupedFeedItems.push(item);
    }
    return dedupedFeedItems;
  }
}

class FilterBlockedQuotes extends FeedFilter {
  filterFeedItems(feedItems) {
    return feedItems.filter((item) => {
      const blockedQuote = getBlockedQuote(item.post);
      if (blockedQuote && isBlockingUser(blockedQuote)) {
        return false;
      }
      return true;
    });
  }
}

class FilterMutedQuotes extends FeedFilter {
  filterFeedItems(feedItems) {
    return feedItems.filter((item) => !getMutedQuote(item.post));
  }
}

class FilterMutedPosts extends FeedFilter {
  filterFeedItems(feedItems) {
    // Filter out muted posts, including the reply context.
    return feedItems.filter((item) => {
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
  }
}

class FilterEmptyPosts extends FeedFilter {
  filterFeedItems(feedItems) {
    const filteredFeedItems = [];
    for (const item of feedItems) {
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
    return filteredFeedItems;
  }
}

class FilterUnauthorizedPosts extends FeedFilter {
  constructor(isAuthenticated) {
    super();
    this.isAuthenticated = isAuthenticated;
  }

  filterFeedItems(feedItems) {
    if (this.isAuthenticated) {
      return feedItems;
    }
    return feedItems.filter((item) => {
      if (item.post.author && doHideAuthorOnUnauthenticated(item.post.author)) {
        return false;
      }
      const quotedPost = getQuotedPost(item.post);
      if (
        quotedPost?.author &&
        doHideAuthorOnUnauthenticated(quotedPost.author)
      ) {
        return false;
      }
      return true;
    });
  }
}

class FilterHiddenPosts extends FeedFilter {
  filterFeedItems(feedItems) {
    return feedItems.filter((item) => {
      if (item.post.viewer?.isHidden) {
        return false;
      }
      // Also filter hidden quotes
      const quotedPost = getQuotedPost(item.post);
      if (quotedPost && quotedPost.isHidden) {
        return false;
      }
      return true;
    });
  }
}

class FilterContentLabeledPosts extends FeedFilter {
  filterFeedItems(feedItems) {
    return feedItems.filter((item) => {
      const contentLabel = item.post.contentLabel;
      if (contentLabel?.visibility === "hide") {
        return false;
      }
      if (hasHiddenBadgeLabel(item.post)) {
        return false;
      }
      const quotedPost = getQuotedPost(item.post);
      if (quotedPost?.contentLabel?.visibility === "hide") {
        return false;
      }
      if (hasHiddenBadgeLabel(quotedPost)) {
        return false;
      }
      return true;
    });
  }
}

export function filterFollowingFeed(
  feed,
  currentUser,
  preferences,
  isAuthenticated,
) {
  const followingFeedPreference = preferences.getFollowingFeedPreference();
  const filter = FeedFilter.compose(
    new FilterByFollowing(currentUser),
    ...(followingFeedPreference?.hideReposts ? [new FilterReposts()] : []),
    ...(followingFeedPreference?.hideReplies ? [new FilterReplies()] : []),
    ...(followingFeedPreference?.hideQuotePosts
      ? [new FilterQuotePosts()]
      : []),
    new DedupeFeed(),
    new FilterBlockedQuotes(),
    new FilterMutedQuotes(),
    new FilterMutedPosts(),
    new FilterEmptyPosts(),
    new FilterHiddenPosts(),
    new FilterContentLabeledPosts(),
    new FilterUnauthorizedPosts(isAuthenticated),
  );
  return {
    feed: filter.filterFeedItems(feed.feed),
    cursor: feed.cursor,
  };
}

export function filterAlgorithmicFeed(feed, isAuthenticated) {
  const filter = FeedFilter.compose(
    new FilterBlockedQuotes(),
    new DedupeFeed(),
    new FilterMutedQuotes(),
    new FilterMutedPosts(),
    new FilterEmptyPosts(),
    new FilterHiddenPosts(),
    new FilterContentLabeledPosts(),
    new FilterUnauthorizedPosts(isAuthenticated),
  );
  return {
    feed: filter.filterFeedItems(feed.feed),
    cursor: feed.cursor,
  };
}

export function filterBookmarksFeed(feed) {
  return {
    feed: new FilterEmptyPosts().filterFeedItems(feed.feed),
    cursor: feed.cursor,
  };
}

export function filterAuthorFeed(feed, isAuthenticated) {
  const filter = FeedFilter.compose(
    new DedupeFeed({ includeReposts: false }),
    new FilterEmptyPosts(),
    new FilterHiddenPosts(),
    new FilterContentLabeledPosts(),
    new FilterUnauthorizedPosts(isAuthenticated),
  );
  return {
    feed: filter.filterFeedItems(feed.feed),
    cursor: feed.cursor,
  };
}
