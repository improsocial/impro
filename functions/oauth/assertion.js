// Signs OAuth client assertions (private_key_jwt)

const ASSERTION_LIFETIME_SECONDS = 60;

function base64UrlEncode(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function encodeUtf8(str) {
  return new TextEncoder().encode(str);
}

function errorResponse(status, error) {
  return Response.json({ error }, { status });
}

export async function onRequestPost({ request, env }) {
  if (!env.OAUTH_PRIVATE_JWK) {
    return errorResponse(501, "not_configured");
  }

  const requestUrl = new URL(request.url);
  const origin = request.headers.get("Origin");
  if (origin && origin !== requestUrl.origin) {
    return errorResponse(403, "origin_not_allowed");
  }

  let aud;
  try {
    ({ aud } = await request.json());
  } catch {
    return errorResponse(400, "invalid_request_body");
  }
  let audUrl;
  try {
    audUrl = new URL(aud);
  } catch {
    return errorResponse(400, "invalid_audience");
  }
  if (audUrl.protocol !== "https:") {
    return errorResponse(400, "invalid_audience");
  }

  let privateJwk;
  try {
    privateJwk = JSON.parse(env.OAUTH_PRIVATE_JWK);
  } catch {
    return errorResponse(500, "invalid_key_configuration");
  }
  if (!privateJwk.kid) {
    return errorResponse(500, "invalid_key_configuration");
  }
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    privateJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const hostName = env.HOST_NAME || requestUrl.hostname;
  const clientId = `https://${hostName}/oauth-client-metadata.json`;
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: privateJwk.kid };
  const payload = {
    iss: clientId,
    sub: clientId,
    aud,
    jti: crypto.randomUUID(),
    iat: now,
    exp: now + ASSERTION_LIFETIME_SECONDS,
  };

  const headerB64 = base64UrlEncode(encodeUtf8(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(encodeUtf8(JSON.stringify(payload)));
  const signatureInput = `${headerB64}.${payloadB64}`;
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    encodeUtf8(signatureInput),
  );
  const assertion = `${signatureInput}.${base64UrlEncode(signature)}`;

  return Response.json({ assertion });
}
