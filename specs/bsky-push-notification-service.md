# Bluesky Push Notification Service Spec

#### Version: 0.0.2

The normative interface between a Bluesky client (an app built on the
`app.bsky.*` appview and `chat.bsky.*` chat services) and a push
notification service covering that surface.

## Service identity

A service is a DID whose document contains:

```json
{
  "service": [
    {
      "id": "#bsky_notif",
      "type": "BskyNotificationService",
      "serviceEndpoint": "https://notifs.example.com"
    }
  ]
}
```

This is the shape PDS request forwarding already resolves
(`packages/common-web/src/did-doc.ts:80`). `did:web` on the service's
own origin is the expected common case, but any DID method that can
publish the entry works. Everything below is served from the
`serviceEndpoint` origin.

A `did:web` document MUST be served with permissive CORS,
(`Access-Control-Allow-Origin: *`) — clients fetch it cross-origin
from the browser.

## Config document

```
GET <serviceEndpoint>/.well-known/notif-service.json
```

Unauthenticated. MUST be served with permissive CORS
(`Access-Control-Allow-Origin: *`) — clients fetch it cross-origin
from the browser.

```json
{
  "name": "Example Notifs",
  "vapidPublicKey": "...",
  "authUrl": "https://notifs.example.com/oauth/start"
}
```

- `name` — label for client settings and consent copy.
- `vapidPublicKey` — the service's VAPID public key
  (base64url-encoded uncompressed P-256 point, as accepted by
  `pushManager.subscribe()`'s `applicationServerKey`). Web Push
  subscriptions are bound to this key at creation time, so rotating it
  invalidates existing subscriptions.
- `authUrl` — entry point of the auth handoff. Absent for an unauthed
  service (e.g. a firehose consumer): clients then skip the auth
  handoff entirely. Unauthed services cannot deliver chat.

Clients ignore unknown fields, so the document can grow new fields
without breaking older clients.

Clients assume every service supports the full notification surface
(app notifications and chat). A capabilities descriptor can be added
to this spec later if needed.

## Auth handoff

Applies only when the config document has an `authUrl`. The service
is its own OAuth client against the user's PDS; the client hands the
browser to it and receives it back:

1. The client navigates to `authUrl` with query parameters:
   - `login_hint` — the user's handle or DID
   - `return_url` — where to redirect when done
   - `chat_previews` — `1` or `0`; whether the grant should include
     the message-content scope (see "Grant tiers")
2. The service runs the standard atproto OAuth flow under its own
   `client_id` and stores the grant server-side.
   - The service's client metadata document MUST declare a `scope`
     covering the union of both grant tiers.
3. The service MUST verify the completed grant's `sub` matches the
   hinted DID before storing it.
4. The service redirects to `return_url`, appending standard OAuth
   callback parameters on failure (`error`, `error_description`). No
   `error` parameter means success; on success the redirect MUST also
   echo the grant's effective `chat_previews` value, which the client
   persists as the confirmed tier.

`authUrl` MUST be idempotent and tier-aware: if the service already
holds a live grant for that DID at the requested tier, redirect
straight back success without touching the PDS; a tier mismatch runs
re-authorization for the new scope set.

### Grant tiers

The grant is account-level — one per DID per service — so a tier
change from any device changes it for all of that account's devices.
Both tiers are mandatory for conformant services; there is no
per-service tier discovery.

- **Counts tier** (`chat_previews=0`): read-only scopes covering
  notification lists and unread counts. Nothing that can post, follow,
  message, or read message content. Chat pushes are generic and
  collapsed.
- **Previews tier** (`chat_previews=1`): adds the chat log scope
  (`chat.bsky.convo.getLog`) so chat pushes carry sender and a message
  preview. This lets the service read message content; client consent
  copy MUST disclose that.

Grant lifecycle expectations:

- When an account has zero registered devices, the service MUST stop
  polling/sending immediately and SHOULD revoke and delete the grant
  after a grace window (~30 days is recommended). A device
  registration during the window resumes service without re-consent
  (via the idempotent `authUrl` walk).
- An `invalid_grant` from the PDS means the grant is dead (expired,
  or revoked by the user at their PDS): delete it and all stored
  state for that DID; the user re-authorizes through `authUrl`.
  PDS-side revocation is the immediate account-wide teardown path.

## Device registration

Registration uses the standard PDS-forwarded XRPC procedures, which
the service MUST implement at its `serviceEndpoint`:

```
app.bsky.notification.registerPush
app.bsky.notification.unregisterPush
```

The PDS forwards these with a service-auth JWT. The service MUST
verify it: signature against the caller's DID keys (`iss` is the user
DID), `aud` equal to the service's own DID, and `lxm` equal to the
called method. This JWT is the sole authentication — it is what makes
registration sound for unauthed services too, since nobody can
register a device against a DID they do not control.

Signature verification MUST accept both `ES256` (P-256) and `ES256K`
(secp256k1). Derive the algorithm from the resolved key in the DID
document, not from the JWT header's `alg`.

Token formats by `platform`:

- `web` — `token` is the serialized `PushSubscription` JSON:
  `{"endpoint": ..., "keys": {"p256dh": ..., "auth": ...}}`.
- `ios` — `token` is the opaque APNs device token string.

Registration MUST be an idempotent upsert keyed on (DID, token).
Clients re-assert registration on every launch — there is no API to
query registration state, and this is the self-healing mechanism for
rotated or lost tokens. `unregisterPush` deletes the single matching
device row.

`appId` identifies the client app and MUST be stored per device, so one service can serve several apps.

OAuth-authenticated clients need the RPC scope
`rpc:app.bsky.notification.registerPush?aud=<serviceDid>#bsky_notif`
(and the `unregisterPush` equivalent) — the PDS asserts exactly this
(`packages/pds/src/api/app/bsky/notification/registerPush.ts:29`).
App-password clients skip the check.

## Push payload

**Web Push** payloads are encrypted per RFC 8291 (`aes128gcm`) against
the subscription's `p256dh`/`auth` keys and signed with the service's
VAPID key. The plaintext is JSON:

```json
{
  "title": "Alice replied",
  "body": "sounds good, see you then",
  "url": "/profile/alice.example/post/3kabc",
  "badge": 3,
  "tag": "chat"
}
```

- `title`, `body` — required; the notification text.
- `url` — required; deeplink, path-relative to the client app's
  origin. The client's service worker resolves it against its own
  origin (the service does not know or care where the client is
  hosted).

  The target is the record the notification is _about_, not the
  notification's own `uri`. For `reply`, `mention`, `quote`, and
  `subscribed-post` those are the same record. For `like` and
  `repost` they are not: the notification's `uri` is the reaction
  record, which lives in the _reacting_ account's repo, so a post
  link built from it names a post that does not exist. Follow the
  reaction to its subject instead — `reasonSubject` for plain `like`
  and `repost`, `record.subject.uri` for the `-via-repost` variants,
  where `reasonSubject` is the reader's own repost rather than the
  post itself. `follow` has no post at all and links to the follower.
  Getting this wrong is not subtle in use: every like notification
  opens a blank page.

- `badge` — optional; total unread count at send time. Best-effort:
  reads on other devices cannot update it until the next push.
- `tag` — optional collapse key: a new notification with the same tag
  replaces the previous one. Counts-tier chat pushes SHOULD use a stable
  tag so an unread pile-up is one notification, not a stack.

**APNs** payloads map the same fields: `title`/`body` into
`aps.alert`, `badge` into `aps.badge`, `tag` into
`apns-collapse-id`, and `url` as a custom key.

## Delivery lifecycle

A `404` or `410` from a Web Push endpoint means the subscription is
dead: the service MUST delete the device row (this is the only
reliable unsubscribe signal, and it feeds the zero-device grant
lifecycle above). Other failures are retried with backoff.

A newly stored grant MUST establish its delivery baseline from the
account's current state — unread counts, and for the previews tier the
chat log cursor at its head — before the first poll. Activity that
predates registration is not new. A service that baselines at zero
reads the account's existing backlog as its first delta and delivers
all of it, so enabling notifications is immediately followed by a
burst of pushes for things the user read days ago. The chat log is the
sharper version of this, since it contains read messages too.

A service MUST NOT push the subscriber's own activity back to them.
`chat.bsky.convo.getLog` returns everything said in a conversation,
including the subscriber's own messages; the appview already
suppresses self-notifications on the `app.bsky` side, and a chat
delivery path that does not do the same notifies people about their
own typing. Own messages are legitimate as _context_ in a previews
push, marked as the reader's own — they simply must never be the
event that triggers one.

A service SHOULD collapse a large burst of app notifications into a
summary rather than sending them individually. A rapid burst of
notifications can trigger browsers' abusive-notification checks.

## Security requirements

- Verify `aud` and `lxm` on every service-auth JWT. Without the `aud`
  check, a JWT minted for another notification service is replayable
  here.
- Verify `sub` against `login_hint` in the auth callback.
- Grants are read-only by scope; the previews tier can read chat
  message content and clients must disclose that at consent.
- Web Push payload encryption is mandatory (RFC 8291) and is doing
  real work: payloads can carry message previews.
- Credentials held for users (tokens, subscription keys) SHOULD be
  encrypted at rest; compromise of a service exposes notification
  metadata, unread counts, and (previews tier) chat content, and
  allows sending arbitrary pushes — but never acting as the user.
