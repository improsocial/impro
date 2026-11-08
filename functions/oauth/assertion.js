// Signs OAuth client assertions (private_key_jwt)

const ASSERTION_LIFETIME_SECONDS = 60;

function isAllowedCrossOriginClient(env, origin) {
  const clients = (env.OAUTH_CROSS_ORIGIN_CLIENTS ?? "")
    .split(",")
    .map((client) => client.trim())
    .filter(Boolean);
  return clients.includes(origin);
}

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

function errorResponse(status, error, headers) {
  return Response.json({ error }, { status, headers });
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function onRequestOptions({ request, env }) {
  const origin = request.headers.get("Origin");
  if (!isAllowedCrossOriginClient(env, origin)) {
    return new Response(null, { status: 403 });
  }
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

export async function onRequestPost({ request, env }) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("Origin");
  const isCrossOrigin = Boolean(origin) && origin !== requestUrl.origin;
  if (isCrossOrigin && !isAllowedCrossOriginClient(env, origin)) {
    return errorResponse(403, "origin_not_allowed", {});
  }
  const responseHeaders = isCrossOrigin ? corsHeaders(origin) : {};

  if (!env.OAUTH_PRIVATE_JWK) {
    return errorResponse(501, "not_configured", responseHeaders);
  }

  let aud;
  try {
    ({ aud } = await request.json());
  } catch {
    return errorResponse(400, "invalid_request_body", responseHeaders);
  }
  let audUrl;
  try {
    audUrl = new URL(aud);
  } catch {
    return errorResponse(400, "invalid_audience", responseHeaders);
  }
  if (audUrl.protocol !== "https:") {
    return errorResponse(400, "invalid_audience", responseHeaders);
  }

  let privateJwk;
  try {
    privateJwk = JSON.parse(env.OAUTH_PRIVATE_JWK);
  } catch {
    return errorResponse(500, "invalid_key_configuration", responseHeaders);
  }
  if (!privateJwk.kid) {
    return errorResponse(500, "invalid_key_configuration", responseHeaders);
  }
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    privateJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const clientOrigin = isCrossOrigin
    ? origin
    : `https://${env.HOST_NAME || requestUrl.hostname}`;
  const clientId = `${clientOrigin}/oauth-client-metadata.json`;
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

  return Response.json({ assertion }, { headers: responseHeaders });
}
