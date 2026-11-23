import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { AccountSwitcherService } from "/js/accountSwitcherService.js";
import { InvalidUsernameError } from "/js/auth.js";

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
