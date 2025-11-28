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
    this.emit("update");
  }

  getCurrentUser() {
    return this.currentUser;
  }

  clearCurrentUser() {
    this.currentUser = null;
    this.emit("update");
  }

  hasPreferences() {
    return this.preferences !== null;
  }

  getPreferences() {
    return this.preferences;
  }

  setPreferences(preferences) {
    this.preferences = preferences;
    this.emit("update");
  }

  clearPreferences() {
    this.preferences = null;
    this.emit("update");
  }

  hasFeed(feedURI) {
    return this.feeds.has(feedURI);
  }

  getFeed(feedURI) {
    return this.feeds.get(feedURI);
  }

  setFeed(feedURI, feed) {
    this.feeds.set(feedURI, feed);
    this.emit("update");
  }

  clearFeed(feedURI) {
    this.feeds.delete(feedURI);
    this.emit("update");
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
    this.emit("update");
    this.emit("setPost", post);
  }

  clearPost(postURI) {
    this.posts.delete(postURI);
    this.emit("update");
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
    this.emit("update");
  }

  clearPostThread(postURI) {
    this.postThreads.delete(postURI);
    this.emit("update");
  }

  hasProfile(did) {
    return this.profiles.has(did);
  }

  setProfile(did, profile) {
    this.profiles.set(did, profile);
    this.emit("update");
  }

  getProfile(did) {
    return this.profiles.get(did);
  }

  clearProfile(did) {
    this.profiles.delete(did);
    this.emit("update");
  }

  hasProfileSearchResults() {
    return this.profileSearchResults !== null;
  }

  getProfileSearchResults() {
    return this.profileSearchResults;
  }

  setProfileSearchResults(dids) {
    this.profileSearchResults = dids;
    this.emit("update");
  }

  clearProfileSearchResults() {
    this.profileSearchResults = null;
    this.emit("update");
  }

  hasPostSearchResults() {
    return this.postSearchResults !== null;
  }

  getPostSearchResults() {
    return this.postSearchResults;
  }

  setPostSearchResults(postUris) {
    this.postSearchResults = postUris;
    this.emit("update");
  }

  clearPostSearchResults() {
    this.postSearchResults = null;
    this.emit("update");
  }

  hasAuthorFeed(feedURI) {
    return this.authorFeeds.has(feedURI);
  }

  getAuthorFeed(feedURI) {
    return this.authorFeeds.get(feedURI);
  }

  setAuthorFeed(feedURI, feed) {
    this.authorFeeds.set(feedURI, feed);
    this.emit("update");
  }

  clearAuthorFeed(feedURI) {
    this.authorFeeds.delete(feedURI);
    this.emit("update");
  }

  getShowLessInteractions() {
    return this.showLessInteractions;
  }

  addShowLessInteraction(interaction) {
    this.showLessInteractions.push(interaction);
    this.emit("update");
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
    this.emit("update");
  }

  hasRepost(repostURI) {
    return this.reposts.has(repostURI);
  }

  getRepost(repostURI) {
    return this.reposts.get(repostURI);
  }

  setRepost(repostURI, repost) {
    this.reposts.set(repostURI, repost);
    this.emit("update");
  }

  clearRepost(repostURI) {
    this.reposts.delete(repostURI);
    this.emit("update");
  }

  setReposts(reposts) {
    reposts.forEach((repost) => this.setRepost(repost.uri, repost));
  }

  clearReposts() {
    this.reposts.clear();
    this.emit("update");
  }

  hasNotifications() {
    return this.notifications !== null;
  }

  getNotifications() {
    return this.notifications;
  }

  setNotifications(notifications) {
    this.notifications = notifications;
    this.emit("update");
  }

  clearNotifications() {
    this.notifications = null;
    this.emit("update");
  }

  hasNotificationCursor() {
    return this.notificationCursor !== null;
  }

  getNotificationCursor() {
    return this.notificationCursor;
  }

  setNotificationCursor(cursor) {
    this.notificationCursor = cursor;
    this.emit("update");
  }

  clearNotificationCursor() {
    this.notificationCursor = null;
    this.emit("update");
  }

  hasConvoList() {
    return this.convoList !== null;
  }

  getConvoList() {
    return this.convoList;
  }

  setConvoList(convos) {
    this.convoList = convos;
    this.emit("update");
  }

  clearConvoList() {
    this.convoList = null;
    this.emit("update");
  }

  hasConvoListCursor() {
    return this.convoListCursor !== null;
  }

  getConvoListCursor() {
    return this.convoListCursor;
  }

  setConvoListCursor(cursor) {
    this.convoListCursor = cursor;
    this.emit("update");
  }

  clearConvoListCursor() {
    this.convoListCursor = null;
    this.emit("update");
  }

  hasConvo(convoId) {
    return this.convos.has(convoId);
  }

  getConvo(convoId) {
    return this.convos.get(convoId);
  }

  setConvo(convoId, convo) {
    this.convos.set(convoId, convo);
    this.emit("update");
  }

  clearConvo(convoId) {
    this.convos.delete(convoId);
    this.emit("update");
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
    this.emit("update");
  }

  clearConvoMessages(convoId) {
    this.convoMessages.delete(convoId);
    this.emit("update");
  }

  hasMessage(messageId) {
    return this.messages.has(messageId);
  }

  getMessage(messageId) {
    return this.messages.get(messageId);
  }

  setMessage(messageId, message) {
    this.messages.set(messageId, message);
    this.emit("update");
  }

  clearMessage(messageId) {
    this.messages.delete(messageId);
    this.emit("update");
  }

  hasPostLikes(postUri) {
    return this.postLikes.has(postUri);
  }

  getPostLikes(postUri) {
    return this.postLikes.get(postUri);
  }

  setPostLikes(postUri, likes) {
    this.postLikes.set(postUri, likes);
    this.emit("update");
  }

  clearPostLikes(postUri) {
    this.postLikes.delete(postUri);
    this.emit("update");
  }

  hasPostQuotes(postUri) {
    return this.postQuotes.has(postUri);
  }

  getPostQuotes(postUri) {
    return this.postQuotes.get(postUri);
  }

  setPostQuotes(postUri, quotes) {
    this.postQuotes.set(postUri, quotes);
    this.emit("update");
  }

  clearPostQuotes(postUri) {
    this.postQuotes.delete(postUri);
    this.emit("update");
  }

  hasPostReposts(postUri) {
    return this.postReposts.has(postUri);
  }

  getPostReposts(postUri) {
    return this.postReposts.get(postUri);
  }

  setPostReposts(postUri, reposts) {
    this.postReposts.set(postUri, reposts);
    this.emit("update");
  }

  clearPostReposts(postUri) {
    this.postReposts.delete(postUri);
    this.emit("update");
  }

  hasFeedGenerator(feedUri) {
    return this.feedGenerators.has(feedUri);
  }

  getFeedGenerator(feedUri) {
    return this.feedGenerators.get(feedUri);
  }

  setFeedGenerator(feedUri, feedGenerator) {
    this.feedGenerators.set(feedUri, feedGenerator);
    this.emit("update");
    this.emit("setFeedGenerator", feedGenerator);
  }

  clearFeedGenerator(feedUri) {
    this.feedGenerators.delete(feedUri);
    this.emit("update");
  }

  hasHashtagFeed(hashtagKey) {
    return this.hashtagFeeds.has(hashtagKey);
  }

  getHashtagFeed(hashtagKey) {
    return this.hashtagFeeds.get(hashtagKey);
  }

  setHashtagFeed(hashtagKey, feed) {
    this.hashtagFeeds.set(hashtagKey, feed);
    this.emit("update");
  }

  clearHashtagFeed(hashtagKey) {
    this.hashtagFeeds.delete(hashtagKey);
    this.emit("update");
  }

  hasPinnedFeedGenerators() {
    return this.pinnedFeedGenerators !== null;
  }

  getPinnedFeedGenerators() {
    return this.pinnedFeedGenerators;
  }

  setPinnedFeedGenerators(pinnedFeedGenerators) {
    this.pinnedFeedGenerators = pinnedFeedGenerators;
    this.emit("update");
  }

  clearPinnedFeedGenerators() {
    this.pinnedFeedGenerators = null;
    this.emit("update");
  }

  hasBookmarks() {
    return this.bookmarks !== null;
  }

  getBookmarks() {
    return this.bookmarks;
  }

  setBookmarks(bookmarks) {
    this.bookmarks = bookmarks;
    this.emit("update");
  }

  clearBookmarks() {
    this.bookmarks = null;
    this.emit("update");
  }

  hasProfileFollowers(profileDid) {
    return this.profileFollowers.has(profileDid);
  }

  getProfileFollowers(profileDid) {
    return this.profileFollowers.get(profileDid);
  }

  setProfileFollowers(profileDid, followers) {
    this.profileFollowers.set(profileDid, followers);
    this.emit("update");
  }

  clearProfileFollowers(profileDid) {
    this.profileFollowers.delete(profileDid);
    this.emit("update");
  }

  hasProfileFollows(profileDid) {
    return this.profileFollows.has(profileDid);
  }

  getProfileFollows(profileDid) {
    return this.profileFollows.get(profileDid);
  }

  setProfileFollows(profileDid, follows) {
    this.profileFollows.set(profileDid, follows);
    this.emit("update");
  }

  clearProfileFollows(profileDid) {
    this.profileFollows.delete(profileDid);
    this.emit("update");
  }

  hasProfileChatStatus(profileDid) {
    return this.profileChatStatus.has(profileDid);
  }

  getProfileChatStatus(profileDid) {
    return this.profileChatStatus.get(profileDid);
  }

  setProfileChatStatus(profileDid, chatStatus) {
    this.profileChatStatus.set(profileDid, chatStatus);
    this.emit("update");
  }

  clearProfileChatStatus(profileDid) {
    this.profileChatStatus.delete(profileDid);
    this.emit("update");
  }
}
