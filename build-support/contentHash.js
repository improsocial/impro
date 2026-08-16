import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { linkHtml } from "./modulepreload.js";
import { splitCss } from "./splitCss.js";

async function transformFiles(filePaths, replacer) {
  await Promise.all(
    filePaths.map(async (filePath) => {
      const content = await fs.promises.readFile(filePath, "utf-8");
      const updated = await replacer(content);
      if (content !== updated) await fs.promises.writeFile(filePath, updated);
    }),
  );
}

// Rewrite every JS and CSS reference to a content-hashed filename so the build
// output can be cached forever (see src/_headers). JS is remapped through an
// import map; the stylesheet is split on its @chunk markers first, so a change
// to one area of the CSS only invalidates that chunk.
export async function applyContentHashing({ outputDir, htmlFiles, cacheSalt }) {
  const buildBaseUrl = pathToFileURL(path.resolve(outputDir) + path.sep);

  const hashedUrlPath = (filePath) => {
    const hash = crypto
      .createHash("sha256")
      .update(cacheSalt)
      .update(fs.readFileSync(filePath))
      .digest("hex")
      .slice(0, 10);
    const urlPath =
      "/" + path.relative(outputDir, filePath).split(path.sep).join("/");
    return [urlPath, urlPath.replace(/(\.[^.]+)$/, `.${hash}$1`)];
  };

  const imports = {};
  for (const filePath of fs.globSync(`${outputDir}/js/**/*.js`)) {
    const [urlPath, hashed] = hashedUrlPath(filePath);
    imports[urlPath] = hashed;
  }

  const stylesheetPath = path.join(outputDir, "css", "style.css");
  const cssUrlPaths = [];
  const cssLinkTags = splitCss(fs.readFileSync(stylesheetPath, "utf-8"))
    .map((chunk) => {
      const chunkPath = path.join(outputDir, "css", `${chunk.name}.css`);
      fs.writeFileSync(chunkPath, chunk.css);
      const [urlPath, hashed] = hashedUrlPath(chunkPath);
      cssUrlPaths.push([urlPath, hashed]);
      return `<link rel="stylesheet" href="${hashed}" />`;
    })
    .join("");

  const importMapTag = `<script type="importmap">${JSON.stringify({ imports })}</script>`;
  await transformFiles(htmlFiles, async (content) => {
    // linkHtml crawls the un-hashed files on disk, so it must run before renaming
    const linked = await linkHtml(content, {
      baseUrl: buildBaseUrl,
      urlMap: imports,
    });
    return linked
      .replace("<head>", `<head>${importMapTag}`)
      .replace(/<link[^>]+href="\/css\/style\.css"[^>]*>/, cssLinkTags);
  });
  fs.rmSync(stylesheetPath);

  for (const [urlPath, hashed] of [
    ...Object.entries(imports),
    ...cssUrlPaths,
  ]) {
    fs.renameSync(
      path.join(outputDir, "." + urlPath),
      path.join(outputDir, "." + hashed),
    );
  }
}
