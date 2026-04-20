import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer, MockConstellation } from "../../mockServer.js";
import { createPost } from "../../factories.js";

const postUri = "at://did:plc:author1/app.bsky.feed.post/abc123";
const AUTHOR_A = {
  did: "did:plc:authorA",
  handle: "authorA.bsky.social",
  name: "Author A",
};
const AUTHOR_B = {
  did: "did:plc:authorB",
  handle: "authorB.bsky.social",
  name: "Author B",
};
const AUTHOR_C = {
  did: "did:plc:authorC",
  handle: "authorC.bsky.social",
  name: "Author C",
};

test.describe("Blocked posts in post thread", () => {
  test.describe("Blocked parents", () => {
    test("should show blocked state when the thread root is blocked", async ({
      page,
    }) => {
      const blockedRoot = {
        $type: "app.bsky.feed.defs#blockedPost",
        uri: "at://did:plc:blockedroot/app.bsky.feed.post/root1",
        blocked: true,
        author: {
          did: "did:plc:blockedroot",
          viewer: { blocking: true },
        },
      };

      const childPost = createPost({
        uri: postUri,
        text: "Reply to blocked root",
        authorHandle: "author1.bsky.social",
        authorDisplayName: "Author One",
        reply: {
          parent: {
            uri: "at://did:plc:blockedroot/app.bsky.feed.post/root1",
            cid: "bafyreitestroot1",
          },
          root: {
            uri: "at://did:plc:blockedroot/app.bsky.feed.post/root1",
            cid: "bafyreitestroot1",
          },
        },
      });

      const mockServer = new MockServer();
      mockServer.addPosts([childPost]);
      mockServer.setPostThread(postUri, {
        $type: "app.bsky.feed.defs#threadViewPost",
        post: childPost,
        parent: {
          $type: "app.bsky.feed.defs#threadViewPost",
          post: blockedRoot,
          parent: null,
          replies: [],
        },
        replies: [],
      });
      await mockServer.setup(page);

      await login(page);
      await page.goto("/profile/author1.bsky.social/post/abc123");

      const view = page.locator("#post-detail-view");
      await expect(view.locator('[data-testid="large-post"]')).toBeVisible({
        timeout: 10000,
      });
      await expect(view.locator(".missing-post-indicator")).toContainText(
        "Blocked",
      );
    });

    test.describe("when the current user is blocked by a parent author", () => {
      test("should show blocked parent as unavailable with nested parents above", async ({
        page,
      }) => {
        const grandparentPost = createPost({
          uri: "at://did:plc:grandparent/app.bsky.feed.post/gp1",
          text: "Grandparent post",
          authorHandle: "grandparent.bsky.social",
          authorDisplayName: "Grandparent User",
        });

        const childPost = createPost({
          uri: postUri,
          text: "Reply to someone who blocked me",
          authorHandle: "author1.bsky.social",
          authorDisplayName: "Author One",
          reply: {
            parent: {
              uri: "at://did:plc:blockedparent/app.bsky.feed.post/bp1",
              cid: "bafyreitestbp1",
            },
            root: {
              uri: grandparentPost.uri,
              cid: grandparentPost.cid,
            },
          },
        });

        const blockedParentUri =
          "at://did:plc:blockedparent/app.bsky.feed.post/bp1";

        const mockServer = new MockServer();
        mockServer.addPosts([childPost, grandparentPost]);
        mockServer.setPostThread(postUri, {
          $type: "app.bsky.feed.defs#threadViewPost",
          post: childPost,
          parent: {
            $type: "app.bsky.feed.defs#blockedPost",
            uri: blockedParentUri,
            blocked: true,
            author: {
              did: "did:plc:blockedparent",
              viewer: { blockedBy: true },
            },
          },
          replies: [],
        });
        // The app tries to load the parent chain, but the second call
        // also returns blocked since the parent author blocked the viewer
        mockServer.setPostThread(blockedParentUri, {
          $type: "app.bsky.feed.defs#threadViewPost",
          post: {
            $type: "app.bsky.feed.defs#blockedPost",
            uri: blockedParentUri,
            blocked: true,
            author: {
              did: "did:plc:blockedparent",
              viewer: { blockedBy: true },
            },
          },
          replies: [],
        });
        await mockServer.setup(page);

        await login(page);
        await page.goto("/profile/author1.bsky.social/post/abc123");

        const view = page.locator("#post-detail-view");
        await expect(view.locator('[data-testid="large-post"]')).toBeVisible({
          timeout: 10000,
        });
        await expect(view.locator(".missing-post-indicator")).toContainText(
          "Blocked",
        );
        // The chain is severed at the blocked post so grandparent is not reachable
        await expect(view).not.toContainText("Grandparent post");
      });

      test("should show blocked parent interspersed with visible parents in a deep chain", async ({
        page,
      }) => {
        const rootPost = createPost({
          uri: "at://did:plc:rootuser/app.bsky.feed.post/root1",
          text: "Root of the conversation",
          authorHandle: "rootuser.bsky.social",
          authorDisplayName: "Root User",
        });

        const visibleParent = createPost({
          uri: "at://did:plc:visible1/app.bsky.feed.post/vp1",
          text: "Visible middle parent",
          authorHandle: "visible1.bsky.social",
          authorDisplayName: "Visible User",
          reply: {
            parent: {
              uri: "at://did:plc:blocked1/app.bsky.feed.post/bp1",
              cid: "bafyreitestbp1",
            },
            root: {
              uri: rootPost.uri,
              cid: rootPost.cid,
            },
          },
        });

        const childPost = createPost({
          uri: postUri,
          text: "Final reply in the chain",
          authorHandle: "author1.bsky.social",
          authorDisplayName: "Author One",
          reply: {
            parent: {
              uri: visibleParent.uri,
              cid: visibleParent.cid,
            },
            root: {
              uri: rootPost.uri,
              cid: rootPost.cid,
            },
          },
        });

        const blockedParentUri = "at://did:plc:blocked1/app.bsky.feed.post/bp1";

        const mockServer = new MockServer();
        mockServer.addPosts([childPost, visibleParent, rootPost]);
        mockServer.setPostThread(postUri, {
          $type: "app.bsky.feed.defs#threadViewPost",
          post: childPost,
          parent: {
            $type: "app.bsky.feed.defs#threadViewPost",
            post: visibleParent,
            parent: {
              $type: "app.bsky.feed.defs#blockedPost",
              uri: blockedParentUri,
              blocked: true,
              author: {
                did: "did:plc:blocked1",
                viewer: { blockedBy: true },
              },
            },
            replies: [],
          },
          replies: [],
        });
        // The app tries to load the parent chain, but the second call
        // also returns blocked since the parent author blocked the viewer
        mockServer.setPostThread(blockedParentUri, {
          $type: "app.bsky.feed.defs#threadViewPost",
          post: {
            $type: "app.bsky.feed.defs#blockedPost",
            uri: blockedParentUri,
            blocked: true,
            author: {
              did: "did:plc:blocked1",
              viewer: { blockedBy: true },
            },
          },
          replies: [],
        });
        await mockServer.setup(page);

        await login(page);
        await page.goto("/profile/author1.bsky.social/post/abc123");

        const view = page.locator("#post-detail-view");
        await expect(view.locator('[data-testid="large-post"]')).toBeVisible({
          timeout: 10000,
        });
        // Visible parent is shown
        await expect(view).toContainText("Visible middle parent", {
          timeout: 10000,
        });
        // Blocked post shown as unavailable
        await expect(view.locator(".missing-post-indicator")).toContainText(
          "Blocked",
        );
        // Root is not reachable past the blocked post
        await expect(view).not.toContainText("Root of the conversation");
      });
    });

    test.describe("when the current user is not blocked", () => {
      test("should resolve blocked parent by loading the parent chain separately", async ({
        page,
      }) => {
        const blockedParentUri =
          "at://did:plc:blockedparent/app.bsky.feed.post/bp1";

        const rootPost = createPost({
          uri: "at://did:plc:rootuser/app.bsky.feed.post/root1",
          text: "Root of the thread",
          authorHandle: "rootuser.bsky.social",
          authorDisplayName: "Root User",
        });

        const blockedParentResolved = createPost({
          uri: blockedParentUri,
          text: "Resolved blocked parent",
          authorHandle: "blockedparent.bsky.social",
          authorDisplayName: "Blocked Parent Author",
          reply: {
            parent: {
              uri: rootPost.uri,
              cid: rootPost.cid,
            },
            root: {
              uri: rootPost.uri,
              cid: rootPost.cid,
            },
          },
        });

        const childPost = createPost({
          uri: postUri,
          text: "Reply by someone who blocked the parent author",
          authorHandle: "author1.bsky.social",
          authorDisplayName: "Author One",
          reply: {
            parent: {
              uri: blockedParentUri,
              cid: blockedParentResolved.cid,
            },
            root: {
              uri: rootPost.uri,
              cid: rootPost.cid,
            },
          },
        });

        const mockServer = new MockServer();
        mockServer.addPosts([childPost, blockedParentResolved, rootPost]);
        // Initial getPostThread returns the blocked parent
        mockServer.setPostThread(postUri, {
          $type: "app.bsky.feed.defs#threadViewPost",
          post: childPost,
          parent: {
            $type: "app.bsky.feed.defs#blockedPost",
            uri: blockedParentUri,
            blocked: true,
            author: {
              did: "did:plc:blockedparent",
              viewer: {},
            },
          },
          replies: [],
        });
        // Second getPostThread resolves the blocked parent's chain
        mockServer.setPostThread(blockedParentUri, {
          $type: "app.bsky.feed.defs#threadViewPost",
          post: blockedParentResolved,
          parent: {
            $type: "app.bsky.feed.defs#threadViewPost",
            post: rootPost,
            parent: null,
            replies: [],
          },
          replies: [],
        });
        await mockServer.setup(page);

        await login(page);
        await page.goto("/profile/author1.bsky.social/post/abc123");

        const view = page.locator("#post-detail-view");
        await expect(view.locator('[data-testid="large-post"]')).toBeVisible({
          timeout: 10000,
        });
        await expect(view).toContainText("Root of the thread", {
          timeout: 10000,
        });
        await expect(view).toContainText("Resolved blocked parent");
        await expect(view).toContainText(
          "Reply by someone who blocked the parent author",
        );
        await expect(view.locator('[data-testid="small-post"]')).toHaveCount(2);
        await expect(
          view.locator(".missing-post-indicator"),
        ).not.toBeAttached();
      });

      test("should resolve deeply nested blocked parent chain", async ({
        page,
      }) => {
        const blockedParentUri =
          "at://did:plc:blockedparent/app.bsky.feed.post/bp1";

        const rootPost = createPost({
          uri: "at://did:plc:rootuser/app.bsky.feed.post/root1",
          text: "Deep root post",
          authorHandle: "rootuser.bsky.social",
          authorDisplayName: "Root User",
        });

        const middleParent = createPost({
          uri: "at://did:plc:middle1/app.bsky.feed.post/mid1",
          text: "Middle parent post",
          authorHandle: "middle1.bsky.social",
          authorDisplayName: "Middle User",
          reply: {
            parent: {
              uri: rootPost.uri,
              cid: rootPost.cid,
            },
            root: {
              uri: rootPost.uri,
              cid: rootPost.cid,
            },
          },
        });

        const blockedParentResolved = createPost({
          uri: blockedParentUri,
          text: "Resolved deep blocked parent",
          authorHandle: "blockedparent.bsky.social",
          authorDisplayName: "Blocked Parent Author",
          reply: {
            parent: {
              uri: middleParent.uri,
              cid: middleParent.cid,
            },
            root: {
              uri: rootPost.uri,
              cid: rootPost.cid,
            },
          },
        });

        const visibleParent = createPost({
          uri: "at://did:plc:visible1/app.bsky.feed.post/vp1",
          text: "Visible parent above main post",
          authorHandle: "visible1.bsky.social",
          authorDisplayName: "Visible User",
          reply: {
            parent: {
              uri: blockedParentUri,
              cid: blockedParentResolved.cid,
            },
            root: {
              uri: rootPost.uri,
              cid: rootPost.cid,
            },
          },
        });

        const childPost = createPost({
          uri: postUri,
          text: "Leaf reply in deep thread",
          authorHandle: "author1.bsky.social",
          authorDisplayName: "Author One",
          reply: {
            parent: {
              uri: visibleParent.uri,
              cid: visibleParent.cid,
            },
            root: {
              uri: rootPost.uri,
              cid: rootPost.cid,
            },
          },
        });

        const mockServer = new MockServer();
        mockServer.addPosts([
          childPost,
          visibleParent,
          blockedParentResolved,
          middleParent,
          rootPost,
        ]);
        // Initial getPostThread returns visible parent with blocked grandparent
        mockServer.setPostThread(postUri, {
          $type: "app.bsky.feed.defs#threadViewPost",
          post: childPost,
          parent: {
            $type: "app.bsky.feed.defs#threadViewPost",
            post: visibleParent,
            parent: {
              $type: "app.bsky.feed.defs#blockedPost",
              uri: blockedParentUri,
              blocked: true,
              author: {
                did: "did:plc:blockedparent",
                viewer: {},
              },
            },
            replies: [],
          },
          replies: [],
        });
        // Second getPostThread resolves the blocked parent's full chain
        mockServer.setPostThread(blockedParentUri, {
          $type: "app.bsky.feed.defs#threadViewPost",
          post: blockedParentResolved,
          parent: {
            $type: "app.bsky.feed.defs#threadViewPost",
            post: middleParent,
            parent: {
              $type: "app.bsky.feed.defs#threadViewPost",
              post: rootPost,
              parent: null,
              replies: [],
            },
            replies: [],
          },
          replies: [],
        });
        await mockServer.setup(page);

        await login(page);
        await page.goto("/profile/author1.bsky.social/post/abc123");

        const view = page.locator("#post-detail-view");
        await expect(view.locator('[data-testid="large-post"]')).toBeVisible({
          timeout: 10000,
        });
        await expect(view).toContainText("Deep root post", {
          timeout: 10000,
        });
        await expect(view).toContainText("Middle parent post");
        await expect(view).toContainText("Resolved deep blocked parent");
        await expect(view).toContainText("Visible parent above main post");
        await expect(view).toContainText("Leaf reply in deep thread");
        await expect(view.locator('[data-testid="small-post"]')).toHaveCount(4);
        await expect(
          view.locator(".missing-post-indicator"),
        ).not.toBeAttached();
      });
    });
  });

  test.describe("Blocked parent chain via constellation", () => {
    test("should resolve blocked parents from two authors blocking each other", async ({
      page,
    }) => {
      const NUM_POSTS = 20;
      const posts = [];
      for (let i = 0; i < NUM_POSTS; i++) {
        const author = i % 2 === 0 ? AUTHOR_A : AUTHOR_B;
        const uri = `at://${author.did}/app.bsky.feed.post/post${i}`;
        const isFirst = i === 0;
        posts.push(
          createPost({
            uri,
            text: `Post ${i} by ${author.name}`,
            authorHandle: author.handle,
            authorDisplayName: author.name,
            ...(isFirst
              ? {}
              : {
                  reply: {
                    parent: {
                      uri: posts[i - 1].uri,
                      cid: posts[i - 1].cid,
                    },
                    root: {
                      uri: posts[0].uri,
                      cid: posts[0].cid,
                    },
                  },
                }),
          }),
        );
      }

      const mainPost = posts[NUM_POSTS - 1];
      const mainPostUri = mainPost.uri;
      const rootUri = posts[0].uri;
      const immediateParent = posts[NUM_POSTS - 2];
      const blockedGrandparent = posts[NUM_POSTS - 3];

      const mockServer = new MockServer();
      mockServer.addPosts(posts);

      mockServer.setPostThread(mainPostUri, {
        $type: "app.bsky.feed.defs#threadViewPost",
        post: mainPost,
        parent: {
          $type: "app.bsky.feed.defs#threadViewPost",
          post: immediateParent,
          parent: {
            $type: "app.bsky.feed.defs#blockedPost",
            uri: blockedGrandparent.uri,
            blocked: true,
            author: {
              did: blockedGrandparent.uri.split("/")[2],
              viewer: { blocking: true },
            },
          },
          replies: [],
        },
        replies: [],
      });
      await mockServer.setup(page);

      const mockConstellation = new MockConstellation();
      const threadBacklinks = posts.slice(1).map((post) => {
        const [, , did, , rkey] = post.uri.split("/");
        return { did, collection: "app.bsky.feed.post", rkey };
      });
      mockConstellation.setBacklinks(rootUri, threadBacklinks);
      await mockConstellation.setup(page);

      await login(page);
      await page.goto(`/profile/${AUTHOR_B.handle}/post/post${NUM_POSTS - 1}`);

      const view = page.locator("#post-detail-view");
      await expect(view.locator('[data-testid="large-post"]')).toBeVisible({
        timeout: 10000,
      });
      await expect(view).toContainText("Post 0 by Author A", {
        timeout: 10000,
      });
      await expect(view).toContainText("Post 1 by Author B");
      await expect(view).toContainText(`Post ${NUM_POSTS - 3} by Author B`);
    });

    test("should handle a third blocked author interspersed in the parent chain", async ({
      page,
    }) => {
      const NUM_POSTS = 20;
      const posts = [];
      for (let i = 0; i < NUM_POSTS; i++) {
        let author;
        if (i === 10) {
          author = AUTHOR_C;
        } else {
          author = i % 2 === 0 ? AUTHOR_A : AUTHOR_B;
        }
        const uri = `at://${author.did}/app.bsky.feed.post/post${i}`;
        const isFirst = i === 0;
        posts.push(
          createPost({
            uri,
            text: `Post ${i} by ${author.name}`,
            authorHandle: author.handle,
            authorDisplayName: author.name,
            ...(isFirst
              ? {}
              : {
                  reply: {
                    parent: {
                      uri: posts[i - 1].uri,
                      cid: posts[i - 1].cid,
                    },
                    root: {
                      uri: posts[0].uri,
                      cid: posts[0].cid,
                    },
                  },
                }),
          }),
        );
      }

      const mainPost = posts[NUM_POSTS - 1];
      const mainPostUri = mainPost.uri;
      const rootUri = posts[0].uri;
      const immediateParent = posts[NUM_POSTS - 2];
      const blockedGrandparent = posts[NUM_POSTS - 3];

      const mockServer = new MockServer();
      mockServer.addPosts(posts);

      mockServer.setPostThread(mainPostUri, {
        $type: "app.bsky.feed.defs#threadViewPost",
        post: mainPost,
        parent: {
          $type: "app.bsky.feed.defs#threadViewPost",
          post: immediateParent,
          parent: {
            $type: "app.bsky.feed.defs#blockedPost",
            uri: blockedGrandparent.uri,
            blocked: true,
            author: {
              did: blockedGrandparent.uri.split("/")[2],
              viewer: { blocking: true },
            },
          },
          replies: [],
        },
        replies: [],
      });
      await mockServer.setup(page);

      const mockConstellation = new MockConstellation();
      const threadBacklinks = posts.slice(1).map((post) => {
        const [, , did, , rkey] = post.uri.split("/");
        return { did, collection: "app.bsky.feed.post", rkey };
      });
      mockConstellation.setBacklinks(rootUri, threadBacklinks);
      await mockConstellation.setup(page);

      await login(page);
      await page.goto(`/profile/${AUTHOR_B.handle}/post/post${NUM_POSTS - 1}`);

      const view = page.locator("#post-detail-view");
      await expect(view.locator('[data-testid="large-post"]')).toBeVisible({
        timeout: 10000,
      });
      await expect(view).toContainText("Post 10 by Author C", {
        timeout: 10000,
      });
      await expect(view).toContainText("Post 0 by Author A");
    });

    test("should handle a non-blocked third author interspersed in the parent chain", async ({
      page,
    }) => {
      const NUM_POSTS = 20;
      const posts = [];
      for (let i = 0; i < NUM_POSTS; i++) {
        let author;
        if (i === 10) {
          author = AUTHOR_C;
        } else {
          author = i % 2 === 0 ? AUTHOR_A : AUTHOR_B;
        }
        const uri = `at://${author.did}/app.bsky.feed.post/post${i}`;
        const isFirst = i === 0;
        posts.push(
          createPost({
            uri,
            text: `Post ${i} by ${author.name}`,
            authorHandle: author.handle,
            authorDisplayName: author.name,
            ...(isFirst
              ? {}
              : {
                  reply: {
                    parent: {
                      uri: posts[i - 1].uri,
                      cid: posts[i - 1].cid,
                    },
                    root: {
                      uri: posts[0].uri,
                      cid: posts[0].cid,
                    },
                  },
                }),
          }),
        );
      }

      const mainPost = posts[NUM_POSTS - 1];
      const mainPostUri = mainPost.uri;
      const rootUri = posts[0].uri;

      function buildParentChain(index) {
        if (index < 0) return null;
        const post = posts[index];
        const isC = index === 10;
        if (isC) {
          return {
            $type: "app.bsky.feed.defs#threadViewPost",
            post,
            parent: buildParentChain(index - 1),
            replies: [],
          };
        }
        return {
          $type: "app.bsky.feed.defs#blockedPost",
          uri: post.uri,
          blocked: true,
          author: {
            did: post.uri.split("/")[2],
            viewer: { blocking: true },
          },
        };
      }

      const mockServer = new MockServer();
      mockServer.addPosts(posts);

      mockServer.setPostThread(mainPostUri, {
        $type: "app.bsky.feed.defs#threadViewPost",
        post: mainPost,
        parent: {
          $type: "app.bsky.feed.defs#threadViewPost",
          post: posts[NUM_POSTS - 2],
          parent: buildParentChain(NUM_POSTS - 3),
          replies: [],
        },
        replies: [],
      });
      await mockServer.setup(page);

      const mockConstellation = new MockConstellation();
      const threadBacklinks = posts.slice(1).map((post) => {
        const [, , did, , rkey] = post.uri.split("/");
        return { did, collection: "app.bsky.feed.post", rkey };
      });
      mockConstellation.setBacklinks(rootUri, threadBacklinks);
      await mockConstellation.setup(page);

      await login(page);
      await page.goto(`/profile/${AUTHOR_B.handle}/post/post${NUM_POSTS - 1}`);

      const view = page.locator("#post-detail-view");
      await expect(view.locator('[data-testid="large-post"]')).toBeVisible({
        timeout: 10000,
      });
      await expect(view).toContainText("Post 10 by Author C", {
        timeout: 10000,
      });
      await expect(view).toContainText("Post 0 by Author A");
    });
  });

  test.describe("Blocked replies", () => {
    test("should load blocked replies via constellation backlinks and place them in the hidden section", async ({
      page,
    }) => {
      const postWithReplies = createPost({
        uri: postUri,
        text: "Post with blocked reply",
        authorHandle: "author1.bsky.social",
        authorDisplayName: "Author One",
        replyCount: 2,
      });

      const normalReply = createPost({
        uri: "at://did:plc:replier1/app.bsky.feed.post/reply1",
        text: "Normal reply",
        authorHandle: "replier1.bsky.social",
        authorDisplayName: "Replier One",
      });

      const blockedReply = createPost({
        uri: "at://did:plc:blocked1/app.bsky.feed.post/blockedreply",
        text: "Reply from blocked user",
        authorHandle: "blocked1.bsky.social",
        authorDisplayName: "Blocked User",
      });

      const mockServer = new MockServer();
      mockServer.addPosts([postWithReplies, normalReply, blockedReply]);
      mockServer.setPostThread(postUri, {
        $type: "app.bsky.feed.defs#threadViewPost",
        post: postWithReplies,
        parent: null,
        replies: [
          {
            $type: "app.bsky.feed.defs#threadViewPost",
            post: normalReply,
            replies: [],
          },
        ],
      });
      await mockServer.setup(page);
      const mockConstellation = new MockConstellation();
      mockConstellation.setBacklinks(postUri, [
        {
          did: "did:plc:replier1",
          collection: "app.bsky.feed.post",
          rkey: "reply1",
        },
        {
          did: "did:plc:blocked1",
          collection: "app.bsky.feed.post",
          rkey: "blockedreply",
        },
      ]);
      await mockConstellation.setup(page);

      await login(page);
      await page.goto("/profile/author1.bsky.social/post/abc123");

      const view = page.locator("#post-detail-view");
      await expect(view).toContainText("Normal reply", { timeout: 10000 });

      const replyChains = view.locator(".post-thread-reply-chains");
      await expect(replyChains).not.toContainText("Reply from blocked user");

      const hiddenSection = view.locator("hidden-replies-section");
      await expect(hiddenSection).toBeVisible();
    });

    test("should reveal loaded blocked replies when clicking 'Show more replies'", async ({
      page,
    }) => {
      const postWithReplies = createPost({
        uri: postUri,
        text: "Post with blocked reply",
        authorHandle: "author1.bsky.social",
        authorDisplayName: "Author One",
        replyCount: 2,
      });

      const normalReply = createPost({
        uri: "at://did:plc:replier1/app.bsky.feed.post/reply1",
        text: "Normal reply",
        authorHandle: "replier1.bsky.social",
        authorDisplayName: "Replier One",
      });

      const blockedReply = createPost({
        uri: "at://did:plc:blocked1/app.bsky.feed.post/blockedreply",
        text: "Reply from blocked user",
        authorHandle: "blocked1.bsky.social",
        authorDisplayName: "Blocked User",
      });

      const mockServer = new MockServer();
      mockServer.addPosts([postWithReplies, normalReply, blockedReply]);
      mockServer.setPostThread(postUri, {
        $type: "app.bsky.feed.defs#threadViewPost",
        post: postWithReplies,
        parent: null,
        replies: [
          {
            $type: "app.bsky.feed.defs#threadViewPost",
            post: normalReply,
            replies: [],
          },
        ],
      });
      await mockServer.setup(page);
      const mockConstellation = new MockConstellation();
      mockConstellation.setBacklinks(postUri, [
        {
          did: "did:plc:replier1",
          collection: "app.bsky.feed.post",
          rkey: "reply1",
        },
        {
          did: "did:plc:blocked1",
          collection: "app.bsky.feed.post",
          rkey: "blockedreply",
        },
      ]);
      await mockConstellation.setup(page);

      await login(page);
      await page.goto("/profile/author1.bsky.social/post/abc123");

      const view = page.locator("#post-detail-view");
      const hiddenSection = view.locator("hidden-replies-section");
      await expect(hiddenSection.locator(".hidden-replies-button")).toBeVisible(
        { timeout: 10000 },
      );

      await expect(hiddenSection.locator(".toggle-content")).not.toBeVisible();

      await hiddenSection.locator(".hidden-replies-button").click();

      await expect(hiddenSection.locator(".toggle-content")).toBeVisible();
      await expect(hiddenSection).toContainText("Reply from blocked user");

      await expect(
        hiddenSection.locator(".hidden-replies-button"),
      ).not.toBeVisible();
    });
  });
});
