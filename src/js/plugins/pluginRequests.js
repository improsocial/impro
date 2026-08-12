import { isFetchAllowed } from "/js/plugins/pluginPermissions.js";

const ALLOWED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"];

// Authorization is stripped from the ordinary manifest-allowlisted fetch()
// (an ambient credential shouldn't be forwardable to any host a manifest
// merely lists), but allowed through customEndpointFetch, where the target
// is a single address a human explicitly typed in and approved - there it's
// the plugin's own credential for a destination the user chose, not
// something being smuggled to an unreviewed third party.
const FETCH_FORBIDDEN_HEADERS = ["authorization", "cookie"];
const CUSTOM_ENDPOINT_FORBIDDEN_HEADERS = ["cookie"];
const MAX_BODY_CHARS = 1_000_000;
export const MAX_RESPONSE_BYTES = 100_000_000;

export async function pluginFetch(
  permissions,
  url,
  init,
  fetchImpl = fetch.bind(globalThis),
) {
  if (!isFetchAllowed(url, permissions)) {
    throw new Error(`fetch to "${url}" not permitted`);
  }
  return performSanitizedFetch(url, init, FETCH_FORBIDDEN_HEADERS, fetchImpl);
}

// approvedUrl is whatever the host currently has on file for this plugin
// from a prior requestCustomEndpointUrl approval (see
// pluginCustomEndpointStore.js) - url must match it exactly. Unlike
// pluginFetch, there's no scheme restriction here: fetch() itself already
// rejects schemes it doesn't support, and the browser's own mixed-content
// rules (which always trust localhost/127.0.0.1 regardless of scheme) are
// what make a plain http:// local Ollama server reachable from an https://
// page in the first place - nothing here needs to special-case that.
export async function customEndpointFetch(
  approvedUrl,
  url,
  init,
  fetchImpl = fetch.bind(globalThis),
) {
  if (approvedUrl == null || url !== approvedUrl) {
    throw new Error(`"${url}" is not the approved custom endpoint`);
  }
  return performSanitizedFetch(
    url,
    init,
    CUSTOM_ENDPOINT_FORBIDDEN_HEADERS,
    fetchImpl,
  );
}

async function performSanitizedFetch(url, init, forbiddenHeaders, fetchImpl) {
  const response = await fetchImpl(url, {
    ...sanitizeFetchInit(init, forbiddenHeaders),
    credentials: "omit",
    redirect: "error",
    mode: "cors",
    referrerPolicy: "no-referrer",
  });
  const bodyBuffer = await response.arrayBuffer();
  if (bodyBuffer.byteLength > MAX_RESPONSE_BYTES) {
    throw new Error(
      `fetch response too large (${bodyBuffer.byteLength} bytes, max ${MAX_RESPONSE_BYTES})`,
    );
  }
  return {
    status: response.status,
    ok: response.ok,
    headers: filterResponseHeaders(response.headers, ["content-type"]),
    body: bodyBuffer,
  };
}

function sanitizeFetchInit(init, forbiddenHeaders) {
  const safeInit = {};
  const method = (init?.method ?? "GET").toUpperCase();
  if (!ALLOWED_METHODS.includes(method)) {
    throw new Error(`fetch method "${method}" not permitted`);
  }
  safeInit.method = method;
  const headers = {};
  for (const [name, value] of Object.entries(init?.headers ?? {})) {
    const lowerName = String(name).toLowerCase();
    if (forbiddenHeaders.includes(lowerName)) {
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
