import {
  getParentPosts,
  getNestedReplyPosts,
  getReplyPosts,
} from "/js/dataHelpers.js";
import { unique } from "/js/utils.js";

// Helper functions for normalizing data from API responses.

export class Normalizer {
  getPostsFromPostThread(postThread) {
    const posts = [];
    if (postThread.post) {
      posts.push(postThread.post);
    }
    const parentPosts = getParentPosts(postThread);
    posts.push(...parentPosts);
    const replies = getNestedReplyPosts(postThread);
    posts.push(...replies);
    return unique(posts, { by: "uri" });
  }

  getPostsFromFeed(feed) {
    const posts = [];
    for (let feedItem of feed.feed) {
      posts.push(feedItem.post);
      if (feedItem.reply) {
        const root = feedItem.reply.root;
        if (root.$type === "app.bsky.feed.defs#postView") {
          posts.push(root);
        }
        const parent = feedItem.reply.parent;
        if (parent.$type === "app.bsky.feed.defs#postView") {
          posts.push(parent);
        }
      }
    }
    return unique(posts, { by: "uri" });
  }
}
