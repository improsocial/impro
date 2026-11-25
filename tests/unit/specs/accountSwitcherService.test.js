import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { AccountSwitcherService } from "/js/accountSwitcherService.js";
import { InvalidUsernameError } from "/js/auth.js";
import {
  mockWindowLocation,
  respondToConfirm,
  restoreWindow,
  waitFor,
} from "../testHelpers.js";

describe("AccountSwitcherService.switchToAccount", () => {
  let auth;
  let service;

  beforeEach(() => {
    auth = {
      switchAccount: mock.fn(() => new Promise(() => {})),
      login: mock.fn(() => new Promise(() => {})),
    };
    service = new AccountSwitcherService(null, auth, null);
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  function getToasts() {
    return document.querySelectorAll("[data-testid='toast']");
  }

  it("switches to an account with a session", () => {
    service.switchToAccount({ did: "did:plc:other", needsReauth: false });
    assert.deepEqual(auth.switchAccount.mock.calls.length, 1);
    assert.deepEqual(auth.switchAccount.mock.calls[0].arguments, [
      "did:plc:other",
    ]);
    assert.deepEqual(auth.login.mock.calls.length, 0);
    assert.deepEqual(service.$pendingSwitchDid.get(), "did:plc:other");
  });

  it("starts a login for an account that needs re-auth", () => {
    service.switchToAccount({
      did: "did:plc:other",
      handle: "other.test",
      needsReauth: true,
    });
    assert.deepEqual(auth.login.mock.calls.length, 1);
    assert.deepEqual(
      auth.login.mock.calls[0].arguments[0].handle,
      "other.test",
    );
    assert.deepEqual(auth.switchAccount.mock.calls.length, 0);
  });

  it("ignores further switches while one is pending", () => {
    service.switchToAccount({ did: "did:plc:other", needsReauth: false });
    service.switchToAccount({ did: "did:plc:third", needsReauth: false });
    assert.deepEqual(auth.switchAccount.mock.calls.length, 1);
    assert.deepEqual(service.$pendingSwitchDid.get(), "did:plc:other");
  });

  it("clears the pending account and shows a toast when switching fails", async () => {
    auth.switchAccount = mock.fn(async () => {
      throw new Error("boom");
    });
    await service.switchToAccount({ did: "did:plc:other", needsReauth: false });
    assert.deepEqual(service.$pendingSwitchDid.get(), null);
    assert.deepEqual(getToasts().length, 1);
  });

  it("clears the pending account and shows a toast when re-auth fails", async () => {
    auth.login = mock.fn(async () => {
      throw new InvalidUsernameError("Invalid username");
    });
    await service.switchToAccount({
      did: "did:plc:other",
      handle: "other.test",
      needsReauth: true,
    });
    assert.deepEqual(service.$pendingSwitchDid.get(), null);
    assert.deepEqual(getToasts().length, 1);
  });
});

describe("AccountSwitcherService.removeAccount", () => {
  const account = { did: "did:plc:other", handle: "other.test" };
  let calls;
  let auth;
  let pushNotificationService;
  let service;

  beforeEach(() => {
    calls = [];
    auth = {
      removeAccount: mock.fn(async () => {
        calls.push("removeAccount");
      }),
      getSession: mock.fn(async () => ({ did: "did:plc:me" })),
      listAccounts: mock.fn(async () => [{ did: "did:plc:me" }]),
    };
    pushNotificationService = {
      unregisterAccount: mock.fn(async () => {
        calls.push("unregisterPush");
      }),
    };
    service = new AccountSwitcherService(null, auth, pushNotificationService);
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("unregisters push, then removes the account and refreshes the other accounts", async () => {
    service.$otherAccounts.set([account]);
    const result = service.removeAccount(account);
    await respondToConfirm(true);
    assert.equal(await result, true);
    assert.deepEqual(calls, ["unregisterPush", "removeAccount"]);
    assert.deepEqual(
      pushNotificationService.unregisterAccount.mock.calls[0].arguments,
      [account.did],
    );
    assert.deepEqual(auth.removeAccount.mock.calls[0].arguments, [account.did]);
    assert.deepEqual(service.$otherAccounts.get(), []);
  });

  it("does nothing when cancelled", async () => {
    const result = service.removeAccount(account);
    await respondToConfirm(false);
    assert.equal(await result, false);
    assert.deepEqual(calls, []);
  });

  it("keeps the modal open and shows a toast when removal fails", async () => {
    auth.removeAccount = mock.fn(async () => {
      throw new Error("boom");
    });
    service.removeAccount(account);
    await respondToConfirm(true);
    await waitFor(
      () => document.querySelectorAll("[data-testid='toast']").length === 1,
    );
    assert.ok(document.querySelector("[data-testid='confirm-modal']"));
    assert.equal(auth.listAccounts.mock.calls.length, 0);
  });

  it("still removes the account when unregistering push fails", async (t) => {
    t.mock.method(console, "error", () => {});
    pushNotificationService.unregisterAccount = mock.fn(async () => {
      throw new Error("push down");
    });
    const result = service.removeAccount(account);
    await respondToConfirm(true);
    assert.equal(await result, true);
    assert.deepEqual(calls, ["removeAccount"]);
  });
});

describe("AccountSwitcherService.signOut", () => {
  let calls;
  let auth;
  let pushNotificationService;
  let service;
  let capturedHrefs;

  beforeEach(() => {
    calls = [];
    capturedHrefs = mockWindowLocation();
    auth = {
      getSession: mock.fn(async () => ({ did: "did:plc:me" })),
      logout: mock.fn(async () => {
        calls.push("logout");
      }),
    };
    pushNotificationService = {
      signOutAccount: mock.fn(async () => {
        calls.push("signOutPush");
      }),
    };
    service = new AccountSwitcherService(null, auth, pushNotificationService);
  });

  afterEach(() => {
    restoreWindow();
    document.body.innerHTML = "";
  });

  it("releases push for the current account before logging out", async () => {
    const result = service.signOut();
    await respondToConfirm(true);
    await result;
    assert.deepEqual(calls, ["signOutPush", "logout"]);
    assert.deepEqual(
      pushNotificationService.signOutAccount.mock.calls[0].arguments,
      ["did:plc:me"],
    );
    assert.equal(capturedHrefs.at(-1), "/login");
  });

  it("still signs out when releasing push fails", async (t) => {
    t.mock.method(console, "error", () => {});
    pushNotificationService.signOutAccount = mock.fn(async () => {
      throw new Error("push down");
    });
    const result = service.signOut();
    await respondToConfirm(true);
    await result;
    assert.deepEqual(calls, ["logout"]);
    assert.equal(capturedHrefs.at(-1), "/login");
  });
});
