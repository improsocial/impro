import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { bundleJs } from "../../../build-support/bundleJs.js";

describe("bundleJs", () => {
  let outputDir;

  const writeFile = (relativePath, content) => {
    const filePath = path.join(outputDir, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  };

  const readFile = (relativePath) =>
    fs.readFileSync(path.join(outputDir, relativePath), "utf-8");

  const jsFiles = () =>
    fs
      .globSync("**/*.js", { cwd: path.join(outputDir, "js") })
      .map((file) => "/js/" + file.split(path.sep).join("/"))
      .sort();

  const findJs = (pattern) => jsFiles().find((file) => pattern.test(file));

  const preloadHrefs = (htmlFile) =>
    [...readFile(htmlFile).matchAll(/rel="modulepreload" href="([^"]+)"/g)].map(
      (match) => match[1],
    );

  const writeSourceFiles = () => {
    writeFile(
      "index.html",
      `<html><head><link rel="modulepreload" href="/js/app.js" /></head><body>
        <script type="module">import "/js/perf.js"; import("/js/app.js");</script>
      </body></html>`,
    );
    writeFile(
      "callback.html",
      `<html><head></head><body><script type="module">import { login } from "/js/auth.js";</script></body></html>`,
    );
    writeFile(
      "js/app.js",
      `import { login } from "/js/auth.js";
       import { homeView } from "./views/home.js";
       export function main() { return [login, homeView, import("/js/lib/hls.js")]; }`,
    );
    writeFile("js/auth.js", "export function login() { return 'logged in'; }");
    writeFile("js/perf.js", "window.perfLoaded = true;");
    writeFile(
      "js/views/home.js",
      "export class HomeView { describe() { return 'home view'; } } export const homeView = new HomeView();",
    );
    writeFile("js/lib/hls.js", "export default 'hls library';");
    writeFile("js/unused.js", "export const unused = 'never imported';");
  };

  const build = (cacheSalt = "salt") =>
    bundleJs({
      outputDir,
      htmlFiles: [
        path.join(outputDir, "index.html"),
        path.join(outputDir, "callback.html"),
      ],
      cacheSalt,
    });

  beforeEach(() => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "bundle-js-"));
    writeSourceFiles();
  });

  afterEach(() => {
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  it("replaces the js directory with content-hashed entry bundles", async () => {
    await build();
    for (const name of ["app", "auth", "perf"]) {
      assert(
        findJs(new RegExp(`^/js/${name}\\.[A-Z0-9]+\\.js$`)),
        `missing ${name}`,
      );
    }
    assert(
      !jsFiles().some((file) => readFile(file).includes("never imported")),
    );
    assert(readFile(findJs(/^\/js\/app\./)).includes("home view"));
  });

  it("points the HTML at the hashed bundles", async () => {
    await build();
    const app = findJs(/^\/js\/app\./);
    const index = readFile("index.html");
    const callback = readFile("callback.html");
    assert(index.includes(`<link rel="modulepreload" href="${app}" />`));
    assert(index.includes(`import("${app}")`));
    assert(index.includes(`import "${findJs(/^\/js\/perf\./)}"`));
    assert(callback.includes(`from "${findJs(/^\/js\/auth\./)}"`));
    assert(!/["']\/js\/(app|auth|perf)\.js["']/.test(index + callback));
    assert(!(index + callback).includes("importmap"));
  });

  it("bundles each entry on its own, including the modules it shares with other entries", async () => {
    await build();
    const filesWithLogin = jsFiles().filter((file) =>
      readFile(file).includes("logged in"),
    );
    assert.deepEqual(filesWithLogin, [
      findJs(/^\/js\/app\./),
      findJs(/^\/js\/auth\./),
    ]);
  });

  it("preloads each page's static imports but not dynamic ones", async () => {
    await build();
    const app = findJs(/^\/js\/app\./);
    const perf = findJs(/^\/js\/perf\./);
    const auth = findJs(/^\/js\/auth\./);
    const indexPreloads = preloadHrefs("index.html");
    const callbackPreloads = preloadHrefs("callback.html");
    assert.equal(new Set(indexPreloads).size, indexPreloads.length);
    assert(indexPreloads.includes(app));
    assert(indexPreloads.includes(perf));
    assert(!indexPreloads.includes(auth));
    assert(!indexPreloads.some((href) => href.includes("/hls.")));
    assert(callbackPreloads.includes(auth));
    assert(!callbackPreloads.includes(app));
  });

  it("splits dynamically imported modules into their own chunk", async () => {
    await build();
    const hlsChunk = findJs(/^\/js\/chunks\/hls\./);
    assert(readFile(hlsChunk).includes("hls library"));
    const relativeHls = "./" + path.posix.relative("/js", hlsChunk);
    assert(
      readFile(findJs(/^\/js\/app\./)).includes(`import("${relativeHls}")`),
    );
  });

  it("changes every filename when the cache salt changes", async () => {
    await build("first");
    const firstFiles = jsFiles();
    fs.rmSync(outputDir, { recursive: true, force: true });
    fs.mkdirSync(outputDir);
    writeSourceFiles();
    await build("second");
    const secondFiles = new Set(jsFiles());
    assert(firstFiles.every((file) => !secondFiles.has(file)));
  });

  it("keeps class names for components that derive their tag from them", async () => {
    await build();
    assert.match(readFile(findJs(/^\/js\/app\./)), /"HomeView"/);
  });
});
