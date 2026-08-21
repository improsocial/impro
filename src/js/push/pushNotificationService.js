import { resolveDid, getServiceEndpointFromDidDoc } from "/js/atproto.js";
import { Signal } from "/js/signals.js";
import { isTouchOnlyDevice, isStandalonePWA, isIOS } from "/js/utils.js";
import { Api, ApiError } from "/js/api.js";

const STORAGE_KEY = "push-notifications-enabled";
const SERVICE_STORAGE_KEY = "push-notification-service";
const NEEDS_REAUTH_STORAGE_KEY = "push-notifications-needs-reauth";
const APP_ID = "social.impro";
const PLATFORM = "web";
const SW_PATH = "/sw.js";
const NOTIF_SERVICE_ID = "#bsky_notif";

async function resolveNotifServiceEndpoint(did) {
  const doc = await resolveDid(did);
  if (!doc) {
    throw new Error(`Notification service DID ${did} could not be resolved`);
  }
  const endpoint = getServiceEndpointFromDidDoc(doc, NOTIF_SERVICE_ID);
  if (!endpoint) {
    throw new Error(
      "Notification service DID document has no #bsky_notif entry",
    );
  }
  return endpoint;
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const bytes = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    bytes[i] = rawData.charCodeAt(i);
  }
  return bytes;
}

function matchesVapidKey(subscription, vapidPublicKey) {
  const existing = subscription.options?.applicationServerKey;
  if (!existing) return true;
  const bytes = new Uint8Array(existing);
  const expected = urlBase64ToUint8Array(vapidPublicKey);
  return (
    bytes.length === expected.length &&
    bytes.every((byte, index) => byte === expected[index])
  );
}

export class PushNotificationService {
  constructor(api, auth) {
    this.api = api;
    this.auth = auth;
    this._configPromise = null;
    this.$enabled = new Signal.State(
      localStorage.getItem(STORAGE_KEY) === "true",
    );
    this.$deviceServiceDid = new Signal.State(
      localStorage.getItem(SERVICE_STORAGE_KEY),
    );
    this.$needsReauth = new Signal.State(
      localStorage.getItem(NEEDS_REAUTH_STORAGE_KEY) === "true",
    );
  }

  get isSupported() {
    return (
      isTouchOnlyDevice() &&
      (isStandalonePWA() || !isIOS()) &&
      typeof Notification !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window
    );
  }

  get requiresInstall() {
    return !this.isSupported && isTouchOnlyDevice() && isIOS();
  }

  get isEnabled() {
    return this.isSupported && this.hasService && this.$enabled.get();
  }

  // A browser holds one push subscription, bound to one service's VAPID key,
  // shared by every account signed in here — so the choice is per-device.
  get serviceDid() {
    return this.$deviceServiceDid.get();
  }

  get hasService() {
    return this.serviceDid !== null;
  }

  get needsReauth() {
    return this.$needsReauth.get();
  }

  _setDeviceServiceDid(did) {
    if (did === null) {
      localStorage.removeItem(SERVICE_STORAGE_KEY);
    } else {
      localStorage.setItem(SERVICE_STORAGE_KEY, did);
    }
    this.$deviceServiceDid.set(did);
  }

  _setEnabled(enabled) {
    if (enabled) {
      localStorage.setItem(STORAGE_KEY, "true");
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    this.$enabled.set(enabled);
  }

  _setNeedsReauth(needsReauth) {
    if (needsReauth) {
      localStorage.setItem(NEEDS_REAUTH_STORAGE_KEY, "true");
    } else {
      localStorage.removeItem(NEEDS_REAUTH_STORAGE_KEY);
    }
    this.$needsReauth.set(needsReauth);
  }

  async previewService(did) {
    const config = await this._loadServiceConfig(did);
    return { did, name: config.name ?? did, authUrl: config.authUrl ?? null };
  }

  async selectService(did) {
    if (did === this.serviceDid) return;
    if (this.isEnabled) {
      await this.disable();
    }
    this._forgetConfig();
    this._setNeedsReauth(false);
    this._setDeviceServiceDid(did);
  }

  async clearService() {
    if (!this.hasService) return;
    if (this.isEnabled) {
      await this.disable();
    }
    this._forgetConfig();
    this._setNeedsReauth(false);
    this._setDeviceServiceDid(null);
  }

  async fetchServiceConfig() {
    if (!this.hasService) {
      throw new Error("No notification service selected");
    }
    return this._loadServiceConfig(this.serviceDid);
  }

  async _loadServiceConfig(did) {
    if (did === this.serviceDid && this._configPromise) {
      return this._configPromise;
    }

    const promise = (async () => {
      const serviceEndpoint = await resolveNotifServiceEndpoint(did);
      const res = await fetch(
        `${serviceEndpoint}/.well-known/notif-service.json`,
      );
      if (!res.ok) {
        throw new Error(
          `Failed to fetch notification service config (${res.status})`,
        );
      }
      return { ...(await res.json()), serviceEndpoint };
    })();

    if (did === this.serviceDid) {
      this._configPromise = promise;
      // A failed lookup must not be cached as the answer forever.
      promise.catch(() => {
        this._configPromise = null;
      });
    }
    return promise;
  }

  _forgetConfig() {
    this._configPromise = null;
  }

  async startEnableFlow({ chatPreviews = false } = {}) {
    const config = await this.fetchServiceConfig();
    const returnUrl = `${window.location.origin}/settings/notifications`;
    if (!config.authUrl) {
      await this._subscribeAndRegister(config);
      return;
    }
    const url = new URL(config.authUrl);
    url.searchParams.set("login_hint", this.api.session.did);
    url.searchParams.set("return_url", returnUrl);
    url.searchParams.set("chat_previews", chatPreviews ? "1" : "0");
    window.location.href = url.toString();
    await new Promise(() => {}); // unreachable: navigating away
  }

  async completeEnableFlow() {
    const config = await this.fetchServiceConfig();
    await this._subscribeAndRegister(config);
  }

  async _subscribeAndRegister(config) {
    const registration = await navigator.serviceWorker.register(SW_PATH);
    await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (subscription && !matchesVapidKey(subscription, config.vapidPublicKey)) {
      await subscription.unsubscribe();
      subscription = null;
    }
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.vapidPublicKey),
      });
    }
    await this.api.registerPush({
      serviceDid: this.serviceDid,
      token: JSON.stringify(subscription),
      platform: PLATFORM,
      appId: APP_ID,
    });
    this._setEnabled(true);
    this._setNeedsReauth(false);
  }

  async reassertIfEnabled() {
    if (!this.$enabled.get() || !this.isSupported || !this.hasService) {
      return { enabled: this.isEnabled };
    }
    if (Notification.permission !== "granted") {
      // Permission was revoked out-of-band (browser site settings).
      this._setEnabled(false);
      return { enabled: false };
    }
    try {
      const config = await this.fetchServiceConfig();
      await this._subscribeAndRegister(config);
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.status === 401 || error.status === 403)
      ) {
        const alreadyKnown = this.$needsReauth.get();
        this._setNeedsReauth(true);
        return { enabled: true, newlyRevoked: !alreadyKnown };
      }
      console.error("Failed to re-assert push registration", error);
    }
    return { enabled: true };
  }

  async _apiForAccount(did) {
    const session = await this.auth.getSession(did);
    return session
      ? new Api(session, { onLogout: (did) => this.auth.logout(did) })
      : null;
  }

  async unregisterAccount(did) {
    const subscription = await this._getSubscription();
    if (!subscription || !this.serviceDid) return;
    const api = await this._apiForAccount(did);
    if (!api) return;
    await api.unregisterPush(this._unregisterPayload(subscription));
  }

  _unregisterPayload(subscription) {
    return {
      serviceDid: this.serviceDid,
      token: JSON.stringify(subscription),
      platform: PLATFORM,
      appId: APP_ID,
    };
  }

  async _listAccountDids() {
    try {
      return (await this.auth.listAccounts()).map((account) => account.did);
    } catch (error) {
      console.warn("Failed to list accounts for push teardown", error);
      return [];
    }
  }

  async _unregisterDevice(subscription) {
    if (!this.serviceDid) return;
    const payload = this._unregisterPayload(subscription);
    const currentDid = this.api.session?.did ?? null;
    try {
      await this.api.unregisterPush(payload);
    } catch (error) {
      console.error("Failed to unregister push subscription", error);
    }
    for (const did of await this._listAccountDids()) {
      if (did === currentDid) continue;
      try {
        const api = await this._apiForAccount(did);
        await api?.unregisterPush(payload);
      } catch (error) {
        console.error("Failed to unregister push for another account", error);
      }
    }
  }

  async _getSubscription() {
    if (!("serviceWorker" in navigator)) return null;
    const registration = await navigator.serviceWorker.getRegistration(SW_PATH);
    return (await registration?.pushManager.getSubscription()) ?? null;
  }

  async disable() {
    this._setEnabled(false);
    this._setNeedsReauth(false);
    const subscription = await this._getSubscription();
    if (!subscription) return;
    await this._unregisterDevice(subscription);
    await subscription.unsubscribe();
  }
}
