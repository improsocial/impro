import {
  verifyIdentity,
  IdentityVerificationError,
} from "../_lib/dpopVerify.js";
import { subscriptionKey, throttleKey } from "../_lib/kvKeys.js";

// KV storage isn't request-fresh, so keep subscriptions well under
// PushSubscription's own typical lifetime and let the client resubscribe.
const SUBSCRIPTION_TTL_SECONDS = 60 * 60 * 24 * 60; // 60 days
const THROTTLE_TTL_SECONDS = 60; // KV enforces a 60s minimum expirationTtl

function errorResponse(status, error) {
  return Response.json({ error }, { status });
}

export async function onRequestPost({ request, env }) {
  if (!env.PUSH_SUBSCRIPTIONS) {
    return errorResponse(501, "not_configured");
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_request_body");
  }
  const { verificationUrl, accessToken, dpopProof, subscription } = body ?? {};
  if (!subscription?.endpoint || !subscription?.keys) {
    return errorResponse(400, "invalid_subscription");
  }

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

  const throttle = throttleKey("subscribe", did);
  if (await env.PUSH_SUBSCRIPTIONS.get(throttle)) {
    return errorResponse(429, "rate_limited");
  }
  await env.PUSH_SUBSCRIPTIONS.put(throttle, "1", {
    expirationTtl: THROTTLE_TTL_SECONDS,
  });

  const key = await subscriptionKey(did, subscription.endpoint);
  await env.PUSH_SUBSCRIPTIONS.put(
    key,
    JSON.stringify({ subscription, createdAt: Date.now() }),
    { expirationTtl: SUBSCRIPTION_TTL_SECONDS },
  );

  return Response.json({ ok: true });
}
