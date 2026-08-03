import {
  verifyIdentity,
  IdentityVerificationError,
} from "../_lib/dpopVerify.js";
import { subscriptionPrefix, throttleKey } from "../_lib/kvKeys.js";
import { buildVapidAuthorizationHeader } from "../_lib/vapid.js";

const THROTTLE_TTL_SECONDS = 60; // KV enforces a 60s minimum expirationTtl
const PUSH_TTL_SECONDS = 60 * 60 * 24; // 1 day, per RFC 8030 TTL header

function errorResponse(status, error) {
  return Response.json({ error }, { status });
}

export async function onRequestPost({ request, env }) {
  if (!env.PUSH_SUBSCRIPTIONS) {
    return errorResponse(501, "not_configured");
  }
  if (!env.VAPID_PRIVATE_JWK || !env.VAPID_PUBLIC_KEY || !env.VAPID_SUBJECT) {
    return errorResponse(501, "not_configured");
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_request_body");
  }
  const { verificationUrl, accessToken, dpopProof, callerEndpoint } =
    body ?? {};

  let identity;
  try {
    identity = await verifyIdentity({
      verificationUrl,
      accessToken,
      dpopProof,
    });
  } catch (error) {
    if (error instanceof IdentityVerificationError) {
      return errorResponse(401, error.code);
    }
    throw error;
  }
  if (identity.needsNonce) {
    return Response.json(
      { error: "use_dpop_nonce", nonce: identity.nonce },
      { status: 428 },
    );
  }
  const { did } = identity;

  const throttle = throttleKey("relay", did);
  if (await env.PUSH_SUBSCRIPTIONS.get(throttle)) {
    return errorResponse(429, "rate_limited");
  }
  await env.PUSH_SUBSCRIPTIONS.put(throttle, "1", {
    expirationTtl: THROTTLE_TTL_SECONDS,
  });

  const privateJwk = JSON.parse(env.VAPID_PRIVATE_JWK);
  const list = await env.PUSH_SUBSCRIPTIONS.list({
    prefix: subscriptionPrefix(did),
  });

  await Promise.all(
    list.keys.map(async (key) => {
      const raw = await env.PUSH_SUBSCRIPTIONS.get(key.name);
      if (!raw) return;
      let stored;
      try {
        stored = JSON.parse(raw);
      } catch {
        return;
      }
      const { subscription } = stored;
      if (!subscription?.endpoint || subscription.endpoint === callerEndpoint) {
        return;
      }
      try {
        const authorization = await buildVapidAuthorizationHeader({
          endpoint: subscription.endpoint,
          privateJwk,
          publicKey: env.VAPID_PUBLIC_KEY,
          subject: env.VAPID_SUBJECT,
        });
        const pushResponse = await fetch(subscription.endpoint, {
          method: "POST",
          headers: {
            Authorization: authorization,
            TTL: String(PUSH_TTL_SECONDS),
            "Content-Length": "0",
          },
        });
        if (pushResponse.status === 404 || pushResponse.status === 410) {
          await env.PUSH_SUBSCRIPTIONS.delete(key.name);
        }
      } catch (error) {
        console.error("push relay failed for", key.name, error);
      }
    }),
  );

  return Response.json({ ok: true });
}
