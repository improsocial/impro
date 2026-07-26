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

    // In-memory store for the tags collection so a putRecord followed by a
    // getRecord round-trips like a real PDS would.
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
    await page.route(
      "**/xrpc/com.atproto.repo.deleteRecord*",
      async (route) => {
        const body = route.request().postDataJSON();
        if (body?.collection !== SHARED_COLLECTION) return route.fallback();
        tagRecords.delete(body.rkey);
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: "{}",
        });
      },
    );
    // Backs syncFromPds — the bulk fetch that populates the local rkey
    // index once at startup so badge rendering never needs a per-post
    // network round trip. Counting calls lets the test prove that.
    let listRecordsCalls = 0;
    await page.route("**/xrpc/com.atproto.repo.listRecords*", async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get("collection") !== SHARED_COLLECTION) {
        return route.fallback();
      }
      listRecordsCalls++;
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
    let getRecordCalls = 0;
    await page.route("**/xrpc/com.atproto.repo.getRecord*", async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get("collection") !== SHARED_COLLECTION) {
        return route.fallback();
      }
      getRecordCalls++;
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

    const pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await login(page);

    // Install the local Tags plugin from the community listing.
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

    // The new records-write permission should show up in the consent modal.
    const permissionPrompt = page.locator('[data-testid="permission-prompt"]');
    await expect(permissionPrompt).toBeVisible({ timeout: 10000 });
    await expect(permissionPrompt).toContainText(
      "Create, update, and delete its own private records",
    );
    await page.locator('[data-testid="modal-confirm-button"]').click();
    await expect(installButton).toHaveText("Uninstall", { timeout: 10000 });

    // Add a key in the plugin's settings and mark it the display key.
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
      settingsView.locator(".setting-item", {
        hasText: "Current display key",
      }),
    ).toBeVisible({ timeout: 10000 });

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
    const getRecordCallsBeforeReload = getRecordCalls;
    await page.reload();
    await expect(
      profileView.locator(".tag-badges .tag-badge", { hasText: "friend" }),
    ).toBeVisible({ timeout: 10000 });
    expect(listRecordsCalls).toBeGreaterThan(0);
    expect(getRecordCalls).toBe(getRecordCallsBeforeReload);

    expect(pageErrors).toEqual([]);
  });
});
