export const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

// Mirrors the "include" list in src/_routes.json
const ASSET_DIRS = ["/js/", "/css/", "/img/", "/oauth/", "/plugin-sdk/"];

export function isAssetPath(pathname) {
  if (!ASSET_DIRS.some((dir) => pathname.startsWith(dir))) return false;
  const match = /\.[^./]+$/.exec(pathname);
  if (!match) return false;
  const type = MIME[match[0].toLowerCase()];
  return Boolean(type) && !type.startsWith("text/html");
}
