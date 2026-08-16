const MARKER = /^\/\*\s*@chunk\s+([a-z0-9][a-z0-9-]*)\s*\*\/$/;

// Split a stylesheet on `/* @chunk <name> */` markers into named parts, in
// source order.
export function splitCss(css) {
  const parts = [];
  let current = { name: null, start: 0 };
  let index = 0;
  let depth = 0;

  while (index < css.length) {
    const char = css[index];

    if (char === "/" && css[index + 1] === "*") {
      const close = css.indexOf("*/", index + 2);
      const stop = close === -1 ? css.length : close + 2;
      const match = MARKER.exec(css.slice(index, stop).trim());
      if (match) {
        if (depth !== 0) {
          throw new Error(
            `@chunk "${match[1]}" sits at brace depth ${depth}; markers must be at the top level`,
          );
        }
        parts.push({ ...current, end: index });
        current = { name: match[1], start: stop };
      }
      index = stop;
      continue;
    }

    if (char === '"' || char === "'") {
      const quote = char;
      index++;
      while (index < css.length) {
        if (css[index] === "\\") {
          index += 2;
          continue;
        }
        if (css[index] === quote) {
          index++;
          break;
        }
        index++;
      }
      continue;
    }

    if (char === "{") depth++;
    else if (char === "}") depth--;
    index++;
  }
  parts.push({ ...current, end: css.length });

  const chunks = parts
    .map((part) => ({ name: part.name, css: css.slice(part.start, part.end) }))
    .filter((chunk) => chunk.css.trim());

  if (!chunks.some((chunk) => chunk.name !== null)) {
    throw new Error("stylesheet has no @chunk markers");
  }
  if (chunks.some((chunk) => chunk.name === null)) {
    throw new Error(
      "stylesheet has rules before the first @chunk marker; every rule must belong to a chunk",
    );
  }

  const seen = new Set();
  for (const chunk of chunks) {
    if (seen.has(chunk.name)) {
      throw new Error(`duplicate @chunk name "${chunk.name}"`);
    }
    seen.add(chunk.name);
  }
  return chunks;
}
