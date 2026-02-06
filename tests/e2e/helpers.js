import { userProfile } from "./fixtures.js";

export async function login(page) {
  await page.goto("/login");
  const oauthSession = {
    did: userProfile.did,
    serviceEndpoint: "https://fake.bsky.social",
    accessToken: "mock-access-token",
    refreshToken: "mock-refresh-token",
    expiresAt: Date.now() + 3600000 * 24,
    clientId: "https://localhost/oauth-client-metadata.json",
    authServerMetadata: {
      token_endpoint: `https://fake.bsky.social/oauth/token`,
    },
  };
  await page.evaluate((session) => {
    localStorage.setItem("oauth_session", JSON.stringify(session));
  }, oauthSession);
}
