import { getServiceEndpointForHandle } from "/js/atproto.js";
import {
  OauthClient,
  HandleNotFoundError,
  InvalidAuthUrlError,
} from "/js/oauth.js";
import { isDev, isNative } from "/js/utils.js";

export class RefreshTokenError extends Error {
  constructor(res) {
    super("Refresh token error");
    this.res = res;
  }
}

export class InvalidUsernameError extends Error {
  constructor(message) {
    super(message);
    this.name = "InvalidUsernameError";
  }
}

export class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = "AuthError";
  }
}

function parseJwt(token) {
  try {
    // Split the token into its three parts
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new Error("Invalid JWT format");
    }

    // Decode the payload (second part)
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );

    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error("Failed to decode JWT:", error);
    return null;
  }
}

export class BasicAuthSession {
  constructor(accessJwt, refreshJwt) {
    this.accessJwt = accessJwt;
    this.refreshJwt = refreshJwt;
  }

  save() {
    localStorage.setItem("accessJwt", this.accessJwt);
    localStorage.setItem("refreshJwt", this.refreshJwt);
  }

  get serviceEndpoint() {
    // Decode the accessJwt to get the serviceEndpoint
    const decoded = parseJwt(this.accessJwt);
    return decoded.aud.replace("did:web:", "https://");
  }

  get did() {
    const decoded = parseJwt(this.accessJwt);
    return decoded.sub;
  }

  async fetch(url, options) {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${this.accessJwt}`,
      },
    });
    // refresh the token if needed
    if (res.status === 400) {
      const error = await res.json();
      if (error.error === "ExpiredToken") {
        const refreshRes = await fetch(
          this.serviceEndpoint + "/xrpc/com.atproto.server.refreshSession",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${this.refreshJwt}`,
            },
          }
        );
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          this.accessJwt = data.accessJwt;
          this.save();
          return await this.fetch(url, options);
        } else {
          throw new RefreshTokenError(refreshRes);
        }
      }
    }
    return res;
  }

  async delete() {
    localStorage.removeItem("accessJwt");
    localStorage.removeItem("refreshJwt");
  }

  static fromLocalStorage() {
    const accessJwt = localStorage.getItem("accessJwt");
    const refreshJwt = localStorage.getItem("refreshJwt");
    if (!accessJwt || !refreshJwt) {
      return null;
    }
    return new BasicAuthSession(accessJwt, refreshJwt);
  }
}

export class BasicAuth {
  constructor() {
    this.session = BasicAuthSession.fromLocalStorage();
  }

  async getSession() {
    return this.session;
  }

  async login(handle, password) {
    const serviceEndpoint = await getServiceEndpointForHandle(handle);
    const res = await fetch(
      serviceEndpoint + "/xrpc/com.atproto.server.createSession",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ identifier: handle, password }),
      }
    );
    if (!res.ok) {
      throw new Error("Login failed");
    }
    const data = await res.json();
    const session = new BasicAuthSession(data.accessJwt, data.refreshJwt);
    this.session = session;
    this.session.save();
    return session;
  }

  async logout() {
    await this.session.delete();
    this.session = null;
  }
}

export class OAuth {
  constructor() {
    this._client = null;
  }

  async getClient() {
    if (!this._client) {
      this._client = await OauthClient.load({
        clientId: `https://${window.env.hostName}/oauth-client-metadata.json`,
        redirectUri: `https://${window.env.hostName}/callback.html`,
      });
    }
    return this._client;
  }

  async getSession() {
    const client = await this.getClient();
    return client.getSession();
  }

  async login(handle) {
    const client = await this.getClient();
    let authUrl = null;
    try {
      authUrl = await client.getAuthorizationUrl(handle, {
        state: { loopback: isDev() },
      });
    } catch (error) {
      if (error instanceof HandleNotFoundError) {
        throw new InvalidUsernameError("Invalid username");
      } else if (error instanceof InvalidAuthUrlError) {
        throw new AuthError("Invalid authorization URL: " + error.message);
      }
      throw error;
    }
    window.location.href = authUrl;
    return new Promise(() => {}); // no resolve, just wait for redirect
    // if (isNative()) {
    //   // Listen for the native app callback
    //   App.addListener("appUrlOpen", (state) => {
    //     if (data.url.startsWith("dev.pages.impro:/callback")) {
    //       const params = data.url.split("?")[1];
    //       window.location.href = "/callback.html?" + params;
    //     }
    //   });
    //   await Browser.open({ url: authUrl });
    // } else {
    //   window.location.href = authUrl;
    // }
  }

  async logout() {
    const client = await this.getClient();
    await client.logout();
  }

  async handleOauthCallback(url) {
    const params = new URLSearchParams(url.split("?")[1]);
    const code = params.get("code");
    const state = params.get("state");
    const iss = params.get("iss");
    if (!code || !state || !iss) {
      throw new Error("Missing code, state, or iss in callback");
    }
    const client = await this.getClient();
    return await client.handleCallback({ code, state, iss });
  }
}

export async function getAuth() {
  if (isNative()) {
    return new BasicAuth();
  } else {
    return new OAuth();
  }
}

export async function requireAuth() {
  const auth = await getAuth();
  const session = await auth.getSession();
  if (!session) {
    window.location.href = "/login";
    // no resolve, just wait for redirect
    return new Promise(() => {});
  }
  return session;
}

export async function requireNoAuth() {
  const auth = await getAuth();
  const session = await auth.getSession();
  if (session) {
    window.location.href = "/";
    // no resolve, just wait for redirect
    return new Promise(() => {});
  }
  return null;
}
