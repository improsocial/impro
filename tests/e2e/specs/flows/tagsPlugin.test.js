import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { userProfile } from "../../testData.js";
import { createProfile } from "../../../shared/factories.js";

// End-to-end coverage for the new host capabilities the "Tags" community
// plugin relies on:
// - permissions.records.write consent + the putRecord/deleteRecord bridge
// - loadLocalData/saveLocalData (device-local, unsynced plugin storage)
// - the author-badges plugin slot rendered next to a profile
// - listRecords (bulk sync) and the local reverse did index it feeds, which
//   backs "click a tag -> see everyone tagged with it" and the settings
//   tab's "browse by tag" view
//
// MockServer's own plugins-local routes always serve its built-in "Test
// Plugin" fixture (by design — "e2e tests don't depend on plugins-local/"),
// so this test overrides those three routes after mockServer.setup() to
// serve the real tags/ plugin's manifest and built main.js instead. That
// keeps the plugin's actual permissions declaration (and thus the consent
// modal copy) and actual runtime behavior under test, not a stand-in.
// The collection every records-write plugin shares (see
// SHARED_PLUGIN_RECORDS_COLLECTION in pluginPermissions.js) — not specific
// to this plugin, which is exactly the point of the shared-collection
// design (see oauthScopes.js).
const SHARED_COLLECTION = "social.impro.plugins.cloaca";
const TAGS_PLUGIN_ID = "tags__LOCAL";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TAGS_PLUGIN_DIR = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "..",
  "tags",
);
const tagsManifest = JSON.parse(
  fs.readFileSync(path.join(TAGS_PLUGIN_DIR, "manifest.json"), "utf-8"),
);
const tagsMainSource = fs.readFileSync(
  path.join(TAGS_PLUGIN_DIR, "main.js"),
  "utf-8",
);

async function serveRealTagsPlugin(page) {
  await page.route("**/plugins-local/index.json", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: TAGS_PLUGIN_ID,
          name: tagsManifest.name,
          author: tagsManifest.author,
          description: tagsManifest.description,
        },
      ]),
    }),
  );
  await page.route(
    `**/plugins-local/${TAGS_PLUGIN_ID}/manifest.json`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(tagsManifest),
      }),
  );
  await page.route(`**/plugins-local/${TAGS_PLUGIN_ID}/main.js`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/javascript",
      body: tagsMainSource,
    }),
  );
}

// In-memory store for the shared records collection, wired up so
// putRecord/getRecord/listRecords/deleteRecord round-trip like a real PDS
// would (including its $type-matches-collection invariant). Returns the
// call counters the tests use to prove badge rendering stays a pure local
// lookup (no per-post getRecord) while the bulk sync uses listRecords.
async function mockRecordsCollection(page) {
  const tagRecords = new Map();

  await page.route("**/xrpc/com.atproto.repo.putRecord*", async (route) => {
    const body = route.request().postDataJSON();
    if (body?.collection !== SHARED_COLLECTION) return route.fallback();
    // Real PDSs reject a record whose $type doesn't match its containing
    // collection — enforce that here too, or this mock would happily
    // accept a bug (a mismatched $type) that only ever surfaces against a
    // real PDS.
    if (body.record?.$type !== SHARED_COLLECTION) {
      return route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          error: "InvalidRequest",
          message: `Invalid $type: expected ${SHARED_COLLECTION}, got ${body.record?.$type}`,
        }),
      });
    }
    tagRecords.set(body.rkey, body.record);
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        uri: `at://${body.repo}/${body.collection}/${body.rkey}`,
        cid: "bafyfaketagcid",
      }),
    });
  });
  await page.route("**/xrpc/com.atproto.repo.deleteRecord*", async (route) => {
    const body = route.request().postDataJSON();
    if (body?.collection !== SHARED_COLLECTION) return route.fallback();
    tagRecords.delete(body.rkey);
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });
  // Backs syncFromPds — the bulk fetch that populates the local rkey
  // index once at startup so badge rendering never needs a per-post
  // network round trip. Counting calls lets the test prove that.
  const counters = { listRecordsCalls: 0, getRecordCalls: 0 };
  await page.route("**/xrpc/com.atproto.repo.listRecords*", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("collection") !== SHARED_COLLECTION) {
      return route.fallback();
    }
    counters.listRecordsCalls++;
    const records = [...tagRecords.entries()].map(([rkey, record]) => ({
      uri: `at://${userProfile.did}/${SHARED_COLLECTION}/${rkey}`,
      cid: "bafyfaketagcid",
      value: record,
    }));
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ records }),
    });
  });
  // Backs both the plugin-facing public getRecord bridge (used by
  // fetchTags, the edit modal's live per-DID lookup) and the host's own
  // authenticated read-before-write ownership check inside putRecord/
  // deleteRecord — both hit this same XRPC path, just against different
  // hosts, and Playwright's route glob matches either. Counting calls
  // lets the test prove badge rendering never triggers one of these,
  // only the modal's own deliberate per-DID lookup does.
  await page.route("**/xrpc/com.atproto.repo.getRecord*", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("collection") !== SHARED_COLLECTION) {
      return route.fallback();
    }
    counters.getRecordCalls++;
    const rkey = url.searchParams.get("rkey");
    const record = tagRecords.get(rkey);
    if (!record) {
      return route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "RecordNotFound" }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        uri: `at://x/${SHARED_COLLECTION}/${rkey}`,
        cid: "bafyfaketagcid",
        value: record,
      }),
    });
  });

  return { tagRecords, counters };
}

// Installs the real tags/ plugin from the community listing, approves the
// records-write consent prompt, and adds a single local key named
// "personal" as the display key. Returns nothing — callers proceed from
// the plugin's settings page.
async function installTagsPluginWithKey(page) {
  await page.goto("/plugins/community");
  const community = page.locator("#community-plugins-view");
  const tagsItem = community.locator(".plugin-list-item", {
    hasText: "Tags",
  });
  await expect(tagsItem).toBeVisible({ timeout: 10000 });
  await tagsItem.locator(".plugin-list-item-link").click();

  const listing = page.locator("#community-plugin-listing-view");
  const installButton = listing.locator(
    '[data-testid="plugin-listing-install-button"]',
  );
  await expect(installButton).toHaveText("Install", { timeout: 10000 });
  await installButton.click();

  const permissionPrompt = page.locator('[data-testid="permission-prompt"]');
  await expect(permissionPrompt).toBeVisible({ timeout: 10000 });
  await expect(permissionPrompt).toContainText(
    "Create, update, and delete its own private records",
  );
  await page.locator('[data-testid="modal-confirm-button"]').click();
  await expect(installButton).toHaveText("Uninstall", { timeout: 10000 });

  await page.goto("/settings/plugins/tags__LOCAL");
  const settingsView = page.locator("#settings-plugin-detail-view");
  const settings = settingsView.locator(".setting-item");
  await expect(settings.first()).toBeVisible({ timeout: 10000 });
  await settings
    .filter({ hasText: "New key label" })
    .locator("input")
    .fill("personal");
  await settings.filter({ hasText: "Add key" }).locator("button").click();
  await expect(
    settingsView.locator(".setting-item", { hasText: "Current display key" }),
  ).toBeVisible({ timeout: 10000 });
}

test.describe("Tags plugin", () => {
  test("install, write a tag, and see it rendered as a badge", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const otherUser = createProfile({
      did: "did:plc:otheruser1",
      handle: "otheruser.bsky.social",
      displayName: "Other User",
      followersCount: 10,
      followsCount: 10,
      postsCount: 10,
    });
    mockServer.addProfile(otherUser);
    await mockServer.setup(page);
    await serveRealTagsPlugin(page);
    const { tagRecords, counters } = await mockRecordsCollection(page);

    const pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await login(page);
    await installTagsPluginWithKey(page);

    // Visit the other user's profile and add a tag through the context menu.
    await page.goto(`/profile/${otherUser.did}`);
    const profileView = page.locator("#profile-view");
    await profileView.locator(".ellipsis-button").click();
    await page.locator("context-menu-item", { hasText: "Edit tags" }).click();

    const modal = page.locator(".modal-dialog");
    await expect(modal).toBeVisible({ timeout: 10000 });
    await modal.locator("input.setting-item-text-input").fill("friend");
    await modal.locator("button", { hasText: "Save" }).click();
    await expect(modal).toBeHidden({ timeout: 10000 });

    // The record should have actually been written under the shared
    // collection, with an rkey that reveals nothing about the target DID,
    // stamped with this plugin's own ownership marker.
    expect(tagRecords.size).toBe(1);
    const [[rkey, record]] = [...tagRecords.entries()];
    expect(rkey).toMatch(/^[0-9a-f]{64}$/);
    expect(record.tags).toEqual(["friend"]);
    expect(record.$type).toBe(SHARED_COLLECTION);
    expect(record.$plugin).toBe(TAGS_PLUGIN_ID);

    // The badge should show up immediately, updated locally from the
    // write itself — no fresh listRecords sync needed for this.
    await expect(
      profileView.locator(".tag-badges .tag-badge", { hasText: "friend" }),
    ).toBeVisible({ timeout: 10000 });

    // A fresh load (a new worker, empty in-memory state) has to rebuild
    // the local index from the PDS — via one bulk listRecords sync, not a
    // per-post/per-profile getRecord call — and still render the badge.
    const getRecordCallsBeforeReload = counters.getRecordCalls;
    await page.reload();
    await expect(
      profileView.locator(".tag-badges .tag-badge", { hasText: "friend" }),
    ).toBeVisible({ timeout: 10000 });
    expect(counters.listRecordsCalls).toBeGreaterThan(0);
    expect(counters.getRecordCalls).toBe(getRecordCallsBeforeReload);

    expect(pageErrors).toEqual([]);
  });

  test("clicking a badge and browsing by tag both show the tagged account, and support editing/removing from there", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const otherUser = createProfile({
      did: "did:plc:otheruser1",
      handle: "otheruser.bsky.social",
      displayName: "Other User",
      followersCount: 10,
      followsCount: 10,
      postsCount: 10,
    });
    mockServer.addProfile(otherUser);
    await mockServer.setup(page);
    await serveRealTagsPlugin(page);
    await mockRecordsCollection(page);

    const pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await login(page);
    await installTagsPluginWithKey(page);

    await page.goto(`/profile/${otherUser.did}`);
    const profileView = page.locator("#profile-view");
    await profileView.locator(".ellipsis-button").click();
    await page.locator("context-menu-item", { hasText: "Edit tags" }).click();
    const editModal = page.locator(".modal-dialog");
    await expect(editModal).toBeVisible({ timeout: 10000 });
    await editModal.locator("input.setting-item-text-input").fill("friend");
    await editModal.locator("button", { hasText: "Save" }).click();
    await expect(editModal).toBeHidden({ timeout: 10000 });

    const badge = profileView.locator(".tag-badges .tag-badge", {
      hasText: "friend",
    });
    await expect(badge).toBeVisible({ timeout: 10000 });

    // Clicking the badge should open a list of everyone tagged "friend"
    // under the current display key, including the account we just tagged.
    await badge.click();
    // Scope to the currently open dialog — the just-closed edit modal is
    // still in the DOM (hidden, no [open] attribute), and a plain
    // ".modal-dialog" locator would match both.
    const listModal = page.locator(".modal-dialog[open]");
    await expect(listModal).toBeVisible({ timeout: 10000 });
    await expect(listModal).toContainText("friend");
    await expect(listModal.locator(".tag-list-row")).toHaveCount(1);
    await expect(listModal.locator(".tag-list-row")).toContainText(
      "Other User",
    );

    // Editing from the list should reach the same edit modal, prefilled.
    await listModal.locator("button", { hasText: "Edit" }).click();
    const editFromList = page.locator(".modal-dialog[open]");
    await expect(editFromList).toBeVisible({ timeout: 10000 });
    await expect(
      editFromList.locator("input.setting-item-text-input"),
    ).toHaveValue("friend");
    await editFromList.locator("button", { hasText: "Cancel" }).click();
    await expect(editFromList).toBeHidden({ timeout: 10000 });

    // The settings tab's own "Browse by tag" view should find the same
    // account for the same key + tag.
    await page.goto("/settings/plugins/tags__LOCAL");
    const settingsView = page.locator("#settings-plugin-detail-view");
    await expect(settingsView).toContainText("Browse by tag", {
      timeout: 10000,
    });
    // The "Display key" setting's own description also mentions "tags", so
    // match the Tag row by its exact setting name rather than substring
    // text anywhere in the row.
    const tagRow = settingsView
      .locator(".setting-item")
      .filter({
        has: page.locator(".setting-item-name", { hasText: /^Tag$/ }),
      });
    await tagRow.locator("select").selectOption("friend");
    await tagRow.locator("button", { hasText: "View" }).click();

    const browseModal = page.locator(".modal-dialog[open]");
    await expect(browseModal).toBeVisible({ timeout: 10000 });
    await expect(browseModal.locator(".tag-list-row")).toHaveCount(1);
    await expect(browseModal.locator(".tag-list-row")).toContainText(
      "Other User",
    );

    // Removing the tag from the browse list should clear the badge back
    // on the profile. The Remove handler closes this modal and reopens a
    // fresh one (Modal has no live re-render), so re-query the open dialog.
    await browseModal.locator("button", { hasText: 'Remove "friend"' }).click();
    const reopenedModal = page.locator(".modal-dialog[open]");
    await expect(reopenedModal.locator(".tag-list-row")).toHaveCount(0, {
      timeout: 10000,
    });
    await reopenedModal.locator("button", { hasText: "Close" }).click();

    await page.goto(`/profile/${otherUser.did}`);
    await expect(
      page.locator("#profile-view .tag-badges .tag-badge", {
        hasText: "friend",
      }),
    ).toHaveCount(0, { timeout: 10000 });

    expect(pageErrors).toEqual([]);
  });
});
