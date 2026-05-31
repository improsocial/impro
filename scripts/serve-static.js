// Lightweight static file server for playwright tests.

import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "build");
const port = parseInt(process.env.PORT || "8081", 10);

export const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf-8");

function send(res, status, body, type) {
  if (res.headersSent || res.writableEnded) return;
  res.writeHead(status, { "Content-Type": type });
  res.end(body);
}

function safeJoin(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const target = path.normalize(path.join(root, decoded));
  if (!target.startsWith(root)) return null;
  return target;
}

http
  .createServer(async (req, res) => {
    const target = safeJoin(req.url);
    const ext = target ? path.extname(target) : "";

    if (target) {
      try {
        const stat = await fsp.stat(target);
        if (stat.isFile()) {
          res.writeHead(200, {
            "Content-Type": MIME[ext] || "application/octet-stream",
          });
          const stream = fs.createReadStream(target);
          stream.on("error", (err) => {
            console.error(`Stream error for ${req.url}:`, err);
            // Headers are already sent; destroy the response to surface the
            // failure to the client rather than leaving it hanging.
            res.destroy(err);
          });
          stream.pipe(res);
          return;
        }
      } catch (err) {
        if (err.code !== "ENOENT" && err.code !== "ENOTDIR") {
          console.error(`Stat error for ${req.url}:`, err);
          send(res, 500, "Internal Server Error", MIME[".html"]);
          return;
        }
        // Fall through to the not-found / SPA-fallback logic below.
      }
    }

    if (!ext || !MIME[ext]) {
      send(res, 200, indexHtml, MIME[".html"]);
    } else {
      send(res, 404, `Not found: ${req.url}`, "text/plain; charset=utf-8");
    }
  })
  .listen(port, () => {
    console.info(`Static server listening on http://localhost:${port}/`);
  });
