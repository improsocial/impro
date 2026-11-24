import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../../../../functions/_middleware.js";

function makeContext(pathname, response) {
  const assetsFetch = mock.fn(async () => new Response("Not found\n"));
  return {
    request: new Request(`https://app.example${pathname}`),
    next: async () => response,
    env: { ASSETS: { fetch: assetsFetch } },
    assetsFetch,
  };
}

function htmlResponse() {
  return new Response("<!doctype html>", {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

describe("pages middleware", () => {
  it("replaces the SPA fallback for a missing asset with not-found.txt as a 404", async () => {
    const context = makeContext("/js/missing.js", htmlResponse());
    const response = await onRequest(context);
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(
      response.headers.get("Content-Type"),
      "text/plain; charset=utf-8",
    );
    assert.equal(await response.text(), "Not found\n");
    assert.equal(
      context.assetsFetch.mock.calls[0].arguments[0].href,
      "https://app.example/not-found.txt",
    );
  });

  it("passes through assets that exist", async () => {
    const asset = new Response("export {}", {
      headers: { "Content-Type": "text/javascript" },
    });
    const context = makeContext("/js/app.js", asset);
    assert.equal(await onRequest(context), asset);
    assert.equal(context.assetsFetch.mock.callCount(), 0);
  });

  it("passes through the SPA fallback for page routes", async () => {
    const page = htmlResponse();
    const context = makeContext("/profile/alice.test", page);
    assert.equal(await onRequest(context), page);
    assert.equal(context.assetsFetch.mock.callCount(), 0);
  });
});
