import { pathToFileURL } from "node:url";
import { cwd } from "node:process";
import {
  renderUsedIconsModule,
  renderAllIconsModule,
} from "../../build-support/iconData.js";

const staticBase = pathToFileURL(cwd() + "/src/");

const GENERATED_MODULES = {
  "/js/iconData.js": renderUsedIconsModule,
  "/js/iconDataAll.js": renderAllIconsModule,
};

export async function resolve(specifier, context, nextResolve) {
  if (GENERATED_MODULES[specifier]) {
    return { url: `generated:${specifier}`, shortCircuit: true };
  }
  if (specifier.startsWith("/js/")) {
    const url = new URL(specifier.slice(1), staticBase);
    return { url: url.href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.startsWith("generated:")) {
    const render = GENERATED_MODULES[url.slice("generated:".length)];
    return { format: "module", source: render(), shortCircuit: true };
  }
  return nextLoad(url, context);
}
