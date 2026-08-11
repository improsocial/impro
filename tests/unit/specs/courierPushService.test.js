import { describe, it, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { CourierPushService } from "/js/push/courierPushService.js";

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
  Object.defineProperty(globalThis, "navigator", {
    value: {
      serviceWorker: {
        getRegistration: async () => ({
          pushManager: {
            getSubscription: async () => SUBSCRIPTION,
          },
        }),
      },
    },
    configurable: true,
    writable: true,
  });
}

function createService() {
  const registerPush = mock.fn(async () => {});
  const api = { registerPush };
  return { service: new CourierPushService(api), registerPush };
}

describe("CourierPushService heartbeat", () => {
  let timers;
  let originals;

  beforeEach(() => {
    timers = [];
    globalThis.setInterval = (fn) => {
      timers.push(fn);
      return timers.length;
    };
    globalThis.clearInterval = () => {};
    // The parallel runner reuses processes across test files, so every global
    // this suite touches must be restored exactly — a leftover fake document
    // breaks whatever runs next in the same worker.
    originals = {
      localStorage: globalThis.localStorage,
      notification: globalThis.Notification,
      document: globalThis.document,
      navigator: Object.getOwnPropertyDescriptor(globalThis, "navigator"),
      pushManager: globalThis.window.PushManager,
    };
  });

  afterEach(() => {
    globalThis.localStorage = originals.localStorage;
    globalThis.Notification = originals.notification;
    globalThis.document = originals.document;
    Object.defineProperty(globalThis, "navigator", originals.navigator);
    if (originals.pushManager === undefined) {
      delete globalThis.window.PushManager;
    } else {
      globalThis.window.PushManager = originals.pushManager;
    }
  });

  it("re-registers the existing subscription without prompting", async () => {
    setupDom();
    const { service, registerPush } = createService();
    await service._heartbeat();
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

  it("is throttled within half the interval", async () => {
    setupDom();
    const { service, registerPush } = createService();
    await service._heartbeat();
    await service._heartbeat(); // immediately after: throttled
    assert.equal(registerPush.mock.calls.length, 1);
  });

  it("stops and skips when push is disabled", async () => {
    setupDom({ enabled: false });
    const { service, registerPush } = createService();
    await service._heartbeat();
    assert.equal(registerPush.mock.calls.length, 0);
  });

  it("stops when permission was revoked out-of-band", async () => {
    setupDom({ granted: false });
    const { service, registerPush } = createService();
    await service._heartbeat();
    assert.equal(registerPush.mock.calls.length, 0);
  });

  it("startHeartbeat registers one interval and one visibility listener", () => {
    setupDom();
    const { service } = createService();
    service.startHeartbeat();
    service.startHeartbeat(); // idempotent
    assert.equal(timers.length, 1);
    assert.ok(globalThis.document._listeners.visibilitychange);
  });

  it("disable() stops the heartbeat", async () => {
    setupDom();
    const { service } = createService();
    service.startHeartbeat();
    const unregisterPush = mock.fn(async () => {});
    service.api.unregisterPush = unregisterPush;
    await service.disable();
    assert.equal(service._heartbeatTimer, null);
    assert.equal(globalThis.document._listeners.visibilitychange, undefined);
  });

  it("a failing beat does not throw", async () => {
    setupDom();
    const api = {
      registerPush: mock.fn(async () => {
        throw new Error("network");
      }),
    };
    const service = new CourierPushService(api);
    await assert.doesNotReject(() => service._heartbeat());
  });
});
