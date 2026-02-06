import { createLabelerView } from "./factories.js";

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
