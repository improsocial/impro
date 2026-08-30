import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { WhoCanReplyModal } from "/js/modals/whoCanReply.modal.js";

describe("WhoCanReplyModal", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  const everybodyPost = { author: { handle: "alice.test" } };
  const nobodyPost = {
    author: { handle: "alice.test" },
    threadgate: { record: { allow: [] } },
  };
  const followersPost = {
    author: { handle: "alice.test" },
    threadgate: {
      record: {
        allow: [{ $type: "app.bsky.feed.threadgate#followerRule" }],
      },
    },
  };
  const mentionAndFollowingPost = {
    author: { handle: "alice.test" },
    threadgate: {
      record: {
        allow: [
          { $type: "app.bsky.feed.threadgate#mentionRule" },
          { $type: "app.bsky.feed.threadgate#followingRule" },
        ],
      },
    },
  };

  const findDialog = () =>
    document.querySelector('[data-testid="who-can-reply-modal"]');

  it("should create a dialog with the who-can-reply testid", () => {
    WhoCanReplyModal.open({ post: everybodyPost });
    const dialog = findDialog();
    assert(dialog !== null);
    assert(dialog.hasAttribute("open"));
  });

  it("should render the title", () => {
    WhoCanReplyModal.open({ post: everybodyPost });
    const title = document.querySelector('[data-testid="modal-title"]');
    assert(title !== null);
  });

  it("should render everybody message when no threadgate", () => {
    WhoCanReplyModal.open({ post: everybodyPost });
    const body = document.querySelector(".who-can-reply-body");
    assert(body.textContent.includes("Everybody can reply to this post."));
  });

  it("should render nobody message when allow is empty", () => {
    WhoCanReplyModal.open({ post: nobodyPost });
    const body = document.querySelector(".who-can-reply-body");
    assert(body.textContent.includes("Replies to this post are disabled."));
  });

  it("should render followers rule", () => {
    WhoCanReplyModal.open({ post: followersPost });
    const body = document.querySelector(".who-can-reply-body");
    assert(body.textContent.includes("Only"));
    assert(body.textContent.includes("users following"));
    assert(body.textContent.includes("@alice.test"));
    assert(body.textContent.includes("can reply."));
  });

  it("should join multiple rules with 'and'", () => {
    WhoCanReplyModal.open({ post: mentionAndFollowingPost });
    const body = document.querySelector(".who-can-reply-body");
    assert(body.textContent.includes("mentioned users"));
    assert(body.textContent.includes(", and "));
    assert(body.textContent.includes("users followed by"));
  });

  it("should not show quote message when embedding is enabled", () => {
    WhoCanReplyModal.open({ post: everybodyPost });
    const body = document.querySelector(".who-can-reply-body");
    assert(!body.textContent.includes("quote this post"));
  });

  it("should show quote message when embedding is disabled", () => {
    WhoCanReplyModal.open({
      post: { ...everybodyPost, viewer: { embeddingDisabled: true } },
    });
    const body = document.querySelector(".who-can-reply-body");
    assert(
      body.textContent.includes("No one but the author can quote this post."),
    );
  });

  it("should close and remove on primary button click", () => {
    WhoCanReplyModal.open({ post: everybodyPost });
    const button = document.querySelector(
      '[data-testid="modal-primary-button"]',
    );
    button.click();
    assert(findDialog() === null);
  });

  it("should close and remove on backdrop click", () => {
    WhoCanReplyModal.open({ post: everybodyPost });
    const dialog = findDialog();
    dialog.dispatchEvent(new Event("click", { bubbles: true }));
    assert(findDialog() === null);
  });

  it("should close and remove on cancel event", () => {
    WhoCanReplyModal.open({ post: everybodyPost });
    const dialog = findDialog();
    const cancelEvent = new Event("cancel");
    cancelEvent.preventDefault = () => {};
    dialog.dispatchEvent(cancelEvent);
    assert(findDialog() === null);
  });
});
