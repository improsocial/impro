import { base64UrlEncode, encodeUtf8 } from "./dpopVerify.js";

// RFC 8292 recommends VAPID JWTs expire within 24h; keep well under that.
const VAPID_JWT_LIFETIME_SECONDS = 12 * 60 * 60;

async function importVapidPrivateKey(privateJwk) {
  return crypto.subtle.importKey(
    "jwk",
    privateJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

// Builds the `Authorization: vapid t=<jwt>, k=<publicKey>` header Web Push
// services expect (RFC 8292). No payload/encryption involved -- pushes are
// sent empty, so there's nothing here beyond identifying our server.
export async function buildVapidAuthorizationHeader({
  endpoint,
  privateJwk,
  publicKey,
  subject,
}) {
  const origin = new URL(endpoint).origin;
  const privateKey = await importVapidPrivateKey(privateJwk);
  const now = Math.floor(Date.now() / 1000);
  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: origin,
    exp: now + VAPID_JWT_LIFETIME_SECONDS,
    sub: subject,
  };

  const headerB64 = base64UrlEncode(encodeUtf8(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(encodeUtf8(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    encodeUtf8(signingInput),
  );
  const jwt = `${signingInput}.${base64UrlEncode(signature)}`;

  return `vapid t=${jwt}, k=${publicKey}`;
}
