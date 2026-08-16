import { resolveDid, getServiceEndpointFromDidDoc } from "/js/atproto.js";
import { Signal } from "/js/signals.js";

const STORAGE_KEY = "courier-push-enabled";
const CONFIG_CACHE_KEY = "courier-push-service-config";
const APP_ID = "social.impro";
const PLATFORM = "web";
const SW_PATH = "/sw.js";
const NOTIF_SERVICE_ID = "#bsky_notif";

// Keeps the account on the service's fast poll cadence while the user is here.
//
// Must stay comfortably under the service's own active window (300s on the
// reference deployment) — that is the coupling this number exists to satisfy,
// and the only reason it is not larger. Every beat is a PDS round-trip, so
// beating far more often than the window buys nothing and costs traffic on
// somebody else's infrastructure.
const HEARTBEAT_INTERVAL_MS = 240_000;

// How long a fetched service config is reused before being re-fetched. The
// documents are effectively static; without this the app re-fetches a DID
// document and a config document on every launch.
const CONFIG_TTL_MS = 6 * 60 * 60 * 1000;

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
      typeof Notification !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window
    );
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

  // Memoized per instance, then cached in localStorage for CONFIG_TTL_MS.
  //
  // Resolving a service costs two network round-trips (a DID document, then
  // the config document) and both are effectively static. Without this the app
  // pays for them on every launch, and again whenever a heartbeat has to fall
  // back to a full re-assert.
  async _loadServiceConfig(did) {
    if (did === this.serviceDid && this._configPromise) {
      return this._configPromise;
    }

    const cached = this._cachedConfig(did);
    if (cached) {
      if (did === this.serviceDid) {
        this._configPromise = Promise.resolve(cached);
      }
      return cached;
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
      const config = { ...(await res.json()), serviceEndpoint };
      this._cacheConfig(did, config);
      return config;
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

  _cachedConfig(did) {
    try {
      const raw = localStorage.getItem(CONFIG_CACHE_KEY);
      if (!raw) return null;
      const entry = JSON.parse(raw);
      if (entry.did !== did) return null;
      if (Date.now() - entry.at > CONFIG_TTL_MS) return null;
      return entry.config;
    } catch {
      return null;
    }
  }

  _cacheConfig(did, config) {
    try {
      localStorage.setItem(
        CONFIG_CACHE_KEY,
        JSON.stringify({ did, at: Date.now(), config }),
      );
    } catch {
      // A full or unavailable localStorage costs a re-fetch, nothing more.
    }
  }

  _forgetConfig() {
    this._configPromise = null;
    localStorage.removeItem(CONFIG_CACHE_KEY);
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
    this.startHeartbeat();
  }

  async _subscribeAndRegister(config) {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      throw new Error(permission === "denied" ? "denied" : "dismissed");
    }
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
    this.startHeartbeat();
  }

  // User-activity signal for the courier's adaptive cadence.
  //
  // The service decides poll frequency from "how recently was this account
  // active", and the only activity signal in the protocol is registerPush
  // (an idempotent upsert the service already counts as activity — no new
  // method, no new scope). While the user has this app open, re-asserting
  // keeps the account on the fast cadence; when the tab goes away the
  // heartbeats stop and the service lets the account wind down to idle on
  // its own, which is the correct behavior for a user who's gone.
  startHeartbeat() {
    if (this._heartbeatTimer) return;
    const beat = () => this._heartbeat();
    this._heartbeatTimer = setInterval(beat, HEARTBEAT_INTERVAL_MS);
    // Coming back to the tab is activity right now — beat once on the way
    // in rather than waiting up to a full interval.
    this._visibilityHandler = () => {
      if (document.visibilityState === "visible") beat();
    };
    document.addEventListener("visibilitychange", this._visibilityHandler);
  }

  stopHeartbeat() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
    if (this._visibilityHandler) {
      document.removeEventListener("visibilitychange", this._visibilityHandler);
      this._visibilityHandler = null;
    }
  }

  async _heartbeat() {
    // A hidden tab is not the user being here. The interval keeps running so
    // the beat resumes the moment the tab comes back (the visibilitychange
    // listener also fires one immediately), but no traffic goes out while the
    // user is elsewhere — and the service lets the account wind down to idle
    // on its own, which is right for a user who's gone.
    if (document.visibilityState !== "visible") return;

    // Throttle: visibility flips can be rapid, and every beat is a PDS
    // round-trip.
    const now = Date.now();
    if (now - (this._lastHeartbeat ?? 0) < HEARTBEAT_INTERVAL_MS / 2) return;
    this._lastHeartbeat = now;

    if (!this.$enabled.get() || !this.isSupported) {
      this.stopHeartbeat();
      return;
    }
    if (Notification.permission !== "granted") {
      this.stopHeartbeat();
      return;
    }
    try {
      // Direct re-registration with the subscription this device already
      // holds — no permission prompt, no subscribe dance, one PDS
      // round-trip. registerPush is an idempotent upsert, and the service
      // counts it as activity, which is the whole point of the beat.
      const registration =
        await navigator.serviceWorker.getRegistration(SW_PATH);
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription) {
        // No local subscription (rotated or lost) — the full re-assert path
        // is the self-healing recovery for exactly this case.
        const config = await this.fetchServiceConfig();
        await this._subscribeAndRegister(config);
        return;
      }
      await this.api.registerPush({
        serviceDid: this.serviceDid,
        token: JSON.stringify(subscription),
        platform: PLATFORM,
        appId: APP_ID,
      });
    } catch (error) {
      // A heartbeat that fails is just a heartbeat that didn't happen —
      // the service's cadence degrades gracefully and the next one retries.
      console.warn("Courier activity heartbeat failed", error);
    }
  }

  // Unregisters just this device (per spec, callers must always do this on
  // logout — the service polls server-side, so nothing else stops pushes
  // for a logged-out account from reaching this device).
  async disable() {
    this.stopHeartbeat();
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
