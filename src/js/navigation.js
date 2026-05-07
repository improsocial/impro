import { getRKey, parseUri, hasValidHandle } from "/js/dataHelpers.js";

function encodePathSegment(segment) {
  return encodeURIComponent(segment).replace(/%3A/g, ":").replace(/%40/g, "@");
}

function profileIdentifier(profile) {
  return hasValidHandle(profile) ? profile.handle : profile.did;
}

export function linkToHashtag(hashtag) {
  return `/hashtag/${encodePathSegment(hashtag)}`;
}

export function linkToProfile(profile) {
  return `/profile/${encodePathSegment(profileIdentifier(profile))}`;
}

export function linkToProfileByDid(did) {
  return `/profile/${encodePathSegment(did)}`;
}

export function linkToLabeler(labeler) {
  return linkToProfile(labeler.creator);
}

export function linkToPost(post) {
  return `/profile/${encodePathSegment(profileIdentifier(post.author))}/post/${encodePathSegment(getRKey(post))}`;
}

export function linkToPostFromUri(postUri) {
  const { repo, rkey } = parseUri(postUri);
  return `/profile/${encodePathSegment(repo)}/post/${encodePathSegment(rkey)}`;
}

export function linkToPostLikes(post) {
  return `/profile/${encodePathSegment(profileIdentifier(post.author))}/post/${encodePathSegment(getRKey(post))}/likes`;
}

export function linkToPostQuotes(post) {
  return `/profile/${encodePathSegment(profileIdentifier(post.author))}/post/${encodePathSegment(getRKey(post))}/quotes`;
}

export function linkToPostReposts(post) {
  return `/profile/${encodePathSegment(profileIdentifier(post.author))}/post/${encodePathSegment(getRKey(post))}/reposts`;
}

export function linkToProfileFollowers(profile) {
  return `/profile/${encodePathSegment(profileIdentifier(profile))}/followers`;
}

export function linkToProfileFollowing(profile) {
  return `/profile/${encodePathSegment(profileIdentifier(profile))}/following`;
}

export function linkToFeed(feedGenerator) {
  return `/profile/${encodePathSegment(profileIdentifier(feedGenerator.creator))}/feed/${encodePathSegment(
    getRKey(feedGenerator),
  )}`;
}

export function linkToSearchPostsByProfile(profile) {
  const searchString = `from:@${profile.handle} `;
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
  return getPermalinkOrigin() + linkToProfile(profile);
}

export function linkToLogin() {
  const { pathname, search, hash } = window.location;
  if (pathname === "/login" || pathname === "/") {
    return "/login";
  }
  const params = new URLSearchParams();
  params.set("returnTo", pathname + search + hash);
  return "/login?" + params.toString();
}

export function validateReturnToParam(raw) {
  if (typeof raw !== "string" || raw.length === 0) {
    return null;
  }
  if (!raw.startsWith("/")) {
    return null;
  }
  if (raw.startsWith("//") || raw.startsWith("/\\")) {
    return null;
  }
  return raw;
}
