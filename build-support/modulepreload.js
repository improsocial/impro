import fs from "node:fs";
import path from "node:path";

const DYNAMIC_IMPORT = /\bimport\(([^)]*)\)/g;
const LITERAL_SPECIFIER = /^\s*["']((?:\/|\.\.?\/)[^"']+)["']\s*$/;
const PRELOAD_HREF = /rel="modulepreload" href="([^"]+)"/g;

function findLazyModules(modules) {
  const lazyModules = new Set();
  for (const { urlPath, source } of modules) {
    for (const match of source.matchAll(DYNAMIC_IMPORT)) {
      const literal = match[1].match(LITERAL_SPECIFIER);
      if (!literal) {
        console.warn(
          `WARNING: non-literal dynamic import in ${urlPath} will be preloaded: import(${match[1]})`,
        );
        continue;
      }
      lazyModules.add(
        new URL(literal[1], new URL(urlPath, "file://")).pathname,
      );
    }
  }
  return lazyModules;
}

function injectPreloads(html, hrefs) {
  const existingHrefs = new Set(
    [...html.matchAll(PRELOAD_HREF)].map((match) => match[1]),
  );
  const links = hrefs
    .filter((href) => !existingHrefs.has(href))
    .map((href) => `<link rel="modulepreload" href="${href}" />\n`)
    .join("");
  return html.replace(
    "</head>",
    `<!-- Begin Module Preloads -->\n${links}<!-- End Module Preloads -->\n</head>`,
  );
}

export function applyModulePreloads({ outputDir, htmlFile, urlMap }) {
  const lazyModules = findLazyModules(
    Object.entries(urlMap).map(([urlPath, servedPath]) => ({
      urlPath,
      source: fs.readFileSync(path.join(outputDir, "." + servedPath), "utf-8"),
    })),
  );
  const preloadHrefs = Object.keys(urlMap)
    .filter((urlPath) => !lazyModules.has(urlPath))
    .sort()
    .map((urlPath) => urlMap[urlPath]);
  const html = fs.readFileSync(htmlFile, "utf-8");
  fs.writeFileSync(htmlFile, injectPreloads(html, preloadHrefs));
}
