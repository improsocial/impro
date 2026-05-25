import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import {
  hydratePostForView,
  markMutedWords,
  markIsHidden,
  addLabels,
  resolveBlockedQuote,
} from "/js/dataLayer/derived.js";

const t = new TestSuite("Derived");

function emptyPrefs(overrides = {}) {
  return {
    postHasMutedWord: () => false,
    quotedPostHasMutedWord: () => false,
    isPostHidden: () => false,
    getBadgeLabels: () => [],
    getContentLabel: () => null,
    getMediaLabel: () => null,
    ...overrides,
  };
}

function makePost(extra = {}) {
  return {
    uri: "at://did:test/app.bsky.feed.post/x",
    record: { text: "hello" },
    ...extra,
  };
}

t.describe("markMutedWords", (it) => {
  it("marks the post when it contains a muted word", () => {
    const post = makePost();
    const result = markMutedWords(
      post,
      emptyPrefs({ postHasMutedWord: () => true }),
    );
    assertEquals(result.viewer.hasMutedWord, true);
  });

  it("does not touch the post when there is no match", () => {
    const post = makePost();
    const result = markMutedWords(post, emptyPrefs());
    assertEquals(result.viewer, undefined);
  });
});

t.describe("markIsHidden", (it) => {
  it("marks the post hidden when preferences say so", () => {
    const post = makePost();
    const result = markIsHidden(post, emptyPrefs({ isPostHidden: () => true }));
    assertEquals(result.viewer.isHidden, true);
  });
});

t.describe("addLabels", (it) => {
  it("attaches badge, content, and media labels from preferences", () => {
    const post = makePost();
    const result = addLabels(
      post,
      emptyPrefs({
        getBadgeLabels: () => ["badge"],
        getContentLabel: () => "warn",
        getMediaLabel: () => "blur",
      }),
    );
    assertEquals(result.badgeLabels, ["badge"]);
    assertEquals(result.contentLabel, "warn");
    assertEquals(result.mediaLabel, "blur");
  });

  it("leaves the post untouched when no labels apply", () => {
    const post = makePost();
    const result = addLabels(post, emptyPrefs());
    assertEquals(result.badgeLabels, undefined);
    assertEquals(result.contentLabel, undefined);
    assertEquals(result.mediaLabel, undefined);
  });
});

t.describe("resolveBlockedQuote", (it) => {
  it("returns the post unchanged when there is no blocked quote", () => {
    const post = makePost();
    const result = resolveBlockedQuote(post, { getPost: () => null });
    assertEquals(result, post);
  });
});

t.describe("hydratePostForView", (it) => {
  it("returns null when given null", () => {
    const result = hydratePostForView(null, {
      preferences: emptyPrefs(),
      getPost: () => null,
    });
    assertEquals(result, null);
  });

  it("composes muted/hidden/label marks against the post", () => {
    const post = makePost();
    const result = hydratePostForView(post, {
      preferences: emptyPrefs({
        postHasMutedWord: () => true,
        isPostHidden: () => true,
        getBadgeLabels: () => ["b"],
      }),
      getPost: () => null,
    });
    assertEquals(result.viewer.hasMutedWord, true);
    assertEquals(result.viewer.isHidden, true);
    assertEquals(result.badgeLabels, ["b"]);
  });
});

await t.run();
