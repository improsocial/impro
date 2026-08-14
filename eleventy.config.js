import fs from "node:fs";
import path from "node:path";
import { isAssetPath } from "./build-support/assetPaths.js";
import { applyContentHashing } from "./build-support/contentHash.js";
import { watchLocalPlugins } from "./build-support/localPlugins.js";

const BUILD_DIR = process.env.BUILD_DIR || "build";

// Bump to bust cache
const CACHE_SALT = "2";

export default async function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/js");
  eleventyConfig.addPassthroughCopy("src/css");
  // Individual icon SVGs are combined into build/img/icons.svg by
  // src/img/icons.11ty.js, so we don't ship src/img/icons/ itself.
  eleventyConfig.addPassthroughCopy(
    "src/img/*.{png,jpg,jpeg,ico,svg,webp,avif}",
  );
  eleventyConfig.addPassthroughCopy("src/img/shortcuts");
  eleventyConfig.addWatchTarget("src/img/icons");
  eleventyConfig.addPassthroughCopy("src/manifest.json");
  eleventyConfig.addPassthroughCopy("src/_headers");
  eleventyConfig.addPassthroughCopy("src/_routes.json");
  eleventyConfig.addPassthroughCopy("src/plugin-sandbox.html");
  eleventyConfig.addWatchTarget("impro-plugin/main.js");

  // Prevent sandbox from being treated as a template
  eleventyConfig.ignores.add("src/plugin-sandbox.html");

  const isDev = process.env.NODE_ENV !== "production";

  if (isDev) watchLocalPlugins(eleventyConfig, BUILD_DIR);

  // Send index for SPA
  eleventyConfig.setServerOptions({
    liveReload: !process.env.PLAYWRIGHT,
    onRequest: {
      "/*": function ({ url }) {
        if (fs.existsSync(path.join(BUILD_DIR, url.pathname))) {
          // will send file by default
          return null;
        }
        // ignore reload-client.js
        if (url.pathname.includes("reload-client.js")) {
          return null;
        }
        if (isAssetPath(url.pathname)) {
          return {
            status: 404,
            headers: { "Content-Type": "text/plain" },
            body: "Not Found",
          };
        }
        return fs.readFileSync(path.join(BUILD_DIR, "index.html"), "utf-8");
      },
    },
  });

  // Create content-hashed filenames
  eleventyConfig.on("eleventy.after", async ({ dir, results }) => {
    if (isDev) return;
    await applyContentHashing({
      outputDir: dir.output,
      htmlFiles: results
        .map((result) => result.outputPath)
        .filter((outputPath) => outputPath.endsWith(".html")),
      cacheSalt: CACHE_SALT,
    });
  });

  return {
    dir: {
      input: "src",
      output: BUILD_DIR,
    },
  };
}
