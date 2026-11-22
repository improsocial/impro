import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { applyContentHashing } from "../../../build-support/contentHash.js";

describe("applyContentHashing", () => {
  let outputDir;

  const writeFile = (relativePath, content) => {
    const filePath = path.join(outputDir, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  };

  const build = () =>
    applyContentHashing({
      outputDir,
      htmlFiles: [path.join(outputDir, "index.html")],
      cacheSalt: "test",
    });

  beforeEach(() => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "content-hash-"));
    writeFile("css/style.css", "/* @chunk base */\nbody {}");
    writeFile(
      "index.html",
      '<html><head><link rel="modulepreload" href="/js/app.js" /><link rel="stylesheet" href="/css/style.css" /></head></html>',
    );
    writeFile("js/app.js", 'import "./views/home.js";');
    writeFile("js/views/home.js", "export const home = {};");
  });

  afterEach(() => {
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  it("renames every module and returns the url map", async () => {
    const urlMap = await build();
    assert.deepEqual(Object.keys(urlMap).sort(), [
      "/js/app.js",
      "/js/views/home.js",
    ]);
    for (const [urlPath, hashed] of Object.entries(urlMap)) {
      assert.match(hashed, /\.[0-9a-f]{10}\.js$/);
      assert(fs.existsSync(path.join(outputDir, hashed)));
      assert(!fs.existsSync(path.join(outputDir, urlPath)));
    }
  });

  it("rewrites existing preload links to hashed filenames", async () => {
    const urlMap = await build();
    const html = fs.readFileSync(path.join(outputDir, "index.html"), "utf-8");
    assert(html.includes(`rel="modulepreload" href="${urlMap["/js/app.js"]}"`));
  });
});
