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

  const stylesheetHrefs = () =>
    [
      ...fs
        .readFileSync(path.join(outputDir, "index.html"), "utf-8")
        .matchAll(/rel="stylesheet" href="([^"]+)"/g),
    ].map((match) => match[1]);

  const build = (cacheSalt = "test") =>
    applyContentHashing({
      outputDir,
      htmlFiles: [path.join(outputDir, "index.html")],
      cacheSalt,
    });

  beforeEach(() => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "content-hash-"));
    writeFile(
      "css/style.css",
      "/* @chunk base */\nbody {}\n/* @chunk feed */\n.feed {}",
    );
    writeFile(
      "index.html",
      '<html><head><link rel="stylesheet" href="/css/style.css" /></head></html>',
    );
  });

  afterEach(() => {
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  it("replaces the stylesheet link with one hashed link per chunk", async () => {
    await build();
    const hrefs = stylesheetHrefs();
    assert.equal(hrefs.length, 2);
    assert.match(hrefs[0], /^\/css\/base\.[0-9a-f]{10}\.css$/);
    assert.match(hrefs[1], /^\/css\/feed\.[0-9a-f]{10}\.css$/);
    for (const href of hrefs) {
      assert(fs.existsSync(path.join(outputDir, href)));
    }
    assert(!fs.existsSync(path.join(outputDir, "css", "style.css")));
  });

  it("changes chunk filenames when the cache salt changes", async () => {
    await build("first");
    const firstHrefs = stylesheetHrefs();
    writeFile(
      "css/style.css",
      "/* @chunk base */\nbody {}\n/* @chunk feed */\n.feed {}",
    );
    writeFile(
      "index.html",
      '<html><head><link rel="stylesheet" href="/css/style.css" /></head></html>',
    );
    await build("second");
    const secondHrefs = stylesheetHrefs();
    assert(firstHrefs.every((href) => !secondHrefs.includes(href)));
  });
});
