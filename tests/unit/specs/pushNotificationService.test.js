import { describe, it, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { PushNotificationService } from "/js/push/pushNotificationService.js";
import { Signal, effect } from "/js/signals.js";

const SUBSCRIPTION = {
  endpoint: "https://push.example/ep/abc",
  keys: { p256dh: "p", auth: "a" },
  unsubscribe: async () => {},
};

const FRESH_SUBSCRIPTION = {
  endpoint: "https://push.example/ep/fresh",
  keys: { p256dh: "p2", auth: "a2" },
  unsubscribe: async () => {},
};

// "BKxQ" is the base64url the service config carries; decoded it is the key a
// subscription reports back through options.applicationServerKey.
const VAPID_KEY = "BKxQ";
const VAPID_KEY_BYTES = Uint8Array.from([4, 172, 80]);

function setupDom({ enabled = true, granted = true } = {}) {
  globalThis.localStorage = {
    _data: enabled ? { "push-notifications-enabled": "true" } : {},
    getItem(k) {
      return this._data[k] ?? null;
    },
    setItem(k, v) {
      this._data[k] = v;
    },
    removeItem(k) {
      delete this._data[k];
    },
  };
  globalThis.Notification = { permission: granted ? "granted" : "denied" };
  // isSupported checks for these on window/navigator; jsdom has neither.
  globalThis.window.PushManager = function PushManager() {};
  // Push needs an installed app on a touch-only device; the env's default
  // matchMedia stub reports every query as non-matching, which would read as
  // an uninstalled desktop browser.
  globalThis.window.matchMedia = (query) => ({
    matches:
      query === "(hover: none) and (pointer: coarse)" ||
      query === "(display-mode: standalone)",
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  globalThis.document = {
    _listeners: {},
    addEventListener(type, fn) {
      this._listeners[type] = fn;
    },
    removeEventListener(type) {
      delete this._listeners[type];
    },
    visibilityState: "visible",
  };
  // Node 24 defines a read-only global `navigator`; replace it explicitly.
  const registration = {
    pushManager: {
      getSubscription: async () => SUBSCRIPTION,
      subscribe: async () => FRESH_SUBSCRIPTION,
    },
  };
  Object.defineProperty(globalThis, "navigator", {
    value: {
      serviceWorker: {
        register: async () => registration,
        ready: Promise.resolve(registration),
        getRegistration: async () => registration,
      },
    },
    configurable: true,
    writable: true,
  });
}

// The chosen service is device state, so a service DID is seeded the same way
// a previous launch would have left it: in localStorage.
function createService(serviceDid = null) {
  if (serviceDid !== null) {
    globalThis.localStorage.setItem("push-notification-service", serviceDid);
  }
  const registerPush = mock.fn(async () => {});
  const api = { registerPush, session: { did: "did:plc:current" } };
  const service = new PushNotificationService(api);
  // Enumerating accounts reaches for real OAuth storage; tests that care about
  // the other-account fan-out override this.
  service._listAccountDids = async () => [];
  return { service, registerPush };
}

describe("PushNotificationService registration", () => {
  let originals;

  beforeEach(() => {
    // The parallel runner reuses processes across test files, so every global
    // this suite touches must be restored exactly — a leftover fake document
    // breaks whatever runs next in the same worker.
    originals = {
      localStorage: globalThis.localStorage,
      notification: globalThis.Notification,
      document: globalThis.document,
      navigator: Object.getOwnPropertyDescriptor(globalThis, "navigator"),
      pushManager: globalThis.window.PushManager,
      matchMedia: globalThis.window.matchMedia,
    };
  });

  afterEach(() => {
    globalThis.localStorage = originals.localStorage;
    globalThis.Notification = originals.notification;
    globalThis.document = originals.document;
    globalThis.window.matchMedia = originals.matchMedia;
    Object.defineProperty(globalThis, "navigator", originals.navigator);
    if (originals.pushManager === undefined) {
      delete globalThis.window.PushManager;
    } else {
      globalThis.window.PushManager = originals.pushManager;
    }
  });

  it("reuses the existing subscription rather than prompting again", async () => {
    setupDom();
    const { service, registerPush } = createService();
    await service._subscribeAndRegister({ vapidPublicKey: "k" });
    assert.equal(registerPush.mock.calls.length, 1);
    const args = registerPush.mock.calls[0].arguments[0];
    assert.equal(args.appId, "social.impro");
    assert.equal(args.platform, "web");
    // The token is the serialized PushSubscription (functions don't survive).
    assert.deepEqual(JSON.parse(args.token), {
      endpoint: SUBSCRIPTION.endpoint,
      keys: SUBSCRIPTION.keys,
    });
  });

  // A PushSubscription is bound to the VAPID key it was created with, so one
  // left behind by a different service can't receive this service's pushes —
  // the gateway rejects them, silently, forever.
  it("replaces a subscription bound to another service's key", async () => {
    setupDom();
    const { service, registerPush } = createService("did:web:notifs.example");
    const unsubscribe = mock.fn(async () => {});
    SUBSCRIPTION.options = {
      applicationServerKey: Uint8Array.from([9, 9, 9]).buffer,
    };
    SUBSCRIPTION.unsubscribe = unsubscribe;

    try {
      await service._subscribeAndRegister({ vapidPublicKey: VAPID_KEY });
    } finally {
      delete SUBSCRIPTION.options;
      SUBSCRIPTION.unsubscribe = async () => {};
    }

    assert.equal(unsubscribe.mock.calls.length, 1);
    assert.equal(
      JSON.parse(registerPush.mock.calls[0].arguments[0].token).endpoint,
      FRESH_SUBSCRIPTION.endpoint,
    );
  });

  it("keeps a subscription bound to this service's key", async () => {
    setupDom();
    const { service, registerPush } = createService("did:web:notifs.example");
    const unsubscribe = mock.fn(async () => {});
    SUBSCRIPTION.options = { applicationServerKey: VAPID_KEY_BYTES.buffer };
    SUBSCRIPTION.unsubscribe = unsubscribe;

    try {
      await service._subscribeAndRegister({ vapidPublicKey: VAPID_KEY });
    } finally {
      delete SUBSCRIPTION.options;
      SUBSCRIPTION.unsubscribe = async () => {};
    }

    assert.equal(unsubscribe.mock.calls.length, 0);
    assert.equal(
      JSON.parse(registerPush.mock.calls[0].arguments[0].token).endpoint,
      SUBSCRIPTION.endpoint,
    );
  });

  it("skips the launch re-assert when no service is selected", async () => {
    setupDom();
    const { service, registerPush } = createService();
    await service.reassertIfEnabled();
    assert.equal(registerPush.mock.calls.length, 0);
  });

  it("skips the launch re-assert when push is disabled", async () => {
    setupDom({ enabled: false });
    const { service, registerPush } = createService("did:web:notifs.example");
    await service.reassertIfEnabled();
    assert.equal(registerPush.mock.calls.length, 0);
  });

  // Revoking notifications in browser site settings tells us nothing, so the
  // stored flag is only reconciled the next time we go looking.
  it("clears the stored flag when permission was revoked out-of-band", async () => {
    setupDom({ granted: false });
    const { service, registerPush } = createService("did:web:notifs.example");
    await service.reassertIfEnabled();
    assert.equal(registerPush.mock.calls.length, 0);
    assert.equal(service.$enabled.get(), false);
  });

  it("disable() unregisters this device and clears the flag", async () => {
    setupDom();
    const { service } = createService("did:web:notifs.example");
    const unregisterPush = mock.fn(async () => {});
    service.api.unregisterPush = unregisterPush;
    await service.disable();
    assert.equal(unregisterPush.mock.calls.length, 1);
    const args = unregisterPush.mock.calls[0].arguments[0];
    assert.equal(args.appId, "social.impro");
    assert.equal(args.platform, "web");
    assert.deepEqual(JSON.parse(args.token), {
      endpoint: SUBSCRIPTION.endpoint,
      keys: SUBSCRIPTION.keys,
    });
    assert.equal(service.$enabled.get(), false);
  });

  // Only iOS withholds push from a browser tab, so installation is required
  // there and nowhere else.
  function simulateUninstalled({ ios }) {
    globalThis.window.matchMedia = (query) => ({
      matches: query === "(hover: none) and (pointer: coarse)",
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    });
    navigator.userAgent = ios ? "iPhone" : "Android";
  }

  it("is unsupported in an uninstalled iOS browser", () => {
    setupDom();
    simulateUninstalled({ ios: true });
    const { service } = createService();
    assert.equal(service.isSupported, false);
    assert.equal(service.isEnabled, false);
    // The one refusal the user can act on, so the settings copy can say how.
    assert.equal(service.requiresInstall, true);
  });

  it("is supported in an uninstalled non-iOS mobile browser", () => {
    setupDom();
    simulateUninstalled({ ios: false });
    const { service } = createService("did:web:notifs.example");
    assert.equal(service.isSupported, true);
    assert.equal(service.requiresInstall, false);
  });

  it("is unsupported on a device that isn't touch-only", () => {
    setupDom();
    // Desktop gets SystemNotificationService's in-tab notifications instead,
    // which is gated on the same check the other way round.
    globalThis.window.matchMedia = (query) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    });
    const { service } = createService();
    assert.equal(service.isSupported, false);
    assert.equal(service.isEnabled, false);
  });

  it("registers against the selected service, not the default", async () => {
    setupDom();
    const { service, registerPush } = createService(
      "did:web:elsewhere.example",
    );
    await service._subscribeAndRegister({ vapidPublicKey: "k" });
    assert.equal(
      registerPush.mock.calls[0].arguments[0].serviceDid,
      "did:web:elsewhere.example",
    );
  });

  // Removing an account happens from a different account's session, so the
  // teardown borrows the removed account's own session.
  function stubRemovedAccount(service) {
    const unregisterPush = mock.fn(async () => {});
    service._apiForAccount = mock.fn(async () => ({ unregisterPush }));
    return { unregisterPush };
  }

  it("unregisters a removed account at this device's service", async () => {
    setupDom();
    const { service } = createService("did:web:notifs.example");
    const { unregisterPush } = stubRemovedAccount(service);

    await service.unregisterAccount("did:plc:removed");

    assert.equal(
      service._apiForAccount.mock.calls[0].arguments[0],
      "did:plc:removed",
    );
    assert.equal(unregisterPush.mock.calls.length, 1);
    const args = unregisterPush.mock.calls[0].arguments[0];
    assert.equal(args.serviceDid, "did:web:notifs.example");
    assert.equal(args.appId, "social.impro");
    assert.equal(args.platform, "web");
    assert.deepEqual(JSON.parse(args.token), {
      endpoint: SUBSCRIPTION.endpoint,
      keys: SUBSCRIPTION.keys,
    });
  });

  it("skips the teardown on a device with no service", async () => {
    setupDom();
    const { service } = createService();
    const { unregisterPush } = stubRemovedAccount(service);

    await service.unregisterAccount("did:plc:removed");

    assert.equal(unregisterPush.mock.calls.length, 0);
  });

  // One browser subscription serves every signed-in account, so dropping it
  // would silently kill push for the accounts that remain.
  it("leaves the shared browser subscription in place", async () => {
    setupDom();
    const { service } = createService("did:web:notifs.example");
    const unsubscribe = mock.fn(async () => {});
    const originalUnsubscribe = SUBSCRIPTION.unsubscribe;
    SUBSCRIPTION.unsubscribe = unsubscribe;
    stubRemovedAccount(service);

    try {
      await service.unregisterAccount("did:plc:removed");
    } finally {
      SUBSCRIPTION.unsubscribe = originalUnsubscribe;
    }

    assert.equal(unsubscribe.mock.calls.length, 0);
    assert.equal(service.$enabled.get(), true);
  });

  // The caller decides what a failed teardown means; here it stays
  // best-effort, so the error has to surface rather than be swallowed.
  it("surfaces a failed teardown to the caller", async () => {
    setupDom();
    const { service } = createService("did:web:notifs.example");
    service._apiForAccount = async () => {
      throw new Error("session already gone");
    };
    await assert.rejects(
      () => service.unregisterAccount("did:plc:removed"),
      /session already gone/,
    );
  });

  // Tearing down the subscription strands every account still registered
  // against it, so disable() has to cover all of them.
  it("unregisters every signed-in account before unsubscribing", async () => {
    setupDom();
    const { service } = createService("did:web:notifs.example");
    const order = [];
    const unregisterPush = mock.fn(async () => {});
    service.api.unregisterPush = mock.fn(async () => order.push("current"));
    service._listAccountDids = async () => [
      "did:plc:current",
      "did:plc:other",
      "did:plc:third",
    ];
    service._apiForAccount = mock.fn(async (did) => ({
      unregisterPush: async (payload) => {
        order.push(did);
        return unregisterPush(payload);
      },
    }));
    const originalUnsubscribe = SUBSCRIPTION.unsubscribe;
    SUBSCRIPTION.unsubscribe = mock.fn(async () => order.push("unsubscribe"));

    try {
      await service.disable();
    } finally {
      SUBSCRIPTION.unsubscribe = originalUnsubscribe;
    }

    // The current account goes through the app's own api, and is not
    // unregistered twice.
    assert.deepEqual(order, [
      "current",
      "did:plc:other",
      "did:plc:third",
      "unsubscribe",
    ]);
    assert.equal(
      unregisterPush.mock.calls[0].arguments[0].serviceDid,
      "did:web:notifs.example",
    );
  });

  it("still unsubscribes when another account's teardown fails", async () => {
    setupDom();
    const { service } = createService("did:web:notifs.example");
    service.api.unregisterPush = mock.fn(async () => {});
    service._listAccountDids = async () => ["did:plc:other"];
    service._apiForAccount = async () => {
      throw new Error("session already gone");
    };
    const unsubscribe = mock.fn(async () => {});
    const originalUnsubscribe = SUBSCRIPTION.unsubscribe;
    SUBSCRIPTION.unsubscribe = unsubscribe;
    const originalError = console.error;
    console.error = () => {};

    try {
      await service.disable();
    } finally {
      SUBSCRIPTION.unsubscribe = originalUnsubscribe;
      console.error = originalError;
    }

    assert.equal(unsubscribe.mock.calls.length, 1);
    assert.equal(service.$enabled.get(), false);
  });
});

describe("PushNotificationService service selection", () => {
  let originals;
  let fetchCalls;

  const CONFIG = { name: "Example Notifs", vapidPublicKey: "k", authUrl: "u" };

  beforeEach(() => {
    originals = {
      localStorage: globalThis.localStorage,
      notification: globalThis.Notification,
      document: globalThis.document,
      navigator: Object.getOwnPropertyDescriptor(globalThis, "navigator"),
      pushManager: globalThis.window.PushManager,
      matchMedia: globalThis.window.matchMedia,
      fetch: globalThis.fetch,
    };
    setupDom({ enabled: false });
    fetchCalls = [];
    globalThis.fetch = async (url) => {
      fetchCalls.push(String(url));
      const body = String(url).includes("notif-service.json")
        ? CONFIG
        : {
            service: [
              {
                id: "#bsky_notif",
                type: "BskyNotificationService",
                serviceEndpoint: "https://notifs.example",
              },
            ],
          };
      return { ok: true, status: 200, json: async () => body };
    };
  });

  afterEach(() => {
    globalThis.localStorage = originals.localStorage;
    globalThis.Notification = originals.notification;
    globalThis.document = originals.document;
    globalThis.window.matchMedia = originals.matchMedia;
    Object.defineProperty(globalThis, "navigator", originals.navigator);
    globalThis.fetch = originals.fetch;
    if (originals.pushManager === undefined) {
      delete globalThis.window.PushManager;
    } else {
      globalThis.window.PushManager = originals.pushManager;
    }
  });

  // Impro suggests no service of its own, so nothing can happen until the
  // user names one.
  it("has no service until the user names one", () => {
    const { service } = createService();
    assert.equal(service.serviceDid, null);
    assert.equal(service.hasService, false);
  });

  it("cannot be enabled while no service is named", () => {
    const { service } = createService();
    globalThis.localStorage.setItem("push-notifications-enabled", "true");
    assert.equal(service.isEnabled, false);
  });

  it("refuses to resolve a config while no service is named", async () => {
    const { service } = createService();
    await assert.rejects(() => service.fetchServiceConfig(), {
      message: "No notification service selected",
    });
    assert.equal(fetchCalls.length, 0, "it must not hit the network");
  });

  // The choice is device state: it belongs to the browser, not the account,
  // because one subscription serves every account signed in here.
  it("naming a service persists it on the device across launches", async () => {
    const { service } = createService();
    await service.selectService("did:web:notifs.example");
    assert.equal(service.serviceDid, "did:web:notifs.example");
    assert.equal(service.hasService, true);
    assert.equal(
      globalThis.localStorage.getItem("push-notification-service"),
      "did:web:notifs.example",
    );

    // Same device, later launch.
    const { service: relaunched } = createService();
    assert.equal(relaunched.serviceDid, "did:web:notifs.example");
  });

  it("clearing the service clears the device's choice", async () => {
    const { service } = createService("did:web:notifs.example");

    await service.clearService();

    assert.equal(service.serviceDid, null);
    assert.equal(service.hasService, false);
    assert.equal(
      globalThis.localStorage.getItem("push-notification-service"),
      null,
    );
  });

  it("resolves a service through its DID document", async () => {
    const { service } = createService();
    const preview = await service.previewService("did:web:notifs.example");
    assert.equal(preview.name, "Example Notifs");
    assert.equal(preview.authUrl, "u");
  });

  it("resolves a service once per session", async () => {
    const { service } = createService();
    await service.selectService("did:web:notifs.example");
    await service.fetchServiceConfig();
    const afterFirst = fetchCalls.length;
    await service.fetchServiceConfig();
    assert.equal(
      fetchCalls.length,
      afterFirst,
      "a second lookup should not hit the network",
    );

    // A fresh instance is the app-launch case. It re-resolves rather than
    // reading a persisted copy: how long the config stays good is the
    // service's call, made in its own cache headers.
    const { service: relaunched } = createService();
    await relaunched.fetchServiceConfig();
    assert.ok(fetchCalls.length > afterFirst);
  });

  it("does not cache a failed lookup as the answer", async () => {
    const { service } = createService();
    await service.selectService("did:web:notifs.example");
    globalThis.fetch = async () => {
      throw new Error("offline");
    };
    await assert.rejects(() => service.fetchServiceConfig());

    globalThis.fetch = async (url) => ({
      ok: true,
      status: 200,
      json: async () =>
        String(url).includes("notif-service.json")
          ? CONFIG
          : {
              service: [
                {
                  id: "#bsky_notif",
                  serviceEndpoint: "https://notifs.example",
                },
              ],
            },
    });
    const config = await service.fetchServiceConfig();
    assert.equal(config.name, "Example Notifs");
  });

  it("switching services unregisters the old one first", async () => {
    globalThis.localStorage.setItem("push-notifications-enabled", "true");
    const { service } = createService();
    await service.selectService("did:web:notifs.example");
    const unregisterPush = mock.fn(async () => {});
    service.api.unregisterPush = unregisterPush;

    await service.selectService("did:web:elsewhere.example");

    // The old service polls server-side; leaving it registered would keep it
    // delivering after the user believes they have moved away from it.
    assert.equal(unregisterPush.mock.calls.length, 1);
    assert.equal(service.serviceDid, "did:web:elsewhere.example");
    assert.equal(service.isEnabled, false);
  });

  it("clearing the service unregisters it first", async () => {
    globalThis.localStorage.setItem("push-notifications-enabled", "true");
    const { service } = createService();
    await service.selectService("did:web:notifs.example");
    const unregisterPush = mock.fn(async () => {});
    service.api.unregisterPush = unregisterPush;

    await service.clearService();

    // Same reason as switching: the old service polls server-side, so it
    // must be unregistered before nothing points at it any more.
    assert.equal(unregisterPush.mock.calls.length, 1);
    assert.equal(service.serviceDid, null);
    assert.equal(service.hasService, false);
    assert.equal(service.isEnabled, false);
  });

  // Views read the service directly rather than re-reading storage when they
  // are navigated back to, so its state has to notify on change.
  it("notifies reactive readers when the service changes", async () => {
    const { service } = createService();
    const seen = [];
    // Effects flush on an animation frame, so each change needs one to land.
    const flush = () =>
      new Promise((resolve) => requestAnimationFrame(() => resolve()));
    const dispose = effect(() => {
      seen.push(service.serviceDid);
    });

    await service.selectService("did:web:notifs.example");
    await flush();
    await service.clearService();
    await flush();

    assert.deepEqual(seen, [null, "did:web:notifs.example", null]);
    dispose();
  });

  it("switching services replaces the stored choice", async () => {
    const { service } = createService();
    await service.selectService("did:web:notifs.example");
    await service.selectService("did:web:elsewhere.example");
    assert.equal(service.serviceDid, "did:web:elsewhere.example");
  });

  it("switching services drops the previous service's cached config", async () => {
    const { service } = createService();
    await service.selectService("did:web:notifs.example");
    await service.fetchServiceConfig();
    await service.selectService("did:web:elsewhere.example");
    const before = fetchCalls.length;
    await service.fetchServiceConfig();
    assert.ok(
      fetchCalls.length > before,
      "the new service must be resolved, not served from the old cache",
    );
  });
});
