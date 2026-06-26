import { TestSuite } from "../testSuite.js";
import {
  assert,
  assertEquals,
  mock,
  MockFetch,
  mockWindowLocation,
} from "../testHelpers.js";
import {
  Auth,
  BasicAuthProvider,
  BasicAuthSession,
  RefreshTokenError,
  getMissingScopes,
} from "/js/auth.js";
import { TimeoutError } from "/js/utils.js";

const t = new TestSuite("auth");

const originalWindow = globalThis.window;
const originalPath =
  window.location.pathname + window.location.search + window.location.hash;

// Produces a minimal JWT string whose payload encodes the given fields.
// parseJwt only decodes — no signature verification — so the sig can be fake.
function makeJwt(payload) {
  const encode = (obj) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  return `${encode({ alg: "HS256" })}.${encode(payload)}.fakesig`;
}

// Writes a BasicAuth session to localStorage so BasicAuth.getSession() returns
// a live session without hitting the network.
function writeBasicAuthSession({
  aud = "did:web:pds.example.com",
  sub = "did:plc:test",
} = {}) {
  const accessJwt = makeJwt({ aud, sub });
  const refreshJwt = makeJwt({ sub });
  localStorage.setItem("accessJwt", accessJwt);
  localStorage.setItem("refreshJwt", refreshJwt);
  return { accessJwt, refreshJwt };
}

function makeMockProvider({ logoutFn } = {}) {
  return {
    logout: mock(logoutFn ?? (() => Promise.resolve())),
    getSession: mock(() => Promise.resolve(null)),
  };
}

t.describe("Auth constructor", (it) => {
  it("throws when no provider is given", () => {
    let threw = null;
    try {
      new Auth(null);
    } catch (error) {
      threw = error;
    }
    assert(threw !== null);
    assert(threw.message.includes("provider"));
  });
});

t.describe("Auth.handleForceLogoutParam", (it, { afterEach }) => {
  afterEach(() => {
    globalThis.window = originalWindow;
    window.history.replaceState(null, "", originalPath);
  });

  it("does not call provider.logout when param is absent", async () => {
    const provider = makeMockProvider();
    const manager = new Auth(provider);
    await manager.handleForceLogoutParam();
    assertEquals(provider.logout.calls.length, 0);
  });

  it("calls provider.logout when force-logout param is present", async () => {
    mockWindowLocation("?force-logout=1");
    const provider = makeMockProvider();
    const manager = new Auth(provider);
    // Don't await — the returned promise never resolves; flush microtasks instead
    manager.handleForceLogoutParam();
    await Promise.resolve();
    await Promise.resolve();
    assertEquals(provider.logout.calls.length, 1);
  });

  it("redirects to the login page after logout", async () => {
    const capturedHrefs = mockWindowLocation("?force-logout=1");
    const manager = new Auth(makeMockProvider());
    manager.handleForceLogoutParam();
    await Promise.resolve();
    await Promise.resolve();
    assert(capturedHrefs.length > 0, "expected a redirect");
    assert(capturedHrefs[0].includes("/login"));
  });

  it("still redirects to login when provider.logout throws", async () => {
    const capturedHrefs = mockWindowLocation("?force-logout=1");
    const manager = new Auth(
      makeMockProvider({
        logoutFn: () => Promise.reject(new Error("logout failed")),
      }),
    );
    manager.handleForceLogoutParam();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    assert(
      capturedHrefs.length > 0,
      "expected a redirect despite logout error",
    );
    assert(capturedHrefs[0].includes("/login"));
  });

  it("strips force-logout from the URL before building returnTo so login does not loop", async () => {
    // Simulate being on /profile/alice?force-logout so linkToLogin() would
    // normally encode ?force-logout into returnTo, causing a logout loop on return.
    const capturedHrefs = [];
    let currentPathname = "/profile/alice";
    let currentSearch = "?force-logout=1&tab=posts";
    let currentHash = "";
    const locationMock = {
      get search() {
        return currentSearch;
      },
      get pathname() {
        return currentPathname;
      },
      get hash() {
        return currentHash;
      },
      get href() {
        return (
          capturedHrefs.at(-1) ??
          "http://localhost/profile/alice?force-logout=1&tab=posts"
        );
      },
      set href(value) {
        capturedHrefs.push(value);
      },
    };
    const historyMock = {
      replaceState(_state, _title, url) {
        const parsed = new URL(url, "http://localhost");
        currentPathname = parsed.pathname;
        currentSearch = parsed.search;
        currentHash = parsed.hash;
      },
    };
    globalThis.window = new Proxy(originalWindow, {
      get(target, prop) {
        if (prop === "location") return locationMock;
        if (prop === "history") return historyMock;
        const val = target[prop];
        return typeof val === "function" ? val.bind(target) : val;
      },
    });
    const manager = new Auth(makeMockProvider());
    manager.handleForceLogoutParam();
    await Promise.resolve();
    await Promise.resolve();
    assert(capturedHrefs.length > 0, "expected a redirect");
    assert(capturedHrefs[0].includes("/login"), "should redirect to login");
    const decoded = decodeURIComponent(capturedHrefs[0]);
    assert(
      !decoded.includes("force-logout"),
      "force-logout must not appear in the returnTo",
    );
    assert(
      decoded.includes("tab=posts"),
      "other params should be preserved in returnTo",
    );
  });
});

t.describe("BasicAuthSession", (it, { beforeEach, afterEach }) => {
  beforeEach(() => {
    globalThis.fetch = new MockFetch();
  });

  afterEach(() => {
    localStorage.clear();
    delete globalThis.fetch;
  });

  it("fromLocalStorage returns null when no tokens are stored", () => {
    assertEquals(BasicAuthSession.fromLocalStorage(), null);
  });

  it("fromLocalStorage returns null when only one token is stored", () => {
    localStorage.setItem("accessJwt", makeJwt({ sub: "did:plc:test" }));
    assertEquals(BasicAuthSession.fromLocalStorage(), null);
  });

  it("save and fromLocalStorage round-trip the tokens", () => {
    const accessJwt = makeJwt({
      sub: "did:plc:test",
      aud: "did:web:pds.example.com",
    });
    const refreshJwt = makeJwt({ sub: "did:plc:test" });
    const session = new BasicAuthSession(accessJwt, refreshJwt);
    session.save();
    const loaded = BasicAuthSession.fromLocalStorage();
    assert(loaded !== null);
    assertEquals(loaded.accessJwt, accessJwt);
    assertEquals(loaded.refreshJwt, refreshJwt);
  });

  it("delete removes both tokens from localStorage", async () => {
    const { accessJwt, refreshJwt } = writeBasicAuthSession();
    const session = new BasicAuthSession(accessJwt, refreshJwt);
    await session.delete();
    assertEquals(localStorage.getItem("accessJwt"), null);
    assertEquals(localStorage.getItem("refreshJwt"), null);
  });

  it("serviceEndpoint decodes aud from JWT and converts did:web: to https://", () => {
    const session = new BasicAuthSession(
      makeJwt({ aud: "did:web:pds.example.com", sub: "did:plc:test" }),
      makeJwt({}),
    );
    assertEquals(session.serviceEndpoint, "https://pds.example.com");
  });

  it("did decodes sub from JWT", () => {
    const session = new BasicAuthSession(
      makeJwt({ aud: "did:web:pds.example.com", sub: "did:plc:alice" }),
      makeJwt({}),
    );
    assertEquals(session.did, "did:plc:alice");
  });

  it("fetch passes the Bearer token and returns the response", async () => {
    const { accessJwt, refreshJwt } = writeBasicAuthSession();
    const session = new BasicAuthSession(accessJwt, refreshJwt);
    globalThis.fetch.__interceptJson("https://pds.example.com/xrpc/foo", {
      ok: true,
    });
    const res = await session.fetch("https://pds.example.com/xrpc/foo", {
      headers: {},
    });
    assert(res.ok);
    const authHeader = globalThis.fetch.calls[0].options.headers.Authorization;
    assertEquals(authHeader, `Bearer ${accessJwt}`);
  });

  it("fetch refreshes the token on 400 ExpiredToken and retries the original request", async () => {
    const { accessJwt, refreshJwt } = writeBasicAuthSession();
    const session = new BasicAuthSession(accessJwt, refreshJwt);
    const refreshUrl =
      "https://pds.example.com/xrpc/com.atproto.server.refreshSession";
    const newAccessJwt = makeJwt({
      aud: "did:web:pds.example.com",
      sub: "did:plc:test",
    });
    const newRefreshJwt = makeJwt({ sub: "did:plc:test" });

    // First call returns 400 ExpiredToken; the retry (after refresh) returns success.
    let fooCallCount = 0;
    globalThis.fetch.__intercept(
      "https://pds.example.com/xrpc/foo",
      async () => {
        fooCallCount++;
        if (fooCallCount === 1) {
          return {
            ok: false,
            status: 400,
            json: async () => ({ error: "ExpiredToken" }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ result: "ok" }),
          headers: { get: () => null },
        };
      },
    );
    globalThis.fetch.__interceptJson(refreshUrl, {
      accessJwt: newAccessJwt,
      refreshJwt: newRefreshJwt,
    });

    const res = await session.fetch("https://pds.example.com/xrpc/foo", {
      headers: {},
    });
    const body = await res.json();
    assertEquals(body.result, "ok");
    assertEquals(session.accessJwt, newAccessJwt);
    assertEquals(session.refreshJwt, newRefreshJwt);
    assertEquals(localStorage.getItem("accessJwt"), newAccessJwt);
  });

  it("fetch does not refresh on a 400 that is not ExpiredToken", async () => {
    const { accessJwt, refreshJwt } = writeBasicAuthSession();
    const session = new BasicAuthSession(accessJwt, refreshJwt);
    globalThis.fetch.__intercept(
      "https://pds.example.com/xrpc/foo",
      async () => ({
        ok: false,
        status: 400,
        json: async () => ({ error: "InvalidRequest" }),
      }),
    );
    const res = await session.fetch("https://pds.example.com/xrpc/foo", {
      headers: {},
    });
    assert(!res.ok);
    assertEquals(globalThis.fetch.calls.length, 1);
  });

  it("BasicAuthProvider.logout is a no-op when no session is stored", async () => {
    const provider = new BasicAuthProvider();
    await provider.logout();
    assertEquals(await provider.getSession(), null);
  });

  it("BasicAuthProvider does not read localStorage until getSession is called", () => {
    writeBasicAuthSession();
    const provider = new BasicAuthProvider();
    assertEquals(provider._loaded, false);
    assertEquals(provider.session, null);
  });

  it("BasicAuthProvider.getSession lazily loads the session from localStorage", async () => {
    writeBasicAuthSession({ sub: "did:plc:lazy" });
    const provider = new BasicAuthProvider();
    const session = await provider.getSession();
    assert(session instanceof BasicAuthSession);
    assertEquals(session.did, "did:plc:lazy");
  });

  it("fetch throws RefreshTokenError when the refresh request fails", async () => {
    const { accessJwt, refreshJwt } = writeBasicAuthSession();
    const session = new BasicAuthSession(accessJwt, refreshJwt);
    const refreshUrl =
      "https://pds.example.com/xrpc/com.atproto.server.refreshSession";

    globalThis.fetch.__intercept(
      "https://pds.example.com/xrpc/foo",
      async () => ({
        ok: false,
        status: 400,
        json: async () => ({ error: "ExpiredToken" }),
      }),
    );
    globalThis.fetch.__intercept(refreshUrl, async () => ({
      ok: false,
      status: 401,
    }));

    let threw = null;
    try {
      await session.fetch("https://pds.example.com/xrpc/foo", { headers: {} });
    } catch (error) {
      threw = error;
    }
    assert(threw instanceof RefreshTokenError);
  });
});

t.describe("Auth.requireAuth", (it, { beforeEach, afterEach }) => {
  let manager;
  beforeEach(() => {
    manager = new Auth(new BasicAuthProvider());
  });

  afterEach(() => {
    localStorage.clear();
    globalThis.window = originalWindow;
    window.history.replaceState(null, "", originalPath);
  });

  it("returns the session when one exists", async () => {
    writeBasicAuthSession({ sub: "did:plc:alice" });
    manager = new Auth(new BasicAuthProvider());
    const session = await manager.requireAuth();
    assert(session instanceof BasicAuthSession);
    assertEquals(session.did, "did:plc:alice");
  });

  it("redirects to login and never resolves when no session exists", async () => {
    const capturedHrefs = mockWindowLocation("");
    manager.requireAuth(); // don't await — never resolves
    await Promise.resolve();
    await Promise.resolve();
    assert(capturedHrefs.length > 0, "expected a redirect to login");
    assert(capturedHrefs[0].includes("/login"));
  });
});

t.describe("Auth.requireNoAuth", (it, { beforeEach, afterEach }) => {
  let manager;
  beforeEach(() => {
    manager = new Auth(new BasicAuthProvider());
  });

  afterEach(() => {
    localStorage.clear();
    globalThis.window = originalWindow;
    window.history.replaceState(null, "", originalPath);
  });

  it("returns null when no session exists", async () => {
    const result = await manager.requireNoAuth();
    assertEquals(result, null);
  });

  it("redirects to / when a session exists and no returnTo is set", async () => {
    writeBasicAuthSession();
    manager = new Auth(new BasicAuthProvider());
    const capturedHrefs = mockWindowLocation("");
    manager.requireNoAuth(); // don't await — never resolves
    await Promise.resolve();
    await Promise.resolve();
    assert(capturedHrefs.length > 0, "expected a redirect");
    assertEquals(capturedHrefs[0], "/");
  });

  it("redirects to returnTo when a session exists and returnTo is a valid path", async () => {
    writeBasicAuthSession();
    manager = new Auth(new BasicAuthProvider());
    const capturedHrefs = mockWindowLocation("?returnTo=%2Ffeed");
    manager.requireNoAuth();
    await Promise.resolve();
    await Promise.resolve();
    assertEquals(capturedHrefs[0], "/feed");
  });

  it("does not redirect when addAccount=1 is set, even if a session exists", async () => {
    writeBasicAuthSession();
    manager = new Auth(new BasicAuthProvider());
    const capturedHrefs = mockWindowLocation(
      "?addAccount=1&returnTo=%2Fsettings",
    );
    const result = await manager.requireNoAuth();
    assertEquals(result, null);
    assertEquals(capturedHrefs.length, 0);
  });

  it("falls back to / when returnTo is an external URL", async () => {
    writeBasicAuthSession();
    manager = new Auth(new BasicAuthProvider());
    const capturedHrefs = mockWindowLocation(
      "?returnTo=https%3A%2F%2Fevil.com",
    );
    manager.requireNoAuth();
    await Promise.resolve();
    await Promise.resolve();
    assertEquals(capturedHrefs[0], "/");
  });
});

t.describe("Auth account management", (it, { afterEach }) => {
  afterEach(() => {
    globalThis.window = originalWindow;
    window.history.replaceState(null, "", originalPath);
  });

  async function flushMicrotasks(count = 10) {
    for (let i = 0; i < count; i++) await Promise.resolve();
  }

  function makeMultiAccountProvider({ accounts, currentDid }) {
    return {
      supportsMultipleAccounts: () => true,
      listAccounts: mock(() => Promise.resolve(accounts)),
      getSession: mock(() =>
        Promise.resolve(currentDid ? { did: currentDid } : null),
      ),
      switchToAccount: mock((did) => {
        currentDid = did;
        return Promise.resolve();
      }),
      removeAccount: mock((did) => {
        accounts = accounts.filter((account) => account.did !== did);
        if (currentDid === did) currentDid = accounts[0]?.did ?? null;
        return Promise.resolve();
      }),
      logout: mock(() => Promise.resolve()),
    };
  }

  it("listAccounts delegates to the provider", async () => {
    const provider = makeMultiAccountProvider({
      accounts: [
        { did: "did:plc:alice", handle: "alice.test" },
        { did: "did:plc:bob", handle: "bob.test" },
      ],
      currentDid: "did:plc:alice",
    });
    const manager = new Auth(provider);
    const accounts = await manager.listAccounts();
    assertEquals(accounts.length, 2);
    assertEquals(provider.listAccounts.calls.length, 1);
  });

  it("listAccounts flips needsReauth on accounts whose stored scope is stale", async () => {
    globalThis.window = {
      ...originalWindow,
      env: { oauthScopes: "atproto rpc:a rpc:b" },
    };
    const provider = makeMultiAccountProvider({
      accounts: [
        {
          did: "did:plc:alice",
          handle: "alice.test",
          scope: "atproto rpc:a",
          needsReauth: false,
        },
        {
          did: "did:plc:bob",
          handle: "bob.test",
          scope: "atproto rpc:a rpc:b",
          needsReauth: false,
        },
        {
          did: "did:plc:carol",
          handle: "carol.test",
          scope: null,
          needsReauth: true,
        },
      ],
      currentDid: "did:plc:alice",
    });
    const manager = new Auth(provider);
    const accounts = await manager.listAccounts();
    const byDid = Object.fromEntries(
      accounts.map((entry) => [entry.did, entry]),
    );
    assertEquals(byDid["did:plc:alice"].needsReauth, true);
    assertEquals(byDid["did:plc:bob"].needsReauth, false);
    assertEquals(byDid["did:plc:carol"].needsReauth, true);
  });

  it("listAccounts leaves needsReauth alone for providers that don't expose scope", async () => {
    const provider = makeMultiAccountProvider({
      accounts: [
        { did: "did:plc:alice", handle: "alice.test", needsReauth: false },
      ],
      currentDid: "did:plc:alice",
    });
    const manager = new Auth(provider);
    const accounts = await manager.listAccounts();
    assertEquals(accounts[0].needsReauth, false);
  });

  it("supportsMultipleAccounts reflects the provider capability", () => {
    const multi = new Auth(makeMultiAccountProvider({ accounts: [] }));
    assertEquals(multi.supportsMultipleAccounts(), true);
    const basic = new Auth(new BasicAuthProvider());
    assertEquals(basic.supportsMultipleAccounts(), false);
  });

  it("switchAccount flips the provider and redirects to /", async () => {
    const capturedHrefs = mockWindowLocation("");
    const provider = makeMultiAccountProvider({
      accounts: [
        { did: "did:plc:alice", handle: "alice.test" },
        { did: "did:plc:bob", handle: "bob.test" },
      ],
      currentDid: "did:plc:alice",
    });
    const manager = new Auth(provider);
    manager.switchAccount("did:plc:bob"); // never resolves
    await flushMicrotasks();
    assertEquals(provider.switchToAccount.calls.length, 1);
    assertEquals(provider.switchToAccount.calls[0][0], "did:plc:bob");
    assertEquals(capturedHrefs.at(-1), "reload");
  });

  it("switchAccount throws when the provider does not support it", async () => {
    const manager = new Auth(new BasicAuthProvider());
    let threw = null;
    try {
      await manager.switchAccount("did:plc:bob");
    } catch (error) {
      threw = error;
    }
    assert(threw !== null);
  });

  it("removeAccount drops the account in place when it is not current", async () => {
    const provider = makeMultiAccountProvider({
      accounts: [
        { did: "did:plc:alice", handle: "alice.test" },
        { did: "did:plc:bob", handle: "bob.test" },
      ],
      currentDid: "did:plc:alice",
    });
    const manager = new Auth(provider);
    await manager.removeAccount("did:plc:bob");
    assertEquals(provider.removeAccount.calls.length, 1);
    assertEquals(provider.removeAccount.calls[0][0], "did:plc:bob");
    assertEquals(provider.switchToAccount.calls.length, 0);
  });

  it("removeAccount switches to another account first when removing the current one", async () => {
    const capturedHrefs = mockWindowLocation("");
    const provider = makeMultiAccountProvider({
      accounts: [
        { did: "did:plc:alice", handle: "alice.test" },
        { did: "did:plc:bob", handle: "bob.test" },
      ],
      currentDid: "did:plc:alice",
    });
    const manager = new Auth(provider);
    manager.removeAccount("did:plc:alice"); // never resolves
    await flushMicrotasks();
    assertEquals(provider.switchToAccount.calls.length, 1);
    assertEquals(provider.switchToAccount.calls[0][0], "did:plc:bob");
    assertEquals(provider.removeAccount.calls.length, 1);
    assertEquals(provider.removeAccount.calls[0][0], "did:plc:alice");
    assertEquals(capturedHrefs.at(-1), "reload");
  });

  it("removeAccount redirects to login when removing the only account", async () => {
    const capturedHrefs = mockWindowLocation("");
    const provider = makeMultiAccountProvider({
      accounts: [{ did: "did:plc:alice", handle: "alice.test" }],
      currentDid: "did:plc:alice",
    });
    const manager = new Auth(provider);
    manager.removeAccount("did:plc:alice"); // never resolves
    await flushMicrotasks();
    assertEquals(provider.switchToAccount.calls.length, 0);
    assertEquals(provider.removeAccount.calls.length, 1);
    assert(capturedHrefs.at(-1).includes("/login"));
  });
});

t.describe("Auth.login", (it, { beforeEach, afterEach }) => {
  const originalSetTimeout = globalThis.setTimeout;
  beforeEach(() => {
    globalThis.setTimeout = (fn) => originalSetTimeout(fn, 0);
  });
  afterEach(() => {
    globalThis.setTimeout = originalSetTimeout;
  });

  it("delegates to provider.login with the args object intact", async () => {
    const provider = {
      login: mock(() => Promise.resolve("session")),
    };
    const manager = new Auth(provider);
    const args = { handle: "alice.test", returnTo: "/feed" };
    const result = await manager.login(args);
    assertEquals(result, "session");
    assertEquals(provider.login.calls.length, 1);
    assertEquals(provider.login.calls[0][0], args);
  });

  it("throws TimeoutError when provider.login hangs past the timeout", async () => {
    const provider = {
      login: mock(() => new Promise(() => {})),
    };
    const manager = new Auth(provider);
    let threw = null;
    try {
      await manager.login({ handle: "alice.test" });
    } catch (error) {
      threw = error;
    }
    assert(threw instanceof TimeoutError);
  });
});

t.describe("Auth.logout", (it) => {
  it("delegates to provider.logout with the did", async () => {
    const provider = makeMockProvider();
    const manager = new Auth(provider);
    await manager.logout("did:plc:alice");
    assertEquals(provider.logout.calls.length, 1);
    assertEquals(provider.logout.calls[0][0], "did:plc:alice");
  });

  it("delegates to provider.logout with no did when called without args", async () => {
    const provider = makeMockProvider();
    const manager = new Auth(provider);
    await manager.logout();
    assertEquals(provider.logout.calls.length, 1);
    assertEquals(provider.logout.calls[0][0], null);
  });
});

t.describe("getMissingScopes", (it) => {
  it("returns an empty array when granted matches required", () => {
    const result = getMissingScopes(
      "atproto rpc:a rpc:b",
      "atproto rpc:a rpc:b",
    );
    assertEquals(result.length, 0);
  });

  it("returns scopes present in required but missing from granted", () => {
    const result = getMissingScopes("atproto rpc:a", "atproto rpc:a rpc:b");
    assertEquals(result, ["rpc:b"]);
  });

  it("ignores extra scopes in granted that are not required", () => {
    const result = getMissingScopes("atproto rpc:a rpc:extra", "atproto rpc:a");
    assertEquals(result.length, 0);
  });

  it("tolerates extra whitespace and empty tokens", () => {
    const result = getMissingScopes("  atproto   rpc:a  ", "atproto rpc:a");
    assertEquals(result.length, 0);
  });

  it("treats scopes with different query params as distinct", () => {
    // Exact-string match: ?aud=* and ?aud=did:web:foo are not equivalent.
    const result = getMissingScopes("rpc:a?aud=did:web:foo", "rpc:a?aud=*");
    assertEquals(result, ["rpc:a?aud=*"]);
  });
});

t.describe("Auth.ensureCurrentScopes", (it, { afterEach }) => {
  const originalEnv = globalThis.window.env;

  afterEach(() => {
    globalThis.window = originalWindow;
    globalThis.window.env = originalEnv;
  });

  it("does nothing when there is no session", async () => {
    const capturedHrefs = mockWindowLocation();
    globalThis.window.env = { oauthScopes: "atproto rpc:a" };
    const provider = makeMockProvider();
    const manager = new Auth(provider);
    await manager.ensureCurrentScopes();
    assertEquals(capturedHrefs.length, 0);
    assertEquals(provider.logout.calls.length, 0);
  });

  it("does nothing when the session has no scope (BasicAuth)", async () => {
    const capturedHrefs = mockWindowLocation();
    globalThis.window.env = { oauthScopes: "atproto rpc:a" };
    const provider = makeMockProvider();
    provider.getSession = mock(() => Promise.resolve({ scope: undefined }));
    const manager = new Auth(provider);
    await manager.ensureCurrentScopes();
    assertEquals(capturedHrefs.length, 0);
    assertEquals(provider.logout.calls.length, 0);
  });

  it("does nothing when granted scopes match required", async () => {
    const capturedHrefs = mockWindowLocation();
    globalThis.window.env = { oauthScopes: "atproto rpc:a rpc:b" };
    const provider = makeMockProvider();
    provider.getSession = mock(() =>
      Promise.resolve({ scope: "atproto rpc:a rpc:b" }),
    );
    const manager = new Auth(provider);
    await manager.ensureCurrentScopes();
    assertEquals(capturedHrefs.length, 0);
    assertEquals(provider.logout.calls.length, 0);
  });

  it("logs out and redirects to login when a required scope is missing", async () => {
    const capturedHrefs = mockWindowLocation();
    globalThis.window.env = { oauthScopes: "atproto rpc:a rpc:b" };
    const provider = makeMockProvider();
    provider.getSession = mock(() =>
      Promise.resolve({ scope: "atproto rpc:a" }),
    );
    const manager = new Auth(provider);
    manager.ensureCurrentScopes();
    await Promise.resolve();
    await Promise.resolve();
    assertEquals(provider.logout.calls.length, 1);
    assert(capturedHrefs.length > 0, "expected a redirect");
    assert(capturedHrefs[0].includes("/login"));
  });

  it("still redirects to login when provider.logout throws", async () => {
    const capturedHrefs = mockWindowLocation();
    globalThis.window.env = { oauthScopes: "atproto rpc:a rpc:b" };
    const provider = makeMockProvider({
      logoutFn: () => Promise.reject(new Error("logout failed")),
    });
    provider.getSession = mock(() =>
      Promise.resolve({ scope: "atproto rpc:a" }),
    );
    const manager = new Auth(provider);
    manager.ensureCurrentScopes();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    assert(
      capturedHrefs.length > 0,
      "expected a redirect despite logout error",
    );
    assert(capturedHrefs[0].includes("/login"));
  });
});

await t.run();
