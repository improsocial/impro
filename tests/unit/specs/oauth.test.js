import { TestSuite } from "../testSuite.js";
import { assert, assertEquals } from "../testHelpers.js";
import {
  OauthClient,
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
  localStorage.setItem("oauth_session", JSON.stringify(sessionData));
}

const originalFetch = globalThis.fetch;

t.afterEach(() => {
  globalThis.localStorage.clear();
  globalThis.fetch = originalFetch;
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

t.describe("OauthClient.logout", (it) => {
  it("should remove oauth_session from localStorage", async () => {
    const client = await buildClient();
    writeSession();
    await client.logout();
    assertEquals(localStorage.getItem("oauth_session"), null);
  });

  it("should be a no-op when no session exists", async () => {
    const client = await buildClient();
    await client.logout();
    assertEquals(localStorage.getItem("oauth_session"), null);
  });
});

t.describe("OauthClient.handleCallback", (it) => {
  function writeInFlight(requestId, overrides = {}) {
    const inFlightData = {
      codeVerifier: "code-verifier-123",
      did: "did:plc:test",
      serviceEndpoint: "https://pds.example.com",
      authServerUrl: "https://auth.example.com",
      authServerMetadata: {
        token_endpoint: "https://auth.example.com/token",
      },
      redirectUri: "https://app.example.com/callback",
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
    globalThis.fetch = async () =>
      mockResponse({
        body: {
          access_token: "at",
          refresh_token: "rt",
          expires_in: 3600,
          sub: "did:plc:different",
          scope: "atproto",
        },
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
    globalThis.fetch = async () =>
      mockResponse({
        ok: false,
        status: 400,
        text: "invalid_grant",
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
    assert(threw.message.includes("Token exchange failed"));
  });

  it("should save session and clear all in-flight entries on success", async () => {
    const client = await buildClient();
    writeInFlight("req1", { did: "did:plc:test" });
    writeInFlight("req_stale", { did: "did:plc:other" });
    globalThis.fetch = async () =>
      mockResponse({
        body: {
          access_token: "new-at",
          refresh_token: "new-rt",
          expires_in: 3600,
          sub: "did:plc:test",
          scope: "atproto",
        },
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
    assertEquals(localStorage.getItem("oauth_in_flight_req_stale"), null);
    const stored = JSON.parse(localStorage.getItem("oauth_session"));
    assertEquals(stored.accessToken, "new-at");
    assertEquals(stored.refreshToken, "new-rt");
    assertEquals(stored.did, "did:plc:test");
    assertEquals(
      stored.clientId,
      "https://app.example.com/client-metadata.json",
    );
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
    const calls = [];
    globalThis.fetch = async (url) => {
      calls.push(String(url));
      if (String(url).includes("/token")) {
        return mockResponse({
          body: {
            access_token: "new-at",
            refresh_token: "new-rt",
            expires_in: 3600,
          },
        });
      }
      return mockResponse({ body: { ok: true } });
    };
    const response = await session.fetch("https://pds.example.com/xrpc/foo");
    assert(response.ok);
    assert(calls[0].includes("/token"));
    const stored = JSON.parse(localStorage.getItem("oauth_session"));
    assertEquals(stored.accessToken, "new-at");
    assertEquals(stored.refreshToken, "new-rt");
  });

  it("should not refresh when token has plenty of time left", async () => {
    const session = await getLoadedSession({ expiresAt: Date.now() + 3600000 });
    const calls = [];
    globalThis.fetch = async (url) => {
      calls.push(String(url));
      return mockResponse({ body: { ok: true } });
    };
    await session.fetch("https://pds.example.com/xrpc/foo");
    assert(!calls.some((url) => url.includes("/token")));
  });

  it("should deduplicate concurrent refresh requests", async () => {
    const session = await getLoadedSession({ expiresAt: Date.now() + 30000 });
    let refreshCount = 0;
    globalThis.fetch = async (url) => {
      if (String(url).includes("/token")) {
        refreshCount++;
        return mockResponse({
          body: {
            access_token: "new-at",
            refresh_token: "new-rt",
            expires_in: 3600,
          },
        });
      }
      return mockResponse({ body: {} });
    };
    await Promise.all([
      session.fetch("https://pds.example.com/xrpc/a"),
      session.fetch("https://pds.example.com/xrpc/b"),
      session.fetch("https://pds.example.com/xrpc/c"),
    ]);
    assertEquals(refreshCount, 1);
  });

  it("should throw TokenRefreshError on non-500 refresh failure", async () => {
    const session = await getLoadedSession({ expiresAt: Date.now() + 30000 });
    globalThis.fetch = async (url) => {
      if (String(url).includes("/token")) {
        return mockResponse({ ok: false, status: 400, text: "invalid_grant" });
      }
      return mockResponse({ body: {} });
    };
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
    globalThis.fetch = async (url) => {
      if (String(url).includes("/token")) {
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
      }
      return mockResponse({ body: {} });
    };
    await session.fetch("https://pds.example.com/xrpc/foo");
    assertEquals(refreshCount, 2);
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
    globalThis.fetch = async () => {
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
    };
    const response = await session.fetch("https://pds.example.com/xrpc/foo");
    assertEquals(callCount, 2);
    assert(response.ok);
  });

  it("should not retry when 401 without use_dpop_nonce error", async () => {
    const session = await getLoadedSession();
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      return mockResponse({
        ok: false,
        status: 401,
        body: { error: "invalid_token" },
      });
    };
    const response = await session.fetch("https://pds.example.com/xrpc/foo");
    assertEquals(callCount, 1);
    assert(!response.ok);
  });

  it("should attach DPoP proof header to outgoing fetch", async () => {
    const session = await getLoadedSession();
    let receivedHeaders = null;
    globalThis.fetch = async (_url, options) => {
      receivedHeaders = options.headers;
      return mockResponse({ body: { ok: true } });
    };
    await session.fetch("https://pds.example.com/xrpc/foo");
    assert(receivedHeaders.DPoP);
    assertEquals(receivedHeaders.Authorization, "DPoP at");
    // DPoP proof is a JWT: header.payload.signature
    assertEquals(receivedHeaders.DPoP.split(".").length, 3);
  });
});

t.describe("OauthClient.getAuthorizationUrl", (it) => {
  it("should throw HandleNotFoundError when handle does not resolve", async () => {
    const client = await buildClient();
    globalThis.fetch = async (url) => {
      if (String(url).includes("resolveHandle")) {
        return mockResponse({ body: { did: null } });
      }
      return mockResponse({ body: {} });
    };
    let threw = null;
    try {
      await client.getAuthorizationUrl("unknown.bsky.social");
    } catch (error) {
      threw = error;
    }
    assert(threw instanceof HandleNotFoundError);
  });
});

await t.run();
