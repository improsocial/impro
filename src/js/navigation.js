import { getRKey, parseUri } from "/js/dataHelpers.js";

function encodePathSegment(segment) {
  return encodeURIComponent(segment).replace(/%3A/g, ":").replace(/%40/g, "@");
}

export function linkToHashtag(hashtag) {
  return `/hashtag/${encodePathSegment(hashtag)}`;
}

export function linkToProfile(identifierOrProfile) {
  let handle = identifierOrProfile;
  if (typeof identifierOrProfile === "object") {
    handle = identifierOrProfile.handle;
  }
  return `/profile/${encodePathSegment(handle)}`;
}

export function linkToLabeler(labeler) {
  return linkToProfile(labeler.creator);
}

export function linkToPost(post) {
  return `/profile/${encodePathSegment(post.author.handle)}/post/${encodePathSegment(getRKey(post))}`;
}

export function linkToPostFromUri(postUri) {
  const { repo, rkey } = parseUri(postUri);
  return `/profile/${encodePathSegment(repo)}/post/${encodePathSegment(rkey)}`;
}

export function linkToPostLikes(post) {
  return `/profile/${encodePathSegment(post.author.handle)}/post/${encodePathSegment(getRKey(post))}/likes`;
}

export function linkToPostQuotes(post) {
  return `/profile/${encodePathSegment(post.author.handle)}/post/${encodePathSegment(getRKey(post))}/quotes`;
}

export function linkToPostReposts(post) {
  return `/profile/${encodePathSegment(post.author.handle)}/post/${encodePathSegment(getRKey(post))}/reposts`;
}

export function linkToProfileFollowers(handleOrProfile) {
  let handle = handleOrProfile;
  if (typeof handleOrProfile === "object") {
    handle = handleOrProfile.handle;
  }
  return `/profile/${encodePathSegment(handle)}/followers`;
}

export function linkToProfileFollowing(handleOrProfile) {
  let handle = handleOrProfile;
  if (typeof handleOrProfile === "object") {
    handle = handleOrProfile.handle;
  }
  return `/profile/${encodePathSegment(handle)}/following`;
}

export function linkToFeed(feedGenerator) {
  return `/profile/${encodePathSegment(feedGenerator.creator.handle)}/feed/${encodePathSegment(
    getRKey(feedGenerator),
  )}`;
}

export function linkToSearchPostsByProfile(profile) {
  const searchString = `from:@${profile.handle}`;
  const query = new URLSearchParams();
  query.set("q", searchString);
  query.set("tab", "posts");
  return `/search?${query.toString()}`;
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
