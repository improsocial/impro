import { pathToFileURL } from "node:url";
import { cwd } from "node:process";

const staticBase = pathToFileURL(cwd() + "/src/");

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("/")) {
    const url = new URL(specifier.slice(1), staticBase);
    return { url: url.href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
