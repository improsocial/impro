import * as esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";

const ENTRY_SPECIFIER = /(["'])(\/js\/[^"'?#]+\.js)\1/g;
const PRELOAD_LINK = /<link rel="modulepreload" href="([^"]+)" \/>/g;

function findEntrySpecifiers(html) {
  return new Set([...html.matchAll(ENTRY_SPECIFIER)].map((match) => match[2]));
}

function rootAbsoluteImports(outputDir) {
  return {
    name: "root-absolute-imports",
    setup(build) {
      build.onResolve({ filter: /^\/js\// }, (args) => ({
        path: path.join(outputDir, args.path),
      }));
    },
  };
}

function staticImportClosure(outputs, outputPath, closure = new Set()) {
  if (closure.has(outputPath)) return closure;
  closure.add(outputPath);
  for (const imported of outputs[outputPath].imports) {
    if (imported.kind === "import-statement") {
      staticImportClosure(outputs, imported.path, closure);
    }
  }
  return closure;
}

function injectPreloads(html, hrefs) {
  const existingHrefs = new Set(
    [...html.matchAll(PRELOAD_LINK)].map((match) => match[1]),
  );
  const links = hrefs
    .filter((href) => !existingHrefs.has(href))
    .map((href) => `<link rel="modulepreload" href="${href}" />\n`)
    .join("");
  return html.replace("</head>", `${links}</head>`);
}

// Replace build/js with minified, content-hashed bundles of the modules the
// HTML files load, then point the HTML at them and preload their static imports.
// Each entry is bundled on its own, so entries never share module instances.
export async function bundleJs({
  outputDir: outputPath,
  htmlFiles,
  cacheSalt,
}) {
  const outputDir = fs.realpathSync(outputPath);
  const jsDir = path.join(outputDir, "js");
  const bundleDir = path.join(outputDir, ".js-bundle");
  const htmlByFile = new Map(
    htmlFiles.map((htmlFile) => [htmlFile, fs.readFileSync(htmlFile, "utf-8")]),
  );
  const entrySpecifiers = new Set(
    [...htmlByFile.values()].flatMap((html) => [...findEntrySpecifiers(html)]),
  );

  const results = await Promise.all(
    [...entrySpecifiers].map((specifier) =>
      esbuild.build({
        entryPoints: [path.join(outputDir, specifier)],
        outbase: jsDir,
        outdir: bundleDir,
        absWorkingDir: outputDir,
        bundle: true,
        splitting: true,
        format: "esm",
        minify: true,
        keepNames: true,
        entryNames: "[dir]/[name].[hash]",
        chunkNames: "chunks/[name].[hash]",
        banner: { js: `/*${cacheSalt}*/` },
        metafile: true,
        plugins: [rootAbsoluteImports(outputDir)],
        logLevel: "warning",
      }),
    ),
  );
  const outputs = Object.assign(
    {},
    ...results.map(({ metafile }) => metafile.outputs),
  );

  const toUrlPath = (outputFile) =>
    outputFile.replace(/^\.js-bundle\//, "/js/");
  const entryOutputs = new Map(
    Object.entries(outputs)
      .filter(([, output]) => output.entryPoint)
      .map(([outputFile, output]) => [`/${output.entryPoint}`, outputFile]),
  );

  for (const [htmlFile, html] of htmlByFile) {
    const entries = [...findEntrySpecifiers(html)];
    const preloadHrefs = [
      ...new Set(
        entries.flatMap((specifier) => [
          ...staticImportClosure(outputs, entryOutputs.get(specifier)),
        ]),
      ),
    ]
      .map(toUrlPath)
      .sort();
    const rewritten = html.replace(
      ENTRY_SPECIFIER,
      (_, quote, specifier) =>
        `${quote}${toUrlPath(entryOutputs.get(specifier))}${quote}`,
    );
    fs.writeFileSync(htmlFile, injectPreloads(rewritten, preloadHrefs));
  }

  fs.rmSync(jsDir, { recursive: true });
  fs.renameSync(bundleDir, jsDir);
}
