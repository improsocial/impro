import fs from "node:fs";
import { parse } from "es-module-lexer";
import { Parser } from "htmlparser2";
import { resolve, parseFromString } from "@import-maps/resolve";

async function getImports(script) {
  const [imports] = await parse(script);
  return imports.map((imp) => imp.n);
}

class ImportCollector {
  constructor({ imports, baseUrl, importMap, noFetch, exclude }) {
    this.imports = imports;
    this.baseUrl = baseUrl;
    this.dependencies = new Set();
    this.noFetch = noFetch;
    this.exclude = exclude;
    this.importMap = importMap;
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
        const deps = await getImports(contents);
        await Promise.all(deps.map((dep) => this.visit(dep, resolvedImport)));
      }
    } else if (resolvedImport.protocol.startsWith("http")) {
      if (!this.noFetch) {
        const contents = await fetch(resolvedImport).then((res) => res.text());
        const deps = await getImports(contents);
        await Promise.all(deps.map((dep) => this.visit(dep, resolvedImport)));
      }
    }
  }
  async collect() {
    const parent = new URL("./index.js", this.baseUrl);
    await Promise.all(this.imports.map((entry) => this.visit(entry, parent)));
    return [...this.dependencies].map((dep) =>
      dep.replace(this.baseUrl.href, "/"),
    );
  }
}

async function parseHtml(contents) {
  const scripts = [];
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
    const deps = await getImports(script);
    deps.forEach((d) => imports.add(d));
  }
  return { imports: [...imports], importMapString: importMapString || "{}" };
}

export async function getDependencies(
  contents,
  baseUrl,
  { noFetch, exclude = [] } = {},
) {
  if (!baseUrl) {
    throw new Error("baseUrl is required");
  }
  if (!baseUrl.href.endsWith("/")) {
    baseUrl.href += "/";
  }
  const { importMapString, imports } = await parseHtml(contents);
  const importMap = parseFromString(importMapString, baseUrl);
  const collector = new ImportCollector({
    imports,
    baseUrl,
    importMap,
    noFetch,
    exclude,
  });
  return collector.collect();
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
  { baseUrl: providedBaseUrl, noFetch, exclude, includeComments } = {},
) {
  let html = htmlContentsOrUrl;
  let baseUrl = providedBaseUrl;
  if (htmlContentsOrUrl instanceof URL) {
    html = await fs.promises.readFile(htmlContentsOrUrl, "utf8");
    baseUrl = new URL("./", htmlContentsOrUrl);
  }
  const dependencies = await getDependencies(html, baseUrl, {
    exclude,
    noFetch,
  });
  return injectPreloads(html, dependencies, { includeComments });
}
