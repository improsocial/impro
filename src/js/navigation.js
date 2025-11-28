import { getRKey, parseUri } from "/js/dataHelpers.js";

export function linkToHashtag(hashtag) {
  return `/hashtag/${hashtag}`;
}

export function linkToProfile(identifierOrProfile) {
  let handle = identifierOrProfile;
  if (typeof identifierOrProfile === "object") {
    handle = identifierOrProfile.handle;
  }
  return `/profile/${handle}`;
}

export function linkToPost(post) {
  return `/profile/${post.author.handle}/post/${getRKey(post)}`;
}

export function linkToPostFromUri(postUri) {
  const { repo, rkey } = parseUri(postUri);
  return `/profile/${repo}/post/${rkey}`;
}

export function linkToPostLikes(post) {
  return `/profile/${post.author.handle}/post/${getRKey(post)}/likes`;
}

export function linkToPostQuotes(post) {
  return `/profile/${post.author.handle}/post/${getRKey(post)}/quotes`;
}

export function linkToPostReposts(post) {
  return `/profile/${post.author.handle}/post/${getRKey(post)}/reposts`;
}

export function linkToProfileFollowers(handleOrProfile) {
  let handle = handleOrProfile;
  if (typeof handleOrProfile === "object") {
    handle = handleOrProfile.handle;
  }
  return `/profile/${handle}/followers`;
}

export function linkToProfileFollowing(handleOrProfile) {
  let handle = handleOrProfile;
  if (typeof handleOrProfile === "object") {
    handle = handleOrProfile.handle;
  }
  return `/profile/${handle}/following`;
}

export function linkToFeed(feedGenerator) {
  return `/profile/${feedGenerator.creator.handle}/feed/${getRKey(
    feedGenerator
  )}`;
}

function getPermalinkOrigin() {
  // return window.location.origin;
  // TODO: make configurable
  return "https://bsky.app";
}

export function getPermalinkForPost(post) {
  return getPermalinkOrigin() + linkToPost(post);
}

export function getPermalinkForProfile(profile) {
  return getPermalinkOrigin() + linkToProfile(profile.handle);
}
