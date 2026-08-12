import { isFetchAllowed } from "/js/plugins/pluginPermissions.js";

const ALLOWED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"];

const FORBIDDEN_HEADERS = ["authorization", "cookie"];
const MAX_BODY_CHARS = 1_000_000;
// Response bytes are buffered into memory whole (no streaming to the
// worker), and base64-encoded for transport - generous enough for a
// legitimately large response, but still bounded so a plugin can't be
// handed an unbounded download.
export const MAX_RESPONSE_BYTES = 100_000_000;

// Encodes in fixed-size chunks rather than String.fromCharCode(...bytes) in
// one call, which risks "too many arguments"/stack errors once bytes gets
// into the tens of millions of entries this is sized for.
export function bytesToBase64(bytes) {
  const CHUNK_SIZE = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE));
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function pluginFetch(
  permissions,
  url,
  init,
  fetchImpl = fetch.bind(globalThis),
) {
  if (!isFetchAllowed(url, permissions)) {
    throw new Error(`fetch to "${url}" not permitted`);
  }
  const response = await fetchImpl(url, {
    ...sanitizeFetchInit(init),
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
  // Always base64, regardless of content type: this is the one encoding
  // that survives the postMessage/structured-clone hop to the plugin
  // worker byte-for-byte, whether the response is JSON, HTML, or a binary
  // asset. PluginResponse (impro-plugin/main.js) decodes it back into
  // text/JSON/raw bytes on the plugin side depending on which accessor is
  // called.
  const bodyBase64 = bytesToBase64(new Uint8Array(bodyBuffer));
  return {
    status: response.status,
    ok: response.ok,
    headers: filterResponseHeaders(response.headers, ["content-type"]),
    body: bodyBase64,
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
