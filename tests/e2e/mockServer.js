import { userProfile } from "./fixtures.js";

export class MockServer {
  constructor() {
    this.bookmarks = [];
    this.convos = [];
    this.convoMessages = new Map();
    this.messageCounter = 0;
    this.feedGenerators = [];
    this.feeds = new Map();
    this.notifications = [];
    this.notificationCursor = undefined;
    this.pinnedFeedUris = [];
    this.posts = [];
    this.postLikes = new Map();
    this.postQuotes = new Map();
    this.postReposts = new Map();
    this.postThreads = new Map();
    this.savedFeedUris = [];
    this.searchPosts = [];
    this.timelinePosts = [];
  }

  addBookmarks(bookmarks) {
    this.bookmarks.push(...bookmarks);
  }

  addFeedGenerators(feedGenerators) {
    this.feedGenerators.push(...feedGenerators);
  }

  addFeedItems(feedUri, posts) {
    this.feeds.set(
      feedUri,
      posts.map((post) => ({ post })),
    );
  }

  setPinnedFeeds(feedUris) {
    this.pinnedFeedUris = feedUris;
  }

  setSavedFeeds(feedUris) {
    this.savedFeedUris = feedUris;
  }

  addTimelinePosts(posts) {
    this.timelinePosts.push(...posts);
  }

  addSearchPosts(posts) {
    this.searchPosts.push(...posts);
  }

  addNotifications(notifications, { cursor } = {}) {
    this.notifications.push(...notifications);
    this.notificationCursor = cursor;
  }

  addPosts(posts) {
    this.posts.push(...posts);
  }

  addPostLikes(postUri, likes) {
    this.postLikes.set(postUri, likes);
  }

  addPostQuotes(postUri, quotes) {
    this.postQuotes.set(postUri, quotes);
  }

  addPostReposts(postUri, reposts) {
    this.postReposts.set(postUri, reposts);
  }

  setPostThread(postUri, thread) {
    this.postThreads.set(postUri, thread);
  }

  addConvos(convos) {
    for (const convo of convos) {
      if (!this.convoMessages.has(convo.id)) {
        this.convoMessages.set(convo.id, []);
      }
    }
    this.convos.push(...convos);
  }

  addConvoMessages(convoId, messages) {
    this.convoMessages.set(convoId, messages);
  }

  async setup(page) {
    await page.route("**/xrpc/blue.microcosm.links.getBacklinks*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ records: [], cursor: "" }),
      }),
    );

    await page.route("**/xrpc/com.atproto.server.getSession*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          did: userProfile.did,
          handle: userProfile.handle,
        }),
      }),
    );

    await page.route("**/xrpc/app.bsky.actor.getPreferences*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          preferences: [
            {
              $type: "app.bsky.actor.defs#savedFeedsPrefV2",
              items: [
                {
                  type: "timeline",
                  value: "following",
                  pinned: true,
                  id: "timeline-following",
                },
                ...this.pinnedFeedUris.map((uri) => ({
                  type: "feed",
                  value: uri,
                  pinned: true,
                  id: uri,
                })),
                ...this.savedFeedUris.map((uri) => ({
                  type: "feed",
                  value: uri,
                  pinned: false,
                  id: uri,
                })),
              ],
            },
          ],
        }),
      }),
    );

    await page.route("**/xrpc/app.bsky.labeler.getServices*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ views: [] }),
      }),
    );

    await page.route("**/xrpc/app.bsky.notification.getUnreadCount*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ count: 0 }),
      }),
    );

    await page.route(
      "**/xrpc/app.bsky.notification.listNotifications*",
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            notifications: this.notifications,
            cursor: this.notificationCursor,
          }),
        }),
    );

    await page.route("**/xrpc/app.bsky.notification.updateSeen*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "{}",
      }),
    );

    await page.route("**/xrpc/app.bsky.feed.getPosts*", (route) => {
      const url = new URL(route.request().url());
      const uris = url.searchParams.getAll("uris");
      const posts = uris
        .map((uri) => this.posts.find((p) => p.uri === uri))
        .filter(Boolean);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ posts }),
      });
    });

    await page.route("**/xrpc/chat.bsky.convo.listConvos*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ convos: this.convos }),
      }),
    );

    await page.route("**/xrpc/chat.bsky.convo.getConvo*", (route) => {
      const url = new URL(route.request().url());
      const convoId = url.searchParams.get("convoId");
      const convo = this.convos.find((c) => c.id === convoId);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ convo: convo || {} }),
      });
    });

    await page.route("**/xrpc/chat.bsky.convo.getMessages*", (route) => {
      const url = new URL(route.request().url());
      const convoId = url.searchParams.get("convoId");
      const messages = this.convoMessages.get(convoId) || [];
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ messages }),
      });
    });

    await page.route("**/xrpc/chat.bsky.convo.sendMessage*", (route) => {
      const body = route.request().postDataJSON();
      const msgId = ++this.messageCounter;
      const sentMessage = {
        id: `msg-sent-${msgId}`,
        rev: `rev-sent-${msgId}`,
        text: body?.message?.text || "",
        sender: { did: userProfile.did },
        sentAt: new Date().toISOString(),
      };
      const convo = this.convos.find((c) => c.id === body?.convoId);
      if (convo) {
        convo.lastMessage = {
          $type: "chat.bsky.convo.defs#messageView",
          ...sentMessage,
        };
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(sentMessage),
      });
    });

    await page.route("**/xrpc/chat.bsky.convo.updateRead*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "{}",
      }),
    );

    await page.route("**/xrpc/chat.bsky.convo.getLog*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ logs: [], cursor: "" }),
      }),
    );

    await page.route("**/xrpc/chat.bsky.convo.acceptConvo*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ rev: "rev-accepted" }),
      }),
    );

    await page.route("**/xrpc/chat.bsky.convo.leaveConvo*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ rev: "rev-left" }),
      }),
    );

    await page.route("**/xrpc/app.bsky.actor.getProfile*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(userProfile),
      }),
    );

    await page.route("**/xrpc/app.bsky.bookmark.getBookmarks*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          bookmarks: this.bookmarks.map((post) => ({ item: post })),
        }),
      }),
    );

    await page.route("**/xrpc/app.bsky.feed.searchPosts*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          posts: this.searchPosts,
          cursor: "",
        }),
      }),
    );

    await page.route("**/xrpc/app.bsky.feed.getTimeline*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          feed: this.timelinePosts.map((post) => ({ post })),
          cursor: "",
        }),
      }),
    );

    // Order matters: Playwright checks routes in LIFO order, so register
    // the most general pattern first (checked last) and most specific last.
    await page.route("**/xrpc/app.bsky.feed.getFeed*", (route) => {
      const url = new URL(route.request().url());
      const feedUri = url.searchParams.get("feed");
      const feed = this.feeds.get(feedUri) || [];
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ feed, cursor: "" }),
      });
    });

    await page.route("**/xrpc/app.bsky.feed.getFeedGenerator*", (route) => {
      const url = new URL(route.request().url());
      const feedUri = url.searchParams.get("feed");
      const generator = this.feedGenerators.find((g) => g.uri === feedUri);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ view: generator || {} }),
      });
    });

    await page.route("**/xrpc/app.bsky.feed.getFeedGenerators*", (route) => {
      const url = new URL(route.request().url());
      const feedUris = url.searchParams.getAll("feeds");
      const feeds = feedUris.map(
        (uri) => this.feedGenerators.find((g) => g.uri === uri) || {},
      );
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ feeds }),
      });
    });

    await page.route("**/xrpc/app.bsky.feed.getLikes*", (route) => {
      const url = new URL(route.request().url());
      const uri = url.searchParams.get("uri");
      const likes = this.postLikes.get(uri) || [];
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ likes, cursor: "" }),
      });
    });

    await page.route("**/xrpc/app.bsky.feed.getQuotes*", (route) => {
      const url = new URL(route.request().url());
      const uri = url.searchParams.get("uri");
      const posts = this.postQuotes.get(uri) || [];
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ posts, cursor: "" }),
      });
    });

    await page.route("**/xrpc/app.bsky.feed.getRepostedBy*", (route) => {
      const url = new URL(route.request().url());
      const uri = url.searchParams.get("uri");
      const repostedBy = this.postReposts.get(uri) || [];
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ repostedBy, cursor: "" }),
      });
    });

    await page.route("**/xrpc/app.bsky.feed.getPostThread*", (route) => {
      const url = new URL(route.request().url());
      const uri = url.searchParams.get("uri");
      const customThread = this.postThreads.get(uri);
      if (customThread) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ thread: customThread }),
        });
      }
      const allPosts = [
        ...this.timelinePosts,
        ...this.bookmarks,
        ...this.searchPosts,
        ...this.posts,
      ];
      const post = allPosts.find((p) => p.uri === uri);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          thread: {
            $type: "app.bsky.feed.defs#threadViewPost",
            post: post || {},
            replies: [],
          },
        }),
      });
    });

    await page.route("**/xrpc/com.atproto.identity.resolveHandle*", (route) => {
      const url = new URL(route.request().url());
      const handle = url.searchParams.get("handle");
      const allPosts = [
        ...this.timelinePosts,
        ...this.bookmarks,
        ...this.searchPosts,
        ...this.posts,
      ];
      const postAuthor = allPosts.find(
        (p) => p.author?.handle === handle,
      )?.author;
      const generator = this.feedGenerators.find(
        (g) => g.creator.handle === handle,
      );
      const did = postAuthor?.did || generator?.creator?.did || "";
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ did }),
      });
    });

    await page.route("**/xrpc/app.bsky.actor.putPreferences*", (route) => {
      const body = route.request().postDataJSON();
      const savedFeedsPref = body?.preferences?.find(
        (p) => p.$type === "app.bsky.actor.defs#savedFeedsPrefV2",
      );
      if (savedFeedsPref) {
        this.pinnedFeedUris = savedFeedsPref.items
          .filter((item) => item.type === "feed" && item.pinned)
          .map((item) => item.value);
        this.savedFeedUris = savedFeedsPref.items
          .filter((item) => item.type === "feed" && !item.pinned)
          .map((item) => item.value);
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "{}",
      });
    });
  }
}
