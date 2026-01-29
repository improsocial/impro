import { execSync } from "child_process";
import { OAUTH_SCOPES } from "./oauthScopes.js";

export default {
  // Output the page as a HTML file
  permalink: (data) => (data.page.fileSlug || "index") + ".html",
  version: execSync("node -p -e \"require('./package.json').version\"")
    .toString()
    .trim(),
  gitCommit: () => execSync("git rev-parse --short=8 HEAD").toString().trim(),
  hostName: process.env.HOST_NAME ?? "impro.social",
  environment: process.env.ENVIRONMENT ?? "development",
  oauthScopes: OAUTH_SCOPES,
};
