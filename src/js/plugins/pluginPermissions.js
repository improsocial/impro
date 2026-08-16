import { unique } from "/js/utils.js";

const ACTION_SCOPES = ["mute", "block", "feedFeedback"];

export function getPermissionsFromManifest(manifest) {
  return parsePermissions(manifest.permissions ?? {});
}

export function parsePermissions(permissions) {
  const parsed = {};
  if (permissions.fetch) {
    const fetchArray = Array.isArray(permissions.fetch)
      ? permissions.fetch
      : [permissions.fetch];
    const fetchPatterns = unique(
      fetchArray.filter((entry) => typeof entry === "string"),
    );
    if (fetchPatterns.length > 0) parsed.fetch = fetchPatterns;
  }
  if (permissions.userFetch === true) parsed.userFetch = true;
  if (permissions.actions) {
    const actionsArray = Array.isArray(permissions.actions)
      ? permissions.actions
      : [permissions.actions];
    const actionScopes = unique(
      actionsArray.filter((entry) => ACTION_SCOPES.includes(entry)),
    );
    if (actionScopes.length > 0) parsed.actions = actionScopes;
  }
  return parsed;
}

// action is one of "mute", "block", "feedFeedback" (the "show fewer/more
// like this" feed-interaction signal)
export function isActionAllowed(action, permissions) {
  return (permissions.actions ?? []).includes(action);
}

export function diffPermissions(current, next) {
  const diff = {};
  let hasAny = false;
  for (const key of Object.keys(next)) {
    const nextValue = next[key];
    // Scope flags (userFetch) are booleans, not pattern lists
    if (!Array.isArray(nextValue)) {
      if (nextValue && !current[key]) {
        diff[key] = nextValue;
        hasAny = true;
      }
      continue;
    }
    const have = new Set(Array.isArray(current[key]) ? current[key] : []);
    const added = nextValue.filter((entry) => !have.has(entry));
    if (added.length > 0) {
      diff[key] = added;
      hasAny = true;
    }
  }
  return hasAny ? diff : null;
}

export function isEmptyPermissions(obj) {
  return Object.values(obj).every((value) =>
    Array.isArray(value) ? value.length === 0 : !value,
  );
}

export function isUserFetchAllowed(permissions) {
  return permissions.userFetch === true;
}

// Canonicalizes a plugin-supplied URL into an origin-scoped fetch pattern,
// or null if it can't be one. User grants cover a whole origin: path is
// discarded, port kept.
export function normalizeFetchOrigin(url) {
  let parsedUrl = null;
  try {
    parsedUrl = new URL(url);
  } catch {
    return null;
  }
  if (parsedUrl.username || parsedUrl.password) return null;
  const host = parsedUrl.hostname.toLowerCase();
  if (!host || host.includes("*")) return null;
  if (parsedUrl.protocol === "http:") {
    if (!isLoopbackHost(host)) return null;
  } else if (parsedUrl.protocol !== "https:") {
    return null;
  }
  const port = parsedUrl.port ? `:${parsedUrl.port}` : "";
  return `${parsedUrl.protocol}//${host}${port}/*`;
}

// Sanitizes stored user-granted origins into canonical fetch patterns. The
// installed-plugins list lives in the user's preferences record, we need to
// sanitize before using it.
export function parseUserGrantedFetchOrigins(origins) {
  if (!Array.isArray(origins)) return [];
  return unique(origins.map(normalizeFetchOrigin).filter(Boolean));
}

export function isFetchAllowed(url, permissions) {
  let parsedUrl = null;
  try {
    parsedUrl = new URL(url);
  } catch {
    return false;
  }
  if (parsedUrl.protocol !== "https:") {
    if (parsedUrl.protocol !== "http:") return false;
    if (!isLoopbackHost(parsedUrl.hostname)) return false;
  }
  return (permissions.fetch ?? []).some((pattern) =>
    matchesPattern(parsedUrl, pattern),
  );
}

// Permission pattern matching:
//   https://example.com/path        — exact host, exact path
//   https://example.com/path/*      — exact host, path prefix
//   https://*.example.com/*         — example.com and any subdomain
//   https://example.com/*           — exact host, any path
//   https://example.com:8443/*      — exact port; without one, any port
//   http://localhost:11434/*        — http is loopback-only

function matchesPattern(parsedUrl, pattern) {
  let parsedPattern = null;
  try {
    parsedPattern = parsePattern(pattern);
  } catch (e) {
    console.error(e);
    console.warn(`invalid permission: ${pattern}`);
    return false;
  }
  const { scheme, host, port, path } = parsedPattern;
  if (scheme !== parsedUrl.protocol.slice(0, -1)) return false;
  if (!hostMatches(parsedUrl.hostname, host)) return false;
  if (port !== null && port !== effectivePort(parsedUrl)) return false;
  if (!pathMatches(parsedUrl.pathname, path)) return false;
  return true;
}

function parsePattern(pattern) {
  if (typeof pattern !== "string") throw new Error("must be a string");
  const schemeSep = pattern.indexOf("://");
  if (schemeSep === -1) throw new Error("no protocol found");
  const scheme = pattern.slice(0, schemeSep);
  if (scheme !== "https" && scheme !== "http") {
    throw new Error("https required");
  }
  const rest = pattern.slice(schemeSep + 3);
  const pathStart = rest.indexOf("/");
  const authority = (
    pathStart === -1 ? rest : rest.slice(0, pathStart)
  ).toLowerCase();
  const path = pathStart === -1 ? "/*" : rest.slice(pathStart);
  const { host, port } = splitHostPort(authority);
  if (!host) throw new Error("no host found");
  if (scheme === "http" && !isLoopbackHost(host)) {
    throw new Error("http is only allowed for loopback hosts");
  }
  return { scheme, host, port, path };
}

function splitHostPort(authority) {
  const portSep = authority.startsWith("[")
    ? authority.indexOf(":", authority.indexOf("]"))
    : authority.lastIndexOf(":");
  if (portSep === -1) return { host: authority, port: null };
  const port = authority.slice(portSep + 1);
  if (!/^\d+$/.test(port)) throw new Error("invalid port");
  return { host: authority.slice(0, portSep), port };
}

function effectivePort(parsedUrl) {
  if (parsedUrl.port) return parsedUrl.port;
  return parsedUrl.protocol === "https:" ? "443" : "80";
}

// Mirrors the "potentially trustworthy origin" hosts browsers exempt from
// mixed-content blocking. Note Safari does not honor the exemption, so http
// loopback fetches fail there when the app itself is served over https.
function isLoopbackHost(host) {
  const normalized = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized === "localhost" || normalized.endsWith(".localhost")) {
    return true;
  }
  if (normalized === "::1") return true;
  return /^127(?:\.\d{1,3}){3}$/.test(normalized);
}

function hostMatches(actualHost, patternHost) {
  const actual = actualHost.toLowerCase();
  if (patternHost.startsWith("*.")) {
    const suffix = patternHost.slice(2);
    if (!suffix || suffix.includes("*")) return false;
    if (actual === suffix) return true;
    return actual.endsWith("." + suffix);
  }
  if (patternHost.includes("*")) return false;
  return actual === patternHost;
}

function pathMatches(actualPath, patternPath) {
  if (patternPath.endsWith("*")) {
    const prefix = patternPath.slice(0, -1);
    return actualPath.startsWith(prefix);
  }
  return actualPath === patternPath;
}
