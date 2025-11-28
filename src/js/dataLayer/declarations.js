export class Declarations {
  constructor(selectors, requests) {
    this.selectors = selectors;
    this.requests = requests;
  }
  async ensureCurrentUser() {
    let currentUser = this.selectors.getCurrentUser();
    if (!currentUser) {
      await this.requests.loadCurrentUser();
      currentUser = this.selectors.getCurrentUser();
    }
    if (!currentUser) {
      throw new Error("Current user not found");
    }
    return currentUser;
  }

  async ensurePreferences() {
    let preferences = this.selectors.getPreferences();
    if (!preferences) {
      await this.requests.loadPreferences();
      preferences = this.selectors.getPreferences();
    }
    if (!preferences) {
      throw new Error("Preferences not found");
    }
    return preferences;
  }

  async ensureProfile(profileDid) {
    let profile = this.selectors.getProfile(profileDid);
    if (!profile) {
      await this.requests.loadProfile(profileDid);
      profile = this.selectors.getProfile(profileDid);
    }
    if (!profile) {
      throw new Error("Profile not found");
    }
    return profile;
  }

  async ensurePostThread(postURI, { labelers = [] } = {}) {
    let postThread = this.selectors.getPostThread(postURI);
    if (!postThread) {
      await this.requests.loadPostThread(postURI, { labelers });
      postThread = this.selectors.getPostThread(postURI);
    }
    if (!postThread) {
      throw new Error("Post thread not found");
    }
    return postThread;
  }

  async ensurePost(postURI) {
    let post = this.selectors.getPost(postURI);
    if (!post) {
      await this.requests.loadPost(postURI);
      post = this.selectors.getPost(postURI);
    }
    if (!post) {
      throw new Error("Post not found");
    }
    return post;
  }

  async ensureFeedGenerator(feedUri) {
    let feedGenerator = this.selectors.getFeedGenerator(feedUri);
    if (!feedGenerator) {
      await this.requests.loadFeedGenerator(feedUri);
      feedGenerator = this.selectors.getFeedGenerator(feedUri);
    }
    if (!feedGenerator) {
      throw new Error("Feed generator not found");
    }
    return feedGenerator;
  }

  async ensurePinnedFeedGenerators() {
    let pinnedFeedGenerators = this.selectors.getPinnedFeedGenerators();
    if (!pinnedFeedGenerators) {
      await this.requests.loadPinnedFeedGenerators();
      pinnedFeedGenerators = this.selectors.getPinnedFeedGenerators();
    }
    if (!pinnedFeedGenerators) {
      throw new Error("Pinned feed generators not found");
    }
    return pinnedFeedGenerators;
  }

  async ensureConvoList() {
    let convoList = this.selectors.getConvoList();
    if (!convoList) {
      await this.requests.loadConvoList();
      convoList = this.selectors.getConvoList();
    }
    if (!convoList) {
      throw new Error("Conversation list not found");
    }
    return convoList;
  }

  async ensureConvo(convoId) {
    let convo = this.selectors.getConvo(convoId);
    if (!convo) {
      await this.requests.loadConvo(convoId);
      convo = this.selectors.getConvo(convoId);
    }
    if (!convo) {
      throw new Error("Conversation not found");
    }
    return convo;
  }

  async ensureConvoForProfile(profileDid) {
    let convo = this.selectors.getConvoForProfile(profileDid);
    if (!convo) {
      await this.requests.loadConvoForProfile(profileDid);
      convo = this.selectors.getConvoForProfile(profileDid);
    }
    if (!convo) {
      throw new Error("Conversation not found");
    }
    return convo;
  }
}
