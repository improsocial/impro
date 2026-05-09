import { TestSuite } from "../testSuite.js";
import { assert, assertEquals, mock } from "../testHelpers.js";
import {
  showSignInModal,
  showInfoModal,
  confirm,
  showWhoCanReplyModal,
  showPluginModal,
  hidePluginModal,
} from "/js/modals.js";

const t = new TestSuite("Modals");

function clearDOM() {
  document.body.innerHTML = "";
}

t.describe("showSignInModal", (it) => {
  it("should create a dialog and open it", () => {
    clearDOM();
    showSignInModal();
    const dialog = document.querySelector("dialog");
    assert(dialog !== null);
    assert(dialog.hasAttribute("open"));
    assert(dialog.classList.contains("modal-dialog"));
    assert(dialog.classList.contains("compact"));
  });

  it("should render sign in content", () => {
    clearDOM();
    showSignInModal();
    const title = document.querySelector(".modal-dialog-title");
    assertEquals(title.textContent, "Sign in");
    const message = document.querySelector(".modal-dialog-message");
    assertEquals(message.textContent, "Sign in to join the conversation!");
    const link = document.querySelector("a.primary-button");
    assert(link !== null);
    assert(link.getAttribute("href").startsWith("/login"));
    assertEquals(link.textContent.trim(), "Sign in");
  });

  it("should close and remove on backdrop click", () => {
    clearDOM();
    showSignInModal();
    const dialog = document.querySelector("dialog");
    dialog.dispatchEvent(new Event("click", { bubbles: true }));
    assert(document.querySelector("dialog") === null);
  });

  it("should close and remove on link click", () => {
    clearDOM();
    showSignInModal();
    const link = document.querySelector("a.primary-button");
    link.click();
    assert(document.querySelector("dialog") === null);
  });
});

// showInfoModal and confirm create fresh dialogs each time, so we can
// safely clear the DOM between tests.

t.describe("showInfoModal", (it) => {
  it("should create a dialog with info-modal class", () => {
    clearDOM();
    showInfoModal({ title: "Info", message: "Hello" });
    const dialog = document.querySelector("dialog.info-modal");
    assert(dialog !== null);
  });

  it("should render the provided title", () => {
    clearDOM();
    showInfoModal({ title: "My Title", message: "Some message" });
    const title = document.querySelector(".modal-dialog-title");
    assertEquals(title.textContent, "My Title");
  });

  it("should render the provided message", () => {
    clearDOM();
    showInfoModal({ title: "Title", message: "Custom message" });
    const message = document.querySelector(".modal-dialog-message");
    assertEquals(message.textContent, "Custom message");
  });

  it("should use OK as default button text", () => {
    clearDOM();
    showInfoModal({ title: "Title", message: "Msg" });
    const button = document.querySelector(".primary-button");
    assertEquals(button.textContent.trim(), "OK");
  });

  it("should use custom button text when provided", () => {
    clearDOM();
    showInfoModal({ title: "T", message: "M", confirmButtonText: "Got it" });
    const button = document.querySelector(".primary-button");
    assertEquals(button.textContent.trim(), "Got it");
  });

  it("should open the dialog", () => {
    clearDOM();
    showInfoModal({ title: "T", message: "M" });
    const dialog = document.querySelector("dialog");
    assert(dialog.hasAttribute("open"));
  });

  it("should close and remove on button click", () => {
    clearDOM();
    showInfoModal({ title: "T", message: "M" });
    const button = document.querySelector(".primary-button");
    button.click();
    assert(document.querySelector("dialog") === null);
  });

  it("should close and remove on backdrop click", () => {
    clearDOM();
    showInfoModal({ title: "T", message: "M" });
    const dialog = document.querySelector("dialog");
    dialog.dispatchEvent(new Event("click", { bubbles: true }));
    assert(document.querySelector("dialog") === null);
  });

  it("should close and remove on cancel event", () => {
    clearDOM();
    showInfoModal({ title: "T", message: "M" });
    const dialog = document.querySelector("dialog");
    const cancelEvent = new Event("cancel");
    cancelEvent.preventDefault = () => {};
    dialog.dispatchEvent(cancelEvent);
    assert(document.querySelector("dialog") === null);
  });
});

t.describe("confirm", (it) => {
  it("should create a dialog in the DOM", () => {
    clearDOM();
    confirm("Are you sure?");
    const dialog = document.querySelector("dialog.modal-dialog");
    assert(dialog !== null);
  });

  it("should render the message", () => {
    clearDOM();
    confirm("Delete this?");
    const message = document.querySelector(".modal-dialog-message");
    assertEquals(message.textContent, "Delete this?");
  });

  it("should render cancel and confirm buttons", () => {
    clearDOM();
    confirm("Sure?");
    const cancelButton = document.querySelector(".cancel-button");
    const confirmButton = document.querySelector(".confirm-button");
    assert(cancelButton !== null);
    assert(confirmButton !== null);
    assertEquals(cancelButton.textContent.trim(), "Cancel");
    assertEquals(confirmButton.textContent.trim(), "Confirm");
  });

  it("should use custom confirm button text", () => {
    clearDOM();
    confirm("Sure?", { confirmButtonText: "Delete" });
    const confirmButton = document.querySelector(".confirm-button");
    assertEquals(confirmButton.textContent.trim(), "Delete");
  });

  it("should apply custom confirm button style", () => {
    clearDOM();
    confirm("Sure?", { confirmButtonStyle: "danger" });
    const confirmButton = document.querySelector(".confirm-button");
    assert(confirmButton.classList.contains("danger-button"));
  });

  it("should apply primary button style by default", () => {
    clearDOM();
    confirm("Sure?");
    const confirmButton = document.querySelector(".confirm-button");
    assert(confirmButton.classList.contains("primary-button"));
  });

  it("should render title when provided", () => {
    clearDOM();
    confirm("Body text", { title: "Warning" });
    const title = document.querySelector(".modal-dialog-title");
    assert(title !== null);
    assertEquals(title.textContent, "Warning");
  });

  it("should not render title when not provided", () => {
    clearDOM();
    confirm("Body text");
    const title = document.querySelector(".modal-dialog-title");
    assert(title === null);
  });

  it("should open the dialog", () => {
    clearDOM();
    confirm("Sure?");
    const dialog = document.querySelector("dialog");
    assert(dialog.hasAttribute("open"));
  });

  it("should resolve true when confirm is clicked", async () => {
    clearDOM();
    const result = confirm("Sure?");
    document.querySelector(".confirm-button").click();
    assertEquals(await result, true);
  });

  it("should resolve false when cancel is clicked", async () => {
    clearDOM();
    const result = confirm("Sure?");
    document.querySelector(".cancel-button").click();
    assertEquals(await result, false);
  });

  it("should resolve false on backdrop click", async () => {
    clearDOM();
    const result = confirm("Sure?");
    const dialog = document.querySelector("dialog");
    dialog.dispatchEvent(new Event("click", { bubbles: true }));
    assertEquals(await result, false);
  });

  it("should resolve false on cancel event", async () => {
    clearDOM();
    const result = confirm("Sure?");
    const dialog = document.querySelector("dialog");
    const cancelEvent = new Event("cancel");
    cancelEvent.preventDefault = () => {};
    dialog.dispatchEvent(cancelEvent);
    assertEquals(await result, false);
  });

  it("should remove dialog from DOM after confirm", async () => {
    clearDOM();
    const result = confirm("Sure?");
    document.querySelector(".confirm-button").click();
    await result;
    assert(document.querySelector("dialog") === null);
  });

  it("should remove dialog from DOM after cancel", async () => {
    clearDOM();
    const result = confirm("Sure?");
    document.querySelector(".cancel-button").click();
    await result;
    assert(document.querySelector("dialog") === null);
  });
});

t.describe("showWhoCanReplyModal", (it) => {
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

  it("should create a dialog with the who-can-reply testid", () => {
    clearDOM();
    showWhoCanReplyModal({ post: everybodyPost });
    const dialog = document.querySelector("dialog");
    assert(dialog !== null);
    assertEquals(dialog.dataset.testid, "who-can-reply-modal");
    assert(dialog.classList.contains("info-modal"));
    assert(dialog.hasAttribute("open"));
  });

  it("should render the title", () => {
    clearDOM();
    showWhoCanReplyModal({ post: everybodyPost });
    const title = document.querySelector(".modal-dialog-title");
    assertEquals(title.textContent, "Who can interact with this post?");
  });

  it("should render everybody message when no threadgate", () => {
    clearDOM();
    showWhoCanReplyModal({ post: everybodyPost });
    const body = document.querySelector(".who-can-reply-body");
    assert(body.textContent.includes("Everybody can reply to this post."));
  });

  it("should render nobody message when allow is empty", () => {
    clearDOM();
    showWhoCanReplyModal({ post: nobodyPost });
    const body = document.querySelector(".who-can-reply-body");
    assert(body.textContent.includes("Replies to this post are disabled."));
  });

  it("should render followers rule", () => {
    clearDOM();
    showWhoCanReplyModal({ post: followersPost });
    const body = document.querySelector(".who-can-reply-body");
    assert(body.textContent.includes("Only"));
    assert(body.textContent.includes("users following"));
    assert(body.textContent.includes("@alice.test"));
    assert(body.textContent.includes("can reply."));
  });

  it("should join multiple rules with 'and'", () => {
    clearDOM();
    showWhoCanReplyModal({ post: mentionAndFollowingPost });
    const body = document.querySelector(".who-can-reply-body");
    assert(body.textContent.includes("mentioned users"));
    assert(body.textContent.includes(", and "));
    assert(body.textContent.includes("users followed by"));
  });

  it("should not show quote message when embedding is enabled", () => {
    clearDOM();
    showWhoCanReplyModal({ post: everybodyPost });
    const body = document.querySelector(".who-can-reply-body");
    assert(!body.textContent.includes("quote this post"));
  });

  it("should show quote message when embedding is disabled", () => {
    clearDOM();
    showWhoCanReplyModal({
      post: { ...everybodyPost, viewer: { embeddingDisabled: true } },
    });
    const body = document.querySelector(".who-can-reply-body");
    assert(
      body.textContent.includes("No one but the author can quote this post."),
    );
  });

  it("should close and remove on OK button click", () => {
    clearDOM();
    showWhoCanReplyModal({ post: everybodyPost });
    const button = document.querySelector(".primary-button");
    assertEquals(button.textContent.trim(), "OK");
    button.click();
    assert(document.querySelector("dialog") === null);
  });

  it("should close and remove on backdrop click", () => {
    clearDOM();
    showWhoCanReplyModal({ post: everybodyPost });
    const dialog = document.querySelector("dialog");
    dialog.dispatchEvent(new Event("click", { bubbles: true }));
    assert(document.querySelector("dialog") === null);
  });

  it("should close and remove on cancel event", () => {
    clearDOM();
    showWhoCanReplyModal({ post: everybodyPost });
    const dialog = document.querySelector("dialog");
    const cancelEvent = new Event("cancel");
    cancelEvent.preventDefault = () => {};
    dialog.dispatchEvent(cancelEvent);
    assert(document.querySelector("dialog") === null);
  });
});

let pluginModalCounter = 0;
function uniqueModalId(prefix) {
  pluginModalCounter += 1;
  return `${prefix}-${pluginModalCounter}`;
}

t.describe("showPluginModal", (it) => {
  it("should create a dialog with plugin-modal class and pluginId dataset", () => {
    clearDOM();
    showPluginModal({
      pluginId: "test.plugin",
      modalId: uniqueModalId("create"),
      title: { tag: "span", text: "Hello" },
      content: { tag: "div", text: "Body" },
    });
    const dialog = document.querySelector("dialog.plugin-modal");
    assert(dialog !== null);
    assertEquals(dialog.dataset.pluginId, "test.plugin");
    assert(dialog.classList.contains("modal-dialog"));
    assert(dialog.hasAttribute("open"));
  });

  it("should render the title with the modal-dialog-title class", () => {
    clearDOM();
    showPluginModal({
      pluginId: "p",
      modalId: uniqueModalId("title"),
      title: { tag: "span", text: "My Title" },
      content: { tag: "div", text: "Body" },
    });
    const title = document.querySelector(".modal-dialog-title");
    assert(title !== null);
    assertEquals(title.textContent, "My Title");
  });

  it("should skip the title when it is empty", () => {
    clearDOM();
    showPluginModal({
      pluginId: "p",
      modalId: uniqueModalId("no-title"),
      title: { tag: "span", text: "" },
      content: { tag: "div", text: "Body only" },
    });
    const title = document.querySelector(".modal-dialog-title");
    assert(title === null);
  });

  it("should render content children when content has children", () => {
    clearDOM();
    showPluginModal({
      pluginId: "p",
      modalId: uniqueModalId("children"),
      title: { tag: "span", text: "T" },
      content: {
        tag: "div",
        children: [
          { tag: "p", text: "First" },
          { tag: "p", text: "Second" },
        ],
      },
    });
    const paragraphs = document.querySelectorAll(".modal-dialog-content > p");
    assertEquals(paragraphs.length, 2);
    assertEquals(paragraphs[0].textContent, "First");
    assertEquals(paragraphs[1].textContent, "Second");
  });

  it("should render the content node directly when it has no children", () => {
    clearDOM();
    showPluginModal({
      pluginId: "p",
      modalId: uniqueModalId("single"),
      title: { tag: "span", text: "T" },
      content: { tag: "p", text: "Single body" },
    });
    const body = document.querySelector(".modal-dialog-content > p");
    assert(body !== null);
    assertEquals(body.textContent, "Single body");
  });

  it("should reuse the existing dialog and replace its content on a second call", () => {
    clearDOM();
    const pluginId = "reuse.plugin";
    const modalId = uniqueModalId("reuse");
    showPluginModal({
      pluginId,
      modalId,
      title: { tag: "span", text: "First Title" },
      content: { tag: "p", text: "First body" },
    });
    hidePluginModal({ pluginId, modalId });
    showPluginModal({
      pluginId,
      modalId,
      title: { tag: "span", text: "Second Title" },
      content: { tag: "p", text: "Second body" },
    });
    const dialogs = document.querySelectorAll("dialog.plugin-modal");
    assertEquals(dialogs.length, 1);
    const title = document.querySelector(".modal-dialog-title");
    assertEquals(title.textContent, "Second Title");
    const body = document.querySelector(".modal-dialog-content > p");
    assertEquals(body.textContent, "Second body");
    assert(dialogs[0].hasAttribute("open"));
  });

  it("should be a no-op when called with the same key while already open", () => {
    clearDOM();
    const pluginId = "noop.plugin";
    const modalId = uniqueModalId("noop");
    showPluginModal({
      pluginId,
      modalId,
      title: { tag: "span", text: "Original" },
      content: { tag: "p", text: "Original body" },
    });
    showPluginModal({
      pluginId,
      modalId,
      title: { tag: "span", text: "Replaced" },
      content: { tag: "p", text: "Replaced body" },
    });
    const title = document.querySelector(".modal-dialog-title");
    assertEquals(title.textContent, "Original");
    hidePluginModal({ pluginId, modalId });
  });

  it("should invoke onDismiss when dismissed via backdrop click", () => {
    clearDOM();
    const onDismiss = mock();
    showPluginModal({
      pluginId: "backdrop.plugin",
      modalId: uniqueModalId("backdrop"),
      title: { tag: "span", text: "T" },
      content: { tag: "p", text: "B" },
      onDismiss,
    });
    const dialog = document.querySelector("dialog.plugin-modal");
    dialog.dispatchEvent(new Event("click", { bubbles: true }));
    assert(!dialog.hasAttribute("open"));
    assertEquals(onDismiss.calls.length, 1);
  });

  it("should invoke onDismiss when dismissed via cancel event", () => {
    clearDOM();
    const onDismiss = mock();
    showPluginModal({
      pluginId: "cancel.plugin",
      modalId: uniqueModalId("cancel"),
      title: { tag: "span", text: "T" },
      content: { tag: "p", text: "B" },
      onDismiss,
    });
    const dialog = document.querySelector("dialog.plugin-modal");
    const cancelEvent = new Event("cancel");
    cancelEvent.preventDefault = () => {};
    dialog.dispatchEvent(cancelEvent);
    assert(!dialog.hasAttribute("open"));
    assertEquals(onDismiss.calls.length, 1);
  });

  it("should not require an onDismiss callback", () => {
    clearDOM();
    showPluginModal({
      pluginId: "no-cb.plugin",
      modalId: uniqueModalId("no-cb"),
      title: { tag: "span", text: "T" },
      content: { tag: "p", text: "B" },
    });
    const dialog = document.querySelector("dialog.plugin-modal");
    dialog.dispatchEvent(new Event("click", { bubbles: true }));
    assert(!dialog.hasAttribute("open"));
  });

  it("should isolate modals by pluginId/modalId key", () => {
    clearDOM();
    const modalIdA = uniqueModalId("isoA");
    const modalIdB = uniqueModalId("isoB");
    showPluginModal({
      pluginId: "iso.plugin",
      modalId: modalIdA,
      title: { tag: "span", text: "A" },
      content: { tag: "p", text: "A body" },
    });
    showPluginModal({
      pluginId: "iso.plugin",
      modalId: modalIdB,
      title: { tag: "span", text: "B" },
      content: { tag: "p", text: "B body" },
    });
    const dialogs = document.querySelectorAll("dialog.plugin-modal");
    assertEquals(dialogs.length, 2);
    hidePluginModal({ pluginId: "iso.plugin", modalId: modalIdA });
    hidePluginModal({ pluginId: "iso.plugin", modalId: modalIdB });
  });
});

t.describe("hidePluginModal", (it) => {
  it("should close the dialog without invoking onDismiss", () => {
    clearDOM();
    const onDismiss = mock();
    const pluginId = "hide.plugin";
    const modalId = uniqueModalId("hide");
    showPluginModal({
      pluginId,
      modalId,
      title: { tag: "span", text: "T" },
      content: { tag: "p", text: "B" },
      onDismiss,
    });
    const dialog = document.querySelector("dialog.plugin-modal");
    assert(dialog.hasAttribute("open"));
    hidePluginModal({ pluginId, modalId });
    assert(!dialog.hasAttribute("open"));
    assertEquals(onDismiss.calls.length, 0);
  });

  it("should be a no-op when no modal exists for the key", () => {
    clearDOM();
    hidePluginModal({ pluginId: "missing.plugin", modalId: "missing-modal" });
    assert(document.querySelector("dialog") === null);
  });

  it("should be a no-op when the modal is already closed", () => {
    clearDOM();
    const onDismiss = mock();
    const pluginId = "double-hide.plugin";
    const modalId = uniqueModalId("double-hide");
    showPluginModal({
      pluginId,
      modalId,
      title: { tag: "span", text: "T" },
      content: { tag: "p", text: "B" },
      onDismiss,
    });
    hidePluginModal({ pluginId, modalId });
    hidePluginModal({ pluginId, modalId });
    assertEquals(onDismiss.calls.length, 0);
  });
});

await t.run();
