import { unique } from "/js/utils.js";

const ACTION_SCOPES = ["mute", "block", "feedFeedback"];
const RECORD_SCOPES = ["write"];

// All records-write plugins share this one collection — a plugin doesn't
// get to choose its own NSID. AT Protocol OAuth scopes have to name an
// exact collection at authorization time (no partial wildcards), so
// enumerating a new collection per plugin would mean a core change *and* a
// forced re-authentication for every new plugin, forever. Sharing one
// collection means the OAuth scope for it (see oauthScopes.js) only ever
// needs to be granted once. Cross-plugin isolation within this shared
// collection is enforced per-record by pluginService.js's putRecord/
// deleteRecord (see the $plugin ownership marker there), not by the
// collection name.
export const SHARED_PLUGIN_RECORDS_COLLECTION = "social.impro.plugins.cloaca";

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
  if (permissions.actions) {
    const actionsArray = Array.isArray(permissions.actions)
      ? permissions.actions
      : [permissions.actions];
    const actionScopes = unique(
      actionsArray.filter((entry) => ACTION_SCOPES.includes(entry)),
    );
    if (actionScopes.length > 0) parsed.actions = actionScopes;
  }
  if (permissions.records) {
    const recordsArray = Array.isArray(permissions.records)
      ? permissions.records
      : [permissions.records];
    const recordScopes = unique(
      recordsArray.filter((entry) => RECORD_SCOPES.includes(entry)),
    );
    if (recordScopes.length > 0) parsed.records = recordScopes;
  }
  return parsed;
}

// action is one of "mute", "block", "feedFeedback" (the "show fewer/more
// like this" feed-interaction signal)
export function isActionAllowed(action, permissions) {
  return (permissions.actions ?? []).includes(action);
}

// Currently just "write" — lets a plugin create/update/delete its own
// records in the shared SHARED_PLUGIN_RECORDS_COLLECTION (see
// pluginService.js's putRecord/deleteRecord host methods). Writes are
// always pinned to the signed-in user's own repo; a plugin never supplies
// or chooses a repo or a collection.
export function isRecordWriteAllowed(permissions) {
  return (permissions.records ?? []).includes("write");
}

export function diffPermissions(current, next) {
  const diff = {};
  let hasAny = false;
  for (const key of Object.keys(next)) {
    const have = new Set(current[key] ?? []);
    const added = (next[key] ?? []).filter((entry) => !have.has(entry));
    if (added.length > 0) {
      diff[key] = added;
      hasAny = true;
    }
  }
  return hasAny ? diff : null;
}

export function isEmptyPermissions(obj) {
  return Object.values(obj).every(
    (entries) => !Array.isArray(entries) || entries.length === 0,
  );
}

export function isFetchAllowed(url, permissions) {
  let parsedUrl = null;
  try {
    parsedUrl = new URL(url);
  } catch {
    return false;
  }
  if (parsedUrl.protocol !== "https:") return false;
  return (permissions.fetch ?? []).some((pattern) =>
    matchesPattern(parsedUrl, pattern),
  );
}

// Permission pattern matching:
//   https://example.com/path        — exact host, exact path
//   https://example.com/path/*      — exact host, path prefix
//   https://*.example.com/*         — example.com and any subdomain
//   https://example.com/*           — exact host, any path

function matchesPattern(parsedUrl, pattern) {
  let parsedPattern = null;
  try {
    parsedPattern = parsePattern(pattern);
  } catch (e) {
    console.error(e);
    console.warn(`invalid permission: ${pattern}`);
    return false;
  }
  const { host, path } = parsedPattern;
  if (!hostMatches(parsedUrl.hostname, host)) return false;
  if (!pathMatches(parsedUrl.pathname, path)) return false;
  return true;
}

function parsePattern(pattern) {
  if (typeof pattern !== "string") throw new Error("must be a string");
  const schemeSep = pattern.indexOf("://");
  if (schemeSep === -1) throw new Error("no protocol found");
  const scheme = pattern.slice(0, schemeSep);
  if (scheme !== "https") throw new Error("https required");
  const rest = pattern.slice(schemeSep + 3);
  const pathStart = rest.indexOf("/");
  const host = (
    pathStart === -1 ? rest : rest.slice(0, pathStart)
  ).toLowerCase();
  const path = pathStart === -1 ? "/*" : rest.slice(pathStart);
  if (!host) throw new Error("no host found");
  return { host, path };
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
