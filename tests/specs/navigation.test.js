import { TestSuite } from "../testSuite.js";
import { assert, assertEquals } from "../testHelpers.js";
import {
  linkToHashtag,
  linkToProfile,
  linkToPost,
  linkToPostFromUri,
  linkToPostLikes,
  linkToPostQuotes,
  linkToPostReposts,
  linkToProfileFollowers,
  linkToProfileFollowing,
  linkToFeed,
  getPermalinkForPost,
  getPermalinkForProfile,
} from "../../src/js/navigation.js";

const t = new TestSuite("navigation");

t.describe("linkToHashtag", (it) => {
  it("should return correct hashtag link", () => {
    assertEquals(linkToHashtag("coding"), "/hashtag/coding");
  });

  it("should handle hashtag with numbers", () => {
    assertEquals(linkToHashtag("test123"), "/hashtag/test123");
  });

  it("should handle hashtag with underscores", () => {
    assertEquals(linkToHashtag("hello_world"), "/hashtag/hello_world");
  });
});

t.describe("linkToProfile", (it) => {
  it("should return profile link from handle string", () => {
    assertEquals(
      linkToProfile("alice.bsky.social"),
      "/profile/alice.bsky.social",
    );
  });

  it("should return profile link from profile object", () => {
    const profile = { handle: "bob.bsky.social", did: "did:plc:bob" };
    assertEquals(linkToProfile(profile), "/profile/bob.bsky.social");
  });
});

t.describe("linkToPost", (it) => {
  it("should return correct post link", () => {
    const post = {
      uri: "at://did:plc:alice/app.bsky.feed.post/abc123",
      author: { handle: "alice.bsky.social" },
    };
    assertEquals(linkToPost(post), "/profile/alice.bsky.social/post/abc123");
  });

  it("should handle different rkeys", () => {
    const post = {
      uri: "at://did:plc:bob/app.bsky.feed.post/xyz789",
      author: { handle: "bob.test" },
    };
    assertEquals(linkToPost(post), "/profile/bob.test/post/xyz789");
  });
});

t.describe("linkToPostFromUri", (it) => {
  it("should return correct post link from URI", () => {
    const uri = "at://did:plc:alice123/app.bsky.feed.post/postkey456";
    assertEquals(
      linkToPostFromUri(uri),
      "/profile/did:plc:alice123/post/postkey456",
    );
  });

  it("should handle different DIDs", () => {
    const uri = "at://did:web:example.com/app.bsky.feed.post/key";
    assertEquals(
      linkToPostFromUri(uri),
      "/profile/did:web:example.com/post/key",
    );
  });
});

t.describe("linkToPostLikes", (it) => {
  it("should return correct likes link", () => {
    const post = {
      uri: "at://did:plc:alice/app.bsky.feed.post/abc123",
      author: { handle: "alice.bsky.social" },
    };
    assertEquals(
      linkToPostLikes(post),
      "/profile/alice.bsky.social/post/abc123/likes",
    );
  });
});

t.describe("linkToPostQuotes", (it) => {
  it("should return correct quotes link", () => {
    const post = {
      uri: "at://did:plc:alice/app.bsky.feed.post/abc123",
      author: { handle: "alice.bsky.social" },
    };
    assertEquals(
      linkToPostQuotes(post),
      "/profile/alice.bsky.social/post/abc123/quotes",
    );
  });
});

t.describe("linkToPostReposts", (it) => {
  it("should return correct reposts link", () => {
    const post = {
      uri: "at://did:plc:alice/app.bsky.feed.post/abc123",
      author: { handle: "alice.bsky.social" },
    };
    assertEquals(
      linkToPostReposts(post),
      "/profile/alice.bsky.social/post/abc123/reposts",
    );
  });
});

t.describe("linkToProfileFollowers", (it) => {
  it("should return followers link from handle string", () => {
    assertEquals(
      linkToProfileFollowers("alice.bsky.social"),
      "/profile/alice.bsky.social/followers",
    );
  });

  it("should return followers link from profile object", () => {
    const profile = { handle: "bob.bsky.social", did: "did:plc:bob" };
    assertEquals(
      linkToProfileFollowers(profile),
      "/profile/bob.bsky.social/followers",
    );
  });
});

t.describe("linkToProfileFollowing", (it) => {
  it("should return following link from handle string", () => {
    assertEquals(
      linkToProfileFollowing("alice.bsky.social"),
      "/profile/alice.bsky.social/following",
    );
  });

  it("should return following link from profile object", () => {
    const profile = { handle: "bob.bsky.social", did: "did:plc:bob" };
    assertEquals(
      linkToProfileFollowing(profile),
      "/profile/bob.bsky.social/following",
    );
  });
});

t.describe("linkToFeed", (it) => {
  it("should return correct feed link", () => {
    const feedGenerator = {
      uri: "at://did:plc:feedcreator/app.bsky.feed.generator/myfeed",
      creator: { handle: "feedcreator.bsky.social" },
    };
    assertEquals(
      linkToFeed(feedGenerator),
      "/profile/feedcreator.bsky.social/feed/myfeed",
    );
  });

  it("should handle different feed rkeys", () => {
    const feedGenerator = {
      uri: "at://did:plc:alice/app.bsky.feed.generator/trending",
      creator: { handle: "alice.bsky.social" },
    };
    assertEquals(
      linkToFeed(feedGenerator),
      "/profile/alice.bsky.social/feed/trending",
    );
  });
});

t.describe("getPermalinkForPost", (it) => {
  it("should return bsky.app permalink for post", () => {
    const post = {
      uri: "at://did:plc:alice/app.bsky.feed.post/abc123",
      author: { handle: "alice.bsky.social" },
    };
    assertEquals(
      getPermalinkForPost(post),
      "https://bsky.app/profile/alice.bsky.social/post/abc123",
    );
  });
});

t.describe("getPermalinkForProfile", (it) => {
  it("should return bsky.app permalink for profile", () => {
    const profile = { handle: "alice.bsky.social", did: "did:plc:alice" };
    assertEquals(
      getPermalinkForProfile(profile),
      "https://bsky.app/profile/alice.bsky.social",
    );
  });
});

await t.run();
