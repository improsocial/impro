import { readFileSync, readdirSync, statSync, globSync } from "node:fs";
import { join, basename, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const ICONS_DIR = join(SRC_DIR, "img", "icons");
const JS_DIR = join(SRC_DIR, "js");

const PRESERVED_ATTRS = [
  "fill",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) out.push(...walk(full));
    else if (name.endsWith(".svg")) out.push(full);
  }
  return out;
}

function extractInner(svg) {
  const openMatch = svg.match(/<svg\b[^>]*>/);
  if (!openMatch) throw new Error("no <svg> open tag");
  const openTag = openMatch[0];
  const viewBoxMatch = openTag.match(/viewBox="([^"]+)"/);
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : "0 0 24 24";
  const attrs = [];
  for (const name of PRESERVED_ATTRS) {
    const m = openTag.match(new RegExp(`\\b${name}="([^"]+)"`));
    if (m) attrs.push(`${name}="${m[1]}"`);
  }
  const inner = svg
    .slice(openMatch.index + openTag.length)
    .replace(/<\/svg>\s*$/, "")
    .trim();
  return { viewBox, attrs: attrs.join(" "), inner };
}

/** Every icon under src/img/icons as a `<symbol>` string, keyed by id. */
export function readIconSymbols(iconsDir = ICONS_DIR) {
  const symbols = new Map();
  for (const file of walk(iconsDir).sort()) {
    const id = basename(file, ".svg");
    if (symbols.has(id)) {
      console.warn(`duplicate icon id "${id}" (${relative(iconsDir, file)})`);
      continue;
    }
    const { viewBox, attrs, inner } = extractInner(readFileSync(file, "utf8"));
    const attrStr = attrs ? ` ${attrs}` : "";
    symbols.set(
      id,
      `<symbol id="${id}" viewBox="${viewBox}"${attrStr}>${inner}</symbol>`,
    );
  }
  return symbols;
}

/** Icon ids that appear as quoted strings in the app's own source, plus their `-line` variants. */
export function findUsedIconIds(iconIds, jsDir = JS_DIR) {
  const quoted = new Set();
  for (const file of globSync("**/*.js", { cwd: jsDir })) {
    if (file.startsWith("lib/")) continue;
    const source = readFileSync(join(jsDir, file), "utf8");
    for (const match of source.matchAll(/["'`]([a-z0-9-]+)["'`]/g)) {
      quoted.add(match[1]);
    }
  }
  const used = new Set();
  for (const id of iconIds) {
    if (!quoted.has(id)) continue;
    used.add(id);
    if (iconIds.has(`${id}-line`)) used.add(`${id}-line`);
  }
  return used;
}

export function renderIconModule(symbols, ids = symbols.keys()) {
  const entries = Object.fromEntries(
    [...ids].sort().map((id) => [id, symbols.get(id)]),
  );
  return `export default ${JSON.stringify(entries)};\n`;
}

export function renderUsedIconsModule() {
  const symbols = readIconSymbols();
  return renderIconModule(symbols, findUsedIconIds(new Set(symbols.keys())));
}

export function renderAllIconsModule() {
  return renderIconModule(readIconSymbols());
}
