import { execSync } from "child_process";

export default {
  // Output the page as a HTML file
  permalink: (data) => (data.page.fileSlug || "index") + ".html",
  gitCommit: () => execSync("git rev-parse --short=8 HEAD").toString().trim(),
  hostName: process.env.HOST_NAME ?? "impro.social",
  nodeEnv: process.env.NODE_ENV,
};
