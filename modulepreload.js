import fs from "node:fs";
import { parse } from "es-module-lexer";
import { Parser } from "htmlparser2";
import { resolve, parseFromString } from "@import-maps/resolve";

async function getImports(script, { includeDynamic = false } = {}) {
  let [imports] = await parse(script);
  if (!includeDynamic) {
    // Import type is provided by `t` value
    // (1 for static, 2 for dynamic)
    imports = imports.filter((imp) => imp.t === 1);
  }
  return imports.map((imp) => imp.n);
}

class ImportCollector {
  constructor({
    imports,
    baseUrl,
    importMap,
    noFetch,
    exclude,
    includeDynamic,
    urlMap,
  }) {
    this.imports = imports;
    this.baseUrl = baseUrl;
    this.dependencies = new Set();
    this.noFetch = noFetch;
    this.exclude = exclude;
    this.includeDynamic = includeDynamic;
    this.importMap = importMap;
    this.urlMap = urlMap;
  }
  async visit(specifier, parent) {
    const doExclude = this.exclude.some((e) => specifier.includes(e));
    if (doExclude) {
      return;
    }
    let resolvedImport = null;
    if (parent.protocol === "file:") {
      const resolved = resolve(specifier, this.importMap, parent);
      resolvedImport = resolved.resolvedImport;
      if (specifier.startsWith("/")) {
        resolvedImport = new URL("." + specifier, this.baseUrl);
      }
    } else if (parent.protocol.startsWith("http")) {
      resolvedImport = new URL(specifier, parent.origin);
    }
    if (!resolvedImport) {
      console.warn(
        `WARNING: could not resolve import specifier: ${specifier} from parent: ${parent} - skipping`,
      );
      return;
    }
    if (this.dependencies.has(resolvedImport.href)) return;
    this.dependencies.add(resolvedImport.href);
    if (resolvedImport.protocol === "file:") {
      let contents = null;
      try {
        contents = await fs.promises.readFile(resolvedImport, "utf8");
      } catch (e) {
        console.warn(
          "WARNING: could not read file: " +
            resolvedImport.href +
            " - skipping",
        );
      }
      if (contents) {
        const deps = await getImports(contents, {
          includeDynamic: this.includeDynamic,
        });
        await Promise.all(deps.map((dep) => this.visit(dep, resolvedImport)));
      }
    } else if (resolvedImport.protocol.startsWith("http")) {
      if (!this.noFetch) {
        const contents = await fetch(resolvedImport).then((res) => res.text());
        const deps = await getImports(contents, {
          includeDynamic: this.includeDynamic,
        });
        await Promise.all(deps.map((dep) => this.visit(dep, resolvedImport)));
      }
    }
  }
  async collect() {
    const parent = new URL("./index.js", this.baseUrl);
    await Promise.all(this.imports.map((entry) => this.visit(entry, parent)));
    return [...this.dependencies].sort().map((dep) => {
      const urlPath = dep.replace(this.baseUrl.href, "/");
      return this.urlMap[urlPath] ?? urlPath;
    });
  }
}

async function parseHtml(contents, { includeDynamic = false } = {}) {
  const scripts = [];
  const preloadHrefs = [];
  let inScript = false;
  let inImportMap = false;
  let importMapString = "";
  const parser = new Parser({
    onopentag(name, attributes) {
      if (name === "script" && attributes.type === "module") {
        inScript = true;
        scripts.unshift("");
      }
      if (name === "script" && attributes.type === "importmap") {
        inImportMap = true;
      }
      if (
        name === "link" &&
        attributes.rel === "modulepreload" &&
        attributes.href
      ) {
        preloadHrefs.push(attributes.href);
      }
    },
    ontext(text) {
      if (inScript) {
        scripts[0] += text;
      }
      if (inImportMap) {
        importMapString += text;
      }
    },
    onclosetag(tagname) {
      if (tagname === "script") {
        inScript = false;
        inImportMap = false;
      }
    },
  });
  parser.write(contents);
  parser.end();
  const imports = new Set();
  for (let script of scripts) {
    const deps = await getImports(script, { includeDynamic });
    deps.forEach((d) => imports.add(d));
  }
  preloadHrefs.forEach((href) => imports.add(href));
  return {
    imports: [...imports],
    preloadHrefs,
    importMapString: importMapString || "{}",
  };
}

async function collectDependencies(
  { imports, importMapString },
  baseUrl,
  { noFetch, exclude = [], includeDynamic = false, urlMap = {} } = {},
) {
  if (!baseUrl) {
    throw new Error("baseUrl is required");
  }
  if (!baseUrl.href.endsWith("/")) {
    baseUrl.href += "/";
  }
  const importMap = parseFromString(importMapString, baseUrl);
  const collector = new ImportCollector({
    imports,
    baseUrl,
    importMap,
    noFetch,
    exclude,
    includeDynamic,
    urlMap,
  });
  return collector.collect();
}

export async function getDependencies(contents, baseUrl, options = {}) {
  const parsed = await parseHtml(contents, {
    includeDynamic: options.includeDynamic,
  });
  return collectDependencies(parsed, baseUrl, options);
}

export function injectPreloads(
  contents,
  dependencies,
  { includeComments = true } = {},
) {
  let preloads = "";
  if (includeComments) {
    preloads += "<!-- Begin Module Preloads -->\n";
  }
  for (const dep of dependencies) {
    preloads += `<link rel="modulepreload" href="${dep}" />\n`;
  }
  if (includeComments) {
    preloads += "<!-- End Module Preloads -->\n";
  }
  if (contents.includes("</head>")) {
    return contents.replace("</head>", `${preloads}</head>`);
  } else if (contents.includes("</html>")) {
    return contents.replace("<html>", `<html>\n${preloads}`);
  } else {
    console.warn(
      "WARNING: could not find <head> or <html> in HTML - skipping.",
    );
    return contents;
  }
}

export async function linkHtml(
  htmlContentsOrUrl,
  {
    baseUrl: providedBaseUrl,
    noFetch,
    exclude,
    includeComments,
    includeDynamic,
    urlMap = {},
  } = {},
) {
  let html = htmlContentsOrUrl;
  let baseUrl = providedBaseUrl;
  if (htmlContentsOrUrl instanceof URL) {
    html = await fs.promises.readFile(htmlContentsOrUrl, "utf8");
    baseUrl = new URL("./", htmlContentsOrUrl);
  }
  const parsed = await parseHtml(html, { includeDynamic });
  const dependencies = await collectDependencies(parsed, baseUrl, {
    exclude,
    noFetch,
    includeDynamic,
    urlMap,
  });
  // Pre-existing modulepreload links act as crawl seeds - rewrite
  // their hrefs through the url map and skip them when injecting
  const { preloadHrefs } = parsed;
  const existingHrefs = new Set();
  for (const href of preloadHrefs) {
    const mapped = urlMap[href] ?? href;
    existingHrefs.add(mapped);
    if (mapped !== href) {
      html = html.replaceAll(
        `rel="modulepreload" href="${href}"`,
        `rel="modulepreload" href="${mapped}"`,
      );
    }
  }
  return injectPreloads(
    html,
    dependencies.filter((dep) => !existingHrefs.has(dep)),
    { includeComments },
  );
}
