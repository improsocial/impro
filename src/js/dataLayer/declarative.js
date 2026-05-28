export class Declarative {
  constructor(derived, requests) {
    this.derived = derived;
    this.requests = requests;
  }
  async ensureCurrentUser() {
    let currentUser = this.derived.$currentUser.get();
    if (!currentUser) {
      await this.requests.loadCurrentUser();
      currentUser = this.derived.$currentUser.get();
    }
    if (!currentUser) {
      throw new Error("Current user not found");
    }
    return currentUser;
  }

  async ensureProfile(profileDid) {
    const getProfile = (did) => this.derived.$hydratedProfiles.get(did).get();
    let profile = getProfile(profileDid);
    if (!profile) {
      await this.requests.loadProfile(profileDid);
      profile = getProfile(profileDid);
    }
    if (!profile) {
      throw new Error("Profile not found");
    }
    return profile;
  }

  async ensureProfiles(profileDids) {
    const getProfile = (did) => this.derived.$hydratedProfiles.get(did).get();
    const missing = profileDids.filter((did) => !getProfile(did));
    if (missing.length > 0) {
      await this.requests.loadProfiles(missing);
    }
    return profileDids.map((did) => getProfile(did) ?? null);
  }

  async ensurePostThread(postURI, { labelers = [] } = {}) {
    let postThread = this.derived.$hydratedPostThreads.get(postURI).get();
    if (!postThread) {
      await this.requests.loadPostThread(postURI, { labelers });
      postThread = this.derived.$hydratedPostThreads.get(postURI).get();
    }
    if (!postThread) {
      throw new Error("Post thread not found");
    }
    return postThread;
  }

  async ensurePost(postURI) {
    let post = this.derived.$hydratedPosts.get(postURI).get();
    if (!post) {
      await this.requests.loadPost(postURI);
      post = this.derived.$hydratedPosts.get(postURI).get();
    }
    if (!post) {
      throw new Error("Post not found");
    }
    return post;
  }

  async ensurePosts(postURIs) {
    const getPost = (uri) => this.derived.$hydratedPosts.get(uri).get();
    const missing = postURIs.filter((uri) => !getPost(uri));
    if (missing.length > 0) {
      await this.requests.loadPosts(missing);
    }
    return postURIs.map((uri) => getPost(uri));
  }

  async ensureFeedGenerator(feedUri) {
    let feedGenerator = this.derived.$feedGenerators.get(feedUri).get();
    if (!feedGenerator) {
      await this.requests.loadFeedGenerator(feedUri);
      feedGenerator = this.derived.$feedGenerators.get(feedUri).get();
    }
    if (!feedGenerator) {
      throw new Error("Feed generator not found");
    }
    return feedGenerator;
  }

  async ensurePinnedFeedGenerators() {
    let pinnedFeedGenerators = this.derived.$hydratedPinnedFeedGenerators.get();
    if (!pinnedFeedGenerators) {
      await this.requests.loadPinnedFeedGenerators();
      pinnedFeedGenerators = this.derived.$hydratedPinnedFeedGenerators.get();
    }
    if (!pinnedFeedGenerators) {
      throw new Error("Pinned feed generators not found");
    }
    return pinnedFeedGenerators;
  }

  async ensureConvoList() {
    let convoList = this.derived.$convoList.get();
    if (!convoList) {
      await this.requests.loadConvoList();
      convoList = this.derived.$convoList.get();
    }
    if (!convoList) {
      throw new Error("Conversation list not found");
    }
    return convoList;
  }

  async ensureConvo(convoId) {
    let convo = this.derived.$convos.get(convoId).get();
    if (!convo) {
      await this.requests.loadConvo(convoId);
      convo = this.derived.$convos.get(convoId).get();
    }
    if (!convo) {
      throw new Error("Conversation not found");
    }
    return convo;
  }

  async ensureConvoForProfile(profileDid) {
    let convo = this.derived.$convoForProfile.get(profileDid).get();
    if (!convo) {
      await this.requests.loadConvoForProfile(profileDid);
      convo = this.derived.$convoForProfile.get(profileDid).get();
    }
    if (!convo) {
      throw new Error("Conversation not found");
    }
    return convo;
  }
}
