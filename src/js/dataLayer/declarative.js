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
    const getProfile = (did) => this.derived.$hydratedProfiles.get(did);
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
    const getProfile = (did) => this.derived.$hydratedProfiles.get(did);
    const missing = profileDids.filter((did) => !getProfile(did));
    if (missing.length > 0) {
      await this.requests.loadProfiles(missing);
    }
    return profileDids.map((did) => getProfile(did) ?? null);
  }

  async ensurePostThread(postURI, { labelers = [] } = {}) {
    let postThread = this.derived.$hydratedPostThreads.get(postURI);
    if (!postThread) {
      await this.requests.loadPostThread(postURI, { labelers });
      postThread = this.derived.$hydratedPostThreads.get(postURI);
    }
    if (!postThread) {
      throw new Error("Post thread not found");
    }
    return postThread;
  }

  async ensurePost(postURI) {
    let post = this.derived.$hydratedPosts.get(postURI);
    if (!post) {
      await this.requests.loadPost(postURI);
      post = this.derived.$hydratedPosts.get(postURI);
    }
    if (!post) {
      throw new Error("Post not found");
    }
    return post;
  }

  async ensurePosts(postURIs) {
    const getPost = (uri) => this.derived.$hydratedPosts.get(uri);
    const missing = postURIs.filter((uri) => !getPost(uri));
    if (missing.length > 0) {
      await this.requests.loadPosts(missing);
    }
    return postURIs.map((uri) => getPost(uri));
  }

  async ensureFeedGenerator(feedUri) {
    let feedGenerator = this.derived.$feedGenerators.get(feedUri);
    if (!feedGenerator) {
      await this.requests.loadFeedGenerator(feedUri);
      feedGenerator = this.derived.$feedGenerators.get(feedUri);
    }
    if (!feedGenerator) {
      throw new Error("Feed generator not found");
    }
    return feedGenerator;
  }

  async ensurePinnedItems() {
    let pinnedItems = this.derived.$hydratedPinnedItems.get();
    if (!pinnedItems) {
      await this.requests.loadPinnedItems();
      pinnedItems = this.derived.$hydratedPinnedItems.get();
    }
    if (!pinnedItems) {
      throw new Error("Pinned items not found");
    }
    return pinnedItems;
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
    let convo = this.derived.$convos.get(convoId);
    if (!convo) {
      await this.requests.loadConvo(convoId);
      convo = this.derived.$convos.get(convoId);
    }
    if (!convo) {
      throw new Error("Conversation not found");
    }
    return convo;
  }

  async ensureConvoForProfile(profileDid) {
    let convo = this.derived.$convoForProfile.get(profileDid);
    if (!convo) {
      await this.requests.loadConvoForProfile(profileDid);
      convo = this.derived.$convoForProfile.get(profileDid);
    }
    if (!convo) {
      throw new Error("Conversation not found");
    }
    return convo;
  }
}
