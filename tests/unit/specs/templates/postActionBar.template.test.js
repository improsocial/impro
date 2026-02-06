import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import { postActionBarTemplate } from "/js/templates/postActionBar.template.js";
import { post } from "../../fixtures.js";
import { render } from "/js/lib/lit-html.js";

const t = new TestSuite("postActionBarTemplate");

t.describe("postActionBarTemplate", (it) => {
  it("should render action bar with reply button", () => {
    const result = postActionBarTemplate({
      post,
      isAuthenticated: true,
      onClickLike: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='reply-button']") !== null);
  });

  it("should render action bar with repost button", () => {
    const result = postActionBarTemplate({
      post,
      isAuthenticated: true,
      onClickLike: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='repost-button']") !== null);
  });

  it("should render action bar with bookmark button", () => {
    const result = postActionBarTemplate({
      post,
      isAuthenticated: true,
      onClickLike: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    assert(container.querySelector("[data-testid='bookmark-button']") !== null);
  });

  it("should show reply count when post has replies", () => {
    const postWithReplies = {
      ...post,
      replyCount: 5,
    };
    const result = postActionBarTemplate({
      post: postWithReplies,
      isAuthenticated: true,
      onClickLike: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    const replyCount = container.querySelector("[data-testid='reply-count']");
    assert(replyCount !== null);
    assertEquals(replyCount.textContent.trim(), "5");
  });

  it("should not show reply count when post has no replies", () => {
    const postWithNoReplies = {
      ...post,
      replyCount: 0,
    };
    const result = postActionBarTemplate({
      post: postWithNoReplies,
      isAuthenticated: true,
      onClickLike: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    assertEquals(container.querySelector("[data-testid='reply-count']"), null);
  });

  it("should show repost count when post has reposts", () => {
    const postWithReposts = {
      ...post,
      repostCount: 10,
    };
    const result = postActionBarTemplate({
      post: postWithReposts,
      isAuthenticated: true,
      onClickLike: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    const repostCount = container.querySelector("[data-testid='repost-count']");
    assert(repostCount !== null);
    assertEquals(repostCount.textContent.trim(), "10");
  });

  it("should include quote posts in repost count", () => {
    const postWithRepostsAndQuotes = {
      ...post,
      repostCount: 5,
      quoteCount: 3,
    };
    const result = postActionBarTemplate({
      post: postWithRepostsAndQuotes,
      isAuthenticated: true,
      onClickLike: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    const repostCount = container.querySelector("[data-testid='repost-count']");
    assert(repostCount !== null);
    assertEquals(repostCount.textContent.trim(), "8");
  });

  it("should not show repost count when post has no reposts", () => {
    const postWithNoReposts = {
      ...post,
      repostCount: 0,
    };
    const result = postActionBarTemplate({
      post: postWithNoReposts,
      isAuthenticated: true,
      onClickLike: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    assertEquals(container.querySelector("[data-testid='repost-count']"), null);
  });

  it("should add reposted class when post is reposted", () => {
    const repostedPost = {
      ...post,
      viewer: { ...post.viewer, repost: "repost-uri" },
    };
    const result = postActionBarTemplate({
      post: repostedPost,
      isAuthenticated: true,
      onClickLike: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    const repostButton = container.querySelector(
      "[data-testid='repost-button']",
    );
    assert(repostButton.classList.contains("reposted"));
  });

  it("should not have reposted class when post is not reposted", () => {
    const notRepostedPost = {
      ...post,
      viewer: { ...post.viewer, repost: null },
    };
    const result = postActionBarTemplate({
      post: notRepostedPost,
      isAuthenticated: true,
      onClickLike: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    const repostButton = container.querySelector(
      "[data-testid='repost-button']",
    );
    assert(!repostButton.classList.contains("reposted"));
  });

  it("should add bookmarked class when post is bookmarked", () => {
    const bookmarkedPost = {
      ...post,
      viewer: { ...post.viewer, bookmarked: true },
    };
    const result = postActionBarTemplate({
      post: bookmarkedPost,
      isAuthenticated: true,
      onClickLike: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    const bookmarkButton = container.querySelector(
      "[data-testid='bookmark-button']",
    );
    assert(bookmarkButton.classList.contains("bookmarked"));
  });

  it("should not have bookmarked class when post is not bookmarked", () => {
    const notBookmarkedPost = {
      ...post,
      viewer: { ...post.viewer, bookmarked: false },
    };
    const result = postActionBarTemplate({
      post: notBookmarkedPost,
      isAuthenticated: true,
      onClickLike: () => {},
    });
    const container = document.createElement("div");
    render(result, container);
    const bookmarkButton = container.querySelector(
      "[data-testid='bookmark-button']",
    );
    assert(!bookmarkButton.classList.contains("bookmarked"));
  });
});

t.describe("postActionBarTemplate - callbacks", (it) => {
  it("should call onClickBookmark when bookmark button clicked", () => {
    let callArgs = null;
    const testPost = {
      ...post,
      viewer: { ...post.viewer, bookmarked: false },
    };
    const onClickBookmark = (p, doBookmark) => {
      callArgs = { post: p, doBookmark };
    };
    const result = postActionBarTemplate({
      post: testPost,
      isAuthenticated: true,
      onClickBookmark,
    });
    const container = document.createElement("div");
    render(result, container);
    const bookmarkButton = container.querySelector(
      "[data-testid='bookmark-button']",
    );
    bookmarkButton.click();
    assert(callArgs !== null);
    assertEquals(callArgs.doBookmark, true);
  });

  it("should call onClickBookmark with false when unbookmarking", () => {
    let callArgs = null;
    const testPost = {
      ...post,
      viewer: { ...post.viewer, bookmarked: true },
    };
    const onClickBookmark = (p, doBookmark) => {
      callArgs = { post: p, doBookmark };
    };
    const result = postActionBarTemplate({
      post: testPost,
      isAuthenticated: true,
      onClickBookmark,
    });
    const container = document.createElement("div");
    render(result, container);
    const bookmarkButton = container.querySelector(
      "[data-testid='bookmark-button']",
    );
    bookmarkButton.click();
    assert(callArgs !== null);
    assertEquals(callArgs.doBookmark, false);
  });
});

await t.run();
