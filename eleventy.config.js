import { linkHtml } from "./modulepreload.js";
import { MIME } from "./scripts/serve-static.js";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function transformGlob(pattern, replacer) {
  await Promise.all(
    fs.globSync(pattern).map(async (filePath) => {
      const content = await fs.promises.readFile(filePath, "utf-8");
      const updated = await replacer(content);
      if (content !== updated) await fs.promises.writeFile(filePath, updated);
    }),
  );
}

const BUILD_DIR = process.env.BUILD_DIR || "build";

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
    const buildPluginsDir = path.join(BUILD_DIR, "plugins-local");
    const localPluginsDir = "plugins-local";
    const listings = [];
    fs.mkdirSync(buildPluginsDir, { recursive: true });
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
      const destDir = path.join(buildPluginsDir, manifest.id + "__LOCAL");
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
      path.join(buildPluginsDir, "index.json"),
      JSON.stringify(listings, null, 2),
    );
  });

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
        const ext = path.extname(url.pathname);
        if (ext && MIME[ext] && !MIME[ext].startsWith("text/html")) {
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

  // Cache busting via content-hashed filenames
  eleventyConfig.on("eleventy.after", async ({ dir }) => {
    if (isDev) return;

    const buildBaseUrl = pathToFileURL(path.resolve(dir.output) + path.sep);

    const hashedUrlPath = (filePath) => {
      const hash = crypto
        .createHash("sha256")
        .update(fs.readFileSync(filePath))
        .digest("hex")
        .slice(0, 10);
      const urlPath =
        "/" + path.relative(dir.output, filePath).split(path.sep).join("/");
      return [urlPath, urlPath.replace(/(\.[^.]+)$/, `.${hash}$1`)];
    };

    const imports = {};
    for (const filePath of fs.globSync(`${dir.output}/js/**/*.js`)) {
      const [urlPath, hashed] = hashedUrlPath(filePath);
      imports[urlPath] = hashed;
    }
    const [cssUrlPath, hashedCssUrlPath] = hashedUrlPath(
      path.join(dir.output, "css", "style.css"),
    );

    const importMapTag = `<script type="importmap">${JSON.stringify({ imports })}</script>`;
    await transformGlob(`${dir.output}/*.html`, async (content) => {
      // linkHtml crawls the un-hashed files on disk, so it must run before renaming
      const linked = await linkHtml(content, {
        baseUrl: buildBaseUrl,
        exclude: ["/lib/hls.js"],
        urlMap: imports,
      });
      return linked
        .replace("<head>", `<head>${importMapTag}`)
        .replace(`href="${cssUrlPath}"`, `href="${hashedCssUrlPath}"`);
    });

    for (const [urlPath, hashed] of [
      ...Object.entries(imports),
      [cssUrlPath, hashedCssUrlPath],
    ]) {
      fs.renameSync(
        path.join(dir.output, "." + urlPath),
        path.join(dir.output, "." + hashed),
      );
    }
  });

  return {
    dir: {
      input: "src",
      output: BUILD_DIR,
    },
  };
}
