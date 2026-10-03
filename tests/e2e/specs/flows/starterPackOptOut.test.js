import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import { userProfile } from "../../testData.js";
import { createProfile, createStarterPack } from "../../../shared/factories.js";

const PACK_URI = "at://did:plc:creator1/app.bsky.graph.starterpack/coolpack";
const LIST_URI = "at://did:plc:creator1/app.bsky.graph.list/coolpack";
const PACK_PATH = "/profile/creator1.bsky.social/starter-pack/coolpack";
const OPT_OUT_COLLECTION = "app.bsky.graph.referencelistoptout";

function setupPack(mockServer) {
  mockServer.addStarterPacks([
    createStarterPack({
      uri: PACK_URI,
      name: "Cool Pack",
      creatorHandle: "creator1.bsky.social",
      list: true,
    }),
  ]);
  mockServer.addListMembers(LIST_URI, [
    createProfile({
      did: "did:plc:member1",
      handle: "member1.bsky.social",
      displayName: "Member One",
    }),
    userProfile,
  ]);
}

async function openPack(page) {
  await login(page);
  await page.goto(PACK_PATH);
  const view = page.locator("#starter-pack-detail-view");
  await expect(view.locator('[data-testid="starter-pack-name"]')).toBeVisible({
    timeout: 10000,
  });
  return view;
}

function optOutItem(view) {
  return view.locator('[data-testid="menu-action-starter-pack-opt-out"]');
}

test.describe("Starter pack opt-out flow", () => {
  test("opts out, then undoes, writing and deleting the record", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    setupPack(mockServer);
    await mockServer.setup(page);

    const view = await openPack(page);

    await view.locator(".context-menu-button").click();
    await optOutItem(view).click();
    await expect(page.locator('[data-testid="confirm-modal"]')).toBeVisible();
    await page.locator('[data-testid="modal-confirm-button"]').click();

    await expect(page.locator('[data-testid="toast"]')).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator('[data-testid="confirm-modal"]')).toHaveCount(0);
    expect(mockServer.referenceListOptOutRecords).toEqual([
      expect.objectContaining({ subject: LIST_URI }),
    ]);
    expect(mockServer.referenceListOptOutRecords[0].uri).toContain(
      `/${OPT_OUT_COLLECTION}/`,
    );

    await view.locator(".context-menu-button").click();
    await expect(optOutItem(view)).toHaveAttribute(
      "data-teststate",
      "opted-out",
    );
    await optOutItem(view).click();
    await page.locator('[data-testid="modal-confirm-button"]').click();

    await expect(page.locator('[data-testid="confirm-modal"]')).toHaveCount(0, {
      timeout: 10000,
    });
    expect(mockServer.referenceListOptOutRecords).toEqual([]);
    await view.locator(".context-menu-button").click();
    await expect(optOutItem(view)).toHaveAttribute(
      "data-teststate",
      "opted-in",
    );
  });

  test("cancelling the confirm writes nothing", async ({ page }) => {
    const mockServer = new MockServer();
    setupPack(mockServer);
    await mockServer.setup(page);

    const view = await openPack(page);

    await view.locator(".context-menu-button").click();
    await optOutItem(view).click();
    await page.locator('[data-testid="modal-cancel-button"]').click();

    await expect(page.locator('[data-testid="confirm-modal"]')).toHaveCount(0);
    expect(mockServer.referenceListOptOutRecords).toEqual([]);
  });

  test("keeps the opted-out state across a reload while the appview lags", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    setupPack(mockServer);
    mockServer.setReferenceListOptOutLag(100);
    await mockServer.setup(page);

    const view = await openPack(page);

    await view.locator(".context-menu-button").click();
    await optOutItem(view).click();
    await page.locator('[data-testid="modal-confirm-button"]').click();
    await expect(page.locator('[data-testid="confirm-modal"]')).toHaveCount(0, {
      timeout: 15000,
    });
    expect(mockServer.referenceListOptOutRecords).toHaveLength(1);

    await page.evaluate(() => window.router.go("/"));
    await expect(page.locator("#starter-pack-detail-view")).toBeHidden();
    await page.evaluate((path) => window.router.go(path), PACK_PATH);
    await expect(view.locator('[data-testid="starter-pack-name"]')).toBeVisible(
      { timeout: 10000 },
    );
    await view.locator(".context-menu-button").click();
    await expect(optOutItem(view)).toHaveAttribute(
      "data-teststate",
      "opted-out",
    );
  });

  test("leaves the confirm open with an error toast when the write fails", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    setupPack(mockServer);
    mockServer.failCreateRecord(OPT_OUT_COLLECTION);
    await mockServer.setup(page);

    const view = await openPack(page);

    await view.locator(".context-menu-button").click();
    await optOutItem(view).click();
    await page.locator('[data-testid="modal-confirm-button"]').click();

    await expect(page.locator('[data-testid="toast"].error')).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator('[data-testid="confirm-modal"]')).toBeVisible();
    await page.locator('[data-testid="modal-cancel-button"]').click();

    await view.locator(".context-menu-button").click();
    await expect(optOutItem(view)).toHaveAttribute(
      "data-teststate",
      "opted-in",
    );
  });
});
