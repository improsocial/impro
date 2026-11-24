import { APP_NAME, APP_LOGO_URL } from "./js/config.js";

export default {
  data() {
    return {
      permalink: "/oauth-client-metadata.json",
    };
  },

  render(data) {
    const publicJwks = data.oauthPublicJwk
      ? [JSON.parse(data.oauthPublicJwk)].flat()
      : [];
    const output = {
      client_id: `https://${data.hostName}/oauth-client-metadata.json`,
      client_name: APP_NAME,
      client_uri: `https://${data.hostName}`,
      logo_uri: `https://${data.hostName}${APP_LOGO_URL}`,
      redirect_uris: [`https://${data.hostName}/callback.html`],
      scope: data.oauthScopes,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      application_type: "web",
      dpop_bound_access_tokens: true,
      ...(publicJwks.length > 0
        ? {
            token_endpoint_auth_method: "private_key_jwt",
            token_endpoint_auth_signing_alg: "ES256",
            jwks: { keys: publicJwks },
          }
        : { token_endpoint_auth_method: "none" }),
    };

    return JSON.stringify(output, null, 2);
  },
};
