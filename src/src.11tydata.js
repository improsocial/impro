import { execSync } from "child_process";
import { OAUTH_SCOPES, OPTIONAL_OAUTH_SCOPES } from "./oauthScopes.js";
import pkg from "../package.json" with { type: "json" };

export default {
  // Output the page as a HTML file
  permalink: (data) => (data.page.fileSlug || "index") + ".html",
  version: pkg.version,
  gitCommit: () => execSync("git rev-parse --short=8 HEAD").toString().trim(),
  hostName: process.env.HOST_NAME ?? "dev.impro.social",
  environment: process.env.ENVIRONMENT ?? "development",
  playwright: process.env.PLAYWRIGHT ? "true" : "",
  oauthScopes: OAUTH_SCOPES,
  oauthOptionalScopes: OPTIONAL_OAUTH_SCOPES,
  // Which push notification service this deployment suggests by default.
  // Deployment config rather than a constant: a service holds a read-only
  // OAuth grant for every subscriber and polls on their behalf, so which one
  // a deployment points at is that deployment's decision, not this repo's.
  // Users can pick a different one in settings.
  notificationServiceDid:
    process.env.NOTIFICATION_SERVICE_DID ?? "did:web:courier.7778777.online",
  oauthPublicJwk: process.env.OAUTH_PUBLIC_JWK ?? "",
  useConfidentialOauth: process.env.OAUTH_PUBLIC_JWK ? "true" : "",
};
