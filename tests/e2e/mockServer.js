import { createPost } from "./factories.js";
import { bskyLabeler, userProfile } from "./fixtures.js";

export class MockServer {
  constructor() {
    this.authorFeeds = new Map();
    this.bookmarks = [];
    this.convos = [];
    this.convoMessages = new Map();
    this.createRecordCounter = 0;
    this.messageCounter = 0;
    this.feedGenerators = [];
    this.feeds = new Map();
    this.labelerViews = [bskyLabeler];
    this.notifications = [];
    this.notificationCursor = undefined;
    this.pinnedFeedUris = [];
    this.posts = [];
    this.postLikes = new Map();
    this.reportPayloads = [];
    this.postQuotes = new Map();
    this.postReposts = new Map();
    this.postThreads = new Map();
    this.profileFollowers = new Map();
    this.profileFollows = new Map();
    this.profiles = new Map();
    this.savedFeedUris = [];
    this.searchPosts = [];
    this.searchProfiles = [];
    this.timelinePosts = [];
  }

  addAuthorFeedPosts(did, filter, posts) {
    this.authorFeeds.set(`${did}-${filter}`, posts);
  }

  addBookmarks(bookmarks) {
    this.bookmarks.push(...bookmarks);
  }

  addFeedGenerators(feedGenerators) {
    this.feedGenerators.push(...feedGenerators);
  }

  addLabelerViews(views) {
    this.labelerViews.push(...views);
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

  addSearchProfiles(profiles) {
    this.searchProfiles.push(...profiles);
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

  addProfileFollowers(did, followers) {
    this.profileFollowers.set(did, followers);
  }

  addProfileFollows(did, follows) {
    this.profileFollows.set(did, follows);
  }

  addProfile(profile) {
    this.profiles.set(profile.did, profile);
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
    await page.route("**/.well-known/atproto-did*", (route) =>
      route.fulfill({ status: 404, body: "Not Found" }),
    );

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
        body: JSON.stringify({ views: this.labelerViews }),
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

    await page.route("**/xrpc/chat.bsky.convo.addReaction*", (route) => {
      const body = route.request().postDataJSON();
      const { convoId, messageId, value } = body || {};
      const messages = this.convoMessages.get(convoId) || [];
      const message = messages.find((m) => m.id === messageId);
      if (message) {
        message.reactions.push({
          createdAt: new Date().toISOString(),
          sender: { did: userProfile.did },
          value,
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ message: message || {} }),
      });
    });

    await page.route("**/xrpc/chat.bsky.convo.removeReaction*", (route) => {
      const body = route.request().postDataJSON();
      const { convoId, messageId, value } = body || {};
      const messages = this.convoMessages.get(convoId) || [];
      const message = messages.find((m) => m.id === messageId);
      if (message) {
        message.reactions = message.reactions.filter(
          (r) => !(r.value === value && r.sender.did === userProfile.did),
        );
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ message: message || {} }),
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

    await page.route(
      "**/xrpc/chat.bsky.convo.getConvoAvailability*",
      (route) => {
        const url = new URL(route.request().url());
        const members = url.searchParams.getAll("members");
        const otherDid = members.find((m) => m !== userProfile.did);
        const profile = this.profiles.get(otherDid);
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ canChat: profile?.canChat ?? false }),
        });
      },
    );

    await page.route("**/xrpc/app.bsky.graph.muteActor*", (route) => {
      const body = route.request().postDataJSON();
      const actor = body?.actor;
      const profile = this.profiles.get(actor);
      if (profile) {
        profile.viewer = { ...profile.viewer, muted: true };
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "{}",
      });
    });

    await page.route("**/xrpc/app.bsky.graph.unmuteActor*", (route) => {
      const body = route.request().postDataJSON();
      const actor = body?.actor;
      const profile = this.profiles.get(actor);
      if (profile) {
        profile.viewer = { ...profile.viewer, muted: false };
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "{}",
      });
    });

    await page.route("**/xrpc/app.bsky.feed.getActorLikes*", (route) => {
      const url = new URL(route.request().url());
      const actor = url.searchParams.get("actor");
      const posts = this.authorFeeds.get(`${actor}-likes`) || [];
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          feed: posts.map((post) => ({ post })),
          cursor: "",
        }),
      });
    });

    await page.route("**/xrpc/app.bsky.feed.getAuthorFeed*", (route) => {
      const url = new URL(route.request().url());
      const actor = url.searchParams.get("actor");
      const filter = url.searchParams.get("filter") || "";
      const posts = this.authorFeeds.get(`${actor}-${filter}`) || [];
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          feed: posts.map((post) => ({ post })),
          cursor: "",
        }),
      });
    });

    await page.route("**/xrpc/app.bsky.actor.getProfile*", (route) => {
      const url = new URL(route.request().url());
      const actor = url.searchParams.get("actor");
      const profile = this.profiles.get(actor) || userProfile;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(profile),
      });
    });

    await page.route("**/xrpc/app.bsky.bookmark.getBookmarks*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          bookmarks: this.bookmarks.map((post) => ({ item: post })),
        }),
      }),
    );

    await page.route("**/xrpc/app.bsky.bookmark.createBookmark*", (route) => {
      const body = route.request().postDataJSON();
      const postUri = body?.uri;
      const allPosts = [
        ...this.timelinePosts,
        ...this.bookmarks,
        ...this.searchPosts,
        ...this.posts,
      ];
      const post = allPosts.find((p) => p.uri === postUri);
      if (post) {
        post.viewer.bookmarked = true;
        if (!this.bookmarks.includes(post)) {
          this.bookmarks.push(post);
        }
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "{}",
      });
    });

    await page.route("**/xrpc/app.bsky.bookmark.deleteBookmark*", (route) => {
      const body = route.request().postDataJSON();
      const postUri = body?.uri;
      const idx = this.bookmarks.findIndex((p) => p.uri === postUri);
      if (idx !== -1) {
        this.bookmarks[idx].viewer.bookmarked = false;
        this.bookmarks.splice(idx, 1);
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "{}",
      });
    });

    await page.route("**/xrpc/app.bsky.actor.searchActors*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          actors: this.searchProfiles,
          cursor: "",
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

    await page.route("**/xrpc/app.bsky.feed.getTimeline*", (route) => {
      const url = new URL(route.request().url());
      const cursor = url.searchParams.get("cursor") || "";
      const limit = parseInt(url.searchParams.get("limit") || "0", 10);
      const offset = cursor ? parseInt(cursor, 10) : 0;

      const blockedDids = new Set();
      for (const [did, profile] of this.profiles) {
        if (profile.viewer?.blocking || profile.viewer?.muted) {
          blockedDids.add(did);
        }
      }
      const allPosts = this.timelinePosts.filter(
        (post) => !blockedDids.has(post.author?.did),
      );

      let posts, nextCursor;
      if (limit) {
        posts = allPosts.slice(offset, offset + limit);
        nextCursor =
          offset + limit < allPosts.length ? String(offset + limit) : "";
      } else {
        posts = allPosts;
        nextCursor = "";
      }

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          feed: posts.map((post) => ({ post })),
          cursor: nextCursor,
        }),
      });
    });

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

    await page.route("**/xrpc/app.bsky.graph.getFollowers*", (route) => {
      const url = new URL(route.request().url());
      const actor = url.searchParams.get("actor");
      const followers = this.profileFollowers.get(actor) || [];
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ followers, cursor: "" }),
      });
    });

    await page.route("**/xrpc/app.bsky.graph.getFollows*", (route) => {
      const url = new URL(route.request().url());
      const actor = url.searchParams.get("actor");
      const follows = this.profileFollows.get(actor) || [];
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ follows, cursor: "" }),
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
      const profileEntry = [...this.profiles.values()].find(
        (p) => p.handle === handle,
      );
      const did =
        postAuthor?.did || generator?.creator?.did || profileEntry?.did;
      if (!did) {
        return route.fulfill({
          status: 404,
          body: JSON.stringify({ error: "NotFound" }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ did }),
      });
    });

    await page.route("**/xrpc/com.atproto.repo.deleteRecord*", (route) => {
      const body = route.request().postDataJSON();
      const collection = body?.collection;
      const rkey = body?.rkey;

      if (collection === "app.bsky.feed.like") {
        const feedKey = `${userProfile.did}-likes`;
        const likes = this.authorFeeds.get(feedKey) || [];
        this.authorFeeds.set(
          feedKey,
          likes.filter((p) => p.viewer?.like?.split("/").pop() !== rkey),
        );
      }

      if (collection === "app.bsky.feed.repost") {
        const allPosts = [
          ...this.timelinePosts,
          ...this.bookmarks,
          ...this.searchPosts,
          ...this.posts,
        ];
        for (const post of allPosts) {
          if (
            post.viewer?.repost &&
            post.viewer.repost.split("/").pop() === rkey
          ) {
            delete post.viewer.repost;
            post.repostCount = Math.max(0, (post.repostCount || 0) - 1);
            const feedKey = `${userProfile.did}-posts_and_author_threads`;
            const existing = this.authorFeeds.get(feedKey) || [];
            this.authorFeeds.set(
              feedKey,
              existing.filter((p) => p !== post),
            );
            break;
          }
        }
      }

      if (collection === "app.bsky.graph.follow") {
        for (const [did, profile] of this.profiles) {
          if (
            profile.viewer?.following &&
            profile.viewer.following.split("/").pop() === rkey
          ) {
            profile.viewer = { ...profile.viewer, following: undefined };
            if (
              profile.followersCount !== undefined &&
              profile.followersCount > 0
            ) {
              profile.followersCount--;
            }
            const follows = this.profileFollows.get(userProfile.did) || [];
            this.profileFollows.set(
              userProfile.did,
              follows.filter((p) => p.did !== did),
            );
            break;
          }
        }
      }

      if (collection === "app.bsky.graph.block") {
        for (const [, profile] of this.profiles) {
          if (
            profile.viewer?.blocking &&
            profile.viewer.blocking.split("/").pop() === rkey
          ) {
            profile.viewer = { ...profile.viewer, blocking: undefined };
            break;
          }
        }
      }

      if (collection === "app.bsky.feed.post") {
        const postUri = `at://${userProfile.did}/${collection}/${rkey}`;
        this.timelinePosts = this.timelinePosts.filter(
          (p) => p.uri !== postUri,
        );
        this.posts = this.posts.filter((p) => p.uri !== postUri);
        for (const [key, posts] of this.authorFeeds) {
          this.authorFeeds.set(
            key,
            posts.filter((p) => p.uri !== postUri),
          );
        }
      }

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "{}",
      });
    });

    await page.route("**/xrpc/com.atproto.repo.createRecord*", (route) => {
      const body = route.request().postDataJSON();
      const collection = body?.collection;
      const rkey = `rkey-${++this.createRecordCounter}`;
      const uri = `at://${userProfile.did}/${collection}/${rkey}`;
      const cid = `bafyrei${rkey}`;

      if (collection === "app.bsky.feed.post") {
        const record = body?.record;
        let embed;
        let quotedPostUri;

        if (record?.embed?.$type === "app.bsky.embed.record") {
          quotedPostUri = record.embed.record.uri;
          const allQuotePosts = [
            ...this.timelinePosts,
            ...this.bookmarks,
            ...this.searchPosts,
            ...this.posts,
          ];
          const quotedPost = allQuotePosts.find((p) => p.uri === quotedPostUri);
          if (quotedPost) {
            embed = {
              $type: "app.bsky.embed.record#view",
              record: {
                $type: "app.bsky.embed.record#viewRecord",
                uri: quotedPost.uri,
                cid: quotedPost.cid,
                author: quotedPost.author,
                value: quotedPost.record,
                indexedAt: quotedPost.indexedAt,
                labels: [],
                embeds: [],
              },
            };
            quotedPost.quoteCount = (quotedPost.quoteCount || 0) + 1;
          }
        }

        const post = createPost({
          uri,
          text: record?.text || "",
          authorHandle: userProfile.handle,
          authorDisplayName: userProfile.displayName,
          embed,
        });
        this.posts.push(post);

        if (quotedPostUri) {
          const existingQuotes = this.postQuotes.get(quotedPostUri) || [];
          existingQuotes.push(post);
          this.postQuotes.set(quotedPostUri, existingQuotes);
        }

        const isReply = !!record?.reply;

        if (isReply) {
          const parentUri = record.reply.parent.uri;
          const allReplyPosts = [
            ...this.timelinePosts,
            ...this.bookmarks,
            ...this.searchPosts,
            ...this.posts,
          ];
          const parentPost = allReplyPosts.find((p) => p.uri === parentUri);
          if (parentPost) {
            parentPost.replyCount = (parentPost.replyCount || 0) + 1;
          }
          const thread = this.postThreads.get(parentUri);
          if (thread) {
            thread.replies = thread.replies || [];
            thread.replies.push({
              $type: "app.bsky.feed.defs#threadViewPost",
              post,
              replies: [],
            });
          }
        }

        const feedKey = `${userProfile.did}-posts_and_author_threads`;
        const existing = this.authorFeeds.get(feedKey) || [];
        this.authorFeeds.set(feedKey, [post, ...existing]);
        if (!isReply) {
          const noRepliesKey = `${userProfile.did}-posts_no_replies`;
          const existingNoReplies = this.authorFeeds.get(noRepliesKey) || [];
          this.authorFeeds.set(noRepliesKey, [post, ...existingNoReplies]);
        }
      }

      if (collection === "app.bsky.feed.like") {
        const subjectUri = body?.record?.subject?.uri;
        const allPosts = [
          ...this.timelinePosts,
          ...this.bookmarks,
          ...this.searchPosts,
          ...this.posts,
        ];
        const post = allPosts.find((p) => p.uri === subjectUri);
        if (post) {
          post.viewer.like = uri;
          const feedKey = `${userProfile.did}-likes`;
          const existing = this.authorFeeds.get(feedKey) || [];
          this.authorFeeds.set(feedKey, [...existing, post]);
        }
      }

      if (collection === "app.bsky.feed.repost") {
        const subjectUri = body?.record?.subject?.uri;
        const allPosts = [
          ...this.timelinePosts,
          ...this.bookmarks,
          ...this.searchPosts,
          ...this.posts,
        ];
        const post = allPosts.find((p) => p.uri === subjectUri);
        if (post) {
          post.viewer.repost = uri;
          post.repostCount = (post.repostCount || 0) + 1;
          const feedKey = `${userProfile.did}-posts_and_author_threads`;
          const existing = this.authorFeeds.get(feedKey) || [];
          this.authorFeeds.set(feedKey, [post, ...existing]);
        }
      }

      if (collection === "app.bsky.graph.follow") {
        const subjectDid = body?.record?.subject;
        const profile = this.profiles.get(subjectDid);
        if (profile) {
          profile.viewer = { ...profile.viewer, following: uri };
          if (profile.followersCount !== undefined) {
            profile.followersCount++;
          }
          const follows = this.profileFollows.get(userProfile.did) || [];
          if (!follows.find((p) => p.did === subjectDid)) {
            follows.push(profile);
            this.profileFollows.set(userProfile.did, follows);
          }
        }
      }

      if (collection === "app.bsky.graph.block") {
        const subjectDid = body?.record?.subject;
        const profile = this.profiles.get(subjectDid);
        if (profile) {
          profile.viewer = { ...profile.viewer, blocking: uri };
        }
      }

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ uri, cid }),
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

    await page.route(
      "**/xrpc/com.atproto.moderation.createReport*",
      (route) => {
        const body = route.request().postDataJSON();
        this.reportPayloads.push(body);
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: this.reportPayloads.length,
            reasonType: body?.reasonType,
            subject: body?.subject,
            reportedBy: userProfile.did,
            createdAt: new Date().toISOString(),
          }),
        });
      },
    );
  }
}
