import { linkHtml } from "./modulepreload.js";
import fs from "node:fs";
import path from "node:path";

export default async function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/js");
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/img");
  eleventyConfig.addPassthroughCopy("src/manifest.json");

  // Prevent sandbox from being treated as a template
  eleventyConfig.ignores.add("src/js/plugins/sandbox.html");

  const isDev = process.env.NODE_ENV !== "production";

  // Add watch targets for local plugins
  if (isDev) {
    eleventyConfig.addWatchTarget("plugins-local");
    for (const entry of fs.readdirSync("plugins-local", {
      withFileTypes: true,
    })) {
      if (!entry.isSymbolicLink()) continue;
      const realPath = fs.realpathSync(path.join("plugins-local", entry.name));
      eleventyConfig.addWatchTarget(`${realPath}/{manifest.json,main.js}`);
    }
  }

  // Copy local plugins into build and generate index
  eleventyConfig.on("eleventy.before", () => {
    if (!isDev) return;
    const localPluginsDir = "plugins-local";
    const listings = [];
    fs.mkdirSync("build/plugins-local", { recursive: true });
    for (const entry of fs.readdirSync(localPluginsDir, {
      withFileTypes: true,
    })) {
      if (!(entry.isDirectory() || entry.isSymbolicLink())) continue;
      if (entry.name.startsWith(".")) continue;
      const pluginPath = path.join(localPluginsDir, entry.name);
      const manifestPath = path.join(pluginPath, "manifest.json");
      const mainPath = path.join(pluginPath, "main.js");
      if (!fs.existsSync(manifestPath) || !fs.existsSync(mainPath)) continue;
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      listings.push({
        id: manifest.id + "__LOCAL",
        name: manifest.name,
        author: manifest.author,
        description: manifest.description,
      });
      const destDir = path.join("build/plugins-local", manifest.id + "__LOCAL");
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(manifestPath, path.join(destDir, "manifest.json"));
      fs.copyFileSync(mainPath, path.join(destDir, "main.js"));
    }
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
