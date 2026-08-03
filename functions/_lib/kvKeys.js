// KV key format for PUSH_SUBSCRIPTIONS, shared so subscribe/unsubscribe/relay
// can't drift out of sync with each other.

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function subscriptionKey(did, endpoint) {
  return `sub:${did}:${await sha256Hex(endpoint)}`;
}

export function subscriptionPrefix(did) {
  return `sub:${did}:`;
}

export function throttleKey(action, did) {
  return `throttle:${action}:${did}`;
}
