import { createLabelerView } from "../shared/factories.js";

export const userProfile = {
  did: "did:plc:testuser123",
  handle: "testuser.bsky.social",
  displayName: "Test User",
  avatar: "",
  viewer: { muted: false, blockedBy: false },
  labels: [],
  createdAt: "2025-01-01T00:00:00.000Z",
};

export const bskyLabeler = createLabelerView({
  did: "did:plc:ar7c4by46qjdydhdevvrndac",
  handle: "moderation.bsky.app",
  displayName: "Bluesky Moderation",
});

// A dummy push notification service, served entirely by MockServer. The app
// ships no default service, so tests that need one point at this.
export const notificationService = {
  did: "did:web:notifs.test",
  endpoint: "https://notifs.test",
  name: "Test Notifications",
  authUrl: "https://notifs.test/authorize",
  // Any valid base64url-encoded VAPID key; the browser never verifies it
  // because MockServer also stubs PushManager.
  vapidPublicKey: "QklMTFktVEVTVC1WQVBJRC1QVUJMSUMtS0VZLVZBTFVF",
};
