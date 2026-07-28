import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  linkToHashtag,
  linkToProfile,
  linkToProfileByDid,
  linkToLabeler,
  linkToPost,
  linkToPostFromUri,
  linkToPostLikes,
  linkToPostQuotes,
  linkToPostReposts,
  linkToProfileFollowers,
  linkToProfileFollowing,
  linkToFeed,
  linkToCommunityPlugin,
  linkToPluginSettings,
  getPermalinkForPost,
  getPermalinkForProfile,
  getPermalinkForCommunityPlugin,
  validateReturnToParam,
  linkToLogin,
} from "/js/navigation.js";

describe("linkToHashtag", () => {
  it("should return correct hashtag link", () => {
    assert.deepEqual(linkToHashtag("coding"), "/hashtag/coding");
  });

  it("should handle hashtag with numbers", () => {
    assert.deepEqual(linkToHashtag("test123"), "/hashtag/test123");
  });

  it("should handle hashtag with underscores", () => {
    assert.deepEqual(linkToHashtag("hello_world"), "/hashtag/hello_world");
  });
});

describe("linkToProfile", () => {
  it("should return profile link from profile object", () => {
    const profile = { handle: "bob.bsky.social", did: "did:plc:bob" };
    assert.deepEqual(linkToProfile(profile), "/profile/bob.bsky.social");
  });

  it("falls back to did when handle is handle.invalid", () => {
    const profile = { handle: "handle.invalid", did: "did:plc:bob" };
    assert.deepEqual(linkToProfile(profile), "/profile/did:plc:bob");
  });

  it("falls back to did when handle is missing.invalid", () => {
    const profile = { handle: "missing.invalid", did: "did:plc:bob" };
    assert.deepEqual(linkToProfile(profile), "/profile/did:plc:bob");
  });

  it("falls back to did when handle is absent", () => {
    const profile = { did: "did:plc:bob" };
    assert.deepEqual(linkToProfile(profile), "/profile/did:plc:bob");
  });
});

describe("linkToProfileByDid", () => {
  it("returns a profile link for the given did", () => {
    assert.deepEqual(
      linkToProfileByDid("did:plc:abc123"),
      "/profile/did:plc:abc123",
    );
  });

  it("preserves colons in the did", () => {
    assert.deepEqual(
      linkToProfileByDid("did:web:example.com"),
      "/profile/did:web:example.com",
    );
  });
});

describe("linkToLabeler", () => {
  it("should return profile link for labeler creator", () => {
    const labeler = {
      creator: { handle: "labeler.bsky.social", did: "did:plc:labeler" },
    };
    assert.deepEqual(linkToLabeler(labeler), "/profile/labeler.bsky.social");
  });

  it("should handle labeler with different handle", () => {
    const labeler = {
      creator: { handle: "moderation-service.test", did: "did:plc:mod" },
    };
    assert.deepEqual(
      linkToLabeler(labeler),
      "/profile/moderation-service.test",
    );
  });
});

describe("linkToPost", () => {
  it("should return correct post link", () => {
    const post = {
      uri: "at://did:plc:alice/app.bsky.feed.post/abc123",
      author: { handle: "alice.bsky.social" },
    };
    assert.deepEqual(
      linkToPost(post),
      "/profile/alice.bsky.social/post/abc123",
    );
  });

  it("should handle different rkeys", () => {
    const post = {
      uri: "at://did:plc:bob/app.bsky.feed.post/xyz789",
      author: { handle: "bob.test" },
    };
    assert.deepEqual(linkToPost(post), "/profile/bob.test/post/xyz789");
  });

  it("falls back to author did when handle is invalid", () => {
    const post = {
      uri: "at://did:plc:alice/app.bsky.feed.post/abc123",
      author: { handle: "handle.invalid", did: "did:plc:alice" },
    };
    assert.deepEqual(linkToPost(post), "/profile/did:plc:alice/post/abc123");
  });
});

describe("linkToPostFromUri", () => {
  it("should return correct post link from URI", () => {
    const uri = "at://did:plc:alice123/app.bsky.feed.post/postkey456";
    assert.deepEqual(
      linkToPostFromUri(uri),
      "/profile/did:plc:alice123/post/postkey456",
    );
  });

  it("should handle different DIDs", () => {
    const uri = "at://did:web:example.com/app.bsky.feed.post/key";
    assert.deepEqual(
      linkToPostFromUri(uri),
      "/profile/did:web:example.com/post/key",
    );
  });
});

describe("linkToPostLikes", () => {
  it("should return correct likes link", () => {
    const post = {
      uri: "at://did:plc:alice/app.bsky.feed.post/abc123",
      author: { handle: "alice.bsky.social" },
    };
    assert.deepEqual(
      linkToPostLikes(post),
      "/profile/alice.bsky.social/post/abc123/likes",
    );
  });
});

describe("linkToPostQuotes", () => {
  it("should return correct quotes link", () => {
    const post = {
      uri: "at://did:plc:alice/app.bsky.feed.post/abc123",
      author: { handle: "alice.bsky.social" },
    };
    assert.deepEqual(
      linkToPostQuotes(post),
      "/profile/alice.bsky.social/post/abc123/quotes",
    );
  });
});

describe("linkToPostReposts", () => {
  it("should return correct reposts link", () => {
    const post = {
      uri: "at://did:plc:alice/app.bsky.feed.post/abc123",
      author: { handle: "alice.bsky.social" },
    };
    assert.deepEqual(
      linkToPostReposts(post),
      "/profile/alice.bsky.social/post/abc123/reposts",
    );
  });
});

describe("linkToProfileFollowers", () => {
  it("should return followers link from profile object", () => {
    const profile = { handle: "bob.bsky.social", did: "did:plc:bob" };
    assert.deepEqual(
      linkToProfileFollowers(profile),
      "/profile/bob.bsky.social/followers",
    );
  });

  it("falls back to did when handle is invalid", () => {
    const profile = { handle: "handle.invalid", did: "did:plc:bob" };
    assert.deepEqual(
      linkToProfileFollowers(profile),
      "/profile/did:plc:bob/followers",
    );
  });
});

describe("linkToProfileFollowing", () => {
  it("should return following link from profile object", () => {
    const profile = { handle: "bob.bsky.social", did: "did:plc:bob" };
    assert.deepEqual(
      linkToProfileFollowing(profile),
      "/profile/bob.bsky.social/following",
    );
  });

  it("falls back to did when handle is invalid", () => {
    const profile = { handle: "handle.invalid", did: "did:plc:bob" };
    assert.deepEqual(
      linkToProfileFollowing(profile),
      "/profile/did:plc:bob/following",
    );
  });
});

describe("linkToFeed", () => {
  it("should return correct feed link", () => {
    const feedGenerator = {
      uri: "at://did:plc:feedcreator/app.bsky.feed.generator/myfeed",
      creator: { handle: "feedcreator.bsky.social" },
    };
    assert.deepEqual(
      linkToFeed(feedGenerator),
      "/profile/feedcreator.bsky.social/feed/myfeed",
    );
  });

  it("should handle different feed rkeys", () => {
    const feedGenerator = {
      uri: "at://did:plc:alice/app.bsky.feed.generator/trending",
      creator: { handle: "alice.bsky.social" },
    };
    assert.deepEqual(
      linkToFeed(feedGenerator),
      "/profile/alice.bsky.social/feed/trending",
    );
  });
});

describe("path segment encoding", () => {
  it("should encode slashes in hashtags", () => {
    assert.deepEqual(linkToHashtag("test/tag"), "/hashtag/test%2Ftag");
  });

  it("should encode spaces in hashtags", () => {
    assert.deepEqual(linkToHashtag("hello world"), "/hashtag/hello%20world");
  });

  it("should preserve colons in DIDs", () => {
    assert.deepEqual(
      linkToProfileByDid("did:plc:abc123"),
      "/profile/did:plc:abc123",
    );
  });

  it("should preserve colons in DID-based post URIs", () => {
    const uri = "at://did:plc:alice123/app.bsky.feed.post/key456";
    assert.deepEqual(
      linkToPostFromUri(uri),
      "/profile/did:plc:alice123/post/key456",
    );
  });

  it("should preserve at signs in handles", () => {
    assert.deepEqual(
      linkToProfile({ handle: "@alice.bsky.social" }),
      "/profile/@alice.bsky.social",
    );
  });

  it("should encode question marks in path segments", () => {
    assert.deepEqual(linkToHashtag("test?q=1"), "/hashtag/test%3Fq%3D1");
  });

  it("should encode hash characters in path segments", () => {
    assert.deepEqual(linkToHashtag("test#tag"), "/hashtag/test%23tag");
  });

  it("should encode slashes in handles for post links", () => {
    const post = {
      uri: "at://did:plc:alice/app.bsky.feed.post/abc123",
      author: { handle: "alice/evil" },
    };
    assert.deepEqual(linkToPost(post), "/profile/alice%2Fevil/post/abc123");
  });

  it("should encode slashes in handles for followers links", () => {
    assert.deepEqual(
      linkToProfileFollowers({ handle: "alice/evil" }),
      "/profile/alice%2Fevil/followers",
    );
  });

  it("should encode slashes in handles for following links", () => {
    assert.deepEqual(
      linkToProfileFollowing({ handle: "alice/evil" }),
      "/profile/alice%2Fevil/following",
    );
  });
});

describe("getPermalinkForPost", () => {
  it("should return bsky.app permalink for post", () => {
    const post = {
      uri: "at://did:plc:alice/app.bsky.feed.post/abc123",
      author: { handle: "alice.bsky.social" },
    };
    assert.deepEqual(
      getPermalinkForPost(post),
      "https://bsky.app/profile/alice.bsky.social/post/abc123",
    );
  });
});

describe("getPermalinkForProfile", () => {
  it("should return bsky.app permalink for profile", () => {
    const profile = { handle: "alice.bsky.social", did: "did:plc:alice" };
    assert.deepEqual(
      getPermalinkForProfile(profile),
      "https://bsky.app/profile/alice.bsky.social",
    );
  });

  it("falls back to did when handle is invalid", () => {
    const profile = { handle: "handle.invalid", did: "did:plc:alice" };
    assert.deepEqual(
      getPermalinkForProfile(profile),
      "https://bsky.app/profile/did:plc:alice",
    );
  });
});

describe("linkToPluginSettings", () => {
  it("should return correct plugin settings link", () => {
    assert.deepEqual(
      linkToPluginSettings("remote-themes"),
      "/plugin/remote-themes/settings",
    );
  });

  it("should encode slashes in plugin ids", () => {
    assert.deepEqual(
      linkToPluginSettings("evil/plugin"),
      "/plugin/evil%2Fplugin/settings",
    );
  });
});

describe("linkToCommunityPlugin", () => {
  it("should return correct community plugin link", () => {
    assert.deepEqual(
      linkToCommunityPlugin("remote-themes"),
      "/plugins/community/remote-themes",
    );
  });

  it("should encode slashes in plugin ids", () => {
    assert.deepEqual(
      linkToCommunityPlugin("evil/plugin"),
      "/plugins/community/evil%2Fplugin",
    );
  });
});

describe("getPermalinkForCommunityPlugin", () => {
  it("should return impro.social permalink for community plugin", () => {
    assert.deepEqual(
      getPermalinkForCommunityPlugin("remote-themes"),
      "https://impro.social/plugins/community/remote-themes",
    );
  });
});

describe("validateReturnToParam", () => {
  it("accepts a simple path", () => {
    assert.deepEqual(validateReturnToParam("/bookmarks"), "/bookmarks");
  });

  it("accepts a path with query string and hash", () => {
    assert.deepEqual(
      validateReturnToParam("/profile/alice.bsky.social?tab=posts#top"),
      "/profile/alice.bsky.social?tab=posts#top",
    );
  });

  it("rejects null and undefined", () => {
    assert.deepEqual(validateReturnToParam(null), null);
    assert.deepEqual(validateReturnToParam(undefined), null);
  });

  it("rejects empty string", () => {
    assert.deepEqual(validateReturnToParam(""), null);
  });

  it("rejects non-strings", () => {
    assert.deepEqual(validateReturnToParam(42), null);
    assert.deepEqual(validateReturnToParam({}), null);
  });

  it("rejects paths that don't start with /", () => {
    assert.deepEqual(validateReturnToParam("bookmarks"), null);
    assert.deepEqual(validateReturnToParam("https://evil.com/phish"), null);
  });

  it("rejects protocol-relative URLs", () => {
    assert.deepEqual(validateReturnToParam("//evil.com"), null);
    assert.deepEqual(validateReturnToParam("//evil.com/path"), null);
  });

  it("rejects backslash tricks", () => {
    assert.deepEqual(validateReturnToParam("/\\evil.com"), null);
  });
});

describe("linkToLogin", () => {
  const originalPath =
    window.location.pathname + window.location.search + window.location.hash;

  const withPath = (path, fn) => {
    window.history.replaceState(null, "", path);
    try {
      fn();
    } finally {
      window.history.replaceState(null, "", originalPath);
    }
  };

  it("builds a /login url encoding the current location as returnTo", () => {
    withPath("/bookmarks", () => {
      assert.deepEqual(linkToLogin(), "/login?returnTo=%2Fbookmarks");
    });
  });

  it("skips returnTo when the current path is /login", () => {
    withPath("/login", () => assert.deepEqual(linkToLogin(), "/login"));
    withPath("/login?foo=bar", () => assert.deepEqual(linkToLogin(), "/login"));
    withPath("/login#hash", () => assert.deepEqual(linkToLogin(), "/login"));
  });

  it("skips returnTo when the current path is the home path", () => {
    withPath("/", () => assert.deepEqual(linkToLogin(), "/login"));
    withPath("/?foo=bar", () => assert.deepEqual(linkToLogin(), "/login"));
  });

  it("allows paths that start with /login but are a different route", () => {
    withPath("/login-help", () => {
      assert.deepEqual(linkToLogin(), "/login?returnTo=%2Flogin-help");
    });
  });

  it("encodes query string and hash in the path", () => {
    withPath("/profile/a?tab=posts#top", () => {
      assert.deepEqual(
        linkToLogin(),
        "/login?returnTo=%2Fprofile%2Fa%3Ftab%3Dposts%23top",
      );
    });
  });

  it("includes extra query params when provided", () => {
    withPath("/settings", () => {
      assert.deepEqual(
        linkToLogin({ query: { addAccount: 1 } }),
        "/login?addAccount=1&returnTo=%2Fsettings",
      );
    });
  });

  it("omits returnTo when called from /login", () => {
    withPath("/login", () => {
      assert.deepEqual(
        linkToLogin({ query: { addAccount: 1 } }),
        "/login?addAccount=1",
      );
    });
  });
});
