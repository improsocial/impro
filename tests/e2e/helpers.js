import { userProfile } from "./fixtures.js";

export async function login(page) {
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
  await page.addInitScript((session) => {
    localStorage.setItem("oauth_session", JSON.stringify(session));
  }, oauthSession);
}

// Seed multi-account storage directly. The first entry becomes the current
// account.
export async function loginWithAccounts(page, accounts) {
  await page.addInitScript((accountsArg) => {
    const accountEntries = [];
    for (const account of accountsArg) {
      const session = {
        did: account.did,
        serviceEndpoint: "https://fake.bsky.social",
        accessToken: "mock-access-token",
        refreshToken: "mock-refresh-token",
        expiresAt: Date.now() + 3600000 * 24,
        clientId: "https://localhost/oauth-client-metadata.json",
        authServerMetadata: {
          token_endpoint: "https://fake.bsky.social/oauth/token",
        },
      };
      localStorage.setItem(
        "oauth_session:" + account.did,
        JSON.stringify(session),
      );
      accountEntries.push({
        did: account.did,
        handle: account.handle ?? null,
        pdsUrl: "https://fake.bsky.social",
      });
    }
    localStorage.setItem("oauth_accounts", JSON.stringify(accountEntries));
    localStorage.setItem("oauth_current_did", accountsArg[0].did);
  }, accounts);
}
