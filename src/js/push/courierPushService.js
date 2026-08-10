import { NOTIFICATION_SERVICE_DID } from "/js/config.js";

const STORAGE_KEY = "courier-push-enabled";
const PREVIEWS_KEY = "courier-push-chat-previews";
const APP_ID = "social.impro";
const PLATFORM = "web";
const SW_PATH = "/sw.js";

// Resolves a did:web document to find its URL. impro doesn't otherwise need
// general DID resolution here since the notification service is hardcoded
// to one did:web deployment (see NOTIFICATION_SERVICE_DID) rather than
// user-selectable per the spec's full design.
function didWebToDidDocUrl(did) {
  const id = did.slice("did:web:".length);
  const parts = id.split(":").map(decodeURIComponent);
  const [host, ...pathParts] = parts;
  return pathParts.length
    ? `https://${host}/${pathParts.join("/")}/did.json`
    : `https://${host}/.well-known/did.json`;
}

async function resolveNotifServiceEndpoint(did) {
  if (!did.startsWith("did:web:")) {
    throw new Error(`Unsupported notification service DID method: ${did}`);
  }
  const res = await fetch(didWebToDidDocUrl(did));
  if (!res.ok) {
    throw new Error(
      `Failed to resolve notification service DID (${res.status})`,
    );
  }
  const doc = await res.json();
  const service = (doc.service ?? []).find(
    (entry) => entry.id === "#bsky_notif",
  );
  if (!service?.serviceEndpoint) {
    throw new Error(
      "Notification service DID document has no #bsky_notif entry",
    );
  }
  return service.serviceEndpoint;
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

// Client-side half of spec/IMPRO_PUSH_NOTIFICATIONS.md's "Enable flow",
// scoped down to a single hardcoded service (no user-selectable-service
// picker).
export class CourierPushService {
  constructor(api) {
    this.api = api;
  }

  get isSupported() {
    return (
      typeof Notification !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window
    );
  }

  get isEnabled() {
    return this.isSupported && localStorage.getItem(STORAGE_KEY) === "true";
  }

  // The tier the service last confirmed, per the spec's callback echo — not
  // what was asked for. The grant is account-level, so another device may
  // have changed it; only the echo is truthful, and it self-corrects every
  // time the flow runs.
  get chatPreviewsEnabled() {
    return localStorage.getItem(PREVIEWS_KEY) === "true";
  }

  async fetchServiceConfig() {
    const serviceEndpoint = await resolveNotifServiceEndpoint(
      NOTIFICATION_SERVICE_DID,
    );
    const res = await fetch(
      `${serviceEndpoint}/.well-known/notif-service.json`,
    );
    if (!res.ok) {
      throw new Error(
        `Failed to fetch notification service config (${res.status})`,
      );
    }
    return { ...(await res.json()), serviceEndpoint };
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
  // auth handoff. `chatPreviews` is the service's echo of the tier it
  // actually granted, which is what gets persisted — never what was
  // requested.
  async completeEnableFlow({ chatPreviews = false } = {}) {
    const config = await this.fetchServiceConfig();
    await this._subscribeAndRegister(config);
    localStorage.setItem(PREVIEWS_KEY, chatPreviews ? "true" : "false");
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
      serviceDid: NOTIFICATION_SERVICE_DID,
      token: JSON.stringify(subscription),
      platform: PLATFORM,
      appId: APP_ID,
    });
    localStorage.setItem(STORAGE_KEY, "true");
  }

  // Re-assert registration on every app launch: registerPush is an
  // idempotent upsert and there is no API to query registration state, so
  // this is the self-healing path for a rotated or lost subscription.
  async reassertIfEnabled() {
    if (localStorage.getItem(STORAGE_KEY) !== "true" || !this.isSupported)
      return;
    if (Notification.permission !== "granted") {
      // Permission was revoked out-of-band (browser site settings).
      localStorage.removeItem(STORAGE_KEY);
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
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PREVIEWS_KEY);
    if (!("serviceWorker" in navigator)) return;
    const registration = await navigator.serviceWorker.getRegistration(SW_PATH);
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    try {
      await this.api.unregisterPush({
        serviceDid: NOTIFICATION_SERVICE_DID,
        token: JSON.stringify(subscription),
      });
    } catch (error) {
      console.error("Failed to unregister push subscription", error);
    }
    await subscription.unsubscribe();
  }
}
