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
  oauthPublicJwk: process.env.OAUTH_PUBLIC_JWK ?? "",
  useConfidentialOauth: process.env.OAUTH_PUBLIC_JWK ? "true" : "",
};
