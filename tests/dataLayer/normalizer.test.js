import { TestSuite } from "../testSuite.js";
import { assert, assertEquals } from "../testHelpers.js";
import { Normalizer } from "../../src/js/dataLayer/normalizer.js";

const t = new TestSuite("Normalizer");

t.describe("getPostsFromPostThread", (it) => {
  it("should extract and deduplicate posts from post thread", () => {
    const normalizer = new Normalizer();
    const mockPostThread = {
      post: { uri: "main-post", content: "Main post" },
      parent: {
        post: { uri: "parent2", content: "Parent 2" },
        parent: {
          post: { uri: "parent1", content: "Parent 1" },
        },
      },
      replies: [
        {
          $type: "app.bsky.feed.defs#threadViewPost",
          post: { uri: "reply1", content: "Reply 1" },
        },
        {
          $type: "app.bsky.feed.defs#threadViewPost",
          post: { uri: "reply2", content: "Reply 2" },
        },
      ],
    };

    const result = normalizer.getPostsFromPostThread(mockPostThread);

    assertEquals(result.length, 5);
    assertEquals(result[0], { uri: "main-post", content: "Main post" });
    assertEquals(result[1], { uri: "parent1", content: "Parent 1" });
    assertEquals(result[2], { uri: "parent2", content: "Parent 2" });
    assertEquals(result[3], { uri: "reply1", content: "Reply 1" });
    assertEquals(result[4], { uri: "reply2", content: "Reply 2" });
  });

  it("should handle thread with no parents or replies", () => {
    const normalizer = new Normalizer();
    const mockPostThread = {
      post: { uri: "lonely-post", content: "All alone" },
    };

    const result = normalizer.getPostsFromPostThread(mockPostThread);

    assertEquals(result.length, 1);
    assertEquals(result[0], { uri: "lonely-post", content: "All alone" });
  });

  it("should handle duplicate posts across thread parts", () => {
    const normalizer = new Normalizer();
    const mockPostThread = {
      post: { uri: "main-post", content: "Main post" },
      parent: {
        post: { uri: "parent1", content: "Parent 1" },
      },
      replies: [
        {
          $type: "app.bsky.feed.defs#threadViewPost",
          post: { uri: "parent1", content: "Parent 1" }, // Duplicate of parent
        },
        {
          $type: "app.bsky.feed.defs#threadViewPost",
          post: { uri: "reply1", content: "Reply 1" },
        },
      ],
    };

    const result = normalizer.getPostsFromPostThread(mockPostThread);

    assertEquals(result.length, 3);
    assertEquals(result[0], { uri: "main-post", content: "Main post" });
    assertEquals(result[1], { uri: "parent1", content: "Parent 1" });
    assertEquals(result[2], { uri: "reply1", content: "Reply 1" });
  });

  it("should filter out blocked replies", () => {
    const normalizer = new Normalizer();
    const mockPostThread = {
      post: { uri: "main-post", content: "Main post" },
      replies: [
        {
          $type: "app.bsky.feed.defs#threadViewPost",
          post: { uri: "reply1", content: "Reply 1" },
        },
        {
          $type: "app.bsky.feed.defs#blockedPost",
          uri: "blocked-reply",
        },
        {
          $type: "app.bsky.feed.defs#threadViewPost",
          post: { uri: "reply2", content: "Reply 2" },
        },
      ],
    };

    const result = normalizer.getPostsFromPostThread(mockPostThread);

    assertEquals(result.length, 3);
    assertEquals(result[0], { uri: "main-post", content: "Main post" });
    assertEquals(result[1], { uri: "reply1", content: "Reply 1" });
    assertEquals(result[2], { uri: "reply2", content: "Reply 2" });
  });
});

t.describe("getPostsFromFeed", (it) => {
  it("should extract posts from simple feed", () => {
    const normalizer = new Normalizer();
    const mockFeed = {
      feed: [
        { post: { uri: "post1", content: "Post 1" } },
        { post: { uri: "post2", content: "Post 2" } },
      ],
    };

    const result = normalizer.getPostsFromFeed(mockFeed);

    assertEquals(result.length, 2);
    assertEquals(result[0], { uri: "post1", content: "Post 1" });
    assertEquals(result[1], { uri: "post2", content: "Post 2" });
  });

  it("should extract posts from feed with reply context", () => {
    const normalizer = new Normalizer();
    const mockFeed = {
      feed: [
        { post: { uri: "post1", content: "Post 1" } },
        {
          post: { uri: "post2", content: "Reply post" },
          reply: {
            root: {
              $type: "app.bsky.feed.defs#postView",
              uri: "root1",
              content: "Root post",
            },
            parent: {
              $type: "app.bsky.feed.defs#postView",
              uri: "parent1",
              content: "Parent post",
            },
          },
        },
      ],
    };

    const result = normalizer.getPostsFromFeed(mockFeed);

    assertEquals(result.length, 4);
    assertEquals(result[0].uri, "post1");
    assertEquals(result[1].uri, "post2");
    assertEquals(result[2].uri, "root1");
    assertEquals(result[3].uri, "parent1");
  });

  it("should handle feed items without reply context", () => {
    const normalizer = new Normalizer();
    const mockFeed = {
      feed: [
        {
          post: { uri: "post1", content: "Post 1" },
          reply: undefined,
        },
        {
          post: { uri: "post2", content: "Post 2" },
          // No reply property
        },
      ],
    };

    const result = normalizer.getPostsFromFeed(mockFeed);

    assertEquals(result.length, 2);
    assertEquals(result[0], { uri: "post1", content: "Post 1" });
    assertEquals(result[1], { uri: "post2", content: "Post 2" });
  });

  it("should handle empty feed", () => {
    const normalizer = new Normalizer();
    const mockFeed = { feed: [] };

    const result = normalizer.getPostsFromFeed(mockFeed);

    assertEquals(result.length, 0);
  });

  it("should handle duplicates in feed", () => {
    const normalizer = new Normalizer();
    const mockFeed = {
      feed: [
        {
          post: { uri: "post1", content: "Post 1" },
          reply: {
            root: {
              $type: "app.bsky.feed.defs#postView",
              uri: "root1",
              content: "Root post",
            },
            parent: {
              $type: "app.bsky.feed.defs#postView",
              uri: "post1",
              content: "Post 1",
            }, // Duplicate of main post
          },
        },
      ],
    };

    const result = normalizer.getPostsFromFeed(mockFeed);

    assertEquals(result.length, 2);
    assertEquals(result[0].uri, "post1");
    assertEquals(result[1].uri, "root1");
  });

  it("should handle mixed feed items", () => {
    const normalizer = new Normalizer();
    const mockFeed = {
      feed: [
        { post: { uri: "post1", content: "Simple post" } },
        {
          post: { uri: "post2", content: "Reply post" },
          reply: {
            root: {
              $type: "app.bsky.feed.defs#postView",
              uri: "root1",
              content: "Root",
            },
            parent: {
              $type: "app.bsky.feed.defs#postView",
              uri: "parent1",
              content: "Parent",
            },
          },
        },
        { post: { uri: "post3", content: "Another simple post" } },
      ],
    };

    const result = normalizer.getPostsFromFeed(mockFeed);

    assertEquals(result.length, 5);
    assertEquals(result[0].uri, "post1");
    assertEquals(result[1].uri, "post2");
    assertEquals(result[2].uri, "root1");
    assertEquals(result[3].uri, "parent1");
    assertEquals(result[4].uri, "post3");
  });
});

await t.run();
