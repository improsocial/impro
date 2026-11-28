import { execSync } from "child_process";
import { OAUTH_SCOPES, OPTIONAL_OAUTH_SCOPES } from "./oauthScopes.js";
import {
  APP_NAME,
  APP_DESCRIPTION,
  APP_HOST,
  APP_DEV_HOST,
  APP_OG_IMAGE_URL,
} from "./js/config.js";
import pkg from "../package.json" with { type: "json" };

export default {
  // Output the page as a HTML file
  permalink: (data) => (data.page.fileSlug || "index") + ".html",
  version: pkg.version,
  gitCommit: () => execSync("git rev-parse --short=8 HEAD").toString().trim(),
  hostName: process.env.HOST_NAME ?? APP_DEV_HOST,
  brand: {
    name: APP_NAME,
    description: APP_DESCRIPTION,
    host: APP_HOST,
    ogImageUrl: APP_OG_IMAGE_URL,
  },
  environment: process.env.ENVIRONMENT ?? "production",
  playwright: process.env.PLAYWRIGHT ? "true" : "",
  oauthScopes: OAUTH_SCOPES,
  oauthOptionalScopes: OPTIONAL_OAUTH_SCOPES,
  oauthPublicJwk: process.env.OAUTH_PUBLIC_JWK ?? "",
  oauthAssertionUrl: process.env.OAUTH_PUBLIC_JWK
    ? (process.env.OAUTH_ASSERTION_URL ?? "/oauth/assertion")
    : "",
  reportLoads: process.env.REPORT_LOADS ?? "",
};
