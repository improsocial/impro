// Shared helpers for functions/oauth/assertion.js and functions/push/*.js.
// Files under functions/_lib/ are not routed by Cloudflare Pages (any path
// segment starting with "_" is excluded from routing), so this is safe to
// import from sibling function files without creating an extra endpoint.

export function base64UrlEncode(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export function encodeUtf8(str) {
  return new TextEncoder().encode(str);
}

const GET_SESSION_PATH = "/xrpc/com.atproto.server.getSession";

export class IdentityVerificationError extends Error {
  constructor(code) {
    super(code);
    this.name = "IdentityVerificationError";
    this.code = code;
  }
}

// Confirms "this caller is currently authenticated as some DID" without
// this function ever holding a usable credential of its own. The browser's
// OAuth session is DPoP-bound to a non-extractable, browser-generated key
// (see src/js/oauth.js), so a bare access token is useless off-browser --
// but a DPoP proof the browser already signed for one specific request is
// safe to forward. We proxy exactly that one request (a GET to the caller's
// own PDS's com.atproto.server.getSession) and trust the PDS's own
// authoritative response.
//
// `verificationUrl` must be the exact URL the browser used as the DPoP
// proof's `htu` claim (https, path ending in GET_SESSION_PATH) -- proxying
// only that shape keeps this from being usable as an open HTTP proxy.
export async function verifyIdentity({
  verificationUrl,
  accessToken,
  dpopProof,
}) {
  if (!verificationUrl || !accessToken || !dpopProof) {
    throw new IdentityVerificationError("missing_credentials");
  }
  let url;
  try {
    url = new URL(verificationUrl);
  } catch {
    throw new IdentityVerificationError("invalid_verification_url");
  }
  if (url.protocol !== "https:" || !url.pathname.endsWith(GET_SESSION_PATH)) {
    throw new IdentityVerificationError("invalid_verification_url");
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `DPoP ${accessToken}`,
      DPoP: dpopProof,
    },
  });

  if (response.status === 400 || response.status === 401) {
    let body = null;
    try {
      body = await response.json();
    } catch {
      // ignore
    }
    const nonce = response.headers.get("DPoP-Nonce");
    if (body?.error === "use_dpop_nonce" && nonce) {
      return { needsNonce: true, nonce };
    }
    throw new IdentityVerificationError("unauthorized");
  }
  if (!response.ok) {
    throw new IdentityVerificationError("pds_error");
  }

  const data = await response.json();
  if (!data?.did) {
    throw new IdentityVerificationError("missing_did");
  }
  return { did: data.did };
}
