import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";
import {
  createConvo,
  createGroupConvo,
  createGroupConvoMember,
  createProfile,
} from "../../../shared/factories.js";

function createTestMembers() {
  const alice = createProfile({
    did: "did:plc:alice1",
    handle: "alice.bsky.social",
    displayName: "Alice",
  });
  const bob = createProfile({
    did: "did:plc:bob1",
    handle: "bob.bsky.social",
    displayName: "Bob",
  });
  return { alice, bob };
}

test.describe("Group chat details view", () => {
  test("should display group info and member rows", async ({ page }) => {
    const mockServer = new MockServer();
    const { alice, bob } = createTestMembers();
    const convo = createGroupConvo({
      id: "convo-1",
      name: "Cool Group",
      otherMembers: [alice, bob],
      ownerDid: alice.did,
    });
    mockServer.addConvos([convo]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages/convo-1/settings");

    const view = page.locator("#group-chat-details-view");
    await expect(view.locator('[data-testid="header-title"]')).toBeVisible({
      timeout: 10000,
    });
    await expect(view.locator('[data-testid="group-name"]')).toContainText(
      "Cool Group",
    );
    await expect(
      view.locator('[data-testid="group-created-at"]'),
    ).toBeVisible();
    await expect(view.locator('[data-testid="member-count"]')).toContainText(
      "3/100",
    );
    const rows = view.locator(".profile-list-item");
    await expect(rows).toHaveCount(3);
    await expect(rows.first()).toContainText("Alice");
    await expect(rows.first()).toContainText("@alice.bsky.social");
    await expect(rows.nth(1)).toContainText("Test User");
    await expect(rows.nth(2)).toContainText("Bob");
    await expect(view.locator('[data-testid="follow-button"]')).toHaveCount(0);
  });

  test("should show admin badge, added-by subtext, and owner-first sorting", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const { alice, bob } = createTestMembers();
    const convo = createGroupConvo({
      id: "convo-1",
      name: "Cool Group",
      otherMembers: [alice, bob],
      ownerDid: alice.did,
    });
    mockServer.addConvos([convo]);
    // Serve members in a different order to prove sorting
    mockServer.addConvoMembers("convo-1", [
      createGroupConvoMember({ profile: bob }),
      createGroupConvoMember({
        profile: convo.members.find(
          (member) => member.did === "did:plc:testuser123",
        ),
        addedBy: alice,
      }),
      createGroupConvoMember({ profile: alice, role: "owner" }),
    ]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages/convo-1/settings");

    const view = page.locator("#group-chat-details-view");
    const rows = view.locator(".profile-list-item");
    await expect(rows).toHaveCount(3, { timeout: 10000 });

    const ownerRow = rows.first();
    await expect(ownerRow).toContainText("Alice");
    await expect(ownerRow.locator('[data-testid="admin-badge"]')).toBeVisible();
    await expect(
      ownerRow.locator('[data-testid="member-added-by"]'),
    ).toHaveCount(0);

    const selfRow = rows.nth(1);
    await expect(selfRow).toContainText("Test User");
    await expect(
      selfRow.locator('[data-testid="member-added-by"]'),
    ).toContainText("Added by Alice");

    const bobRow = rows.nth(2);
    await expect(bobRow).toContainText("Bob");
    await expect(
      bobRow.locator('[data-testid="member-added-by"]'),
    ).toContainText("Added by invite link");
    await expect(view.locator('[data-testid="admin-badge"]')).toHaveCount(1);
  });

  test("should load more members when scrolling to the bottom", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const manyMembers = Array.from({ length: 120 }, (unused, index) =>
      createProfile({
        did: `did:plc:member${index}`,
        handle: `member${index}.bsky.social`,
        displayName: `Member ${index}`,
      }),
    );
    const convo = createGroupConvo({
      id: "convo-1",
      name: "Big Group",
      otherMembers: manyMembers.slice(0, 3),
      memberCount: 120,
    });
    mockServer.addConvos([convo]);
    mockServer.addConvoMembers("convo-1", manyMembers);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages/convo-1/settings");

    const view = page.locator("#group-chat-details-view");
    const rows = view.locator(".profile-list-item");

    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    const initialCount = await rows.count();
    expect(initialCount).toBeLessThan(120);

    // Scroll the window to the bottom to trigger infinite scroll. Loop
    // because a single fetch may not yield the full set in one batch.
    await expect
      .poll(
        async () => {
          await page.evaluate(() =>
            window.scrollTo(0, document.body.scrollHeight),
          );
          return await rows.count();
        },
        { timeout: 10000, intervals: [200] },
      )
      .toBe(120);
    await expect(view).toContainText("Member 119");
  });

  test("should show a top card skeleton while the convo loads", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const { alice, bob } = createTestMembers();
    const convo = createGroupConvo({
      id: "convo-1",
      name: "Cool Group",
      otherMembers: [alice, bob],
    });
    mockServer.addConvos([convo]);
    mockServer.setConvoDelay("convo-1", 1000);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages/convo-1/settings");

    const view = page.locator("#group-chat-details-view");
    const skeleton = view.locator(".group-chat-header-skeleton");
    await expect(skeleton).toBeVisible({ timeout: 10000 });
    await expect(view.locator(".group-chat-members-heading")).toBeVisible();
    await expect(view.locator('[data-testid="member-count"]')).toHaveCount(0);
    const skeletonHeight = (await skeleton.boundingBox()).height;
    await expect(view.locator('[data-testid="group-name"]')).toContainText(
      "Cool Group",
      { timeout: 10000 },
    );
    await expect(skeleton).toHaveCount(0);
    await expect(view.locator('[data-testid="member-count"]')).toContainText(
      "3/100",
    );
    // The loaded card must not shift the layout below it
    const panelHeight = (await view.locator(".chat-info-panel").boundingBox())
      .height;
    expect(panelHeight).toBe(skeletonHeight);
  });

  test("should show an error state when the member list fails to load", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const { alice, bob } = createTestMembers();
    const convo = createGroupConvo({
      id: "convo-1",
      name: "Cool Group",
      otherMembers: [alice, bob],
    });
    mockServer.addConvos([convo]);
    mockServer.failConvoMembers({ message: "Something went wrong" });
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages/convo-1/settings");

    const view = page.locator("#group-chat-details-view");
    await expect(
      view.locator('[data-testid="group-details-error"]'),
    ).toBeVisible({ timeout: 10000 });
    await expect(view.locator(".profile-list-item")).toHaveCount(0);
  });

  test("should show an error state for non-group conversations", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const { alice } = createTestMembers();
    const convo = createConvo({ id: "convo-1", otherMember: alice });
    mockServer.addConvos([convo]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages/convo-1/settings");

    const view = page.locator("#group-chat-details-view");
    await expect(view.locator('[data-testid="not-group-convo"]')).toBeVisible({
      timeout: 10000,
    });
    await expect(view.locator(".profile-list-item")).toHaveCount(0);
  });

  test("should show mute toggle and leave button in chat actions", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const { alice, bob } = createTestMembers();
    const convo = createGroupConvo({
      id: "convo-1",
      name: "Cool Group",
      otherMembers: [alice, bob],
    });
    mockServer.addConvos([convo]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages/convo-1/settings");

    const view = page.locator("#group-chat-details-view");
    const toggle = view.locator('[data-testid="group-settings-mute-toggle"]');
    await expect(toggle).toBeVisible({ timeout: 10000 });
    await expect(toggle).toHaveAttribute("data-teststate", "unmuted");
    await expect(
      view.locator('[data-testid="group-settings-leave-button"]'),
    ).toContainText("Leave");
  });

  test("should reflect muted state on the group mute toggle", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    const { alice, bob } = createTestMembers();
    const convo = createGroupConvo({
      id: "convo-1",
      name: "Cool Group",
      otherMembers: [alice, bob],
      muted: true,
    });
    mockServer.addConvos([convo]);
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages/convo-1/settings");

    const view = page.locator("#group-chat-details-view");
    await expect(
      view.locator('[data-testid="group-settings-mute-toggle"]'),
    ).toHaveAttribute("data-teststate", "muted", { timeout: 10000 });
  });

  test("should show not found for an unknown conversation", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/messages/unknown-convo/settings");

    const view = page.locator("#group-chat-details-view");
    await expect(view.locator('[data-testid="convo-not-found"]')).toBeVisible({
      timeout: 10000,
    });
  });
});
