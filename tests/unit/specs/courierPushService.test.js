import { describe, it, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { CourierPushService } from "/js/push/courierPushService.js";
import { Signal, effect } from "/js/signals.js";

const SUBSCRIPTION = {
  endpoint: "https://push.example/ep/abc",
  keys: { p256dh: "p", auth: "a" },
  unsubscribe: async () => {},
};

function setupDom({ enabled = true, granted = true } = {}) {
  globalThis.localStorage = {
    _data: enabled ? { "courier-push-enabled": "true" } : {},
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

// The chosen service lives in account preferences, so the service reads it
// through the dataLayer. Share one of these between two CourierPushService
// instances to model the same account on a later launch.
function makeDataLayer(serviceDid = null) {
  const $notificationServiceDid = new Signal.State(serviceDid);
  return {
    derived: { $notificationServiceDid },
    mutations: {
      setNotificationServiceDid: mock.fn(async (did) => {
        $notificationServiceDid.set(did);
      }),
    },
  };
}

function createService(dataLayer = makeDataLayer()) {
  const registerPush = mock.fn(async () => {});
  const api = { registerPush };
  return {
    service: new CourierPushService(api, dataLayer),
    registerPush,
    dataLayer,
  };
}

describe("CourierPushService registration", () => {
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

  it("skips the launch re-assert when no service is selected", async () => {
    setupDom();
    const { service, registerPush } = createService();
    await service.reassertIfEnabled();
    assert.equal(registerPush.mock.calls.length, 0);
  });

  it("skips the launch re-assert when push is disabled", async () => {
    setupDom({ enabled: false });
    const { service, registerPush } = createService(
      makeDataLayer("did:web:notifs.example"),
    );
    await service.reassertIfEnabled();
    assert.equal(registerPush.mock.calls.length, 0);
  });

  // Revoking notifications in browser site settings tells us nothing, so the
  // stored flag is only reconciled the next time we go looking.
  it("clears the stored flag when permission was revoked out-of-band", async () => {
    setupDom({ granted: false });
    const { service, registerPush } = createService(
      makeDataLayer("did:web:notifs.example"),
    );
    await service.reassertIfEnabled();
    assert.equal(registerPush.mock.calls.length, 0);
    assert.equal(service.$enabled.get(), false);
  });

  it("disable() unregisters this device and clears the flag", async () => {
    setupDom();
    const { service } = createService();
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
    const { service } = createService(makeDataLayer("did:web:notifs.example"));
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
      makeDataLayer("did:web:elsewhere.example"),
    );
    await service._subscribeAndRegister({ vapidPublicKey: "k" });
    assert.equal(
      registerPush.mock.calls[0].arguments[0].serviceDid,
      "did:web:elsewhere.example",
    );
  });
});

describe("CourierPushService service selection", () => {
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
    globalThis.localStorage.setItem("courier-push-enabled", "true");
    assert.equal(service.isEnabled, false);
  });

  it("refuses to resolve a config while no service is named", async () => {
    const { service } = createService();
    await assert.rejects(() => service.fetchServiceConfig(), {
      message: "No notification service selected",
    });
    assert.equal(fetchCalls.length, 0, "it must not hit the network");
  });

  it("naming a service persists it across launches", async () => {
    const { service, dataLayer } = createService();
    await service.selectService("did:web:notifs.example");
    assert.equal(service.serviceDid, "did:web:notifs.example");
    assert.equal(service.hasService, true);

    // Same account, later launch: the choice comes back from preferences.
    const { service: relaunched } = createService(dataLayer);
    assert.equal(relaunched.serviceDid, "did:web:notifs.example");
  });

  it("resolves a service through its DID document", async () => {
    const { service } = createService();
    const preview = await service.previewService("did:web:notifs.example");
    assert.equal(preview.name, "Example Notifs");
    assert.equal(preview.authUrl, "u");
  });

  it("resolves a service once per session", async () => {
    const { service, dataLayer } = createService();
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
    const { service: relaunched } = createService(dataLayer);
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
    globalThis.localStorage.setItem("courier-push-enabled", "true");
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
    globalThis.localStorage.setItem("courier-push-enabled", "true");
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
