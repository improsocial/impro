import {
  verifyIdentity,
  IdentityVerificationError,
} from "../_lib/dpopVerify.js";
import { subscriptionKey } from "../_lib/kvKeys.js";

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
  const { verificationUrl, accessToken, dpopProof, endpoint } = body ?? {};
  if (!endpoint) {
    return errorResponse(400, "missing_endpoint");
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

  const key = await subscriptionKey(identity.did, endpoint);
  await env.PUSH_SUBSCRIPTIONS.delete(key);

  return Response.json({ ok: true });
}
