import {
  resolveHandle,
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
    encodeUtf8(signatureInput)
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
    authServerUrl
  );
  const response = await fetch(metadataUrl);
  if (!response.ok) {
    throw new Error("Failed to fetch auth server metadata");
  }
  return await response.json();
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
        ["verify"]
      ),
      privateKey: await window.crypto.subtle.importKey(
        "jwk",
        privkey,
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["sign"]
      ),
    };
  }
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    true,
    ["sign", "verify"]
  );
  const publicKeyJwk = await window.crypto.subtle.exportKey(
    "jwk",
    keyPair.publicKey
  );
  const privateKeyJwk = await window.crypto.subtle.exportKey(
    "jwk",
    keyPair.privateKey
  );
  localStorage.setItem(
    "dpop_keypair",
    JSON.stringify({
      pubkey: publicKeyJwk,
      privkey: privateKeyJwk,
    })
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
      retryCount === 0
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
      this.dpopKeypair.publicKey
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

class Session {
  constructor(sessionData, dpopRequests) {
    this.sessionData = sessionData;
    this.dpopRequests = dpopRequests;
    this.pendingRefresh = null;
  }

  static async load(dpopRequests) {
    const sessionDataStr = localStorage.getItem("oauth_session");
    if (!sessionDataStr) {
      return null;
    }
    const sessionData = JSON.parse(sessionDataStr);
    return new Session(sessionData, dpopRequests);
  }

  save() {
    localStorage.setItem("oauth_session", JSON.stringify(this.sessionData));
  }

  async refreshToken({ retryCount = 0 } = {}) {
    const authServer = new AuthServer(
      this.sessionData.authServerMetadata,
      this.dpopRequests
    );

    const params = {
      grant_type: "refresh_token",
      refresh_token: this.sessionData.refreshToken,
      client_id: this.sessionData.clientId,
    };

    const response = await authServer.refresh(params);

    if (!response.ok) {
      const error = await response.text();
      if (error.error === "server_error" && retryCount === 0) {
        return await this.refreshToken({ retryCount: retryCount + 1 });
      }
      throw new TokenRefreshError(`Token refresh failed: ${error}`);
    }

    const newTokenResponse = await response.json();
    this.sessionData.accessToken = newTokenResponse.access_token;
    this.sessionData.refreshToken = newTokenResponse.refresh_token;
    this.sessionData.expiresAt =
      Date.now() + newTokenResponse.expires_in * 1000;

    this.save();
  }

  async fetch(url, { headers = {}, ...options } = {}) {
    // refresh session if needed
    if (Date.now() > this.sessionData.expiresAt - 60000) {
      if (!this.pendingRefresh) {
        this.pendingRefresh = this.refreshToken();
      }
      await this.pendingRefresh;
      this.pendingRefresh = null;
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

  get serviceEndpoint() {
    return this.sessionData.serviceEndpoint;
  }

  logout() {
    localStorage.removeItem("oauth_session");
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
      const error = await response.text();
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

export class OauthClient {
  constructor({ clientId, redirectUri, dpopKeypair }) {
    this.clientId = clientId;
    this.redirectUri = redirectUri;
    this.dpopRequests = new DPoPRequests(dpopKeypair);
  }

  static async load({ clientId, redirectUri }) {
    const dpopKeypair = await loadOrGenerateDPoPKeypair();
    return new OauthClient({
      clientId,
      redirectUri,
      dpopKeypair,
    });
  }

  async getAuthorizationUrl(
    handle,
    {
      scope = "atproto transition:generic transition:chat.bsky",
      state = {},
    } = {}
  ) {
    const did = await resolveHandle(handle);
    const didDoc = await resolveDid(did);
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
      serviceEndpoint,
      authServerUrl,
      authServerMetadata,
      redirectUri: this.redirectUri,
    };
    localStorage.setItem(
      `oauth_in_flight_${requestId}`,
      JSON.stringify(inFlightData)
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
    const authUrl = new URL(authServerMetadata.authorization_endpoint);
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
      `oauth_in_flight_${requestId}`
    );
    if (!inFlightDataStr) {
      throw new Error("No in-flight data found for requestId");
    }

    localStorage.removeItem(`oauth_in_flight_${requestId}`);

    const inFlightData = JSON.parse(inFlightDataStr);

    if (iss !== inFlightData.authServerUrl) {
      throw new Error("Issuer mismatch");
    }

    const authServer = new AuthServer(
      inFlightData.authServerMetadata,
      this.dpopRequests
    );
    const tokenResponse = await authServer.exchangeCodeForToken(
      this.clientId,
      code,
      inFlightData.codeVerifier,
      inFlightData.redirectUri
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

    return session;
  }

  async getSession() {
    return Session.load(this.dpopRequests);
  }

  async logout() {
    const session = await this.getSession();
    if (session) {
      await session.logout();
    }
  }
}
