# Bluesky Push Notification Research

_External research summary: how Bluesky's notification service actually
works, what is open source vs closed, what the rest of the ecosystem does,
and verification of the claims in
[BSKY_PUSH_NOTIFICATION_SERVICE_SPEC](BSKY_PUSH_NOTIFICATION_SERVICE_SPEC).
Written 2026-08-06 by @77787777778777 (with Hermes agent research)._

## TL;DR

- Bluesky notifications are **two layers**: the in-app feed (fully open,
  served by the appview over public XRPC) and OS push (partially closed:
  the appview side is open, the courier server that talks to APNs/FCM is
  closed).
- `app.bsky.notification.registerPush` is **serviceDid-pluggable**: the
  user's PDS forwards token registration to whatever notification service
  DID the client names. The push service is a swappable, DID-addressed
  endpoint — not a monolith we need access to.
- Bluesky's own courier only serves the official app. Third-party appIds
  get `200 OK` and **no delivery** — confirmed by Bluesky devs in
  [atproto discussion #1914](https://github.com/bluesky-social/atproto/discussions/1914).
- **BlackSky** open-sourced the entire dispatch side (a ~1000-line push
  bridge with block/mute/takedown suppression and a retry outbox); only
  their APNs/FCM courier daemon is private — most likely Bluesky's own Go
  courier shared under a private arrangement (the contract is identical).
- **EuroSky** has **no custom push code at all** across all their forks —
  their client still registers with the official appview. Their "working
  notifications" are in-app only.
- **DracoBlue/atproto-push-gateway** is a fully open, Jetstream-based push
  gateway that implements `registerPush` itself as the service DID. No
  OAuth, no polling, no chat support. The existence proof that a simple
  conforming service is possible.
- Every factual claim in the Fable spec was **verified against the atproto
  codebase** — all check out.
- The spec's complexity is driven by **chat coverage** and **generic
  user-selectable-service** design, not by the protocol. An
  app-notifications-only service is dramatically simpler.

## How Bluesky's notification system works

```
App (social-app)                          PDS                       AppView (bsky)              Courier (Go, push.bsky.app, CLOSED)
  │── registerPush ──────────────────────►│                           │                            │
  │   serviceDid: did:web:api.bsky.app    │── service-auth JWT ─────►│── Bearer API key (gRPC) ──►│── store token keyed by (DID, appId)
  │   appId: 'xyz.blueskyweb.app'         │   (forwards to the DID   │   RegisterDeviceToken       │
  │   token: <APNs/FCM token>             │    named in serviceDid)  │                            │
```

1. **Notification computation** — the appview's data-plane indexing
   plugins (`like.ts`, `follow.ts`, … in
   `packages/bsky/src/data-plane/server/indexing/plugins/`) write the
   `notification` table. Fully open. Served to clients via the public
   `app.bsky.notification.listNotifications` XRPC — any client can call
   it, no push service involved.
2. **Token registration** — the client calls
   `app.bsky.notification.registerPush` on its PDS with a `serviceDid`.
   The PDS resolves that DID's document, finds the `#bsky_notif` service
   endpoint, and forwards with a service-auth JWT
   (`packages/pds/src/api/app/bsky/notification/registerPush.ts`).
   The appview validates the DID and forwards to the courier
   (`packages/bsky/src/api/app/bsky/notification/registerPush.ts`).
3. **OS push** — the courier (a Go gRPC/Connect service; contract in
   `packages/bsky/proto/courier.proto`, client in
   `packages/bsky/src/courier.ts`) stores device tokens and dispatches to
   APNs (iOS) / FCM (Android). The `appId` field selects which push
   credentials the courier uses — which is why the official courier
   silently drops third-party appIds: it holds no credentials for them.

### The surprising bit: the open-source appview never sends social pushes

Grep of every courier call in upstream `packages/bsky/src` finds only
three: `registerDeviceToken`, `unregisterDeviceToken`, and a
`client_controlled` "mark-read-generic" push from `updateSeen.ts`. The
code that decides "Alice liked your post → push Bob" is **not in the open
repo** — it lives on the closed side (either computed inside the courier
from the firehose, or in a closed appview component). The
`notification-push-token` table exists in the open schema but is referenced
by no open code.

## The registerPush mechanism — why it's pluggable

The PDS implementation (`packages/pds/src/api/app/bsky/notification/registerPush.ts`):

- if `serviceDid` equals the PDS's own configured appview → calls it
  directly with service-auth headers;
- otherwise → resolves the DID document, requires a `#bsky_notif` service
  entry, and forwards there over XRPC.

So **anyone can be the push service**. The spec's "service identity" section
(the DID document with `#bsky_notif` → `serviceEndpoint`) is exactly the
shape the PDS already resolves. This is why third-party services (and
self-hosted ones) don't need Bluesky's permission — they need a DID
document and an endpoint.

## What the ecosystem does

| Implementation                     | Event source                                             | Auth model                                                | Chat?                         | Open source?                   |
| ---------------------------------- | -------------------------------------------------------- | --------------------------------------------------------- | ----------------------------- | ------------------------------ |
| **Official Bluesky**               | closed dispatch + closed courier                         | device token via registerPush                             | yes                           | contract + client only         |
| **BlackSky**                       | open push bridge in their appview fork → private courier | own appview (`did:web:api.blacksky.community`), own appId | probably (full appview)       | dispatch open, courier private |
| **EuroSky**                        | none — upstream code only                                | official appview + official appId (unmodified)            | no                            | —                              |
| **DracoBlue/atproto-push-gateway** | Jetstream listener + block graph                         | implements registerPush itself as the serviceDid          | no (Jetstream can't see chat) | fully open                     |
| **impro (current)**                | 10s polling loops, tab-open only                         | —                                                         | no                            | open                           |

### BlackSky (`blacksky-algorithms`)

Their atproto fork adds what upstream lacks —
`packages/bsky/src/data-plane/server/notification-push-bridge.ts`
(~1000 lines, all public):

- Postgres `LISTEN`/`NOTIFY` on new notifications → batch → calls
  `courierClient.pushNotifications` (same gRPC contract as the proto).
- **Push-side parity with `listNotifications`**: bidirectional blocks,
  mutes, thread mutes, follows-only prefs, actor/record takedowns. They
  document the gaps: no label-based takedowns, no list-based
  blocks/mutes.
- Copy composition (`notification-push-copy.ts`), plus a full retry
  outbox (`notification_push_outbox` table: claim rows, backoff, TTL,
  expiry, suppression on retry).

Their deploy docs (`services/bsky/README.md`) show
`BSKY_COURIER_URL`/`BSKY_COURIER_API_KEY` pointing at their own courier.
The courier server itself appears in **no** public repo. Since everything
BlackSky _wrote_ is open and the proto is identical to Bluesky's, the
private courier is most plausibly Bluesky's own Go code shared under a
private arrangement (BlackSky could not relicense it even if they wanted
to). No security rationale exists for closing it — the sensitive logic
(block/mute suppression) is exactly what they published; the courier's
secrets are APNs/FCM keys, i.e. configuration, not code.

### EuroSky (`eurosky-social`)

Code search across all their forks (atproto, indigo, rsky, social-app)
turns up **zero** custom push code: no bridge, no courier wiring changes,
nothing. Their client (mu) registers push with the official appview
(`did:web:api.bsky.app`) and the official appId (`xyz.blueskyweb.app`) —
unmodified upstream constants. EuroSky's "working notifications" are the
in-app feed (fully open), not OS push.

### DracoBlue/atproto-push-gateway

Fully open (Go). Implements `registerPush`/`unregisterPush` itself as a
`did:web` service, listens to **Jetstream** for like/reply/repost/follow/
mention/quote events, maintains a block graph, and delivers via Expo/FCM/
APNs. No OAuth, no per-user grants, no polling, no chat. This is the
minimal viable conforming service and the strongest evidence that the
courier being closed is a business choice, not a technical necessity.

## Verification of the Fable spec's claims

All load-bearing claims checked against the atproto codebase, 2026-08-06:

- ✅ **PDS forwards registerPush to the `serviceDid`'s `#bsky_notif`
  endpoint** — `packages/pds/src/api/app/bsky/notification/registerPush.ts`
  (resolves DID doc via `getDidDoc`, forwards via `xrpc`).
- ✅ **OAuth RPC scope assertion**
  (`rpc:app.bsky.notification.registerPush?aud=<serviceDid>#bsky_notif`)
  — exactly as cited in `packages/pds/src/api/app/bsky/notification/registerPush.ts`.
- ✅ **Session lifetimes** — `packages/oauth/oauth-provider/src/oauth-constants.ts`:
  public clients 2 weeks (`SESSION_LIFETIME`), confidential clients 2 years
  (`SESSION_LIFETIME_EXTENDED`) with 3-month refresh. The reference
  design's confidential-client choice is real: a public-client poller
  would drop every user fortnightly.
- ✅ **Third-party appIds get 200 and no delivery** — atproto discussion
  #1914: Skywalker, Bluestocks, and others all report successful
  `registerPush` with zero delivery; Bluesky dev (seboslaw): _"Bluesky
  will not send push notifications to 3rd parties … The registerPush API
  call will just sign your request and forward it to the Service you
  provide in the payload."_ Paul Frazee confirmed and said third-party
  support was being explored (2023; no public follow-through since).
- ✅ **Browser OAuth tokens are DPoP-bound** — server-side pollers need
  their own grant; the auth handoff is not optional for a server-side
  service.

## Complexity analysis: what's intrinsic vs chosen

The spec is correct, verifiable, and internally consistent — but it is the
**maximal** solution. Its complexity comes from two deliberate choices:

1. **Chat coverage.** Jetstream/firehose cannot see chat (chat lives in
   the chat service, not the repo stream). Chat pushes are what force the
   OAuth handoff, the grant tiers, the `getLog` paging, and the previews
   consent. Drop chat → drop roughly half the spec.
2. **Generic user-selectable-service design.** The spec is written as an
   interface any conforming service can implement ("a conforming service
   can be built from the spec alone"). That generality costs the config
   document, the tier machinery, and the capability assumptions.

The reference design's polling/adaptive-cadence/outbox machinery is real
production concern, not bloat: BlackSky's bridge independently arrived at
the same batch/retry/backoff/suppression design, and the spec's load math
(1,000 users at flat 60s = 1.44M requests/day on other people's PDSes) is
sound. The one thing worth pushing back on: for a single-app deploy, a
Jetstream gateway (DracoBlue pattern) gets app notifications with ~zero
auth surface and no polling at all — the spec itself acknowledges this
("Absent for an unauthed service … e.g. a firehose consumer").

## Implications for impro

Current state (PRs #30 "Add cross-device push notification relay" and #33
"Fix Tier 1 notifications on Chrome for Android"): the browser polls the
appview every 10s and a Cloudflare Pages + KV + VAPID relay pushes to
other devices. Works only while some device has a tab open. This is
"crap notifications" by design — Tier 1.

The open question is Tier 2: fully working push with previews and details,
chat coverage, and full autonomy (server-side, no tab open anywhere).

Viable service-side options, in increasing effort:

1. **Jetstream gateway** (DracoBlue pattern, ~1 service): app
   notifications only, no chat, no OAuth, no polling. Ships "push works
   closed" soonest.
2. **The spec's reference design** (Cloudflare Worker + D1): adds chat
   pushes with previews and the user-selectable-service story. Build when
   chat matters.
3. **BlackSky-style appview fork**: only if we ever run our own appview —
   impro doesn't need this.

Client side: implement the spec as written regardless — settings UI
(service DID field + enable flow) and a no-fetch-handler service worker.
It's small (~150 lines), and it makes impro work with _any_ conforming
service, including ones we didn't build. One flag: the polling service
holds per-user OAuth grants = a privacy-sensitive store (compromise
exposes notification metadata, unread counts, and on the previews tier
chat content). The service operator is a trust anchor; make that explicit
in consent copy and hold the service to the spec's storage requirements
(envelope encryption, grant GC).

## Sources

- `courier.proto` — github.com/bluesky-social/atproto/blob/main/packages/bsky/proto/courier.proto
- `courier.ts` — github.com/bluesky-social/atproto/blob/main/packages/bsky/src/courier.ts
- PDS registerPush — github.com/bluesky-social/atproto/blob/main/packages/pds/src/api/app/bsky/notification/registerPush.ts
- Appview registerPush — github.com/bluesky-social/atproto/blob/main/packages/bsky/src/api/app/bsky/notification/registerPush.ts
- OAuth lifetimes — github.com/bluesky-social/atproto/blob/main/packages/oauth/oauth-provider/src/oauth-constants.ts
- BlackSky push bridge — github.com/blacksky-algorithms/atproto/blob/main/packages/bsky/src/data-plane/server/notification-push-bridge.ts
- DracoBlue/atproto-push-gateway — github.com/DracoBlue/atproto-push-gateway
- atproto discussion #1914 — github.com/bluesky-social/atproto/discussions/1914
