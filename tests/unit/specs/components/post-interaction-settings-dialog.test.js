import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { makeTestDataLayer } from "../../testHelpers.js";
import "/js/components/post-interaction-settings-dialog.js";

describe("post-interaction-settings-dialog", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  async function flushRender() {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  const userDid = "did:plc:me";
  const postUri = `at://${userDid}/app.bsky.feed.post/abc`;

  const curateList = {
    uri: `at://${userDid}/app.bsky.graph.list/l1`,
    name: "Cool people",
    purpose: "app.bsky.graph.defs#curatelist",
  };
  const modList = {
    uri: `at://${userDid}/app.bsky.graph.list/l2`,
    name: "Mods",
    purpose: "app.bsky.graph.defs#modlist",
  };

  function makeDataLayer({ lists = [curateList, modList] } = {}) {
    const dataLayer = makeTestDataLayer();
    dataLayer.dataStore.$currentUser.set({ did: userDid, handle: "me.test" });
    dataLayer.dataStore.$actorLists.set(userDid, { lists, cursor: "" });
    return dataLayer;
  }

  function makePost({ allow, lists = [] } = {}) {
    const post = { uri: postUri, author: { did: userDid } };
    if (allow !== undefined) {
      post.threadgate = {
        uri: `at://${userDid}/app.bsky.feed.threadgate/abc`,
        lists,
        record: { $type: "app.bsky.feed.threadgate", post: postUri, allow },
      };
    }
    return post;
  }

  // Seeds props the way postInteractionHandler does when a post is given;
  // otherwise passes the wire values through like the composer does.
  async function createDialog({
    post,
    threadgateAllow = null,
    postgateEmbeddingRules = null,
    dataLayer,
  } = {}) {
    const element = document.createElement("post-interaction-settings-dialog");
    element.dataLayer = dataLayer ?? makeDataLayer();
    if (post) {
      element.threadgateAllow = post.threadgate?.record?.allow ?? null;
      element.postgateEmbeddingRules = post.viewer?.embeddingDisabled
        ? [{ $type: "app.bsky.feed.postgate#disableRule" }]
        : null;
      element.hydratedLists = post.threadgate?.lists ?? [];
    } else {
      element.threadgateAllow = threadgateAllow;
      element.postgateEmbeddingRules = postgateEmbeddingRules;
    }
    document.body.appendChild(element);
    await flushRender();
    return element;
  }

  function input(element, testid) {
    return element.querySelector(`[data-testid="${testid}"]`);
  }

  function quoteToggle(element) {
    return input(element, "interaction-settings-quote-posts");
  }

  function clickQuoteToggle(element) {
    quoteToggle(element).querySelector(".toggle-switch-track").click();
  }

  function expandLists(element) {
    input(element, "interaction-settings-lists-toggle").click();
  }

  it("seeds 'Anyone' for a post with no threadgate", async () => {
    const element = await createDialog({});
    assert(input(element, "interaction-settings-reply-anyone").checked);
    assert(!input(element, "interaction-settings-reply-nobody").checked);
    assert(!input(element, "interaction-settings-mention").checked);
  });

  it("seeds granular rules from the post's threadgate", async () => {
    const element = await createDialog({
      post: makePost({
        allow: [
          { $type: "app.bsky.feed.threadgate#mentionRule" },
          { $type: "app.bsky.feed.threadgate#followerRule" },
        ],
      }),
    });
    assert(input(element, "interaction-settings-mention").checked);
    assert(input(element, "interaction-settings-followers").checked);
    assert(!input(element, "interaction-settings-following").checked);
    assert(!input(element, "interaction-settings-reply-anyone").checked);
  });

  it("selecting Nobody wipes granular rules", async () => {
    const element = await createDialog({
      post: makePost({
        allow: [{ $type: "app.bsky.feed.threadgate#mentionRule" }],
      }),
    });
    input(element, "interaction-settings-reply-nobody").click();
    await flushRender();
    assert(input(element, "interaction-settings-reply-nobody").checked);
    assert(!input(element, "interaction-settings-mention").checked);
  });

  it("checking a granular rule clears the radio selection", async () => {
    const element = await createDialog({});
    input(element, "interaction-settings-mention").click();
    await flushRender();
    assert(input(element, "interaction-settings-mention").checked);
    assert(!input(element, "interaction-settings-reply-anyone").checked);
    assert(!input(element, "interaction-settings-reply-nobody").checked);
  });

  it("unchecking the last granular rule re-selects Anyone", async () => {
    const element = await createDialog({
      post: makePost({
        allow: [{ $type: "app.bsky.feed.threadgate#mentionRule" }],
      }),
    });
    input(element, "interaction-settings-mention").click();
    await flushRender();
    assert(!input(element, "interaction-settings-mention").checked);
    assert(input(element, "interaction-settings-reply-anyone").checked);
  });

  it("only shows curate lists in the lists section", async () => {
    const element = await createDialog({});
    expandLists(element);
    await flushRender();
    const rows = element.querySelectorAll(
      '[data-testid="interaction-settings-list-row"]',
    );
    assert.deepEqual(rows.length, 1);
    assert.deepEqual(rows[0].getAttribute("data-list-uri"), curateList.uri);
  });

  it("disables unchecked rows at the five rule cap", async () => {
    const element = await createDialog({
      post: makePost({
        allow: [
          { $type: "app.bsky.feed.threadgate#mentionRule" },
          { $type: "app.bsky.feed.threadgate#followerRule" },
          { $type: "app.bsky.feed.threadgate#followingRule" },
          { $type: "app.bsky.feed.threadgate#futureRule" },
          { $type: "app.bsky.feed.threadgate#otherFutureRule" },
        ],
      }),
    });
    expandLists(element);
    await flushRender();
    const listRow = element.querySelector(
      '[data-testid="interaction-settings-list-row"] input',
    );
    assert(listRow.disabled);
    assert(!input(element, "interaction-settings-mention").disabled);
  });

  it("renders unknown rules as removable preserved rows", async () => {
    const rule = { $type: "app.bsky.feed.threadgate#futureRule" };
    const element = await createDialog({
      post: makePost({
        allow: [{ $type: "app.bsky.feed.threadgate#mentionRule" }, rule],
      }),
    });
    const preserved = element.querySelectorAll(
      '[data-testid="interaction-settings-preserved-row"]',
    );
    assert.deepEqual(preserved.length, 1);
    input(element, "interaction-settings-remove-rule").click();
    await flushRender();
    assert.deepEqual(
      element.querySelectorAll(
        '[data-testid="interaction-settings-preserved-row"]',
      ).length,
      0,
    );
    assert(input(element, "interaction-settings-mention").checked);
  });

  it("renders a list rule for an inaccessible list as a preserved row", async () => {
    const foreignListUri = "at://did:plc:other/app.bsky.graph.list/zzz";
    const element = await createDialog({
      post: makePost({
        allow: [
          {
            $type: "app.bsky.feed.threadgate#listRule",
            list: foreignListUri,
          },
        ],
      }),
    });
    const preserved = element.querySelectorAll(
      '[data-testid="interaction-settings-preserved-row"]',
    );
    assert.deepEqual(preserved.length, 1);
    assert(preserved[0].textContent.includes("zzz"));
  });

  it("saves unknown rules verbatim alongside edits", async () => {
    const rule = { $type: "app.bsky.feed.threadgate#futureRule", extra: 1 };
    const element = await createDialog({
      post: makePost({ allow: [rule] }),
    });
    let detail = null;
    element.addEventListener("save-interaction-settings", (event) => {
      detail = event.detail;
    });
    input(element, "interaction-settings-mention").click();
    await flushRender();
    input(element, "interaction-settings-save").click();
    assert.deepEqual(detail.threadgateAllow, [
      rule,
      { $type: "app.bsky.feed.threadgate#mentionRule" },
    ]);
  });

  it("emits [] for Nobody and closes without saving when untouched", async () => {
    const element = await createDialog({});
    let detail = null;
    element.addEventListener("save-interaction-settings", (event) => {
      detail = event.detail;
    });

    // Untouched: no event
    input(element, "interaction-settings-save").click();
    assert.deepEqual(detail, null);

    input(element, "interaction-settings-reply-nobody").click();
    await flushRender();
    input(element, "interaction-settings-save").click();
    assert.deepEqual(detail.threadgateAllow, []);
  });

  it("keeps the dialog open and shows the error on save failure", async () => {
    const element = await createDialog({});
    element.addEventListener("save-interaction-settings", (event) => {
      event.detail.errorCallback("Server exploded");
    });
    input(element, "interaction-settings-reply-nobody").click();
    await flushRender();
    input(element, "interaction-settings-save").click();
    await flushRender();
    const error = element.querySelector(".interaction-settings-error");
    assert(error !== null);
    assert(error.textContent.includes("Server exploded"));
  });

  it("emits save-interaction-settings with the wire values (composer-style seeding)", async () => {
    const element = await createDialog({});
    let detail = null;
    element.addEventListener("save-interaction-settings", (event) => {
      detail = event.detail;
    });
    input(element, "interaction-settings-following").click();
    await flushRender();
    input(element, "interaction-settings-save").click();
    assert.deepEqual(detail.threadgateAllow, [
      { $type: "app.bsky.feed.threadgate#followingRule" },
    ]);
    assert.deepEqual(detail.postgateEmbeddingRules, null);
  });

  it("seeds from a wire-shaped threadgateAllow", async () => {
    const element = await createDialog({
      threadgateAllow: [],
    });
    assert(input(element, "interaction-settings-reply-nobody").checked);
  });

  it("seeds the quote toggle on by default and off from viewer.embeddingDisabled", async () => {
    const element = await createDialog({});
    assert(quoteToggle(element).hasAttribute("checked"));

    const disabledElement = await createDialog({
      post: { ...makePost(), viewer: { embeddingDisabled: true } },
    });
    assert(!quoteToggle(disabledElement).hasAttribute("checked"));
  });

  it("saves a quote-only change with only postgate marked dirty", async () => {
    const element = await createDialog({});
    let detail = null;
    element.addEventListener("save-interaction-settings", (event) => {
      detail = event.detail;
    });
    clickQuoteToggle(element);
    await flushRender();
    assert(!quoteToggle(element).hasAttribute("checked"));
    input(element, "interaction-settings-save").click();
    assert.deepEqual(detail.threadgateDirty, false);
    assert.deepEqual(detail.postgateDirty, true);
    assert.deepEqual(detail.postgateEmbeddingRules, [
      { $type: "app.bsky.feed.postgate#disableRule" },
    ]);
  });

  it("closes without saving when the quote toggle is flipped back", async () => {
    const element = await createDialog({});
    let detail = null;
    element.addEventListener("save-interaction-settings", (event) => {
      detail = event.detail;
    });
    clickQuoteToggle(element);
    await flushRender();
    clickQuoteToggle(element);
    await flushRender();
    input(element, "interaction-settings-save").click();
    assert.deepEqual(detail, null);
  });

  it("toggles quotes when the row is clicked, without double-toggling from the switch", async () => {
    const element = await createDialog({});
    const row = element.querySelector(".interaction-settings-quote-row");
    row.click();
    await flushRender();
    assert(!quoteToggle(element).hasAttribute("checked"));
    row.click();
    await flushRender();
    assert(quoteToggle(element).hasAttribute("checked"));
    clickQuoteToggle(element);
    await flushRender();
    assert(!quoteToggle(element).hasAttribute("checked"));
  });

  it("seeds the quote toggle from postgateEmbeddingRules and emits changes", async () => {
    const element = await createDialog({
      postgateEmbeddingRules: [{ $type: "app.bsky.feed.postgate#disableRule" }],
    });
    assert(!quoteToggle(element).hasAttribute("checked"));

    let detail = null;
    element.addEventListener("save-interaction-settings", (event) => {
      detail = event.detail;
    });
    clickQuoteToggle(element);
    await flushRender();
    input(element, "interaction-settings-save").click();
    assert.deepEqual(detail.postgateEmbeddingRules, null);
    assert.deepEqual(detail.threadgateAllow, null);
  });

  it("toggling a list adds and removes the list rule", async () => {
    const element = await createDialog({});
    let detail = null;
    element.addEventListener("save-interaction-settings", (event) => {
      detail = event.detail;
    });
    expandLists(element);
    await flushRender();
    const listInput = element.querySelector(
      '[data-testid="interaction-settings-list-row"] input',
    );
    listInput.click();
    await flushRender();
    input(element, "interaction-settings-save").click();
    assert.deepEqual(detail.threadgateAllow, [
      { $type: "app.bsky.feed.threadgate#listRule", list: curateList.uri },
    ]);
  });

  describe("composer mode default settings row", () => {
    async function createComposerDialog({
      threadgateAllow = null,
      defaultInteractionSettings = undefined,
    } = {}) {
      const element = document.createElement(
        "post-interaction-settings-dialog",
      );
      element.defaultInteractionSettings = defaultInteractionSettings;
      element.dataLayer = makeDataLayer();
      element.threadgateAllow = threadgateAllow;
      element.postgateEmbeddingRules = null;
      document.body.appendChild(element);
      await flushRender();
      return element;
    }

    it("shows the static note when the selection matches the stored default", async () => {
      const element = await createComposerDialog({
        threadgateAllow: [{ $type: "app.bsky.feed.threadgate#followingRule" }],
        defaultInteractionSettings: {
          threadgateAllowRules: [
            { $type: "app.bsky.feed.threadgate#followingRule" },
          ],
          postgateEmbeddingRules: null,
        },
      });
      assert(input(element, "interaction-settings-default-note") !== null);
      assert.deepEqual(
        input(element, "interaction-settings-save-default"),
        null,
      );
    });

    it("shows the persist checkbox when the selection differs from the default", async () => {
      const element = await createComposerDialog({
        defaultInteractionSettings: {
          threadgateAllowRules: null,
          postgateEmbeddingRules: null,
        },
      });
      input(element, "interaction-settings-reply-nobody").click();
      await flushRender();
      assert(input(element, "interaction-settings-save-default") !== null);
      assert.deepEqual(
        input(element, "interaction-settings-default-note"),
        null,
      );
    });

    it("treats a Nobody default ([]) as different from Anyone (null)", async () => {
      const element = await createComposerDialog({
        threadgateAllow: null,
        defaultInteractionSettings: {
          threadgateAllowRules: [],
          postgateEmbeddingRules: null,
        },
      });
      assert(input(element, "interaction-settings-save-default") !== null);
    });

    it("renders no default row when the default never loaded", async () => {
      const element = await createComposerDialog({});
      input(element, "interaction-settings-reply-nobody").click();
      await flushRender();
      assert.deepEqual(
        input(element, "interaction-settings-save-default"),
        null,
      );
      assert.deepEqual(
        input(element, "interaction-settings-default-note"),
        null,
      );
    });

    it("renders no default row in post-edit mode, which passes no default", async () => {
      const element = await createDialog({});
      input(element, "interaction-settings-reply-nobody").click();
      await flushRender();
      assert.deepEqual(
        input(element, "interaction-settings-save-default"),
        null,
      );
      assert.deepEqual(
        input(element, "interaction-settings-default-note"),
        null,
      );
    });

    it("emits saveAsDefault false when the checkbox is unchecked", async () => {
      const element = await createComposerDialog({
        defaultInteractionSettings: {
          threadgateAllowRules: null,
          postgateEmbeddingRules: null,
        },
      });
      let detail = null;
      element.addEventListener("save-interaction-settings", (event) => {
        detail = event.detail;
      });
      input(element, "interaction-settings-reply-nobody").click();
      await flushRender();
      input(element, "interaction-settings-save").click();
      assert.deepEqual(detail.saveAsDefault, false);
    });

    it("emits saveAsDefault true when the checkbox is checked", async () => {
      const element = await createComposerDialog({
        defaultInteractionSettings: {
          threadgateAllowRules: null,
          postgateEmbeddingRules: null,
        },
      });
      let detail = null;
      element.addEventListener("save-interaction-settings", (event) => {
        detail = event.detail;
      });
      input(element, "interaction-settings-reply-nobody").click();
      await flushRender();
      input(element, "interaction-settings-save-default").click();
      await flushRender();
      input(element, "interaction-settings-save").click();
      assert.deepEqual(detail.saveAsDefault, true);
      assert.deepEqual(detail.threadgateAllow, []);
    });

    it("shows the persist checkbox for a quote-only difference and saves it as default", async () => {
      const element = await createComposerDialog({
        defaultInteractionSettings: {
          threadgateAllowRules: null,
          postgateEmbeddingRules: null,
        },
      });
      assert(input(element, "interaction-settings-default-note") !== null);
      clickQuoteToggle(element);
      await flushRender();
      assert(input(element, "interaction-settings-save-default") !== null);

      let detail = null;
      element.addEventListener("save-interaction-settings", (event) => {
        detail = event.detail;
      });
      input(element, "interaction-settings-save-default").click();
      await flushRender();
      input(element, "interaction-settings-save").click();
      assert.deepEqual(detail.saveAsDefault, true);
      assert.deepEqual(detail.postgateEmbeddingRules, [
        { $type: "app.bsky.feed.postgate#disableRule" },
      ]);
    });

    it("dispatches for an untouched selection when only the default is being saved", async () => {
      const element = await createComposerDialog({
        threadgateAllow: [],
        defaultInteractionSettings: {
          threadgateAllowRules: null,
          postgateEmbeddingRules: null,
        },
      });
      let detail = null;
      element.addEventListener("save-interaction-settings", (event) => {
        detail = event.detail;
      });
      input(element, "interaction-settings-save-default").click();
      await flushRender();
      input(element, "interaction-settings-save").click();
      assert.deepEqual(detail.threadgateDirty, false);
      assert.deepEqual(detail.saveAsDefault, true);
      assert.deepEqual(detail.threadgateAllow, []);
    });
  });
});
