import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isTransitionScopeModel, oauthScopesFor } from "/js/oauth.js";
import { OAUTH_SCOPES, DECLARED_OAUTH_SCOPES } from "../../../src/oauthScopes.js";

describe("transition scope model", () => {
  const vlpds = {
    scopes_supported: [
      "atproto",
      "transition:email",
      "transition:generic",
      "transition:chat.bsky",
    ],
  };
  const hosted = {
    scopes_supported: [
      "atproto",
      "rpc:app.bsky.notification.getUnreadCount?aud=did:web:api.bsky.app#bsky_appview",
      "include:app.bsky.authFullChat",
    ],
  };

  it("detects the transition model", () => {
    assert.equal(isTransitionScopeModel(vlpds), true);
    assert.equal(isTransitionScopeModel(hosted), false);
    assert.equal(isTransitionScopeModel({}), false);
    assert.equal(isTransitionScopeModel({ scopes_supported: [] }), false);
  });

  it("requests the coarse chat scope on the transition model", () => {
    const scopes = oauthScopesFor(vlpds, OAUTH_SCOPES).split(" ");
    assert.ok(scopes.includes("transition:chat.bsky"));
    assert.ok(!scopes.some((s) => s.startsWith("rpc:chat.bsky.")));
    assert.ok(scopes.includes("atproto"));
    assert.ok(scopes.includes("rpc:app.bsky.feed.getPostThread?aud=*"));
  });

  it("leaves the request unchanged on the granular model", () => {
    assert.equal(oauthScopesFor(hosted, OAUTH_SCOPES), OAUTH_SCOPES);
    assert.equal(oauthScopesFor({}, OAUTH_SCOPES), OAUTH_SCOPES);
  });

  it("declares the transition scope in the client metadata", () => {
    assert.ok(DECLARED_OAUTH_SCOPES.split(" ").includes("transition:chat.bsky"));
    assert.ok(
      DECLARED_OAUTH_SCOPES.split(" ").includes("rpc:chat.bsky.convo.getLog?aud=*"),
    );
  });
});
