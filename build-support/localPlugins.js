import fs from "node:fs";
import path from "node:path";

const LOCAL_PLUGINS_DIR = "plugins-local";
const LOCAL_SUFFIX = "__LOCAL";

export function watchLocalPlugins(eleventyConfig, buildDir) {
  // Watch the symlinks' real paths, since eleventy won't follow the links.
  eleventyConfig.addWatchTarget(LOCAL_PLUGINS_DIR);
  for (const entry of fs.readdirSync(LOCAL_PLUGINS_DIR, {
    withFileTypes: true,
  })) {
    if (!entry.isSymbolicLink()) continue;
    const realPath = fs.realpathSync(path.join(LOCAL_PLUGINS_DIR, entry.name));
    eleventyConfig.addWatchTarget(
      `${realPath}/{manifest.json,main.js,styles.css,README.md}`,
    );
  }

  eleventyConfig.on("eleventy.before", () => {
    const buildPluginsDir = path.join(buildDir, LOCAL_PLUGINS_DIR);
    const listings = [];
    fs.mkdirSync(buildPluginsDir, { recursive: true });

    for (const entry of fs.readdirSync(LOCAL_PLUGINS_DIR, {
      withFileTypes: true,
    })) {
      if (!(entry.isDirectory() || entry.isSymbolicLink())) continue;
      if (entry.name.startsWith(".")) continue;

      const pluginPath = path.join(LOCAL_PLUGINS_DIR, entry.name);
      const manifestPath = path.join(pluginPath, "manifest.json");
      const mainPath = path.join(pluginPath, "main.js");
      if (!fs.existsSync(manifestPath) || !fs.existsSync(mainPath)) continue;

      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      listings.push({
        id: manifest.id + LOCAL_SUFFIX,
        name: manifest.name,
        author: manifest.author,
        description: manifest.description,
      });

      const destDir = path.join(buildPluginsDir, manifest.id + LOCAL_SUFFIX);
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(manifestPath, path.join(destDir, "manifest.json"));
      fs.copyFileSync(mainPath, path.join(destDir, "main.js"));

      for (const optional of ["styles.css", "README.md"]) {
        const source = path.join(pluginPath, optional);
        if (fs.existsSync(source)) {
          fs.copyFileSync(source, path.join(destDir, optional));
        }
      }

      for (const font of manifest.fonts ?? []) {
        if (typeof font?.file !== "string") continue;
        const source = path.join(pluginPath, font.file);
        if (!fs.existsSync(source)) continue;
        const dest = path.join(destDir, font.file);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(source, dest);
      }
    }

    fs.writeFileSync(
      path.join(buildPluginsDir, "index.json"),
      JSON.stringify(listings, null, 2),
    );
  });
}
