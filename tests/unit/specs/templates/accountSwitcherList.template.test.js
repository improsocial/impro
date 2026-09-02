import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { render } from "/js/lib/lit-html.js";
import { accountSwitcherListTemplate } from "/js/templates/accountSwitcherList.template.js";
import { createProfile } from "../../../shared/factories.js";

function renderList(props) {
  const container = document.createElement("div");
  render(
    accountSwitcherListTemplate({
      onSelect: () => {},
      onAdd: () => {},
      ...props,
    }),
    container,
  );
  return container;
}

const alice = createProfile({
  did: "did:plc:alice",
  handle: "alice.test",
  displayName: "Alice",
});
const bob = createProfile({
  did: "did:plc:bob",
  handle: "bob.test",
  displayName: "Bob",
});

const accounts = [
  { did: alice.did, handle: alice.handle },
  { did: bob.did, handle: bob.handle },
];
const profilesByDid = { [alice.did]: alice, [bob.did]: bob };

describe("accountSwitcherListTemplate", () => {
  it("renders a row per account with the shared testids", () => {
    const container = renderList({
      accounts,
      profilesByDid,
      currentDid: null,
      pendingDid: null,
      profilesLoading: false,
    });
    const rows = container.querySelectorAll(
      '[data-testid="account-switcher-item"]',
    );
    assert.equal(rows.length, 2);
    assert.equal(rows[0].getAttribute("data-did"), alice.did);
    assert.equal(rows[1].getAttribute("data-did"), bob.did);
  });

  it("teststate transitions: pending overrides current overrides reauth", () => {
    const container = renderList({
      accounts: [
        { did: alice.did, handle: alice.handle },
        { did: bob.did, handle: bob.handle, needsReauth: true },
      ],
      profilesByDid,
      currentDid: alice.did,
      pendingDid: bob.did,
      profilesLoading: false,
    });
    const rows = container.querySelectorAll(
      '[data-testid="account-switcher-item"]',
    );
    // alice is current (and no pending switch on her row)
    assert.equal(rows[0].getAttribute("data-teststate"), "current");
    // bob is both reauth and pending; pending wins
    assert.equal(rows[1].getAttribute("data-teststate"), "pending");
    assert.match(rows[1].className, /is-pending/);
  });

  it("trailing-action rule: pending -> spinner, current -> check, else chevron", () => {
    const container = renderList({
      accounts: [
        { did: "did:plc:pending", handle: "pending.test" },
        { did: alice.did, handle: alice.handle },
        { did: bob.did, handle: bob.handle },
      ],
      profilesByDid,
      currentDid: alice.did,
      pendingDid: "did:plc:pending",
      profilesLoading: false,
    });
    const rows = container.querySelectorAll(
      '[data-testid="account-switcher-item"]',
    );
    // pending row shows a spinner
    assert.ok(
      rows[0].querySelector('[data-testid="account-spinner"]'),
      "pending row should have spinner",
    );
    // current row shows the current-check
    assert.ok(
      rows[1].querySelector(".account-switcher-current-check"),
      "current row should have current-check",
    );
    // other row shows the chevron
    assert.ok(
      rows[2].querySelector(".account-switcher-chevron"),
      "other row should have chevron",
    );
  });

  it("disables every button while any switch is pending", () => {
    const container = renderList({
      accounts,
      profilesByDid,
      currentDid: null,
      pendingDid: alice.did,
      profilesLoading: false,
    });
    const buttons = container.querySelectorAll("button");
    for (const button of buttons) {
      assert.ok(
        button.hasAttribute("disabled"),
        `button ${button.dataset.testid ?? ""} should be disabled`,
      );
    }
  });

  it("renders skeleton rows while profiles are loading", () => {
    const container = renderList({
      accounts,
      profilesByDid: {},
      currentDid: null,
      pendingDid: null,
      profilesLoading: true,
    });
    assert.equal(
      container.querySelectorAll('[data-testid="account-switcher-skeleton"]')
        .length,
      2,
    );
  });

  it("shows the reauth hint for accounts that need re-auth", () => {
    const container = renderList({
      accounts: [{ did: alice.did, handle: alice.handle, needsReauth: true }],
      profilesByDid,
      currentDid: null,
      pendingDid: null,
      profilesLoading: false,
    });
    assert.ok(
      container.querySelector('[data-testid="account-switcher-reauth-hint"]'),
    );
  });

  it("renders an add row with the given label and a spinner while pending", () => {
    const container = renderList({
      accounts,
      profilesByDid,
      currentDid: null,
      pendingDid: null,
      profilesLoading: false,
      addLabel: "Add account",
      addPending: true,
    });
    const add = container.querySelector('[data-testid="account-switcher-add"]');
    assert.ok(add);
    assert.match(add.textContent, /Add account/);
    assert.ok(add.querySelector('[data-testid="account-spinner"]'));
    // Row buttons are also disabled when the add row is pending.
    const firstRow = container.querySelector(
      '[data-testid="account-switcher-item"]',
    );
    assert.ok(firstRow.hasAttribute("disabled"));
  });

  it("renders the add-row label from the addLabel prop", () => {
    const container = renderList({
      accounts,
      profilesByDid,
      currentDid: null,
      pendingDid: null,
      profilesLoading: false,
      addLabel: "Other account",
    });
    const add = container.querySelector('[data-testid="account-switcher-add"]');
    assert.match(add.textContent, /Other account/);
  });
});
