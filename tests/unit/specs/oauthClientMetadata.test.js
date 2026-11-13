import { describe, it } from "node:test";
import assert from "node:assert/strict";
import clientMetadata from "../../../src/oauth-client-metadata.11ty.js";

describe("oauth client metadata", () => {
  const OLD_JWK = {
    kty: "EC",
    crv: "P-256",
    x: "old-x",
    y: "old-y",
    kid: "old",
  };
  const NEW_JWK = {
    kty: "EC",
    crv: "P-256",
    x: "new-x",
    y: "new-y",
    kid: "new",
  };

  function render(oauthPublicJwk) {
    return JSON.parse(
      clientMetadata.render({
        hostName: "impro.social",
        oauthScopes: "atproto",
        oauthPublicJwk,
      }),
    );
  }

  it("is a public client without a public JWK", () => {
    const metadata = render("");
    assert.deepEqual(metadata.token_endpoint_auth_method, "none");
    assert.deepEqual(metadata.jwks, undefined);
  });

  it("publishes a single public JWK", () => {
    const metadata = render(JSON.stringify(OLD_JWK));
    assert.deepEqual(metadata.token_endpoint_auth_method, "private_key_jwt");
    assert.deepEqual(metadata.jwks, { keys: [OLD_JWK] });
  });

  it("publishes every key from an array of public JWKs", () => {
    const metadata = render(JSON.stringify([OLD_JWK, NEW_JWK]));
    assert.deepEqual(metadata.token_endpoint_auth_method, "private_key_jwt");
    assert.deepEqual(metadata.jwks, { keys: [OLD_JWK, NEW_JWK] });
  });
});
