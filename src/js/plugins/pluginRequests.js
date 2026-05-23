import { isFetchAllowed } from "/js/plugins/pluginPermissions.js";

const ALLOWED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"];

const FORBIDDEN_HEADERS = ["authorization", "cookie"];
const MAX_BODY_CHARS = 1_000_000;

export async function makePluginRequest(
  plugin,
  url,
  init,
  fetchImpl = fetch.bind(globalThis),
) {
  if (!isFetchAllowed(url, plugin.permissions)) {
    throw new Error(`fetch to "${url}" not permitted`);
  }
  const response = await fetchImpl(url, {
    ...sanitizeFetchInit(init),
    credentials: "omit",
    redirect: "error",
    mode: "cors",
    referrerPolicy: "no-referrer",
  });
  const bodyText = await response.text();
  return {
    status: response.status,
    ok: response.ok,
    headers: filterResponseHeaders(response.headers, ["content-type"]),
    body: bodyText,
  };
}

function sanitizeFetchInit(init) {
  const safeInit = {};
  const method = (init?.method ?? "GET").toUpperCase();
  if (!ALLOWED_METHODS.includes(method)) {
    throw new Error(`fetch method "${method}" not permitted`);
  }
  safeInit.method = method;
  const headers = {};
  for (const [name, value] of Object.entries(init?.headers ?? {})) {
    const lowerName = String(name).toLowerCase();
    if (FORBIDDEN_HEADERS.includes(lowerName)) {
      throw new Error(`fetch header "${name}" not permitted`);
    }
    headers[name] = String(value);
  }
  safeInit.headers = headers;
  if (init?.body != null) {
    if (typeof init.body !== "string") {
      throw new Error("fetch body must be a string");
    }
    if (init.body.length > MAX_BODY_CHARS) {
      throw new Error("fetch body too large");
    }
    safeInit.body = init.body;
  }
  return safeInit;
}

function filterResponseHeaders(headers, allowedNames) {
  const picked = {};
  for (const name of allowedNames) {
    const value = headers.get(name);
    if (value != null) picked[name] = value;
  }
  return picked;
}
