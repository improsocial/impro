import { isNative } from "/js/utils.js";

const SW_URL = "/sw.js";
const RELAY_STORAGE_KEY = "system-notifications-relay-enabled";
const GET_SESSION_PATH = "/xrpc/com.atproto.server.getSession";

function base64UrlToUint8Array(base64Url) {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

// Cross-device relay (Tier 2): a device with Impro open relays a real push
// to the user's other, possibly fully-closed devices. The server never
// holds a login credential -- each request proves current identity by
// having the browser generate a DPoP proof for a call to its own PDS's
// getSession, which our function proxies through and trusts (see
// functions/_lib/dpopVerify.js and Session.buildDpopProof in oauth.js).
export class PushSubscriptionService {
  constructor(session) {
    this.session = session;
  }

  get isSupported() {
    return (
      !isNative() &&
      typeof navigator !== "undefined" &&
      "serviceWorker" in navigator &&
      typeof window !== "undefined" &&
      "PushManager" in window &&
      typeof this.session?.buildDpopProof === "function"
    );
  }

  get isEnabled() {
    return localStorage.getItem(RELAY_STORAGE_KEY) === "true";
  }

  // Returns the deployment's VAPID public key, or null if this deployment
  // hasn't configured Tier 2 (or the browser can't support it) -- the
  // settings UI uses this to decide whether to show the relay toggle.
  async probeAvailability() {
    if (!this.isSupported) return null;
    try {
      const response = await fetch("/push/vapid-public-key");
      if (!response.ok) return null;
      const { key } = await response.json();
      return key ?? null;
    } catch {
      return null;
    }
  }

  async _verificationCredentials(nonce = null) {
    const verificationUrl = `${this.session.serviceEndpoint}${GET_SESSION_PATH}`;
    const { accessToken, dpopProof } = await this.session.buildDpopProof(
      "GET",
      verificationUrl,
      { nonce },
    );
    return { verificationUrl, accessToken, dpopProof };
  }

  async _postWithNonceRetry(url, extraBody) {
    const post = async (nonce) => {
      const credentials = await this._verificationCredentials(nonce);
      return fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...credentials, ...extraBody }),
      });
    };
    let response = await post(null);
    if (response.status === 428) {
      const { nonce } = await response.json();
      response = await post(nonce);
    }
    return response;
  }

  async subscribe(vapidPublicKey) {
    if (!this.isSupported) return false;
    await navigator.serviceWorker.register(SW_URL);
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(vapidPublicKey),
    });
    let response;
    try {
      response = await this._postWithNonceRetry("/push/subscribe", {
        subscription: subscription.toJSON(),
      });
    } catch (error) {
      await subscription.unsubscribe().catch(() => {});
      throw error;
    }
    if (!response.ok) {
      await subscription.unsubscribe().catch(() => {});
      return false;
    }
    localStorage.setItem(RELAY_STORAGE_KEY, "true");
    return true;
  }

  async unsubscribe() {
    localStorage.removeItem(RELAY_STORAGE_KEY);
    if (!this.isSupported) return;
    const registration = await navigator.serviceWorker.getRegistration(SW_URL);
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe().catch(() => {});
    try {
      await this._postWithNonceRetry("/push/unsubscribe", { endpoint });
    } catch (error) {
      console.warn("push unsubscribe failed", error);
    }
  }

  async relay() {
    if (!this.isEnabled || !this.isSupported) return;
    try {
      const registration =
        await navigator.serviceWorker.getRegistration(SW_URL);
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription) return;
      await this._postWithNonceRetry("/push/relay", {
        callerEndpoint: subscription.endpoint,
      });
    } catch (error) {
      console.warn("push relay failed", error);
    }
  }
}
