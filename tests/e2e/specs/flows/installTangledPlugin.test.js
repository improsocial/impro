// E2E: install a plugin from a REAL Tangled repo through the host's
// unregistered-install flow, exercising the declaration-only resolution
// path (repos created since the org.tangled.* migration have no legacy
// sh.tangled.repo record).
//
// The plugin assets (manifest/main.js/styles.css) are fetched live from
// knot1.tangled.sh - the actual deployed impro-who-is repo. Identity and
// record lookups are mocked to the declaration-only shape so the test
// pins the new resolution path rather than depending on whether the
// live repo happens to carry a legacy record.
//
// Run from the impro checkout:
//   npx playwright test tests/e2e/specs/flows/installTangledPlugin.test.js

import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";

const OWNER_HANDLE = "7778777.online";
const OWNER_DID = "did:plc:jg6o3bgflm3q4y7jpmpvenj3";
const OWNER_PDS = "https://pds.mock";
const REPO_NAME = "impro-who-is";
const REPO_DID = "did:plc:l22m7vnlebbdwncqh2v3kjva";
const KNOT = "knot1.tangled.sh";
const REPO_URL = `https://tangled.org/${OWNER_HANDLE}/${REPO_NAME}`;

async function setupTangledInstall(page) {
  const mockServer = new MockServer();
  mockServer.registryEntries = [];
  await mockServer.setup(page);

  // Slingshot mini doc (the host's first identity step).
  await page.route("**/blue.microcosm.identity.resolveMiniDoc*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        did: OWNER_DID,
        handle: OWNER_HANDLE,
        pds: OWNER_PDS,
      }),
    }),
  );
  // PLC fallback for identity resolution. (resolveDid percent-encodes
  // the DID in the path, so match the host, not the literal DID.)
  await page.route("https://plc.directory/**", (route) => {
    const url = decodeURIComponent(route.request().url());
    const isRepoDid = url.endsWith(REPO_DID);
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        isRepoDid
          ? {
              id: REPO_DID,
              service: [
                {
                  id: "#atproto_pds",
                  type: "AtprotoPersonalDataServer",
                  serviceEndpoint: `https://${KNOT}`,
                },
              ],
            }
          : {
              id: OWNER_DID,
              alsoKnownAs: [`at://${OWNER_HANDLE}`],
              service: [
                {
                  id: "#atproto_pds",
                  type: "AtprotoPersonalDataServer",
                  serviceEndpoint: OWNER_PDS,
                },
              ],
            },
      ),
    });
  });
  // Owner PDS record lookups: legacy sh.tangled.repo misses (direct +
  // listRecords), the declaration answers. This is exactly the shape of
  // a repo created with `th repo create` today.
  await page.route(`${OWNER_PDS}/xrpc/com.atproto.repo.getRecord*`, (route) => {
    const url = new URL(route.request().url());
    const collection = url.searchParams.get("collection");
    if (collection === "org.tangled.repo.declaration") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          uri: `at://${OWNER_DID}/org.tangled.repo.declaration/${REPO_NAME}`,
          cid: "bafydeclaration",
          value: {
            $type: "org.tangled.repo.declaration",
            repo: REPO_DID,
            createdAt: "2026-11-11T19:36:28.848Z",
          },
        }),
      });
    }
    return route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({
        error: "RecordNotFound",
        message: "not found",
      }),
    });
  });
  await page.route(`${OWNER_PDS}/xrpc/com.atproto.repo.listRecords*`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ records: [] }),
    }),
  );
  // Knot API detection.
  await page.route(
    `https://${KNOT}/xrpc/org.tangled.knot.describeKnot*`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ did: `did:web:${KNOT}` }),
      }),
  );
  // Plugin assets: served LIVE from the real knot. The shared base
  // fixture blocks unmocked non-localhost requests, so pass these
  // through explicitly (page routes run before the context-level block).
  await page.route(`https://${KNOT}/xrpc/org.tangled.git.getBlob*`, (route) =>
    route.continue(),
  );

  await login(page);
  return mockServer;
}

test.describe("Tangled plugin install (declaration-only repo)", () => {
  test("installs from a tangled.org URL and loads the plugin", async ({
    page,
  }) => {
    await setupTangledInstall(page);

    await page.goto("/settings/advanced");
    const urlInput = page.locator(
      '[data-testid="install-unregistered-plugin-input"]',
    );
    await expect(urlInput).toBeVisible({ timeout: 10000 });
    await urlInput.fill(REPO_URL);

    const putPrefs = page.waitForResponse((res) =>
      res.url().includes("app.bsky.actor.putPreferences"),
    );
    await page
      .locator('[data-testid="install-unregistered-plugin-submit"]')
      .click();
    // The install permission prompt.
    await expect(page.locator('[data-testid="install-prompt"]')).toBeVisible({
      timeout: 15000,
    });
    await page.locator('[data-testid="modal-confirm-button"]').click();
    await putPrefs;
    await expect(page.locator('[data-testid="toast"]')).toContainText(
      "Installed Who Is",
      { timeout: 15000 },
    );

    // The plugin appears installed and enabled.
    await page.goto("/plugins/installed");
    const plugins = page.locator("#installed-plugins-view");
    const item = plugins.locator(".plugin-list-item", { hasText: "Who Is" });
    await expect(item).toBeVisible({ timeout: 10000 });
    await expect(item.locator(".plugin-toggle")).toHaveAttribute("checked", "");

    // The plugin's page renders (its bundle actually loaded and ran).
    await page.goto(`/plugin/who-is/pages/search`);
    await expect(page.locator('[data-testid="who-is-input"]')).toBeVisible({
      timeout: 15000,
    });
  });
});
