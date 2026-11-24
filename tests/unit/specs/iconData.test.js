import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  findUsedIconIds,
  readIconSymbols,
  renderIconModule,
} from "../../../build-support/iconData.js";

describe("iconData", () => {
  let rootDir;

  const writeFile = (relativePath, content) => {
    const filePath = path.join(rootDir, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  };

  beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "icon-data-"));
    writeFile(
      "icons/heart.svg",
      '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M1"/></svg>',
    );
    writeFile(
      "icons/line/heart-line.svg",
      '<svg viewBox="0 0 24 24" stroke="currentColor"><path d="M2"/></svg>',
    );
    writeFile(
      "icons/bell.svg",
      '<svg viewBox="0 0 24 24"><path d="M3"/></svg>',
    );
    writeFile("icons/car.svg", '<svg viewBox="0 0 24 24"><path d="M4"/></svg>');
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it("reads each icon as a symbol with its viewBox and presentation attributes", () => {
    const symbols = readIconSymbols(path.join(rootDir, "icons"));
    assert.deepEqual([...symbols.keys()].sort(), [
      "bell",
      "car",
      "heart",
      "heart-line",
    ]);
    assert.equal(
      symbols.get("heart"),
      '<symbol id="heart" viewBox="0 0 24 24" fill="currentColor"><path d="M1"/></symbol>',
    );
  });

  it("finds quoted icon ids in the source along with their -line variants", () => {
    writeFile(
      "js/views/home.js",
      'const icons = [`<app-icon icon="bell">`, fillableIcon({ icon: "heart" })];',
    );
    writeFile("js/lib/vendor.js", 'const ignored = "car";');
    const used = findUsedIconIds(
      new Set(["bell", "car", "heart", "heart-line"]),
      path.join(rootDir, "js"),
    );
    assert.deepEqual([...used].sort(), ["bell", "heart", "heart-line"]);
  });

  it("renders a module exporting the requested symbols", async () => {
    const symbols = readIconSymbols(path.join(rootDir, "icons"));
    writeFile("icons.js", renderIconModule(symbols, ["heart", "bell"]));
    const { default: icons } = await import(path.join(rootDir, "icons.js"));
    assert.deepEqual(Object.keys(icons), ["bell", "heart"]);
    assert.equal(icons.bell, symbols.get("bell"));
  });
});
