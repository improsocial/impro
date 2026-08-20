export const Resources = {
  ACTOR_FEEDS: "actorFeeds",
  ACTOR_LISTS: "actorLists",
  AUTHOR_FEED: "authorFeed",
  BOOKMARKS: "bookmarks",
  BLOCKED_PROFILES: "blockedProfiles",
  CHAT_RECIPIENT_SEARCH: "chatRecipientSearch",
  CONVO: "convo",
  CONVO_LIST: "convoList",
  CONVO_REQUEST_LIST: "convoRequestList",
  CONVO_MEMBERS: "convoMembers",
  CONVO_MESSAGES: "convoMessages",
  FEED: "feed",
  FEED_SEARCH: "feedSearch",
  DETAILED_PROFILE: "detailedProfile",
  DRAFTS: "drafts",
  GIF_SEARCH: "gifSearch",
  HASHTAG_FEED: "hashtagFeed",
  KNOWN_FOLLOWERS: "knownFollowers",
  LIST_MEMBERS: "listMembers",
  LISTS_WITH_MEMBERSHIP: "listsWithMembership",
  MENTION_NOTIFICATIONS: "mentionNotifications",
  MUTED_PROFILES: "mutedProfiles",
  NOTIFICATIONS: "notifications",
  PINNED_ITEMS: "pinnedItems",
  POST_LIKES: "postLikes",
  POST_THREAD: "postThread",
  POST_THREAD_OTHER: "postThreadOther",
  TRENDS: "trends",
  POST_QUOTES: "postQuotes",
  POST_SEARCH_LATEST: "postSearchLatest",
  POST_REPOSTS: "postReposts",
  POST_SEARCH_TOP: "postSearchTop",
  PROFILE_FOLLOWERS: "profileFollowers",
  PROFILE_FOLLOWS: "profileFollows",
  PROFILE_SEARCH: "profileSearch",
  SEARCH_TYPEAHEAD: "searchTypeahead",
  SIDEBAR_SEARCH_TYPEAHEAD: "sidebarSearchTypeahead",
};

export function buildQueryKey(resource, params = {}) {
  const entries = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null)
    .sort(([a], [b]) => (a < b ? -1 : 1));
  return `${resource}|${entries.map(([k, v]) => `${k}=${v}`).join("&")}`;
}

export function actorFeedsQueryKey({ did }) {
  return buildQueryKey(Resources.ACTOR_FEEDS, { did });
}

export function actorListsQueryKey({ did }) {
  return buildQueryKey(Resources.ACTOR_LISTS, { did });
}

export function authorFeedQueryKey({ did, feedType }) {
  return buildQueryKey(Resources.AUTHOR_FEED, { did, feedType });
}

export function bookmarksQueryKey() {
  return buildQueryKey(Resources.BOOKMARKS);
}

export function blockedProfilesQueryKey() {
  return buildQueryKey(Resources.BLOCKED_PROFILES);
}

export function convoListQueryKey() {
  return buildQueryKey(Resources.CONVO_LIST);
}

export function convoRequestListQueryKey() {
  return buildQueryKey(Resources.CONVO_REQUEST_LIST);
}

export function feedQueryKey({ uri }) {
  return buildQueryKey(Resources.FEED, { uri });
}

const FEED_KEY_PREFIX = `${Resources.FEED}|uri=`;

export function parseFeedQueryKey(queryKey) {
  return queryKey.startsWith(FEED_KEY_PREFIX)
    ? queryKey.slice(FEED_KEY_PREFIX.length)
    : null;
}

export function feedSearchQueryKey({ query }) {
  return buildQueryKey(Resources.FEED_SEARCH, { query });
}

export function gifSearchQueryKey({ query }) {
  return buildQueryKey(Resources.GIF_SEARCH, { query });
}

export function draftsQueryKey() {
  return buildQueryKey(Resources.DRAFTS);
}

export function mentionNotificationsQueryKey() {
  return buildQueryKey(Resources.MENTION_NOTIFICATIONS);
}

export function mutedProfilesQueryKey() {
  return buildQueryKey(Resources.MUTED_PROFILES);
}

export function notificationsQueryKey() {
  return buildQueryKey(Resources.NOTIFICATIONS);
}

export function profileFollowersQueryKey({ did }) {
  return buildQueryKey(Resources.PROFILE_FOLLOWERS, { did });
}

export function hashtagFeedQueryKey({ hashtag, sort }) {
  return buildQueryKey(Resources.HASHTAG_FEED, { hashtag, sort });
}

export function knownFollowersQueryKey({ did }) {
  return buildQueryKey(Resources.KNOWN_FOLLOWERS, { did });
}

export function profileFollowsQueryKey({ did }) {
  return buildQueryKey(Resources.PROFILE_FOLLOWS, { did });
}

export function profileSearchQueryKey({ query }) {
  return buildQueryKey(Resources.PROFILE_SEARCH, { query });
}

export function convoMembersQueryKey({ convoId }) {
  return buildQueryKey(Resources.CONVO_MEMBERS, { convoId });
}

export function listMembersQueryKey({ listUri }) {
  return buildQueryKey(Resources.LIST_MEMBERS, { listUri });
}

export function listsWithMembershipQueryKey({ did }) {
  return buildQueryKey(Resources.LISTS_WITH_MEMBERSHIP, { did });
}

export function postLikesQueryKey({ postUri }) {
  return buildQueryKey(Resources.POST_LIKES, { postUri });
}

export function postRepostsQueryKey({ postUri }) {
  return buildQueryKey(Resources.POST_REPOSTS, { postUri });
}

export function postQuotesQueryKey({ postUri }) {
  return buildQueryKey(Resources.POST_QUOTES, { postUri });
}

export function postSearchLatestQueryKey({ query }) {
  return buildQueryKey(Resources.POST_SEARCH_LATEST, { query });
}

export function postSearchTopQueryKey({ query }) {
  return buildQueryKey(Resources.POST_SEARCH_TOP, { query });
}

export function searchTypeaheadQueryKey({ query }) {
  return buildQueryKey(Resources.SEARCH_TYPEAHEAD, { query });
}

export function sidebarSearchTypeaheadQueryKey({ query }) {
  return buildQueryKey(Resources.SIDEBAR_SEARCH_TYPEAHEAD, { query });
}

export function chatRecipientSearchQueryKey({ query }) {
  return buildQueryKey(Resources.CHAT_RECIPIENT_SEARCH, { query });
}

export function pinnedItemsQueryKey() {
  return buildQueryKey(Resources.PINNED_ITEMS);
}

export function trendsQueryKey() {
  return buildQueryKey(Resources.TRENDS);
}

export function convoMessagesQueryKey({ convoId }) {
  return buildQueryKey(Resources.CONVO_MESSAGES, { convoId });
}

export function postThreadQueryKey({ uri }) {
  return buildQueryKey(Resources.POST_THREAD, { uri });
}

export function postThreadOtherQueryKey({ uri }) {
  return buildQueryKey(Resources.POST_THREAD_OTHER, { uri });
}

// Request id for the detailed-profile fetch. The profile is a shared entity in
// the DataStore, so this addresses the request's status only.
export function detailedProfileRequestKey({ did }) {
  return buildQueryKey(Resources.DETAILED_PROFILE, { did });
}
