import {
  resolveHandle,
  didDocReferencesHandle,
  resolveDid,
  getServiceEndpointFromDidDoc,
} from "/js/atproto.js";

// Inspiration from:
// https://www.npmjs.com/package/@atproto/oauth-client-browser
// https://www.npmjs.com/package/@atcute/oauth-browser-client
// Saves dpop keypair in localStorage.

function base64UrlEncode(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function generateRandomString(length) {
  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

function encodeUtf8(str) {
  return new TextEncoder().encode(str);
}

async function signJWT(header, payload, privateKey) {
  const headerB64 = base64UrlEncode(encodeUtf8(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(encodeUtf8(JSON.stringify(payload)));

  const signatureInput = `${headerB64}.${payloadB64}`;
  const signatureBuffer = await window.crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    encodeUtf8(signatureInput),
  );

  const signatureB64 = base64UrlEncode(signatureBuffer);
  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

async function sha256(data) {
  const dataBuffer = encodeUtf8(data);
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", dataBuffer);
  return base64UrlEncode(hashBuffer);
}

async function fetchResourceServerMetadata(pdsUrl) {
  const metadataUrl = new URL("/.well-known/oauth-protected-resource", pdsUrl);
  const response = await fetch(metadataUrl);
  if (!response.ok) {
    throw new Error("Failed to fetch resource server metadata");
  }
  return await response.json();
}

async function fetchAuthServerMetadata(authServerUrl) {
  const metadataUrl = new URL(
    "/.well-known/oauth-authorization-server",
    authServerUrl,
  );
  const response = await fetch(metadataUrl);
  if (!response.ok) {
    throw new Error("Failed to fetch auth server metadata");
  }
  return await response.json();
}

const SESSION_KEY_PREFIX = "oauth_session:";
const ACCOUNTS_KEY = "oauth_accounts";
const CURRENT_DID_KEY = "oauth_current_did";
const IN_FLIGHT_PREFIX = "oauth_in_flight_";
const IN_FLIGHT_MAX_AGE_MS = 10 * 60 * 1000;
const LEGACY_SESSION_KEY = "oauth_session";

function readAccounts() {
  const raw = localStorage.getItem(ACCOUNTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAccounts(accounts) {
  if (accounts.length === 0) {
    localStorage.removeItem(ACCOUNTS_KEY);
  } else {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  }
}

function upsertAccount(account) {
  const accounts = readAccounts();
  const index = accounts.findIndex((entry) => entry.did === account.did);
  if (index >= 0) {
    accounts[index] = { ...accounts[index], ...account };
  } else {
    accounts.push(account);
  }
  writeAccounts(accounts);
}

function getAccount(did) {
  return readAccounts().find((entry) => entry.did === did) ?? null;
}

function deleteAccount(did) {
  const accounts = readAccounts();
  writeAccounts(accounts.filter((entry) => entry.did !== did));
}

function migrateLegacySession() {
  const legacySessionData = localStorage.getItem(LEGACY_SESSION_KEY);
  if (!legacySessionData) return;
  if (localStorage.getItem(ACCOUNTS_KEY) !== null) {
    // This shouldn't happen
    localStorage.removeItem(LEGACY_SESSION_KEY);
    return;
  }
  try {
    const sessionData = JSON.parse(legacySessionData);
    if (!sessionData?.did) {
      localStorage.removeItem(LEGACY_SESSION_KEY);
      return;
    }
    localStorage.setItem(
      SESSION_KEY_PREFIX + sessionData.did,
      legacySessionData,
    );
    writeAccounts([
      {
        did: sessionData.did,
        handle: null,
        pdsUrl: sessionData.serviceEndpoint ?? null,
      },
    ]);
    localStorage.setItem(CURRENT_DID_KEY, sessionData.did);
    localStorage.removeItem(LEGACY_SESSION_KEY);
  } catch {
    localStorage.removeItem(LEGACY_SESSION_KEY);
  }
}

function removeStaleInFlightData() {
  const now = Date.now();
  for (let index = localStorage.length - 1; index >= 0; index--) {
    const key = localStorage.key(index);
    if (!key?.startsWith(IN_FLIGHT_PREFIX)) continue;
    let stale = false;
    try {
      const data = JSON.parse(localStorage.getItem(key));
      stale = !data?.createdAt || now - data.createdAt > IN_FLIGHT_MAX_AGE_MS;
    } catch {
      stale = true;
    }
    if (stale) localStorage.removeItem(key);
  }
}

async function loadOrGenerateDPoPKeypair() {
  const dpopKeypairStr = localStorage.getItem("dpop_keypair");
  if (dpopKeypairStr) {
    const { privkey, pubkey } = JSON.parse(dpopKeypairStr);
    return {
      publicKey: await window.crypto.subtle.importKey(
        "jwk",
        pubkey,
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["verify"],
      ),
      privateKey: await window.crypto.subtle.importKey(
        "jwk",
        privkey,
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["sign"],
      ),
    };
  }
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    true,
    ["sign", "verify"],
  );
  const publicKeyJwk = await window.crypto.subtle.exportKey(
    "jwk",
    keyPair.publicKey,
  );
  const privateKeyJwk = await window.crypto.subtle.exportKey(
    "jwk",
    keyPair.privateKey,
  );
  localStorage.setItem(
    "dpop_keypair",
    JSON.stringify({
      pubkey: publicKeyJwk,
      privkey: privateKeyJwk,
    }),
  );
  return keyPair;
}

class DPoPRequests {
  constructor(dpopKeypair) {
    this.dpopKeypair = dpopKeypair;
    this.nonces = new Map();
  }

  async fetch(url, options, retryCount = 0) {
    const origin = new URL(url).origin;
    const nonce = this.nonces.get(origin) ?? null;
    const method = options.method ?? "GET";
    const authHeader = options.headers?.Authorization;
    const accessToken = authHeader?.includes("DPoP ")
      ? authHeader.split(" ")[1]
      : null;
    const proof = await this.createProof(method, url, nonce, accessToken);
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        DPoP: proof,
      },
    });
    // Set nonce if provided
    const dpopNonce = response.headers.get("DPoP-Nonce");
    if (dpopNonce) {
      this.nonces.set(origin, dpopNonce);
    }
    // Handle nonce errors - retry once with the new nonce
    if (
      !response.ok &&
      [401, 400].includes(response.status) &&
      retryCount === 0 &&
      !options.noDpopRetry // NOTE: special option if we just want to get the dpop nonce
    ) {
      try {
        const errorData = await response.json();
        // attach consumed body to the response, in case the parent needs it
        response.data = errorData;
        if (errorData.error === "use_dpop_nonce") {
          return await this.fetch(url, options, retryCount + 1);
        }
      } catch {
        // pass
      }
    }
    return response;
  }

  async createProof(method, url, dpopNonce = null, accessToken = null) {
    const publicJwk = await window.crypto.subtle.exportKey(
      "jwk",
      this.dpopKeypair.publicKey,
    );
    const header = {
      typ: "dpop+jwt",
      alg: "ES256",
      jwk: {
        kty: publicJwk.kty,
        crv: publicJwk.crv,
        x: publicJwk.x,
        y: publicJwk.y,
      },
    };

    const payload = {
      jti: generateRandomString(32),
      htm: method,
      htu: url,
      iat: Math.floor(Date.now() / 1000),
    };

    if (dpopNonce) {
      payload.nonce = dpopNonce;
    }

    if (accessToken) {
      payload.ath = await sha256(accessToken);
    }

    return signJWT(header, payload, this.dpopKeypair.privateKey);
  }
}

export class TokenRefreshError extends Error {
  constructor(message) {
    super(message);
    this.name = "TokenRefreshError";
  }
}

export class Session {
  static refreshBackoffMs = 500;
  static concurrentRefreshRecoveryMs = 1000;

  constructor(sessionData, dpopRequests) {
    this.sessionData = sessionData;
    this.dpopRequests = dpopRequests;
    this.pendingRefresh = null;
  }

  static async load(dpopRequests, did) {
    if (!did) {
      return null;
    }
    const sessionDataStr = localStorage.getItem(SESSION_KEY_PREFIX + did);
    if (!sessionDataStr) {
      return null;
    }
    const sessionData = JSON.parse(sessionDataStr);
    return new Session(sessionData, dpopRequests);
  }

  save() {
    localStorage.setItem(
      SESSION_KEY_PREFIX + this.sessionData.did,
      JSON.stringify(this.sessionData),
    );
  }

  async refreshToken({ retryCount = 0 } = {}) {
    const authServer = new AuthServer(
      this.sessionData.authServerMetadata,
      this.dpopRequests,
    );

    const usedRefreshToken = this.sessionData.refreshToken;
    const params = {
      grant_type: "refresh_token",
      refresh_token: usedRefreshToken,
      client_id: this.sessionData.clientId,
    };

    const maxRetries = 2;
    const backoffMs = Session.refreshBackoffMs * Math.pow(2, retryCount);

    let response;
    try {
      response = await authServer.refresh(params);
    } catch (error) {
      if (retryCount < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        return await this.refreshToken({ retryCount: retryCount + 1 });
      }
      // Transient network error after retries — surface as a non-logout error
      throw new Error(`Token refresh failed (network): ${error.message}`);
    }

    if (!response.ok) {
      if (response.status >= 500) {
        if (retryCount < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          return await this.refreshToken({ retryCount: retryCount + 1 });
        }
        const body = response.data
          ? JSON.stringify(response.data)
          : await response.text();
        throw new Error(`Token refresh failed (server): ${body}`);
      }
      // invalid_grant can mean another tab rotated the refresh token, so re-check storage and adopt if so
      if (response.status === 400 && response.data?.error === "invalid_grant") {
        if (this.adoptRotatedSession(usedRefreshToken)) return;
        // attempt twice with delay
        await new Promise((resolve) =>
          setTimeout(resolve, Session.concurrentRefreshRecoveryMs),
        );
        if (this.adoptRotatedSession(usedRefreshToken)) return;
      }
      const body = response.data
        ? JSON.stringify(response.data)
        : await response.text();
      throw new TokenRefreshError(`Token refresh failed: ${body}`);
    }

    const newTokenResponse = await response.json();
    this.sessionData.accessToken = newTokenResponse.access_token;
    this.sessionData.refreshToken = newTokenResponse.refresh_token;
    this.sessionData.expiresAt =
      Date.now() + newTokenResponse.expires_in * 1000;

    this.save();
  }

  adoptRotatedSession(usedRefreshToken) {
    const stored = localStorage.getItem(
      SESSION_KEY_PREFIX + this.sessionData.did,
    );
    if (!stored) return false;
    try {
      const data = JSON.parse(stored);
      if (data?.refreshToken && data.refreshToken !== usedRefreshToken) {
        this.sessionData = data;
        return true;
      }
    } catch {
      // pass
    }
    return false;
  }

  async fetch(url, { headers = {}, ...options } = {}) {
    // refresh session if needed
    if (Date.now() > this.sessionData.expiresAt - 60000) {
      if (!this.pendingRefresh) {
        this.pendingRefresh = this.refreshToken().finally(() => {
          this.pendingRefresh = null;
        });
      }
      await this.pendingRefresh;
    }
    return this.dpopRequests.fetch(url, {
      headers: {
        Authorization: `DPoP ${this.sessionData.accessToken}`,
        ...headers,
      },
      ...options,
    });
  }

  get did() {
    return this.sessionData.did;
  }

  get handle() {
    return getAccount(this.sessionData.did)?.handle ?? null;
  }

  get serviceEndpoint() {
    return this.sessionData.serviceEndpoint;
  }

  get scope() {
    return this.sessionData.scope ?? null;
  }
}

class AuthServer {
  constructor(authServerMetadata, dpopRequests) {
    this.authServerMetadata = authServerMetadata;
    this.dpopRequests = dpopRequests;
  }

  async refresh(params) {
    const tokenEndpoint = this.authServerMetadata.token_endpoint;
    return this.dpopRequests.fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params).toString(),
    });
  }

  async exchangeCodeForToken(clientId, code, codeVerifier, redirectUri) {
    const tokenEndpoint = this.authServerMetadata.token_endpoint;

    const params = {
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
      client_id: clientId,
    };

    const response = await this.dpopRequests.fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params).toString(),
    });

    if (!response.ok) {
      const error = response.data
        ? JSON.stringify(response.data)
        : await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    return await response.json();
  }

  async sendPAR(params) {
    const endpoint =
      this.authServerMetadata.pushed_authorization_request_endpoint;
    const body = new URLSearchParams(params);
    const response = await this.dpopRequests.fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      console.error("PAR request failed", response);
      throw new Error("PAR request failed");
    }

    return await response.json();
  }
}

export class HandleNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "HandleNotFoundError";
  }
}

export class InvalidAuthUrlError extends Error {
  constructor(message) {
    super(message);
    this.name = "InvalidAuthUrlError";
  }
}

export class OauthClient {
  constructor({ clientId, redirectUri, dpopKeypair }) {
    this.clientId = clientId;
    this.redirectUri = redirectUri;
    this.dpopRequests = new DPoPRequests(dpopKeypair);
    this.sessionsByDid = new Map();
  }

  static async load({ clientId, redirectUri }) {
    const dpopKeypair = await loadOrGenerateDPoPKeypair();
    migrateLegacySession();
    return new OauthClient({
      clientId,
      redirectUri,
      dpopKeypair,
    });
  }

  async getAuthorizationUrl(handle, { scope = "atproto", state = {} } = {}) {
    const did = await resolveHandle(handle);
    if (!did) {
      throw new HandleNotFoundError("DID not found for handle: " + handle);
    }
    const didDoc = await resolveDid(did);
    if (!didDocReferencesHandle(didDoc, handle)) {
      throw new Error(
        `DID doc for ${did} does not reference handle: ${handle}`,
      );
    }
    const serviceEndpoint = getServiceEndpointFromDidDoc(didDoc);
    const resourceMetadata = await fetchResourceServerMetadata(serviceEndpoint);
    if (
      !resourceMetadata.authorization_servers ||
      resourceMetadata.authorization_servers.length !== 1
    ) {
      throw new Error("Expected exactly one authorization server");
    }
    const authServerUrl = resourceMetadata.authorization_servers[0];
    const authServerMetadata = await fetchAuthServerMetadata(authServerUrl);

    const codeVerifier = generateRandomString(64);
    const codeChallenge = await sha256(codeVerifier);
    const requestId = generateRandomString(32);

    const inFlightData = {
      codeVerifier,
      did,
      handle,
      serviceEndpoint,
      authServerUrl,
      authServerMetadata,
      redirectUri: this.redirectUri,
      createdAt: Date.now(),
    };
    localStorage.setItem(
      `${IN_FLIGHT_PREFIX}${requestId}`,
      JSON.stringify(inFlightData),
    );

    const authServer = new AuthServer(authServerMetadata, this.dpopRequests);
    const parResponse = await authServer.sendPAR({
      client_id: this.clientId,
      response_type: "code",
      redirect_uri: this.redirectUri,
      state: encodeURIComponent(JSON.stringify({ requestId, ...state })),
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      scope,
      login_hint: handle,
    });
    let authUrl = null;
    try {
      authUrl = new URL(authServerMetadata.authorization_endpoint);
    } catch (error) {
      throw new InvalidAuthUrlError("Error parsing authorization URL");
    }
    if (authUrl.protocol !== "https:") {
      throw new InvalidAuthUrlError("Authorization URL protocol must be HTTPS");
    }
    authUrl.searchParams.set("client_id", this.clientId);
    authUrl.searchParams.set("request_uri", parResponse.request_uri);
    return authUrl.toString();
  }

  async handleCallback({ code, state: stateStr, iss }) {
    if (!code || !stateStr) {
      throw new Error("Missing code or state in callback");
    }

    const { requestId } = JSON.parse(decodeURIComponent(stateStr));
    const inFlightDataStr = localStorage.getItem(
      `${IN_FLIGHT_PREFIX}${requestId}`,
    );
    if (!inFlightDataStr) {
      throw new Error("No in-flight data found for requestId");
    }

    const inFlightData = JSON.parse(inFlightDataStr);

    if (iss !== inFlightData.authServerUrl) {
      throw new Error("Issuer mismatch");
    }

    const authServer = new AuthServer(
      inFlightData.authServerMetadata,
      this.dpopRequests,
    );
    const tokenResponse = await authServer.exchangeCodeForToken(
      this.clientId,
      code,
      inFlightData.codeVerifier,
      inFlightData.redirectUri,
    );

    if (tokenResponse.sub !== inFlightData.did) {
      throw new Error("DID mismatch in token response");
    }

    const sessionData = {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresAt: Date.now() + tokenResponse.expires_in * 1000,
      did: tokenResponse.sub,
      scope: tokenResponse.scope,
      serviceEndpoint: inFlightData.serviceEndpoint,
      authServerUrl: inFlightData.authServerUrl,
      authServerMetadata: inFlightData.authServerMetadata,
      clientId: this.clientId,
    };

    const session = new Session(sessionData, this.dpopRequests);
    session.save();
    this.sessionsByDid.set(tokenResponse.sub, session);

    upsertAccount({
      did: tokenResponse.sub,
      handle: inFlightData.handle ?? null,
      pdsUrl: inFlightData.serviceEndpoint,
    });
    localStorage.setItem(CURRENT_DID_KEY, tokenResponse.sub);

    localStorage.removeItem(`${IN_FLIGHT_PREFIX}${requestId}`);
    removeStaleInFlightData();

    return session;
  }

  async getSession(did = null) {
    const targetDid = did ?? localStorage.getItem(CURRENT_DID_KEY);
    if (!targetDid) return null;
    const cached = this.sessionsByDid.get(targetDid);
    if (cached) return cached;
    const session = await Session.load(this.dpopRequests, targetDid);
    if (session) this.sessionsByDid.set(targetDid, session);
    return session;
  }

  listAccounts() {
    return readAccounts().map((account) => {
      const sessionDataStr = localStorage.getItem(
        SESSION_KEY_PREFIX + account.did,
      );
      if (sessionDataStr === null) {
        return { ...account, scope: null, needsReauth: true };
      }
      let scope = null;
      try {
        scope = JSON.parse(sessionDataStr)?.scope ?? null;
      } catch {
        // pass
      }
      return { ...account, scope, needsReauth: false };
    });
  }

  switchToAccount(did) {
    const accounts = readAccounts();
    if (!accounts.some((entry) => entry.did === did)) {
      throw new Error(`No stored account for did: ${did}`);
    }
    localStorage.setItem(CURRENT_DID_KEY, did);
  }

  async _sendRevokeRequest(did) {
    const sessionDataStr = localStorage.getItem(SESSION_KEY_PREFIX + did);
    if (!sessionDataStr) return;
    let sessionData;
    try {
      sessionData = JSON.parse(sessionDataStr);
    } catch {
      return;
    }
    const revocationEndpoint =
      sessionData?.authServerMetadata?.revocation_endpoint;
    const refreshToken = sessionData?.refreshToken;
    if (!revocationEndpoint || !refreshToken) return;
    try {
      await this.dpopRequests.fetch(revocationEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          token: refreshToken,
          token_type_hint: "refresh_token",
          client_id: sessionData.clientId ?? this.clientId,
        }).toString(),
      });
    } catch (error) {
      console.warn("oauth: revoke on sign-out failed", error);
    }
  }

  async revoke(did = null) {
    const targetDid = did ?? localStorage.getItem(CURRENT_DID_KEY);
    if (!targetDid) return;
    await this._sendRevokeRequest(targetDid);
    localStorage.removeItem(SESSION_KEY_PREFIX + targetDid);
    this.sessionsByDid.delete(targetDid);
  }

  async removeAccount(did) {
    const targetDid = did ?? localStorage.getItem(CURRENT_DID_KEY);
    if (!targetDid) return;
    const accounts = readAccounts();
    if (!accounts.some((entry) => entry.did === targetDid)) return;
    await this.revoke(targetDid);
    deleteAccount(targetDid);
    const remaining = readAccounts();
    if (localStorage.getItem(CURRENT_DID_KEY) === targetDid) {
      if (remaining.length === 0) {
        localStorage.removeItem(CURRENT_DID_KEY);
      } else {
        localStorage.setItem(CURRENT_DID_KEY, remaining[0].did);
      }
    }
  }
}
