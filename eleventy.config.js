import { linkHtml } from "./modulepreload.js";
import fs from "node:fs";
import path from "node:path";

export default async function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/js");
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/img");
  eleventyConfig.addPassthroughCopy("src/manifest.json");

  // Send index for SPA
  eleventyConfig.setServerOptions({
    liveReload: true,
    onRequest: {
      "/*": function ({ url }) {
        if (fs.existsSync(path.join("build", url.pathname))) {
          // will send file by default
          return null;
        }
        // ignore reload-client.js
        if (url.pathname.includes("reload-client.js")) {
          return null;
        }
        return fs.readFileSync("build/index.html", "utf-8");
      },
    },
  });

  // Auto-generate modulepreload tags
  eleventyConfig.addTransform(
    "modulepreload",
    async function (content, outputPath) {
      if (outputPath.endsWith(".html")) {
        const baseUrl = new URL("src", import.meta.url);
        return await linkHtml(content, { baseUrl, exclude: ["/lib/hls.js"] });
      }
      return content;
    },
  );

  return {
    dir: {
      input: "src",
      output: "build",
    },
  };
}
