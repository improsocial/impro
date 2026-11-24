import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import {
  onRequestOptions,
  onRequestPost,
} from "../../../../functions/oauth/assertion.js";

const FUNCTION_URL = "https://app.example/oauth/assertion";
const AUD = "https://bsky.social";
const CROSS_ORIGIN_CLIENTS = "https://app.example, https://other.example";

function decodePayload(assertion) {
  const payloadB64 = assertion.split(".")[1];
  return JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8"));
}

describe("oauth assertion function", () => {
  let env;

  before(async () => {
    const keyPair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"],
    );
    const privateJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
    env = {
      HOST_NAME: "app.example",
      OAUTH_CROSS_ORIGIN_CLIENTS: CROSS_ORIGIN_CLIENTS,
      OAUTH_PRIVATE_JWK: JSON.stringify({ ...privateJwk, kid: "test-key" }),
    };
  });

  function postRequest(origin) {
    const headers = { "Content-Type": "application/json" };
    if (origin) headers.Origin = origin;
    return new Request(FUNCTION_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ aud: AUD }),
    });
  }

  function preflightRequest(origin) {
    return new Request(FUNCTION_URL, {
      method: "OPTIONS",
      headers: { Origin: origin, "Access-Control-Request-Method": "POST" },
    });
  }

  it("signs same-origin requests for the configured host without CORS headers", async () => {
    const response = await onRequestPost({
      request: postRequest("https://app.example"),
      env,
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
    const { assertion } = await response.json();
    const payload = decodePayload(assertion);
    assert.equal(payload.iss, "https://app.example/oauth-client-metadata.json");
    assert.equal(payload.sub, payload.iss);
    assert.equal(payload.aud, AUD);
  });

  it("signs allowlisted cross-origin requests for that origin's client id", async () => {
    const response = await onRequestPost({
      request: postRequest("https://other.example"),
      env,
    });
    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get("Access-Control-Allow-Origin"),
      "https://other.example",
    );
    const { assertion } = await response.json();
    assert.equal(
      decodePayload(assertion).iss,
      "https://other.example/oauth-client-metadata.json",
    );
  });

  it("signs for the client origin when the function is hosted elsewhere", async () => {
    const request = new Request("https://auth.app.example/oauth/assertion", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://app.example",
      },
      body: JSON.stringify({ aud: AUD }),
    });
    const response = await onRequestPost({
      request,
      env: { ...env, HOST_NAME: "auth.app.example" },
    });
    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get("Access-Control-Allow-Origin"),
      "https://app.example",
    );
    const { assertion } = await response.json();
    assert.equal(
      decodePayload(assertion).iss,
      "https://app.example/oauth-client-metadata.json",
    );
  });

  it("rejects cross-origin requests from other origins", async () => {
    const response = await onRequestPost({
      request: postRequest("https://evil.example"),
      env,
    });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
  });

  it("rejects all cross-origin requests when no clients are configured", async () => {
    const { OAUTH_CROSS_ORIGIN_CLIENTS, ...envWithoutClients } = env;
    const response = await onRequestPost({
      request: postRequest("https://other.example"),
      env: envWithoutClients,
    });
    assert.equal(response.status, 403);
    const preflight = onRequestOptions({
      request: preflightRequest("https://other.example"),
      env: envWithoutClients,
    });
    assert.equal(preflight.status, 403);
  });

  it("includes CORS headers on errors for allowlisted origins", async () => {
    const response = await onRequestPost({
      request: postRequest("https://other.example"),
      env: {
        HOST_NAME: "app.example",
        OAUTH_CROSS_ORIGIN_CLIENTS: CROSS_ORIGIN_CLIENTS,
      },
    });
    assert.equal(response.status, 501);
    assert.equal(
      response.headers.get("Access-Control-Allow-Origin"),
      "https://other.example",
    );
  });

  it("answers preflights from allowlisted origins", () => {
    const response = onRequestOptions({
      request: preflightRequest("https://other.example"),
      env,
    });
    assert.equal(response.status, 204);
    assert.equal(
      response.headers.get("Access-Control-Allow-Origin"),
      "https://other.example",
    );
    assert.equal(
      response.headers.get("Access-Control-Allow-Headers"),
      "Content-Type",
    );
  });

  it("rejects preflights from other origins", () => {
    const response = onRequestOptions({
      request: preflightRequest("https://evil.example"),
      env,
    });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
  });
});
