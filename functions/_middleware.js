// Send 404s for missing assets in Cloudflare pages

import { isAssetPath } from "../build-support/assetPaths.js";

export async function onRequest(context) {
  const response = await context.next();
  const { pathname } = new URL(context.request.url);
  const isHtml = (response.headers.get("Content-Type") || "").includes(
    "text/html",
  );
  if (isAssetPath(pathname) && isHtml) {
    return new Response(`Not found: ${pathname}`, {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }
  return response;
}
