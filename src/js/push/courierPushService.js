import { resolveDid, getServiceEndpointFromDidDoc } from "/js/atproto.js";
import { Signal } from "/js/signals.js";
import { isTouchOnlyDevice, isStandalonePWA, isIOS } from "/js/utils.js";
import { auth } from "/js/auth.js";
import { Api } from "/js/api.js";
import { Preferences } from "/js/preferences.js";

const STORAGE_KEY = "courier-push-enabled";
const APP_ID = "social.impro";
const PLATFORM = "web";
const SW_PATH = "/sw.js";
const NOTIF_SERVICE_ID = "#bsky_notif";

async function resolveNotifServiceEndpoint(did) {
  const doc = await resolveDid(did);
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

// Client-side half of the spec's "Enable flow".
export class CourierPushService {
  constructor(api, dataLayer) {
    this.api = api;
    this.dataLayer = dataLayer;
    this._configPromise = null;
    this.$enabled = new Signal.State(
      localStorage.getItem(STORAGE_KEY) === "true",
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

  get serviceDid() {
    return this.dataLayer?.derived.$notificationServiceDid.get() ?? null;
  }

  get hasService() {
    return this.serviceDid !== null;
  }

  _setEnabled(enabled) {
    if (enabled) {
      localStorage.setItem(STORAGE_KEY, "true");
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    this.$enabled.set(enabled);
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
    await this.dataLayer.mutations.setNotificationServiceDid(did);
  }

  async clearService() {
    if (!this.hasService) return;
    if (this.isEnabled) {
      await this.disable();
    }
    this._forgetConfig();
    await this.dataLayer.mutations.setNotificationServiceDid(null);
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
  }

  async reassertIfEnabled() {
    if (!this.$enabled.get() || !this.isSupported || !this.hasService) return;
    if (Notification.permission !== "granted") {
      // Permission was revoked out-of-band (browser site settings).
      this._setEnabled(false);
      return;
    }
    try {
      const config = await this.fetchServiceConfig();
      await this._subscribeAndRegister(config);
    } catch (error) {
      console.error("Failed to re-assert push registration", error);
    }
  }

  async _apiForAccount(did) {
    const session = await auth.getSession(did);
    return session ? new Api(session) : null;
  }

  async unregisterAccount(did) {
    const subscription = await this._getSubscription();
    if (!subscription) return;
    const api = await this._apiForAccount(did);
    if (!api) return;
    const preferences = new Preferences(await api.getPreferences(), null, {
      persist: false,
    });
    const serviceDid = preferences.getNotificationServiceDid();
    if (!serviceDid) return;
    await api.unregisterPush({
      serviceDid,
      token: JSON.stringify(subscription),
      platform: PLATFORM,
      appId: APP_ID,
    });
  }

  async _getSubscription() {
    if (!("serviceWorker" in navigator)) return null;
    const registration = await navigator.serviceWorker.getRegistration(SW_PATH);
    return (await registration?.pushManager.getSubscription()) ?? null;
  }

  async disable() {
    this._setEnabled(false);
    const subscription = await this._getSubscription();
    if (!subscription) return;
    try {
      await this.api.unregisterPush({
        serviceDid: this.serviceDid,
        token: JSON.stringify(subscription),
        platform: PLATFORM,
        appId: APP_ID,
      });
    } catch (error) {
      console.error("Failed to unregister push subscription", error);
    }
    await subscription.unsubscribe();
  }
}
