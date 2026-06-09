import { userProfile } from "./fixtures.js";

// Hold the pointer down on an element long enough to trigger a long-press
// (the app uses a 500ms threshold).
export async function longPress(page, locator) {
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
}

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
// account. Seeds on the first page load only; otherwise the init script would
// re-seed on every navigation and undo an in-test account switch.
export async function loginWithAccounts(page, accounts) {
  await page.addInitScript((accountsArg) => {
    if (sessionStorage.getItem("test-accounts-seeded") === "true") return;
    sessionStorage.setItem("test-accounts-seeded", "true");
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
