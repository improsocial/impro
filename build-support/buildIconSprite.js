import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, basename, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ICONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "img",
  "icons",
);

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

export function buildIconSprite() {
  const files = walk(ICONS_DIR).sort();
  const symbols = [];
  const seen = new Set();
  for (const file of files) {
    const id = basename(file, ".svg");
    if (seen.has(id)) {
      console.warn(`duplicate icon id "${id}" (${relative(ICONS_DIR, file)})`);
      continue;
    }
    seen.add(id);
    const svg = readFileSync(file, "utf8");
    const { viewBox, attrs, inner } = extractInner(svg);
    const attrStr = attrs ? ` ${attrs}` : "";
    symbols.push(
      `<symbol id="${id}" viewBox="${viewBox}"${attrStr}>${inner}</symbol>`,
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">${symbols.join("")}</svg>`;
}
