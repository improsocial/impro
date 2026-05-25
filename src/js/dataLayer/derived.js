// Pure derivations over already-selected data. No closed-over state,
// dependencies are explicit in each function's signature so consumers
// can enumerate what events to subscribe to. Each function returns a
// new post object and does not mutate its input.

import {
  getQuotedPost,
  getBlockedQuote,
  isBlockingUser,
  replaceBlockedQuote,
  createEmbedFromPost,
  markBlockedQuoteNotFound,
} from "/js/dataHelpers.js";
import { deepClone } from "/js/utils.js";

export function markMutedWords(post, preferences) {
  const result = deepClone(post);
  applyMutedWordsInPlace(result, preferences);
  return result;
}

export function markIsHidden(post, preferences) {
  const result = deepClone(post);
  applyIsHiddenInPlace(result, preferences);
  return result;
}

export function addLabels(post, preferences) {
  const result = deepClone(post);
  applyLabelsInPlace(result, preferences);
  return result;
}

export function resolveBlockedQuote(post, { getPost }) {
  const blockedQuote = getBlockedQuote(post);
  if (!blockedQuote || isBlockingUser(blockedQuote)) return post;
  const fullBlockedPost = getPost(blockedQuote.uri);
  if (fullBlockedPost) {
    const blockedQuoteEmbed = createEmbedFromPost(fullBlockedPost);
    return replaceBlockedQuote(post, blockedQuoteEmbed);
  }
  return markBlockedQuoteNotFound(post, blockedQuote.uri);
}

// Composes the per-post hydrations a view typically wants.
// Explicit inputs: the post itself, current preferences, and a getPost
// lookup for resolving blocked-quote references. Each input maps to a
// distinct subscription a sub-root consumer would need. Returns a new
// post object; never mutates the input.
export function hydratePostForView(post, { preferences, getPost }) {
  if (!post) return null;
  const resolved = resolveBlockedQuote(post, { getPost });
  // Clone once and run the in-place markers against our own copy.
  const result = resolved === post ? deepClone(post) : deepClone(resolved);
  applyMutedWordsInPlace(result, preferences);
  applyIsHiddenInPlace(result, preferences);
  applyLabelsInPlace(result, preferences);
  return result;
}

function applyMutedWordsInPlace(post, preferences) {
  if (preferences.postHasMutedWord(post)) {
    if (!post.viewer) post.viewer = {};
    post.viewer.hasMutedWord = true;
  }
  const quotedPost = getQuotedPost(post);
  if (quotedPost) {
    if (preferences.quotedPostHasMutedWord(quotedPost)) {
      quotedPost.hasMutedWord = true;
    }
    const nestedQuotedPost = getQuotedPost(quotedPost);
    if (
      nestedQuotedPost &&
      preferences.quotedPostHasMutedWord(nestedQuotedPost)
    ) {
      nestedQuotedPost.hasMutedWord = true;
    }
  }
}

function applyIsHiddenInPlace(post, preferences) {
  if (preferences.isPostHidden(post.uri)) {
    if (!post.viewer) post.viewer = {};
    post.viewer.isHidden = true;
  }
  const quotedPost = getQuotedPost(post);
  if (quotedPost) {
    if (preferences.isPostHidden(quotedPost.uri)) {
      quotedPost.isHidden = true;
    }
    const nestedQuotedPost = getQuotedPost(quotedPost);
    if (nestedQuotedPost && preferences.isPostHidden(nestedQuotedPost.uri)) {
      nestedQuotedPost.isHidden = true;
    }
  }
}

function applyLabelsInPlace(post, preferences) {
  const badgeLabels = preferences.getBadgeLabels(post);
  if (badgeLabels.length > 0) {
    post.badgeLabels = badgeLabels;
  }
  const contentLabel = preferences.getContentLabel(post);
  if (contentLabel) {
    post.contentLabel = contentLabel;
  }
  const mediaLabel = preferences.getMediaLabel(post);
  if (mediaLabel) {
    post.mediaLabel = mediaLabel;
  }
  const quotedPost = getQuotedPost(post);
  if (quotedPost) {
    const quotedBadgeLabels = preferences.getBadgeLabels(quotedPost);
    if (quotedBadgeLabels.length > 0) {
      quotedPost.badgeLabels = quotedBadgeLabels;
    }
    const quotedContentLabel = preferences.getContentLabel(quotedPost);
    if (quotedContentLabel) {
      quotedPost.contentLabel = quotedContentLabel;
    }
    const quotedMediaLabel = preferences.getMediaLabel(quotedPost);
    if (quotedMediaLabel) {
      quotedPost.mediaLabel = quotedMediaLabel;
    }
    const nestedQuotedPost = getQuotedPost(quotedPost);
    if (nestedQuotedPost) {
      const nestedBadgeLabels = preferences.getBadgeLabels(nestedQuotedPost);
      if (nestedBadgeLabels.length > 0) {
        nestedQuotedPost.badgeLabels = nestedBadgeLabels;
      }
      const nestedContentLabel = preferences.getContentLabel(nestedQuotedPost);
      if (nestedContentLabel) {
        nestedQuotedPost.contentLabel = nestedContentLabel;
      }
      const nestedMediaLabel = preferences.getMediaLabel(nestedQuotedPost);
      if (nestedMediaLabel) {
        nestedQuotedPost.mediaLabel = nestedMediaLabel;
      }
    }
  }
}
