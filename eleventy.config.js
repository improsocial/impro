import { linkHtml } from "./modulepreload.js";
import pkg from "./package.json" with { type: "json" };
import { MIME } from "./scripts/serve-static.js";
import fs from "node:fs";
import path from "node:path";

async function transformGlob(pattern, replacer) {
  await Promise.all(
    fs.globSync(pattern).map(async (filePath) => {
      const content = await fs.promises.readFile(filePath, "utf-8");
      const updated = replacer(content);
      if (content !== updated) await fs.promises.writeFile(filePath, updated);
    }),
  );
}

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
      eleventyConfig.addWatchTarget(
        `${realPath}/{manifest.json,main.js,styles.css,README.md}`,
      );
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
      const stylesPath = path.join(pluginPath, "styles.css");
      if (fs.existsSync(stylesPath)) {
        fs.copyFileSync(stylesPath, path.join(destDir, "styles.css"));
      }
      const readmePath = path.join(pluginPath, "README.md");
      if (fs.existsSync(readmePath)) {
        fs.copyFileSync(readmePath, path.join(destDir, "README.md"));
      }
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
        const ext = path.extname(url.pathname);
        if (ext && MIME[ext] && !MIME[ext].startsWith("text/html")) {
          return {
            status: 404,
            headers: { "Content-Type": "text/plain" },
            body: "Not Found",
          };
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

  // Cache busting query params
  eleventyConfig.on("eleventy.after", async ({ dir }) => {
    const bust = `?v=${pkg.version}`;
    const addBust = (_, before, ref, after) => `${before}${ref}${bust}${after}`;

    // JS module refs: `import ... from "x.js"`, `export ... from "x.js"`,
    // bare `import "x.js"`, and dynamic `import("x.js")`.
    const jsModuleRefs =
      /(\b(?:import|export)\b[^'"`;]*?from\s+['"]|\bimport\s*\(\s*['"]|\bimport\s+['"])(?!https?:\/\/|\/\/)([^'"`\n]+?\.m?js)(['"])/g;
    // CSS `@import "x.css"`
    const cssImports =
      /(@import\s+['"])(?!https?:\/\/|\/\/)([^'"\n]+?\.css)(['"])/g;
    // HTML attribute refs: <script src>, <link href>, etc.
    const htmlAttrRefs =
      /((?:src|href)\s*=\s*["'])(?!https?:\/\/|\/\/)([^"']+?\.(?:m?js|css))(["'])/g;

    await Promise.all([
      transformGlob(`${dir.output}/**/*.js`, (content) =>
        content.replace(jsModuleRefs, addBust),
      ),
      transformGlob(`${dir.output}/**/*.css`, (content) =>
        content.replace(cssImports, addBust),
      ),
      transformGlob(`${dir.output}/**/*.html`, (content) =>
        content.replace(htmlAttrRefs, addBust).replace(jsModuleRefs, addBust),
      ),
    ]);
  });

  return {
    dir: {
      input: "src",
      output: "build",
    },
  };
}
