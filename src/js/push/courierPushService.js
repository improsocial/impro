import { resolveDid, getServiceEndpointFromDidDoc } from "/js/atproto.js";
import { Signal } from "/js/signals.js";
import { isTouchOnlyDevice, isStandalonePWA, isIOS } from "/js/utils.js";

const STORAGE_KEY = "courier-push-enabled";
const APP_ID = "social.impro";
const PLATFORM = "web";
const SW_PATH = "/sw.js";
const NOTIF_SERVICE_ID = "#bsky_notif";

async function resolveNotifServiceEndpoint(did) {
  // resolveDid handles did:plc and did:web alike, so a service is not
  // restricted to one DID method the way a hand-rolled did:web resolver
  // would make it.
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

  // The service this account is pointed at, or null if the user has not named
  // one. Impro suggests none: a service holds a read-only grant over the
  // account and polls on the user's behalf, so the choice is always theirs.
  get serviceDid() {
    return this.dataLayer?.derived.$notificationServiceDid.get() ?? null;
  }

  // Nothing can be enabled, resolved or registered until the user has named a
  // service, so every entry point gates on this.
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

  // Resolves a service DID far enough to show the user what they are about to
  // trust, without registering anything. Used by the picker to validate an
  // entered DID before it can be selected.
  async previewService(did) {
    const config = await this._loadServiceConfig(did);
    return { did, name: config.name ?? did, authUrl: config.authUrl ?? null };
  }

  // Switches to a different service, tearing down the current one first.
  //
  // Order matters: the old service polls server-side on the user's behalf, so
  // leaving it registered would keep it delivering after the user thinks they
  // have moved away from it.
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

  // Step 1 of the enable flow: navigates the browser away to the service's
  // auth handoff. Call this only after the user has confirmed the consent
  // interstitial — per the spec, consent must precede burning the one-shot
  // permission prompt in step 2.
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

  // Step 2: called by the settings view when it detects a return from the
  // auth handoff. The grant tier the service echoed back is the caller's to
  // hold — it is not something this class can know on any other page load.
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

  // Re-assert registration on every app launch: registerPush is an
  // idempotent upsert and there is no API to query registration state, so
  // this is the self-healing path for a rotated or lost subscription.
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

  // Unregisters just this device (per spec, callers must always do this on
  // logout — the service polls server-side, so nothing else stops pushes
  // for a logged-out account from reaching this device).
  async disable() {
    this._setEnabled(false);
    if (!("serviceWorker" in navigator)) return;
    const registration = await navigator.serviceWorker.getRegistration(SW_PATH);
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    try {
      await this.api.unregisterPush({
        serviceDid: this.serviceDid,
        token: JSON.stringify(subscription),
      });
    } catch (error) {
      console.error("Failed to unregister push subscription", error);
    }
    await subscription.unsubscribe();
  }
}
