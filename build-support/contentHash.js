import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { splitCss } from "./splitCss.js";

// Split the stylesheet on its @chunk markers and give each chunk a
// content-hashed filename, so it can be cached forever (see src/_headers) and a
// change to one area of the CSS only invalidates that chunk.
export async function applyContentHashing({ outputDir, htmlFiles, cacheSalt }) {
  const stylesheetPath = path.join(outputDir, "css", "style.css");
  const cssLinkTags = splitCss(fs.readFileSync(stylesheetPath, "utf-8"))
    .map((chunk) => {
      const hash = crypto
        .createHash("sha256")
        .update(cacheSalt)
        .update(chunk.css)
        .digest("hex")
        .slice(0, 10);
      const fileName = `${chunk.name}.${hash}.css`;
      fs.writeFileSync(path.join(outputDir, "css", fileName), chunk.css);
      return `<link rel="stylesheet" href="/css/${fileName}" />`;
    })
    .join("");

  await Promise.all(
    htmlFiles.map(async (htmlFile) => {
      const content = await fs.promises.readFile(htmlFile, "utf-8");
      const updated = content.replace(
        /<link[^>]+href="\/css\/style\.css"[^>]*>/,
        cssLinkTags,
      );
      if (content !== updated) await fs.promises.writeFile(htmlFile, updated);
    }),
  );
  fs.rmSync(stylesheetPath);
}
