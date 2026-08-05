// Trivial capability probe: the client uses this to decide whether to show
// the cross-device relay toggle at all, without needing to know in advance
// whether this deployment has Tier 2 configured.

export async function onRequestGet({ env }) {
  if (!env.PUSH_SUBSCRIPTIONS || !env.VAPID_PUBLIC_KEY) {
    return Response.json({ error: "not_configured" }, { status: 501 });
  }
  return Response.json({ key: env.VAPID_PUBLIC_KEY });
}
