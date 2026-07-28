export default {
  data() {
    return {
      permalink: "/oauth-client-metadata.json",
    };
  },

  render(data) {
    const output = {
      client_id: `https://${data.hostName}/oauth-client-metadata.json`,
      client_name: "Impro",
      client_uri: `https://${data.hostName}`,
      logo_uri: `https://${data.hostName}/img/impro-logo.jpg`,
      redirect_uris: [`https://${data.hostName}/callback.html`],
      scope: data.oauthScopes,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      application_type: "web",
      dpop_bound_access_tokens: true,
      ...(data.oauthPublicJwk
        ? {
            token_endpoint_auth_method: "private_key_jwt",
            token_endpoint_auth_signing_alg: "ES256",
            jwks: { keys: [JSON.parse(data.oauthPublicJwk)] },
          }
        : { token_endpoint_auth_method: "none" }),
    };

    return JSON.stringify(output, null, 2);
  },
};
