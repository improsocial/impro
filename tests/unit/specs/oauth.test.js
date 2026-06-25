import { TestSuite } from "../testSuite.js";
import { assert, assertEquals, MockFetch } from "../testHelpers.js";
import {
  OauthClient,
  Session,
  TokenRefreshError,
  HandleNotFoundError,
  InvalidAuthUrlError,
} from "/js/oauth.js";

const t = new TestSuite("oauth");

async function generateTestKeypair() {
  return await globalThis.crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
}

function mockResponse({
  ok = true,
  status = 200,
  statusText = "OK",
  body = {},
  text = "",
  headers = {},
} = {}) {
  return {
    ok,
    status,
    statusText,
    headers: {
      get: (name) => headers[name] ?? null,
    },
    json: async () => body,
    text: async () => text,
  };
}

async function buildClient() {
  const dpopKeypair = await generateTestKeypair();
  return new OauthClient({
    clientId: "https://app.example.com/client-metadata.json",
    redirectUri: "https://app.example.com/callback",
    dpopKeypair,
  });
}

function writeSession(overrides = {}) {
  const sessionData = {
    accessToken: "at",
    refreshToken: "rt",
    expiresAt: Date.now() + 3600000,
    did: "did:plc:test",
    scope: "atproto",
    serviceEndpoint: "https://pds.example.com",
    authServerUrl: "https://auth.example.com",
    authServerMetadata: {
      token_endpoint: "https://auth.example.com/token",
    },
    clientId: "https://app.example.com/client-metadata.json",
    ...overrides,
  };
  localStorage.setItem(
    `oauth_session:${sessionData.did}`,
    JSON.stringify(sessionData),
  );
  const accountsRaw = localStorage.getItem("oauth_accounts");
  const accounts = accountsRaw ? JSON.parse(accountsRaw) : [];
  if (!accounts.some((entry) => entry.did === sessionData.did)) {
    accounts.push({
      did: sessionData.did,
      handle: null,
      pdsUrl: sessionData.serviceEndpoint,
    });
    localStorage.setItem("oauth_accounts", JSON.stringify(accounts));
  }
  localStorage.setItem("oauth_current_did", sessionData.did);
  return sessionData;
}

const TOKEN_URL = "https://auth.example.com/token";
const PDS_URL = "https://pds.example.com/";

const ORIGINAL_REFRESH_BACKOFF_MS = Session.refreshBackoffMs;

const ORIGINAL_CONCURRENT_RECOVERY_MS = Session.concurrentRefreshRecoveryMs;

t.beforeEach(() => {
  globalThis.fetch = new MockFetch();
  Session.refreshBackoffMs = 0;
  Session.concurrentRefreshRecoveryMs = 0;
});

t.afterEach(() => {
  globalThis.localStorage.clear();
  delete globalThis.fetch;
  Session.refreshBackoffMs = ORIGINAL_REFRESH_BACKOFF_MS;
  Session.concurrentRefreshRecoveryMs = ORIGINAL_CONCURRENT_RECOVERY_MS;
});

t.describe("error classes", (it) => {
  it("TokenRefreshError has name, message, and extends Error", () => {
    const err = new TokenRefreshError("refresh failed");
    assertEquals(err.name, "TokenRefreshError");
    assertEquals(err.message, "refresh failed");
    assert(err instanceof Error);
  });

  it("HandleNotFoundError has name, message, and extends Error", () => {
    const err = new HandleNotFoundError("handle missing");
    assertEquals(err.name, "HandleNotFoundError");
    assertEquals(err.message, "handle missing");
    assert(err instanceof Error);
  });

  it("InvalidAuthUrlError has name, message, and extends Error", () => {
    const err = new InvalidAuthUrlError("bad url");
    assertEquals(err.name, "InvalidAuthUrlError");
    assertEquals(err.message, "bad url");
    assert(err instanceof Error);
  });
});

t.describe("OauthClient.load", (it) => {
  it("should generate and persist a DPoP keypair when not stored", async () => {
    const client = await OauthClient.load({
      clientId: "https://app.example.com/client-metadata.json",
      redirectUri: "https://app.example.com/callback",
    });
    assert(client instanceof OauthClient);
    assertEquals(
      client.clientId,
      "https://app.example.com/client-metadata.json",
    );
    const stored = localStorage.getItem("dpop_keypair");
    assert(stored !== null);
    const parsed = JSON.parse(stored);
    assert(parsed.pubkey);
    assert(parsed.privkey);
    assertEquals(parsed.pubkey.kty, "EC");
    assertEquals(parsed.pubkey.crv, "P-256");
  });

  it("should reuse the existing DPoP keypair from localStorage", async () => {
    await OauthClient.load({
      clientId: "cid",
      redirectUri: "ruri",
    });
    const firstStored = localStorage.getItem("dpop_keypair");
    await OauthClient.load({
      clientId: "cid",
      redirectUri: "ruri",
    });
    const secondStored = localStorage.getItem("dpop_keypair");
    assertEquals(firstStored, secondStored);
  });
});

t.describe("OauthClient.getSession", (it) => {
  it("should return null when no session saved", async () => {
    const client = await buildClient();
    const session = await client.getSession();
    assertEquals(session, null);
  });

  it("should return a Session exposing did and serviceEndpoint", async () => {
    const client = await buildClient();
    writeSession({
      did: "did:plc:abc",
      serviceEndpoint: "https://pds.example.com",
    });
    const session = await client.getSession();
    assert(session !== null);
    assertEquals(session.did, "did:plc:abc");
    assertEquals(session.serviceEndpoint, "https://pds.example.com");
  });
});

t.describe("OauthClient.removeAccount", (it) => {
  it("should remove the current session and clear the current did", async () => {
    const client = await buildClient();
    writeSession({ did: "did:plc:test" });
    await client.removeAccount();
    assertEquals(localStorage.getItem("oauth_session:did:plc:test"), null);
    assertEquals(localStorage.getItem("oauth_current_did"), null);
    assertEquals(localStorage.getItem("oauth_accounts"), null);
  });

  it("should be a no-op when no session exists", async () => {
    const client = await buildClient();
    await client.removeAccount();
    assertEquals(localStorage.getItem("oauth_current_did"), null);
  });
});

t.describe("OauthClient.handleCallback", (it) => {
  function writeInFlight(requestId, overrides = {}) {
    const inFlightData = {
      codeVerifier: "code-verifier-123",
      did: "did:plc:test",
      handle: "test.bsky.social",
      serviceEndpoint: "https://pds.example.com",
      authServerUrl: "https://auth.example.com",
      authServerMetadata: {
        token_endpoint: "https://auth.example.com/token",
      },
      redirectUri: "https://app.example.com/callback",
      createdAt: Date.now(),
      ...overrides,
    };
    localStorage.setItem(
      `oauth_in_flight_${requestId}`,
      JSON.stringify(inFlightData),
    );
  }

  it("should throw when code is missing", async () => {
    const client = await buildClient();
    let threw = null;
    try {
      await client.handleCallback({ code: null, state: "state" });
    } catch (error) {
      threw = error;
    }
    assert(threw !== null);
    assert(threw.message.includes("Missing code or state"));
  });

  it("should throw when state is missing", async () => {
    const client = await buildClient();
    let threw = null;
    try {
      await client.handleCallback({ code: "abc", state: null });
    } catch (error) {
      threw = error;
    }
    assert(threw !== null);
    assert(threw.message.includes("Missing code or state"));
  });

  it("should throw when no in-flight data for requestId", async () => {
    const client = await buildClient();
    const state = encodeURIComponent(
      JSON.stringify({ requestId: "nonexistent" }),
    );
    let threw = null;
    try {
      await client.handleCallback({ code: "abc", state });
    } catch (error) {
      threw = error;
    }
    assert(threw !== null);
    assert(threw.message.includes("No in-flight data"));
  });

  it("should throw on issuer mismatch", async () => {
    const client = await buildClient();
    writeInFlight("req1");
    const state = encodeURIComponent(JSON.stringify({ requestId: "req1" }));
    let threw = null;
    try {
      await client.handleCallback({
        code: "abc",
        state,
        iss: "https://attacker.example.com",
      });
    } catch (error) {
      threw = error;
    }
    assert(threw !== null);
    assert(threw.message.includes("Issuer mismatch"));
  });

  it("should throw DID mismatch when token sub differs from in-flight did", async () => {
    const client = await buildClient();
    writeInFlight("req1", { did: "did:plc:expected" });
    globalThis.fetch.__interceptJson(TOKEN_URL, {
      access_token: "at",
      refresh_token: "rt",
      expires_in: 3600,
      sub: "did:plc:different",
      scope: "atproto",
    });
    const state = encodeURIComponent(JSON.stringify({ requestId: "req1" }));
    let threw = null;
    try {
      await client.handleCallback({
        code: "abc",
        state,
        iss: "https://auth.example.com",
      });
    } catch (error) {
      threw = error;
    }
    assert(threw !== null);
    assert(threw.message.includes("DID mismatch"));
  });

  it("should throw when token exchange returns a non-ok response", async () => {
    const client = await buildClient();
    writeInFlight("req1");
    globalThis.fetch.__intercept(TOKEN_URL, async () =>
      mockResponse({
        ok: false,
        status: 400,
        text: "invalid_grant",
      }),
    );
    const state = encodeURIComponent(JSON.stringify({ requestId: "req1" }));
    let threw = null;
    try {
      await client.handleCallback({
        code: "abc",
        state,
        iss: "https://auth.example.com",
      });
    } catch (error) {
      threw = error;
    }
    assert(threw !== null);
    assert(threw.message.includes("Token exchange failed"));
  });

  it("should save session and clear the matching in-flight entry on success", async () => {
    const client = await buildClient();
    writeInFlight("req1", { did: "did:plc:test" });
    globalThis.fetch.__interceptJson(TOKEN_URL, {
      access_token: "new-at",
      refresh_token: "new-rt",
      expires_in: 3600,
      sub: "did:plc:test",
      scope: "atproto",
    });
    const state = encodeURIComponent(JSON.stringify({ requestId: "req1" }));
    const session = await client.handleCallback({
      code: "abc",
      state,
      iss: "https://auth.example.com",
    });
    assert(session !== null);
    assertEquals(session.did, "did:plc:test");
    assertEquals(session.serviceEndpoint, "https://pds.example.com");
    assertEquals(localStorage.getItem("oauth_in_flight_req1"), null);
    const stored = JSON.parse(
      localStorage.getItem("oauth_session:did:plc:test"),
    );
    assertEquals(stored.accessToken, "new-at");
    assertEquals(stored.refreshToken, "new-rt");
    assertEquals(stored.did, "did:plc:test");
    assertEquals(
      stored.clientId,
      "https://app.example.com/client-metadata.json",
    );
    assertEquals(localStorage.getItem("oauth_current_did"), "did:plc:test");
  });
});

t.describe("Session.fetch token refresh", (it) => {
  async function getLoadedSession({ expiresAt }) {
    const client = await buildClient();
    writeSession({ expiresAt });
    return await client.getSession();
  }

  it("should refresh token when within 60s of expiry", async () => {
    const session = await getLoadedSession({ expiresAt: Date.now() + 30000 });
    globalThis.fetch.__interceptJson(TOKEN_URL, {
      access_token: "new-at",
      refresh_token: "new-rt",
      expires_in: 3600,
    });
    globalThis.fetch.__interceptJson(PDS_URL, { ok: true });
    const response = await session.fetch("https://pds.example.com/xrpc/foo");
    assert(response.ok);
    assert(globalThis.fetch.calls[0].url.includes("/token"));
    const stored = JSON.parse(
      localStorage.getItem("oauth_session:did:plc:test"),
    );
    assertEquals(stored.accessToken, "new-at");
    assertEquals(stored.refreshToken, "new-rt");
  });

  it("should not refresh when token has plenty of time left", async () => {
    const session = await getLoadedSession({ expiresAt: Date.now() + 3600000 });
    globalThis.fetch.__interceptJson(PDS_URL, { ok: true });
    await session.fetch("https://pds.example.com/xrpc/foo");
    assert(!globalThis.fetch.calls.some((call) => call.url.includes("/token")));
  });

  it("should deduplicate concurrent refresh requests", async () => {
    const session = await getLoadedSession({ expiresAt: Date.now() + 30000 });
    globalThis.fetch.__interceptJson(TOKEN_URL, {
      access_token: "new-at",
      refresh_token: "new-rt",
      expires_in: 3600,
    });
    globalThis.fetch.__interceptJson(PDS_URL, {});
    await Promise.all([
      session.fetch("https://pds.example.com/xrpc/a"),
      session.fetch("https://pds.example.com/xrpc/b"),
      session.fetch("https://pds.example.com/xrpc/c"),
    ]);
    const tokenCalls = globalThis.fetch.calls.filter((call) =>
      call.url.includes("/token"),
    );
    assertEquals(tokenCalls.length, 1);
  });

  it("should throw TokenRefreshError on non-500 refresh failure", async () => {
    const session = await getLoadedSession({ expiresAt: Date.now() + 30000 });
    globalThis.fetch.__intercept(TOKEN_URL, async () =>
      mockResponse({ ok: false, status: 400, text: "invalid_grant" }),
    );
    globalThis.fetch.__interceptJson(PDS_URL, {});
    let threw = null;
    try {
      await session.fetch("https://pds.example.com/xrpc/foo");
    } catch (error) {
      threw = error;
    }
    assert(threw instanceof TokenRefreshError);
  });

  it("should retry refresh once on 500 error", async () => {
    const session = await getLoadedSession({ expiresAt: Date.now() + 30000 });
    let refreshCount = 0;
    globalThis.fetch.__intercept(TOKEN_URL, async () => {
      refreshCount++;
      if (refreshCount === 1) {
        return mockResponse({
          ok: false,
          status: 500,
          text: "server error",
        });
      }
      return mockResponse({
        body: {
          access_token: "new-at",
          refresh_token: "new-rt",
          expires_in: 3600,
        },
      });
    });
    globalThis.fetch.__interceptJson(PDS_URL, {});
    await session.fetch("https://pds.example.com/xrpc/foo");
    assertEquals(refreshCount, 2);
  });

  it("should not throw TokenRefreshError when network errors exhaust retries", async () => {
    const session = await getLoadedSession({ expiresAt: Date.now() + 30000 });
    globalThis.fetch.__intercept(TOKEN_URL, async () => {
      throw new TypeError("network down");
    });
    globalThis.fetch.__interceptJson(PDS_URL, {});
    let threw = null;
    try {
      await session.fetch("https://pds.example.com/xrpc/foo");
    } catch (error) {
      threw = error;
    }
    assert(threw !== null);
    assert(!(threw instanceof TokenRefreshError));
    assert(threw.message.includes("network"));
    // 3 attempts total: initial + 2 retries
    const tokenCalls = globalThis.fetch.calls.filter((call) =>
      call.url.includes("/token"),
    );
    assertEquals(tokenCalls.length, 3);
  });

  it("should not throw TokenRefreshError when 5xx exhausts retries", async () => {
    const session = await getLoadedSession({ expiresAt: Date.now() + 30000 });
    globalThis.fetch.__intercept(TOKEN_URL, async () =>
      mockResponse({ ok: false, status: 503, text: "unavailable" }),
    );
    globalThis.fetch.__interceptJson(PDS_URL, {});
    let threw = null;
    try {
      await session.fetch("https://pds.example.com/xrpc/foo");
    } catch (error) {
      threw = error;
    }
    assert(threw !== null);
    assert(!(threw instanceof TokenRefreshError));
    assert(threw.message.includes("server"));
  });

  it("should adopt rotated tokens written by another tab on invalid_grant", async () => {
    const session = await getLoadedSession({ expiresAt: Date.now() + 30000 });
    // Simulate another tab rotating the session BEFORE this tab's refresh fires.
    globalThis.fetch.__intercept(TOKEN_URL, async () => {
      const stored = JSON.parse(
        localStorage.getItem("oauth_session:did:plc:test"),
      );
      localStorage.setItem(
        "oauth_session:did:plc:test",
        JSON.stringify({
          ...stored,
          accessToken: "rotated-at",
          refreshToken: "rotated-rt",
          expiresAt: Date.now() + 3600000,
        }),
      );
      return mockResponse({
        ok: false,
        status: 400,
        body: { error: "invalid_grant" },
      });
    });
    globalThis.fetch.__interceptJson(PDS_URL, { ok: true });
    const response = await session.fetch("https://pds.example.com/xrpc/foo");
    assert(response.ok);
    // The follow-up PDS call should have used the adopted access token.
    const pdsCall = globalThis.fetch.calls.find((call) =>
      call.url.includes("/xrpc/foo"),
    );
    assertEquals(pdsCall.options.headers.Authorization, "DPoP rotated-at");
  });

  it("should throw TokenRefreshError on invalid_grant when no concurrent rotation occurred", async () => {
    const session = await getLoadedSession({ expiresAt: Date.now() + 30000 });
    globalThis.fetch.__intercept(TOKEN_URL, async () =>
      mockResponse({
        ok: false,
        status: 400,
        body: { error: "invalid_grant" },
      }),
    );
    globalThis.fetch.__interceptJson(PDS_URL, {});
    let threw = null;
    try {
      await session.fetch("https://pds.example.com/xrpc/foo");
    } catch (error) {
      threw = error;
    }
    assert(threw instanceof TokenRefreshError);
  });
});

t.describe("DPoP nonce retry", (it) => {
  async function getLoadedSession() {
    const client = await buildClient();
    writeSession();
    return await client.getSession();
  }

  it("should retry once when response is 401 with use_dpop_nonce", async () => {
    const session = await getLoadedSession();
    let callCount = 0;
    globalThis.fetch.__intercept(PDS_URL, async () => {
      callCount++;
      if (callCount === 1) {
        return mockResponse({
          ok: false,
          status: 401,
          body: { error: "use_dpop_nonce" },
          headers: { "DPoP-Nonce": "fresh-nonce" },
        });
      }
      return mockResponse({ body: { ok: true } });
    });
    const response = await session.fetch("https://pds.example.com/xrpc/foo");
    assertEquals(globalThis.fetch.calls.length, 2);
    assert(response.ok);
  });

  it("should not retry when 401 without use_dpop_nonce error", async () => {
    const session = await getLoadedSession();
    globalThis.fetch.__intercept(PDS_URL, async () =>
      mockResponse({
        ok: false,
        status: 401,
        body: { error: "invalid_token" },
      }),
    );
    const response = await session.fetch("https://pds.example.com/xrpc/foo");
    assertEquals(globalThis.fetch.calls.length, 1);
    assert(!response.ok);
  });

  it("should attach DPoP proof header to outgoing fetch", async () => {
    const session = await getLoadedSession();
    globalThis.fetch.__interceptJson(PDS_URL, { ok: true });
    await session.fetch("https://pds.example.com/xrpc/foo");
    const receivedHeaders = globalThis.fetch.calls[0].options.headers;
    assert(receivedHeaders.DPoP);
    assertEquals(receivedHeaders.Authorization, "DPoP at");
    // DPoP proof is a JWT: header.payload.signature
    assertEquals(receivedHeaders.DPoP.split(".").length, 3);
  });
});

t.describe("OauthClient.getAuthorizationUrl", (it) => {
  it("should throw HandleNotFoundError when handle does not resolve", async () => {
    const client = await buildClient();
    globalThis.fetch.__interceptJson(/resolveHandle/, { did: null });
    globalThis.fetch.__interceptJson("https://", {});
    let threw = null;
    try {
      await client.getAuthorizationUrl("unknown.bsky.social");
    } catch (error) {
      threw = error;
    }
    assert(threw instanceof HandleNotFoundError);
  });
});

async function runCallback(
  client,
  {
    requestId,
    sub,
    handle = "user.bsky.social",
    serviceEndpoint = "https://pds.example.com",
    authServerUrl = "https://auth.example.com",
    tokenUrl = `https://auth.example.com/token/${requestId}`,
    accessToken = "at-" + sub,
    refreshToken = "rt-" + sub,
    expiresIn = 3600,
    createdAt = Date.now(),
  } = {},
) {
  const inFlightData = {
    codeVerifier: "verifier-" + requestId,
    did: sub,
    handle,
    serviceEndpoint,
    authServerUrl,
    authServerMetadata: { token_endpoint: tokenUrl },
    redirectUri: "https://app.example.com/callback",
    createdAt,
  };
  localStorage.setItem(
    `oauth_in_flight_${requestId}`,
    JSON.stringify(inFlightData),
  );
  globalThis.fetch.__interceptJson(tokenUrl, {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: expiresIn,
    sub,
    scope: "atproto",
  });
  const state = encodeURIComponent(JSON.stringify({ requestId }));
  return await client.handleCallback({
    code: "code-" + requestId,
    state,
    iss: authServerUrl,
  });
}

t.describe("multi-account storage and indexing", (it) => {
  it("two callbacks for different subs produce two retrievable sessions", async () => {
    const client = await buildClient();
    await runCallback(client, { requestId: "r1", sub: "did:plc:alice" });
    await runCallback(client, { requestId: "r2", sub: "did:plc:bob" });
    const alice = await client.getSession("did:plc:alice");
    const bob = await client.getSession("did:plc:bob");
    assert(alice !== null);
    assert(bob !== null);
    assertEquals(alice.did, "did:plc:alice");
    assertEquals(bob.did, "did:plc:bob");
    const accounts = client.listAccounts();
    assertEquals(accounts.length, 2);
  });

  it("callback for known did updates the index entry rather than duplicating", async () => {
    const client = await buildClient();
    await runCallback(client, {
      requestId: "r1",
      sub: "did:plc:alice",
      handle: "alice.old",
      serviceEndpoint: "https://pds-old.example.com",
    });
    await runCallback(client, {
      requestId: "r2",
      sub: "did:plc:alice",
      handle: "alice.new",
      serviceEndpoint: "https://pds-new.example.com",
    });
    const accounts = client.listAccounts();
    assertEquals(accounts.length, 1);
    assertEquals(accounts[0].handle, "alice.new");
    assertEquals(accounts[0].pdsUrl, "https://pds-new.example.com");
  });

  it("callback for known did overwrites the stored session blob", async () => {
    const client = await buildClient();
    await runCallback(client, {
      requestId: "r1",
      sub: "did:plc:alice",
      accessToken: "old-at",
    });
    await runCallback(client, {
      requestId: "r2",
      sub: "did:plc:alice",
      accessToken: "new-at",
    });
    const stored = JSON.parse(
      localStorage.getItem("oauth_session:did:plc:alice"),
    );
    assertEquals(stored.accessToken, "new-at");
  });

  it("index order is preserved when re-authing an existing did", async () => {
    const client = await buildClient();
    await runCallback(client, { requestId: "r1", sub: "did:plc:alice" });
    await runCallback(client, { requestId: "r2", sub: "did:plc:bob" });
    await runCallback(client, {
      requestId: "r3",
      sub: "did:plc:alice",
      handle: "alice.updated",
    });
    const accounts = client.listAccounts();
    assertEquals(accounts.length, 2);
    assertEquals(accounts[0].did, "did:plc:alice");
    assertEquals(accounts[0].handle, "alice.updated");
    assertEquals(accounts[1].did, "did:plc:bob");
  });

  it("listAccounts returns empty array when no accounts stored", async () => {
    const client = await buildClient();
    assertEquals(client.listAccounts(), []);
  });

  it("listAccounts entries include handle and pdsUrl from in-flight data", async () => {
    const client = await buildClient();
    await runCallback(client, {
      requestId: "r1",
      sub: "did:plc:alice",
      handle: "alice.bsky.social",
      serviceEndpoint: "https://pds.example.com",
    });
    const accounts = client.listAccounts();
    assertEquals(accounts[0].did, "did:plc:alice");
    assertEquals(accounts[0].handle, "alice.bsky.social");
    assertEquals(accounts[0].pdsUrl, "https://pds.example.com");
  });
});

t.describe("current account pointer", (it) => {
  it("getSession() returns most recent login; switchToAccount changes it", async () => {
    const client = await buildClient();
    await runCallback(client, { requestId: "r1", sub: "did:plc:alice" });
    await runCallback(client, { requestId: "r2", sub: "did:plc:bob" });
    const current = await client.getSession();
    assertEquals(current.did, "did:plc:bob");
    client.switchToAccount("did:plc:alice");
    const afterSwitch = await client.getSession();
    assertEquals(afterSwitch.did, "did:plc:alice");
  });

  it("getSession() returns null when no current did set", async () => {
    const client = await buildClient();
    assertEquals(await client.getSession(), null);
  });

  it("getSession(unknownDid) returns null", async () => {
    const client = await buildClient();
    await runCallback(client, { requestId: "r1", sub: "did:plc:alice" });
    assertEquals(await client.getSession("did:plc:bob"), null);
  });

  it("switchToAccount(unknownDid) throws and does not change current", async () => {
    const client = await buildClient();
    await runCallback(client, { requestId: "r1", sub: "did:plc:alice" });
    let threw = null;
    try {
      client.switchToAccount("did:plc:nobody");
    } catch (error) {
      threw = error;
    }
    assert(threw !== null);
    assertEquals(localStorage.getItem("oauth_current_did"), "did:plc:alice");
  });

  it("switchToAccount(currentDid) is a no-op", async () => {
    const client = await buildClient();
    await runCallback(client, { requestId: "r1", sub: "did:plc:alice" });
    client.switchToAccount("did:plc:alice");
    assertEquals(localStorage.getItem("oauth_current_did"), "did:plc:alice");
  });
});

t.describe("multi-account removeAccount", (it) => {
  it("removeAccount(nonCurrent) removes that account and leaves current intact", async () => {
    const client = await buildClient();
    await runCallback(client, { requestId: "r1", sub: "did:plc:alice" });
    await runCallback(client, { requestId: "r2", sub: "did:plc:bob" });
    // current is bob
    await client.removeAccount("did:plc:alice");
    assertEquals(localStorage.getItem("oauth_session:did:plc:alice"), null);
    assertEquals(localStorage.getItem("oauth_current_did"), "did:plc:bob");
    assert(localStorage.getItem("oauth_session:did:plc:bob") !== null);
    assertEquals(client.listAccounts().length, 1);
    assertEquals(client.listAccounts()[0].did, "did:plc:bob");
  });

  it("removeAccount(current) with others present rolls current to first remaining", async () => {
    const client = await buildClient();
    await runCallback(client, { requestId: "r1", sub: "did:plc:alice" });
    await runCallback(client, { requestId: "r2", sub: "did:plc:bob" });
    // current is bob
    await client.removeAccount("did:plc:bob");
    assertEquals(localStorage.getItem("oauth_current_did"), "did:plc:alice");
    assertEquals(localStorage.getItem("oauth_session:did:plc:bob"), null);
  });

  it("removeAccount() no-arg with current set behaves like removeAccount(current)", async () => {
    const client = await buildClient();
    await runCallback(client, { requestId: "r1", sub: "did:plc:alice" });
    await runCallback(client, { requestId: "r2", sub: "did:plc:bob" });
    await client.removeAccount();
    assertEquals(localStorage.getItem("oauth_current_did"), "did:plc:alice");
  });

  it("removeAccount of last account clears the current did key", async () => {
    const client = await buildClient();
    await runCallback(client, { requestId: "r1", sub: "did:plc:alice" });
    await client.removeAccount("did:plc:alice");
    assertEquals(localStorage.getItem("oauth_current_did"), null);
    assertEquals(localStorage.getItem("oauth_accounts"), null);
  });

  it("removeAccount(unknownDid) is a no-op", async () => {
    const client = await buildClient();
    await runCallback(client, { requestId: "r1", sub: "did:plc:alice" });
    await client.removeAccount("did:plc:nobody");
    assertEquals(localStorage.getItem("oauth_current_did"), "did:plc:alice");
    assert(localStorage.getItem("oauth_session:did:plc:alice") !== null);
  });

  it("removeAccount() with no current set is a no-op", async () => {
    const client = await buildClient();
    await client.removeAccount();
    assertEquals(localStorage.getItem("oauth_current_did"), null);
  });
});

t.describe("soft logout (revoke)", (it) => {
  it("revoke removes the session blob but keeps the account entry and current did", async () => {
    const client = await buildClient();
    await runCallback(client, {
      requestId: "r1",
      sub: "did:plc:alice",
      handle: "alice.bsky.social",
    });
    await client.revoke("did:plc:alice");
    assertEquals(localStorage.getItem("oauth_session:did:plc:alice"), null);
    const accounts = client.listAccounts();
    assertEquals(accounts.length, 1);
    assertEquals(accounts[0].did, "did:plc:alice");
    assertEquals(accounts[0].handle, "alice.bsky.social");
    assertEquals(localStorage.getItem("oauth_current_did"), "did:plc:alice");
  });

  it("revoke() no-arg targets the current did", async () => {
    const client = await buildClient();
    await runCallback(client, { requestId: "r1", sub: "did:plc:alice" });
    await runCallback(client, { requestId: "r2", sub: "did:plc:bob" });
    // current is bob
    await client.revoke();
    assertEquals(localStorage.getItem("oauth_session:did:plc:bob"), null);
    assert(localStorage.getItem("oauth_session:did:plc:alice") !== null);
    assertEquals(client.listAccounts().length, 2);
  });

  it("revoke with no current did is a no-op", async () => {
    const client = await buildClient();
    await client.revoke();
    assertEquals(localStorage.getItem("oauth_current_did"), null);
    assertEquals(localStorage.getItem("oauth_accounts"), null);
  });

  it("revoke evicts the cached session so getSession returns null", async () => {
    const client = await buildClient();
    await runCallback(client, { requestId: "r1", sub: "did:plc:alice" });
    assert((await client.getSession("did:plc:alice")) !== null);
    await client.revoke("did:plc:alice");
    assertEquals(await client.getSession("did:plc:alice"), null);
  });

  it("listAccounts marks accounts without a session blob as needsReauth", async () => {
    const client = await buildClient();
    await runCallback(client, { requestId: "r1", sub: "did:plc:alice" });
    await runCallback(client, { requestId: "r2", sub: "did:plc:bob" });
    await client.revoke("did:plc:alice");
    const accounts = client.listAccounts();
    const alice = accounts.find((entry) => entry.did === "did:plc:alice");
    const bob = accounts.find((entry) => entry.did === "did:plc:bob");
    assertEquals(alice.needsReauth, true);
    assertEquals(bob.needsReauth, false);
  });

  it("handleCallback after revoke restores the session and clears needsReauth", async () => {
    const client = await buildClient();
    await runCallback(client, { requestId: "r1", sub: "did:plc:alice" });
    await client.revoke("did:plc:alice");
    await runCallback(client, { requestId: "r2", sub: "did:plc:alice" });
    assert(localStorage.getItem("oauth_session:did:plc:alice") !== null);
    assertEquals(localStorage.getItem("oauth_current_did"), "did:plc:alice");
    const accounts = client.listAccounts();
    assertEquals(accounts.length, 1);
    assertEquals(accounts[0].needsReauth, false);
    assert((await client.getSession("did:plc:alice")) !== null);
  });
});

t.describe("multi-account session refresh", (it) => {
  it("refresh on a non-current account writes to the correct keyed slot", async () => {
    const client = await buildClient();
    await runCallback(client, { requestId: "r1", sub: "did:plc:alice" });
    await runCallback(client, { requestId: "r2", sub: "did:plc:bob" });
    // bob is current; refresh alice manually
    const alice = await client.getSession("did:plc:alice");
    // Force expiry
    alice.sessionData.expiresAt = Date.now() + 30000;
    // Reset MockFetch so the new intercept isn't shadowed by the initial
    // exchange route registered during runCallback.
    globalThis.fetch = new MockFetch();
    globalThis.fetch.__interceptJson(
      alice.sessionData.authServerMetadata.token_endpoint,
      {
        access_token: "alice-new-at",
        refresh_token: "alice-new-rt",
        expires_in: 3600,
      },
    );
    globalThis.fetch.__interceptJson(PDS_URL, { ok: true });
    await alice.fetch("https://pds.example.com/xrpc/foo");
    const aliceStored = JSON.parse(
      localStorage.getItem("oauth_session:did:plc:alice"),
    );
    assertEquals(aliceStored.accessToken, "alice-new-at");
    const bobStored = JSON.parse(
      localStorage.getItem("oauth_session:did:plc:bob"),
    );
    assertEquals(bobStored.accessToken, "at-did:plc:bob");
  });
});

t.describe("multi-account in-flight cleanup", (it) => {
  it("completing one callback preserves another concurrent in-flight blob", async () => {
    const client = await buildClient();
    // Pre-seed a concurrent in-flight blob for another flow
    localStorage.setItem(
      "oauth_in_flight_concurrent",
      JSON.stringify({
        codeVerifier: "v",
        did: "did:plc:other",
        handle: "other",
        serviceEndpoint: "https://pds.example.com",
        authServerUrl: "https://auth.example.com",
        authServerMetadata: { token_endpoint: TOKEN_URL },
        redirectUri: "https://app.example.com/callback",
        createdAt: Date.now(),
      }),
    );
    await runCallback(client, { requestId: "r1", sub: "did:plc:alice" });
    assertEquals(localStorage.getItem("oauth_in_flight_r1"), null);
    assert(localStorage.getItem("oauth_in_flight_concurrent") !== null);
  });

  it("callback removes stale in-flight entries older than 10 minutes", async () => {
    const client = await buildClient();
    localStorage.setItem(
      "oauth_in_flight_old",
      JSON.stringify({
        codeVerifier: "v",
        createdAt: Date.now() - 11 * 60 * 1000,
      }),
    );
    await runCallback(client, { requestId: "r1", sub: "did:plc:alice" });
    assertEquals(localStorage.getItem("oauth_in_flight_old"), null);
  });

  it("callback removes multiple stale in-flight entries in one pass", async () => {
    const client = await buildClient();
    const staleAt = Date.now() - 11 * 60 * 1000;
    for (const suffix of ["a", "b", "c", "d"]) {
      localStorage.setItem(
        `oauth_in_flight_old_${suffix}`,
        JSON.stringify({ codeVerifier: "v", createdAt: staleAt }),
      );
    }
    await runCallback(client, { requestId: "r1", sub: "did:plc:alice" });
    for (const suffix of ["a", "b", "c", "d"]) {
      assertEquals(localStorage.getItem(`oauth_in_flight_old_${suffix}`), null);
    }
  });

  it("callback preserves fresh in-flight entries for unrelated flows", async () => {
    const client = await buildClient();
    localStorage.setItem(
      "oauth_in_flight_fresh",
      JSON.stringify({
        codeVerifier: "v",
        createdAt: Date.now() - 60 * 1000,
      }),
    );
    await runCallback(client, { requestId: "r1", sub: "did:plc:alice" });
    assert(localStorage.getItem("oauth_in_flight_fresh") !== null);
  });

  it("callback succeeds with no stale entries present", async () => {
    const client = await buildClient();
    const session = await runCallback(client, {
      requestId: "r1",
      sub: "did:plc:alice",
    });
    assert(session !== null);
  });
});

t.describe("legacy session migration", (it) => {
  function writeLegacySession(overrides = {}) {
    const sessionData = {
      accessToken: "legacy-at",
      refreshToken: "legacy-rt",
      expiresAt: Date.now() + 3600000,
      did: "did:plc:legacy",
      scope: "atproto",
      serviceEndpoint: "https://pds.example.com",
      authServerUrl: "https://auth.example.com",
      authServerMetadata: { token_endpoint: TOKEN_URL },
      clientId: "https://app.example.com/client-metadata.json",
      ...overrides,
    };
    localStorage.setItem("oauth_session", JSON.stringify(sessionData));
    return sessionData;
  }

  it("migrates a bare oauth_session into the keyed layout on load", async () => {
    const sessionData = writeLegacySession();
    const client = await OauthClient.load({
      clientId: "cid",
      redirectUri: "ruri",
    });
    assertEquals(localStorage.getItem("oauth_session"), null);
    const migrated = JSON.parse(
      localStorage.getItem("oauth_session:did:plc:legacy"),
    );
    assertEquals(migrated.accessToken, sessionData.accessToken);
    assertEquals(localStorage.getItem("oauth_current_did"), "did:plc:legacy");
    const accounts = client.listAccounts();
    assertEquals(accounts.length, 1);
    assertEquals(accounts[0].did, "did:plc:legacy");
    assertEquals(accounts[0].pdsUrl, "https://pds.example.com");
  });

  it("migrated account is usable: getSession returns and refresh writes to keyed slot", async () => {
    writeLegacySession({ expiresAt: Date.now() + 30000 });
    const client = await OauthClient.load({
      clientId: "cid",
      redirectUri: "ruri",
    });
    const session = await client.getSession();
    assert(session !== null);
    assertEquals(session.did, "did:plc:legacy");
    globalThis.fetch.__interceptJson(TOKEN_URL, {
      access_token: "refreshed-at",
      refresh_token: "refreshed-rt",
      expires_in: 3600,
    });
    globalThis.fetch.__interceptJson(PDS_URL, { ok: true });
    await session.fetch("https://pds.example.com/xrpc/foo");
    const stored = JSON.parse(
      localStorage.getItem("oauth_session:did:plc:legacy"),
    );
    assertEquals(stored.accessToken, "refreshed-at");
  });

  it("is idempotent: a second load after migration changes nothing", async () => {
    writeLegacySession();
    await OauthClient.load({ clientId: "cid", redirectUri: "ruri" });
    const snapshot = {
      session: localStorage.getItem("oauth_session:did:plc:legacy"),
      accounts: localStorage.getItem("oauth_accounts"),
      current: localStorage.getItem("oauth_current_did"),
      legacy: localStorage.getItem("oauth_session"),
    };
    await OauthClient.load({ clientId: "cid", redirectUri: "ruri" });
    assertEquals(
      localStorage.getItem("oauth_session:did:plc:legacy"),
      snapshot.session,
    );
    assertEquals(localStorage.getItem("oauth_accounts"), snapshot.accounts);
    assertEquals(localStorage.getItem("oauth_current_did"), snapshot.current);
    assertEquals(localStorage.getItem("oauth_session"), snapshot.legacy);
  });

  it("removes stale legacy key when accounts index already exists", async () => {
    writeLegacySession();
    localStorage.setItem(
      "oauth_accounts",
      JSON.stringify([
        { did: "did:plc:other", handle: null, pdsUrl: "https://x" },
      ]),
    );
    await OauthClient.load({ clientId: "cid", redirectUri: "ruri" });
    assertEquals(localStorage.getItem("oauth_session"), null);
    const accounts = JSON.parse(localStorage.getItem("oauth_accounts"));
    assertEquals(accounts.length, 1);
    assertEquals(accounts[0].did, "did:plc:other");
  });

  it("creates no keys when there is no legacy or multi-account state", async () => {
    await OauthClient.load({ clientId: "cid", redirectUri: "ruri" });
    assertEquals(localStorage.getItem("oauth_accounts"), null);
    assertEquals(localStorage.getItem("oauth_current_did"), null);
  });
});

t.describe("DPoP sanity across accounts", (it) => {
  it("two accounts share the same DPoP public key", async () => {
    const client = await buildClient();
    await runCallback(client, { requestId: "r1", sub: "did:plc:alice" });
    await runCallback(client, { requestId: "r2", sub: "did:plc:bob" });
    globalThis.fetch.__interceptJson(PDS_URL, { ok: true });
    const alice = await client.getSession("did:plc:alice");
    await alice.fetch("https://pds.example.com/xrpc/foo");
    const aliceProof = globalThis.fetch.calls.at(-1).options.headers.DPoP;
    const bob = await client.getSession("did:plc:bob");
    await bob.fetch("https://pds.example.com/xrpc/foo");
    const bobProof = globalThis.fetch.calls.at(-1).options.headers.DPoP;
    const aliceJwk = JSON.parse(
      atob(aliceProof.split(".")[0].replace(/-/g, "+").replace(/_/g, "/")),
    ).jwk;
    const bobJwk = JSON.parse(
      atob(bobProof.split(".")[0].replace(/-/g, "+").replace(/_/g, "/")),
    ).jwk;
    assertEquals(aliceJwk.x, bobJwk.x);
    assertEquals(aliceJwk.y, bobJwk.y);
  });
});

t.describe("OauthClient.revoke (server-side)", (it) => {
  const REVOCATION_URL = "https://auth.example.com/revoke";

  function writeSessionWithRevocation(did) {
    writeSession({
      did,
      refreshToken: "rt-" + did,
      authServerMetadata: {
        token_endpoint: "https://auth.example.com/token",
        revocation_endpoint: REVOCATION_URL,
      },
    });
  }

  it("revoke posts to revocation_endpoint with the refresh token", async () => {
    const client = await buildClient();
    writeSessionWithRevocation("did:plc:alice");
    globalThis.fetch.__interceptJson(REVOCATION_URL, {});
    await client.revoke("did:plc:alice");
    const revokeCall = globalThis.fetch.calls.find((entry) =>
      entry.url.startsWith(REVOCATION_URL),
    );
    assert(revokeCall !== undefined);
    assertEquals(revokeCall.options.method, "POST");
    const body = new URLSearchParams(revokeCall.options.body);
    assertEquals(body.get("token"), "rt-did:plc:alice");
    assertEquals(body.get("token_type_hint"), "refresh_token");
    assertEquals(
      body.get("client_id"),
      "https://app.example.com/client-metadata.json",
    );
    assert(revokeCall.options.headers.DPoP !== undefined);
    // Local state is still cleared.
    assertEquals(localStorage.getItem("oauth_session:did:plc:alice"), null);
  });

  it("removeAccount also revokes server-side before clearing", async () => {
    const client = await buildClient();
    writeSessionWithRevocation("did:plc:alice");
    globalThis.fetch.__interceptJson(REVOCATION_URL, {});
    await client.removeAccount("did:plc:alice");
    const revokeCall = globalThis.fetch.calls.find((entry) =>
      entry.url.startsWith(REVOCATION_URL),
    );
    assert(revokeCall !== undefined);
    assertEquals(localStorage.getItem("oauth_session:did:plc:alice"), null);
    assertEquals(localStorage.getItem("oauth_accounts"), null);
  });

  it("clears local state even when the revocation request fails", async () => {
    const client = await buildClient();
    writeSessionWithRevocation("did:plc:alice");
    globalThis.fetch.__intercept(REVOCATION_URL, async () => ({
      ok: false,
      status: 500,
      statusText: "Server Error",
      headers: { get: () => null },
      json: async () => ({ error: "server_error" }),
      text: async () => "boom",
    }));
    await client.revoke("did:plc:alice");
    assertEquals(localStorage.getItem("oauth_session:did:plc:alice"), null);
  });

  it("swallows network errors from the revocation request", async () => {
    const client = await buildClient();
    writeSessionWithRevocation("did:plc:alice");
    globalThis.fetch.__intercept(REVOCATION_URL, async () => {
      throw new Error("network down");
    });
    let threw = null;
    try {
      await client.revoke("did:plc:alice");
    } catch (error) {
      threw = error;
    }
    assertEquals(threw, null);
    assertEquals(localStorage.getItem("oauth_session:did:plc:alice"), null);
  });

  it("skips the revocation call when no revocation_endpoint is advertised", async () => {
    const client = await buildClient();
    writeSession({ did: "did:plc:alice" }); // no revocation_endpoint in fixture
    await client.revoke("did:plc:alice");
    const revokeCall = globalThis.fetch.calls.find((entry) =>
      entry.url.includes("/revoke"),
    );
    assertEquals(revokeCall, undefined);
    assertEquals(localStorage.getItem("oauth_session:did:plc:alice"), null);
  });
});

await t.run();
