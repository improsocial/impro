import { linkHtml } from "./modulepreload.js";
import fs from "node:fs";
import path from "node:path";

export default async function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/js");
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/img");
  eleventyConfig.addPassthroughCopy("src/manifest.json");
  eleventyConfig.addPassthroughCopy("plugins-local");
  eleventyConfig.addWatchTarget("plugins-local");

  // Prevent sandbox from being treated as a template
  eleventyConfig.ignores.add("src/js/plugins/sandbox.html");

  // Local plugin index
  eleventyConfig.on("eleventy.before", () => {
    const localPluginsDir = "plugins-local";
    if (!fs.existsSync(localPluginsDir)) return;
    const listings = [];
    for (const entry of fs.readdirSync(localPluginsDir, {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      if (entry.name.startsWith(".")) continue;
      const manifestPath = path.join(
        localPluginsDir,
        entry.name,
        "manifest.json",
      );
      const mainPath = path.join(localPluginsDir, entry.name, "main.js");
      if (!fs.existsSync(manifestPath) || !fs.existsSync(mainPath)) continue;
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      listings.push({
        id: manifest.id,
        name: manifest.name,
        author: manifest.author,
        description: manifest.description,
      });
    }
    fs.mkdirSync("build/plugins-local", { recursive: true });
    fs.writeFileSync(
      "build/plugins-local/index.json",
      JSON.stringify(listings, null, 2),
    );
  });

  // Send index for SPA
  eleventyConfig.setServerOptions({
    liveReload: !process.env.PLAYWRIGHT,
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
