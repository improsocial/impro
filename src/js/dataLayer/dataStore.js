import { EventEmitter } from "/js/eventEmitter.js";

// The store saves canonical data from the server. Patches are layered on top of this.
export class DataStore extends EventEmitter {
  constructor() {
    super();
    this.currentUser = null;
    this.preferences = null;
    this.feeds = new Map();
    this.posts = new Map();
    this.reposts = new Map();
    this.postThreads = new Map();
    this.profiles = new Map();
    this.authorFeeds = new Map();
    this.profileSearchResults = null;
    this.postSearchResults = null;
    this.showLessInteractions = [];
    this.notifications = null;
    this.notificationCursor = null;
    this.convoList = null;
    this.convoListCursor = null;
    // Note- we separate convos from the convo list because the convo list is
    // paginated, but we want to be able to fetch individual convos.
    this.convos = new Map();
    this.convoMessages = new Map(); // keyed by convoId, value: { messages: [], cursor: null }
    this.messages = new Map(); // keyed by messageId, value: message
    // custom unavailable posts
    this.unavailablePosts = new Map();
    this.postLikes = new Map();
    this.postQuotes = new Map();
    this.postReposts = new Map();
    this.feedGenerators = new Map();
    this.hashtagFeeds = new Map();
    this.pinnedFeedGenerators = null;
    this.bookmarks = null;
    this.profileFollowers = new Map();
    this.profileFollows = new Map();
    this.profileChatStatus = new Map();
  }

  hasCurrentUser() {
    return this.currentUser !== null;
  }

  setCurrentUser(user) {
    this.currentUser = user;
  }

  getCurrentUser() {
    return this.currentUser;
  }

  clearCurrentUser() {
    this.currentUser = null;
  }

  hasPreferences() {
    return this.preferences !== null;
  }

  getPreferences() {
    return this.preferences;
  }

  setPreferences(preferences) {
    this.preferences = preferences;
  }

  clearPreferences() {
    this.preferences = null;
  }

  hasFeed(feedURI) {
    return this.feeds.has(feedURI);
  }

  getFeed(feedURI) {
    return this.feeds.get(feedURI);
  }

  setFeed(feedURI, feed) {
    this.feeds.set(feedURI, feed);
  }

  clearFeed(feedURI) {
    this.feeds.delete(feedURI);
  }

  hasPost(postURI) {
    return this.posts.has(postURI);
  }

  getPost(postURI) {
    return this.posts.get(postURI);
  }

  getAllPosts() {
    return Array.from(this.posts.values());
  }

  setPost(postURI, post) {
    this.posts.set(postURI, post);
    this.emit("setPost", post);
  }

  clearPost(postURI) {
    this.posts.delete(postURI);
  }

  // convenience method
  setPosts(posts) {
    posts.forEach((post) => this.setPost(post.uri, post));
  }

  hasPostThread(postURI) {
    return this.postThreads.has(postURI);
  }

  getPostThread(postURI) {
    return this.postThreads.get(postURI);
  }

  setPostThread(postURI, postThread) {
    this.postThreads.set(postURI, postThread);
  }

  clearPostThread(postURI) {
    this.postThreads.delete(postURI);
  }

  hasProfile(did) {
    return this.profiles.has(did);
  }

  setProfile(did, profile) {
    this.profiles.set(did, profile);
  }

  getProfile(did) {
    return this.profiles.get(did);
  }

  clearProfile(did) {
    this.profiles.delete(did);
  }

  hasProfileSearchResults() {
    return this.profileSearchResults !== null;
  }

  getProfileSearchResults() {
    return this.profileSearchResults;
  }

  setProfileSearchResults(dids) {
    this.profileSearchResults = dids;
  }

  clearProfileSearchResults() {
    this.profileSearchResults = null;
  }

  hasPostSearchResults() {
    return this.postSearchResults !== null;
  }

  getPostSearchResults() {
    return this.postSearchResults;
  }

  setPostSearchResults(postUris) {
    this.postSearchResults = postUris;
  }

  clearPostSearchResults() {
    this.postSearchResults = null;
  }

  hasAuthorFeed(feedURI) {
    return this.authorFeeds.has(feedURI);
  }

  getAuthorFeed(feedURI) {
    return this.authorFeeds.get(feedURI);
  }

  setAuthorFeed(feedURI, feed) {
    this.authorFeeds.set(feedURI, feed);
  }

  clearAuthorFeed(feedURI) {
    this.authorFeeds.delete(feedURI);
  }

  getShowLessInteractions() {
    return this.showLessInteractions;
  }

  addShowLessInteraction(interaction) {
    this.showLessInteractions.push(interaction);
  }

  hasUnavailablePost(uri) {
    return this.unavailablePosts.has(uri);
  }

  getUnavailablePost(uri) {
    return this.unavailablePosts.get(uri);
  }

  setUnavailablePost(uri, post) {
    this.unavailablePosts.set(uri, post);
  }

  clearUnavailablePost(uri) {
    this.unavailablePosts.delete(uri);
  }

  hasRepost(repostURI) {
    return this.reposts.has(repostURI);
  }

  getRepost(repostURI) {
    return this.reposts.get(repostURI);
  }

  setRepost(repostURI, repost) {
    this.reposts.set(repostURI, repost);
  }

  clearRepost(repostURI) {
    this.reposts.delete(repostURI);
  }

  setReposts(reposts) {
    reposts.forEach((repost) => this.setRepost(repost.uri, repost));
  }

  clearReposts() {
    this.reposts.clear();
  }

  hasNotifications() {
    return this.notifications !== null;
  }

  getNotifications() {
    return this.notifications;
  }

  setNotifications(notifications) {
    this.notifications = notifications;
  }

  clearNotifications() {
    this.notifications = null;
  }

  hasNotificationCursor() {
    return this.notificationCursor !== null;
  }

  getNotificationCursor() {
    return this.notificationCursor;
  }

  setNotificationCursor(cursor) {
    this.notificationCursor = cursor;
  }

  clearNotificationCursor() {
    this.notificationCursor = null;
  }

  hasConvoList() {
    return this.convoList !== null;
  }

  getConvoList() {
    return this.convoList;
  }

  setConvoList(convos) {
    this.convoList = convos;
  }

  clearConvoList() {
    this.convoList = null;
  }

  hasConvoListCursor() {
    return this.convoListCursor !== null;
  }

  getConvoListCursor() {
    return this.convoListCursor;
  }

  setConvoListCursor(cursor) {
    this.convoListCursor = cursor;
  }

  clearConvoListCursor() {
    this.convoListCursor = null;
  }

  hasConvo(convoId) {
    return this.convos.has(convoId);
  }

  getConvo(convoId) {
    return this.convos.get(convoId);
  }

  setConvo(convoId, convo) {
    this.convos.set(convoId, convo);
  }

  clearConvo(convoId) {
    this.convos.delete(convoId);
  }

  getAllConvos() {
    return Array.from(this.convos.values());
  }

  hasConvoMessages(convoId) {
    return this.convoMessages.has(convoId);
  }

  getConvoMessages(convoId) {
    return this.convoMessages.get(convoId) ?? null;
  }

  setConvoMessages(convoId, messages) {
    this.convoMessages.set(convoId, messages);
  }

  clearConvoMessages(convoId) {
    this.convoMessages.delete(convoId);
  }

  hasMessage(messageId) {
    return this.messages.has(messageId);
  }

  getMessage(messageId) {
    return this.messages.get(messageId);
  }

  setMessage(messageId, message) {
    this.messages.set(messageId, message);
  }

  clearMessage(messageId) {
    this.messages.delete(messageId);
  }

  hasPostLikes(postUri) {
    return this.postLikes.has(postUri);
  }

  getPostLikes(postUri) {
    return this.postLikes.get(postUri);
  }

  setPostLikes(postUri, likes) {
    this.postLikes.set(postUri, likes);
  }

  clearPostLikes(postUri) {
    this.postLikes.delete(postUri);
  }

  hasPostQuotes(postUri) {
    return this.postQuotes.has(postUri);
  }

  getPostQuotes(postUri) {
    return this.postQuotes.get(postUri);
  }

  setPostQuotes(postUri, quotes) {
    this.postQuotes.set(postUri, quotes);
  }

  clearPostQuotes(postUri) {
    this.postQuotes.delete(postUri);
  }

  hasPostReposts(postUri) {
    return this.postReposts.has(postUri);
  }

  getPostReposts(postUri) {
    return this.postReposts.get(postUri);
  }

  setPostReposts(postUri, reposts) {
    this.postReposts.set(postUri, reposts);
  }

  clearPostReposts(postUri) {
    this.postReposts.delete(postUri);
  }

  hasFeedGenerator(feedUri) {
    return this.feedGenerators.has(feedUri);
  }

  getFeedGenerator(feedUri) {
    return this.feedGenerators.get(feedUri);
  }

  setFeedGenerator(feedUri, feedGenerator) {
    this.feedGenerators.set(feedUri, feedGenerator);
    this.emit("setFeedGenerator", feedGenerator);
  }

  clearFeedGenerator(feedUri) {
    this.feedGenerators.delete(feedUri);
  }

  hasHashtagFeed(hashtagKey) {
    return this.hashtagFeeds.has(hashtagKey);
  }

  getHashtagFeed(hashtagKey) {
    return this.hashtagFeeds.get(hashtagKey);
  }

  setHashtagFeed(hashtagKey, feed) {
    this.hashtagFeeds.set(hashtagKey, feed);
  }

  clearHashtagFeed(hashtagKey) {
    this.hashtagFeeds.delete(hashtagKey);
  }

  hasPinnedFeedGenerators() {
    return this.pinnedFeedGenerators !== null;
  }

  getPinnedFeedGenerators() {
    return this.pinnedFeedGenerators;
  }

  setPinnedFeedGenerators(pinnedFeedGenerators) {
    this.pinnedFeedGenerators = pinnedFeedGenerators;
  }

  clearPinnedFeedGenerators() {
    this.pinnedFeedGenerators = null;
  }

  hasBookmarks() {
    return this.bookmarks !== null;
  }

  getBookmarks() {
    return this.bookmarks;
  }

  setBookmarks(bookmarks) {
    this.bookmarks = bookmarks;
  }

  clearBookmarks() {
    this.bookmarks = null;
  }

  hasProfileFollowers(profileDid) {
    return this.profileFollowers.has(profileDid);
  }

  getProfileFollowers(profileDid) {
    return this.profileFollowers.get(profileDid);
  }

  setProfileFollowers(profileDid, followers) {
    this.profileFollowers.set(profileDid, followers);
  }

  clearProfileFollowers(profileDid) {
    this.profileFollowers.delete(profileDid);
  }

  hasProfileFollows(profileDid) {
    return this.profileFollows.has(profileDid);
  }

  getProfileFollows(profileDid) {
    return this.profileFollows.get(profileDid);
  }

  setProfileFollows(profileDid, follows) {
    this.profileFollows.set(profileDid, follows);
  }

  clearProfileFollows(profileDid) {
    this.profileFollows.delete(profileDid);
  }

  hasProfileChatStatus(profileDid) {
    return this.profileChatStatus.has(profileDid);
  }

  getProfileChatStatus(profileDid) {
    return this.profileChatStatus.get(profileDid);
  }

  setProfileChatStatus(profileDid, chatStatus) {
    this.profileChatStatus.set(profileDid, chatStatus);
  }

  clearProfileChatStatus(profileDid) {
    this.profileChatStatus.delete(profileDid);
  }
}
