import { TestSuite } from "../../testSuite.js";
import { assert, assertEquals } from "../../testHelpers.js";
import "/js/components/post-composer.js";

const t = new TestSuite("PostComposer");

t.beforeEach(() => {
  document.body.innerHTML = "";
});

function connectElement(element) {
  const container = document.createElement("div");
  container.className = "page-visible";
  container.appendChild(element);
  document.body.appendChild(container);
}

function createPostComposer() {
  const element = document.createElement("post-composer");
  element.currentUser = {
    did: "did:plc:test",
    handle: "test.bsky.social",
    displayName: "Test User",
    avatar: null,
  };
  return element;
}

t.describe("PostComposer - rendering", (it) => {
  it("should render dialog element", () => {
    const element = createPostComposer();
    connectElement(element);
    const dialog = element.querySelector(".post-composer");
    assert(dialog !== null);
    assertEquals(dialog.tagName, "DIALOG");
  });

  it("should render cancel button", () => {
    const element = createPostComposer();
    connectElement(element);
    const cancelButton = element.querySelector(".post-composer-cancel-button");
    assert(cancelButton !== null);
    assertEquals(cancelButton.textContent.trim(), "Cancel");
  });

  it("should render post button", () => {
    const element = createPostComposer();
    connectElement(element);
    const postButton = element.querySelector(".rounded-button-primary");
    assert(postButton !== null);
  });

  it("should render rich-text-input", () => {
    const element = createPostComposer();
    connectElement(element);
    const richTextInput = element.querySelector("rich-text-input");
    assert(richTextInput !== null);
  });

  it("should render image picker button", () => {
    const element = createPostComposer();
    connectElement(element);
    const imageButton = element.querySelector(".image-picker-button");
    assert(imageButton !== null);
  });

  it("should render character count", () => {
    const element = createPostComposer();
    connectElement(element);
    const wordCount = element.querySelector(".word-count-text");
    assert(wordCount !== null);
    assertEquals(wordCount.textContent, "300");
  });
});

t.describe("PostComposer - placeholder text", (it) => {
  it("should show 'What's up?' for new posts", () => {
    const element = createPostComposer();
    connectElement(element);
    const richTextInput = element.querySelector("rich-text-input");
    assertEquals(richTextInput.getAttribute("placeholder"), "What's up?");
  });

  it("should show 'Write your reply' for replies", () => {
    const element = createPostComposer();
    element.replyTo = {
      author: { handle: "user.bsky.social", displayName: "User" },
      record: { text: "Original post", createdAt: new Date().toISOString() },
    };
    connectElement(element);
    const richTextInput = element.querySelector("rich-text-input");
    assertEquals(richTextInput.getAttribute("placeholder"), "Write your reply");
  });
});

t.describe("PostComposer - button text", (it) => {
  it("should show 'Post' for new posts", () => {
    const element = createPostComposer();
    connectElement(element);
    const postButton = element.querySelector(".rounded-button-primary");
    assert(postButton.textContent.includes("Post"));
  });

  it("should show 'Reply' for replies", () => {
    const element = createPostComposer();
    element.replyTo = {
      author: { handle: "user.bsky.social", displayName: "User" },
      record: { text: "Original post", createdAt: new Date().toISOString() },
    };
    connectElement(element);
    const postButton = element.querySelector(".rounded-button-primary");
    assert(postButton.textContent.includes("Reply"));
  });
});

t.describe("PostComposer - initial state", (it) => {
  it("should start with empty post text", () => {
    const element = createPostComposer();
    connectElement(element);
    assertEquals(element._postText, "");
  });

  it("should not be sending initially", () => {
    const element = createPostComposer();
    connectElement(element);
    assertEquals(element._isSending, false);
  });

  it("should have no selected images initially", () => {
    const element = createPostComposer();
    connectElement(element);
    assertEquals(element._selectedImages.length, 0);
  });
});

t.describe("PostComposer - character limit", (it) => {
  it("should show 300 remaining characters initially", () => {
    const element = createPostComposer();
    connectElement(element);
    const wordCount = element.querySelector(".word-count-text");
    assertEquals(wordCount.textContent, "300");
  });

  it("should add overflow class when over limit", () => {
    const element = createPostComposer();
    connectElement(element);
    element._postText = "x".repeat(301);
    element.render();
    const wordCountContainer = element.querySelector(".word-count");
    assert(wordCountContainer.classList.contains("overflow"));
  });

  it("should disable post button when over limit", () => {
    const element = createPostComposer();
    connectElement(element);
    element._postText = "x".repeat(301);
    element.render();
    const postButton = element.querySelector(".rounded-button-primary");
    assert(postButton.disabled);
  });
});

t.describe("PostComposer - open method", (it) => {
  it("should show the dialog when open() is called", () => {
    const element = createPostComposer();
    connectElement(element);
    element.open();
    const dialog = element.querySelector(".post-composer");
    assert(dialog.open);
  });
});

t.describe("PostComposer - close method", (it) => {
  it("should close the dialog when close() is called", () => {
    const element = createPostComposer();
    connectElement(element);
    element.open();
    element.close();
    const dialog = element.querySelector(".post-composer");
    assert(!dialog.open);
  });

  it("should dispatch post-composer-closed event when close() is called", () => {
    const element = createPostComposer();
    connectElement(element);
    element.open();

    let eventFired = false;
    element.addEventListener("post-composer-closed", () => {
      eventFired = true;
    });

    element.close();
    assert(eventFired);
  });
});

t.describe("PostComposer - send method", (it) => {
  it("should set _isSending to true when send() is called", () => {
    const element = createPostComposer();
    connectElement(element);
    element._postText = "Hello world";

    // Listen for the event but don't do anything
    element.addEventListener("send-post", () => {});

    element.send();
    assertEquals(element._isSending, true);
  });

  it("should dispatch send-post event with post data", () => {
    const element = createPostComposer();
    connectElement(element);
    element._postText = "Hello world";

    let receivedDetail = null;
    element.addEventListener("send-post", (e) => {
      receivedDetail = e.detail;
    });

    element.send();
    assertEquals(receivedDetail.postText, "Hello world");
  });

  it("should show loading spinner when sending", () => {
    const element = createPostComposer();
    connectElement(element);
    element._isSending = true;
    element.render();
    const spinner = element.querySelector(".loading-spinner");
    assert(spinner !== null);
  });

  it("should disable post button when sending", () => {
    const element = createPostComposer();
    connectElement(element);
    element._isSending = true;
    element.render();
    const postButton = element.querySelector(".rounded-button-primary");
    assert(postButton.disabled);
  });
});

t.describe("PostComposer - image selection", (it) => {
  it("should have file input for images", () => {
    const element = createPostComposer();
    connectElement(element);
    const input = element.querySelector('input[type="file"]');
    assert(input !== null);
    assertEquals(input.accept, "image/*");
    assert(input.multiple);
  });

  it("should disable image button when 4 images are selected", () => {
    const element = createPostComposer();
    connectElement(element);
    element._selectedImages = [
      { file: {}, dataUrl: "data:..." },
      { file: {}, dataUrl: "data:..." },
      { file: {}, dataUrl: "data:..." },
      { file: {}, dataUrl: "data:..." },
    ];
    element.render();
    const imageButton = element.querySelector(".image-picker-button");
    assert(imageButton.disabled);
  });
});

t.describe("PostComposer - confirmClose", (it) => {
  it("should return true when post text is empty", async () => {
    const element = createPostComposer();
    connectElement(element);
    element._postText = "";
    const result = await element.confirmClose();
    assertEquals(result, true);
  });
});

t.describe("PostComposer - reinitialization protection", (it) => {
  it("should not reinitialize when connectedCallback is called multiple times", () => {
    const element = createPostComposer();
    connectElement(element);
    element._postText = "Test content";

    element.connectedCallback();

    assertEquals(element._postText, "Test content");
  });
});

await t.run();
