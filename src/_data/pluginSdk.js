import * as esbuild from "esbuild";
import crypto from "node:crypto";

// SDK is built here so we can pass its hashed filename to the HTML
export default async function () {
  const built = await esbuild.build({
    entryPoints: ["impro-plugin/main.js"],
    bundle: true,
    format: "iife",
    globalName: "ImproPlugin",
    write: false,
  });
  const code = built.outputFiles[0].text;
  const hash = crypto
    .createHash("sha256")
    .update(code)
    .digest("hex")
    .slice(0, 10);

  return { code, fileName: `pluginSdk.${hash}.js` };
}
