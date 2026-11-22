import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { applyModulePreloads } from "../../../build-support/modulepreload.js";

describe("applyModulePreloads", () => {
  let outputDir;
  let urlMap;

  const writeModule = (urlPath, content) => {
    const hashed = urlPath.replace(/\.js$/, ".0123456789.js");
    const filePath = path.join(outputDir, hashed);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
    urlMap[urlPath] = hashed;
  };

  const preloadHrefs = () =>
    [
      ...fs
        .readFileSync(path.join(outputDir, "index.html"), "utf-8")
        .matchAll(/rel="modulepreload" href="([^"]+)"/g),
    ].map((match) => match[1]);

  const run = () =>
    applyModulePreloads({
      outputDir,
      htmlFile: path.join(outputDir, "index.html"),
      urlMap,
    });

  beforeEach(() => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "modulepreload-"));
    urlMap = {};
    fs.writeFileSync(
      path.join(outputDir, "index.html"),
      '<html><head><link rel="modulepreload" href="/js/app.0123456789.js" /></head></html>',
    );
    writeModule("/js/app.js", 'import "./views/home.js";');
    writeModule(
      "/js/views/home.js",
      'export const load = () => [import("/js/lib/hls.js"), import("../lib/marked.js")];',
    );
    writeModule("/js/lib/hls.js", "export default {};");
    writeModule("/js/lib/marked.js", "export default {};");
  });

  afterEach(() => {
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  it("preloads every module except dynamically imported ones", () => {
    run();
    assert.deepEqual(preloadHrefs(), [
      "/js/app.0123456789.js",
      "/js/views/home.0123456789.js",
    ]);
  });

  it("preloads and warns about modules behind non-literal dynamic imports", (t) => {
    const warn = t.mock.method(console, "warn", () => {});
    writeModule(
      "/js/views/home.js",
      "export const load = (name) => import(`/js/lib/${name}.js`);",
    );
    run();
    assert.deepEqual(preloadHrefs(), [
      "/js/app.0123456789.js",
      "/js/lib/hls.0123456789.js",
      "/js/lib/marked.0123456789.js",
      "/js/views/home.0123456789.js",
    ]);
    assert.equal(warn.mock.callCount(), 1);
  });
});
