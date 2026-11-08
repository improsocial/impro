import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import {
  onRequestOptions,
  onRequestPost,
} from "../../../../functions/oauth/assertion.js";

const FUNCTION_URL = "https://impro.social/oauth/assertion";
const AUD = "https://bsky.social";
const CROSS_ORIGIN_CLIENTS = "https://impro.social, https://impro.wisp.place";

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
      HOST_NAME: "impro.social",
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
      request: postRequest("https://impro.social"),
      env,
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
    const { assertion } = await response.json();
    const payload = decodePayload(assertion);
    assert.equal(
      payload.iss,
      "https://impro.social/oauth-client-metadata.json",
    );
    assert.equal(payload.sub, payload.iss);
    assert.equal(payload.aud, AUD);
  });

  it("signs allowlisted cross-origin requests for that origin's client id", async () => {
    const response = await onRequestPost({
      request: postRequest("https://impro.wisp.place"),
      env,
    });
    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get("Access-Control-Allow-Origin"),
      "https://impro.wisp.place",
    );
    const { assertion } = await response.json();
    assert.equal(
      decodePayload(assertion).iss,
      "https://impro.wisp.place/oauth-client-metadata.json",
    );
  });

  it("signs for impro.social when the function is hosted elsewhere", async () => {
    const request = new Request("https://oauth.impro.social/oauth/assertion", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://impro.social",
      },
      body: JSON.stringify({ aud: AUD }),
    });
    const response = await onRequestPost({
      request,
      env: { ...env, HOST_NAME: "oauth.impro.social" },
    });
    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get("Access-Control-Allow-Origin"),
      "https://impro.social",
    );
    const { assertion } = await response.json();
    assert.equal(
      decodePayload(assertion).iss,
      "https://impro.social/oauth-client-metadata.json",
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
      request: postRequest("https://impro.wisp.place"),
      env: envWithoutClients,
    });
    assert.equal(response.status, 403);
    const preflight = onRequestOptions({
      request: preflightRequest("https://impro.wisp.place"),
      env: envWithoutClients,
    });
    assert.equal(preflight.status, 403);
  });

  it("includes CORS headers on errors for allowlisted origins", async () => {
    const response = await onRequestPost({
      request: postRequest("https://impro.wisp.place"),
      env: {
        HOST_NAME: "impro.social",
        OAUTH_CROSS_ORIGIN_CLIENTS: CROSS_ORIGIN_CLIENTS,
      },
    });
    assert.equal(response.status, 501);
    assert.equal(
      response.headers.get("Access-Control-Allow-Origin"),
      "https://impro.wisp.place",
    );
  });

  it("answers preflights from allowlisted origins", () => {
    const response = onRequestOptions({
      request: preflightRequest("https://impro.wisp.place"),
      env,
    });
    assert.equal(response.status, 204);
    assert.equal(
      response.headers.get("Access-Control-Allow-Origin"),
      "https://impro.wisp.place",
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
