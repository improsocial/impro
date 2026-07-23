import { resolveIdentity, getServiceEndpointFromDidDoc } from "/js/atproto.js";

const REQUIRED_MANIFEST_FIELDS = ["id", "name", "version"];

function isRelativePath(file) {
  if (typeof file !== "string" || file.length === 0) return false;
  if (file.startsWith("/")) return false;
  if (file.includes("://")) return false;
  for (const segment of file.split("/")) {
    if (segment === "" || segment === "." || segment === "..") return false;
  }
  return true;
}

function parseFontEntry(entry, index) {
  if (!entry || typeof entry !== "object") {
    throw new Error(`fonts[${index}] must be an object`);
  }
  const { family, file } = entry;
  if (typeof family !== "string" || family.length === 0) {
    throw new Error(`fonts[${index}] missing required field "family"`);
  }
  if (typeof file !== "string" || file.length === 0) {
    throw new Error(`fonts[${index}] missing required field "file"`);
  }
  if (!/\.(woff2?|woff)$/i.test(file)) {
    throw new Error(`fonts[${index}] file must end in .woff2 or .woff`);
  }
  if (!isRelativePath(file)) {
    throw new Error(`fonts[${index}] file must be a relative path`);
  }
  return { ...entry, family, file };
}

function parsePluginManifest(pluginId, manifest) {
  for (const field of REQUIRED_MANIFEST_FIELDS) {
    if (typeof manifest[field] !== "string") {
      throw new Error(`missing required field "${field}"`);
    }
  }
  if (manifest.id !== pluginId) {
    throw new Error(
      `manifest id "${manifest.id}" does not match plugin id "${pluginId}"`,
    );
  }
  if (manifest.fonts !== undefined) {
    if (!Array.isArray(manifest.fonts)) {
      throw new Error(`fonts must be an array`);
    }
    manifest.fonts = manifest.fonts.map((entry, i) => parseFontEntry(entry, i));
  }
  return manifest;
}

// A plugin listing's `repo` field is normally a bare "owner/repo" GitHub
// path. It may also be prefixed with a host name ("host:owner/repo"):
// "github:" spells out the default explicitly, and "tangled:" sources from
// tangled.sh. GitHub owner/repo names can't contain ":", so this is
// unambiguous.
export function parseRepoSpec(repo) {
  const colonIndex = repo.indexOf(":");
  if (colonIndex === -1) return { host: "github", path: repo };
  const host = repo.slice(0, colonIndex);
  const path = repo.slice(colonIndex + 1);
  if (host !== "github" && host !== "tangled") {
    throw new Error(`Unsupported plugin repo host "${host}"`);
  }
  return { host, path };
}

// The human-facing "view source" URL for a plugin's repo field.
export function repoWebUrl(repo) {
  const { host, path } = parseRepoSpec(repo);
  if (host === "tangled") {
    return `https://tangled.org/${path}`;
  }
  return `https://github.com/${path}`;
}

function assertFontMagicBytes(file, bytes) {
  const view = new Uint8Array(bytes, 0, 4);
  const isWoff2 =
    view[0] === 0x77 &&
    view[1] === 0x4f &&
    view[2] === 0x46 &&
    view[3] === 0x32;
  const isWoff =
    view[0] === 0x77 &&
    view[1] === 0x4f &&
    view[2] === 0x46 &&
    view[3] === 0x46;
  const wantWoff2 = /\.woff2$/i.test(file);
  if (wantWoff2 ? !isWoff2 : !isWoff) {
    throw new Error(`font "${file}" has invalid magic bytes`);
  }
}

// tangled.org's own HTTP endpoints (the "/raw/<ref>/<path>" route and the
// mirror.tangled.network XRPC service it redirects through) don't set
// Access-Control-Allow-Origin, so browsers block fetching them cross-origin
// entirely — this isn't fixable by changing the URL we hit on that host.
//
// Instead, resolve and fetch entirely through standard AT Protocol
// infrastructure, which is CORS-enabled throughout (impro already depends
// on plc.directory and the handle resolver for its own core function, so
// this adds no new trust surface):
//   1. resolveIdentity(ownerHandle) -> owner DID + DID doc (handle
//      resolver + plc.directory)
//   2. getServiceEndpointFromDidDoc -> owner's PDS
//   3. the repo's own "sh.tangled.repo" record on the owner's PDS ->
//      {knot, repoDid} (see findTangledRepoRecord below re. the two
//      record-key schemes this has to handle)
//   4. the individual knot server's own "sh.tangled.repo.blob" XRPC route
//      (not the mirror), which does set Access-Control-Allow-Origin: *
//
// Cached per repo path since each resolution costs multiple network
// round-trips and rarely changes.
const tangledRepoInfoCache = new Map();

// The "sh.tangled.repo" record key scheme has changed at least once:
// repos created more recently use the repo name directly as the record
// key (rkey), while older repos use an opaque TID key instead, with the
// repo name only present as an explicit "name" field on the record value
// (confirmed against real accounts, e.g. tangled.org's own "infra" repo
// still uses a TID key). Try the fast direct lookup first, and fall back
// to scanning the owner's records by name — this has to keep working for
// both existing schemes, and possibly future ones with the same fallback.
async function findTangledRepoRecord(pds, ownerDid, repoName) {
  const directUrl =
    `${pds}/xrpc/com.atproto.repo.getRecord?` +
    new URLSearchParams({
      repo: ownerDid,
      collection: "sh.tangled.repo",
      rkey: repoName,
    });
  const directResponse = await fetch(directUrl);
  if (directResponse.ok) {
    const record = await directResponse.json();
    if (record.value) return record.value;
  }

  let cursor = null;
  for (let page = 0; page < 20; page++) {
    const params = new URLSearchParams({
      repo: ownerDid,
      collection: "sh.tangled.repo",
      limit: "100",
    });
    if (cursor) params.set("cursor", cursor);
    const response = await fetch(
      `${pds}/xrpc/com.atproto.repo.listRecords?${params}`,
    );
    if (!response.ok) return null;
    const data = await response.json();
    const records = data.records ?? [];
    const match = records.find((record) => record.value?.name === repoName);
    if (match) return match.value;
    if (!data.cursor || records.length === 0) return null;
    cursor = data.cursor;
  }
  return null;
}

async function resolveTangledRepoInfo(path) {
  if (tangledRepoInfoCache.has(path)) {
    return tangledRepoInfoCache.get(path);
  }
  const promise = (async () => {
    const slashIndex = path.indexOf("/");
    if (slashIndex === -1) {
      throw new Error(`Invalid tangled repo path "${path}"`);
    }
    const ownerHandle = path.slice(0, slashIndex);
    const repoName = path.slice(slashIndex + 1);

    const identity = await resolveIdentity(ownerHandle);
    if (!identity) {
      throw new Error(`Could not resolve tangled repo owner "${ownerHandle}"`);
    }
    const pds = getServiceEndpointFromDidDoc(identity.didDoc);

    const record = await findTangledRepoRecord(pds, identity.did, repoName);
    if (!record) {
      throw new Error(
        `Could not find a tangled repo record named "${repoName}" for "${ownerHandle}"`,
      );
    }
    const { knot, repoDid } = record;
    if (!knot || !repoDid) {
      throw new Error(
        `tangled repo record for "${path}" is missing knot/repoDid`,
      );
    }
    return { knot, repoDid };
  })();
  // Don't cache a failed resolution — allow retrying on a later call.
  promise.catch(() => tangledRepoInfoCache.delete(path));
  tangledRepoInfoCache.set(path, promise);
  return promise;
}

// The knot's raw=true mode only serves image/video/text mime types (fonts
// come back 403 "only image, video, and text files can be accessed
// directly"). Passing raw=false instead gets the JSON-wrapped response
// (content + encoding, "base64" for binary files) that every file type
// supports — needed for fonts, usable for any file type.
async function remoteAssetUrl({ repo, file, release = null, raw = true }) {
  const { host, path } = parseRepoSpec(repo);
  if (host === "tangled") {
    const { knot, repoDid } = await resolveTangledRepoInfo(path);
    const params = new URLSearchParams({
      repo: repoDid,
      ref: release ?? "main",
      path: file,
    });
    if (raw) params.set("raw", "true");
    return `https://${knot}/xrpc/sh.tangled.repo.blob?${params}`;
  }
  const ref = release ? `refs/tags/${release}` : "refs/heads/main";
  return `https://raw.githubusercontent.com/${path}/${ref}/${file}`;
}

// Decodes a tangled knot's JSON-wrapped blob response (from a non-raw
// sh.tangled.repo.blob fetch) into an ArrayBuffer.
function decodeTangledBlobContent(data, file) {
  if (typeof data.content !== "string") {
    throw new Error(`tangled blob response for "${file}" has no content`);
  }
  if (data.encoding === "base64") {
    const binary = atob(data.content);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
  return new TextEncoder().encode(data.content).buffer;
}

export class SourceProvider {
  constructor(pluginCache) {
    this.pluginCache = pluginCache;
  }

  async getManifest(pluginId, version, repo) {
    if (pluginId.endsWith("__LOCAL")) {
      const response = await fetch(`/plugins-local/${pluginId}/manifest.json`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const manifest = await response.json();
      manifest.id = manifest.id + "__LOCAL";
      return parsePluginManifest(pluginId, manifest);
    }
    if (!version || !repo) {
      throw new Error("Version and repo are required");
    }
    const url = await remoteAssetUrl({
      repo,
      file: "manifest.json",
      release: version,
    });
    const response = await this.pluginCache.fetch(url);
    return parsePluginManifest(pluginId, await response.json());
  }

  async getLiveManifest(pluginId, repo) {
    if (pluginId.endsWith("__LOCAL")) {
      return this.getManifest(pluginId, null, null);
    }
    if (!repo) {
      throw new Error("Repo is required");
    }
    // Fetch from main branch
    const url = await remoteAssetUrl({ repo, file: "manifest.json" });
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return parsePluginManifest(pluginId, await response.json());
  }

  async getLiveManifestFromRepo(repo) {
    if (!repo) {
      throw new Error("Repo is required");
    }
    const url = await remoteAssetUrl({ repo, file: "manifest.json" });
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const manifest = await response.json();
    return parsePluginManifest(manifest.id, manifest);
  }

  async getSource(pluginId, version, repo) {
    if (pluginId.endsWith("__LOCAL")) {
      const response = await fetch(`/plugins-local/${pluginId}/main.js`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    }
    if (!version || !repo) {
      throw new Error("Version and repo are required");
    }
    const url = await remoteAssetUrl({
      repo,
      file: "main.js",
      release: version,
    });
    const response = await this.pluginCache.fetch(url);
    return await response.text();
  }

  // Returns CSS text if the plugin includes a styles.css, otherwise null.
  async getStyles(pluginId, version, repo) {
    if (pluginId.endsWith("__LOCAL")) {
      const response = await fetch(`/plugins-local/${pluginId}/styles.css`);
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    }
    if (!version || !repo) {
      throw new Error("Version and repo are required");
    }
    const url = await remoteAssetUrl({
      repo,
      file: "styles.css",
      release: version,
    });
    try {
      const response = await this.pluginCache.fetch(url, {
        doCacheNotFound: true,
      });
      return await response.text();
    } catch (error) {
      if (error?.status === 404) return null;
      throw error;
    }
  }

  async getFont(pluginId, version, repo, file) {
    let bytes;
    if (pluginId.endsWith("__LOCAL")) {
      const response = await fetch(`/plugins-local/${pluginId}/${file}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      bytes = await response.arrayBuffer();
    } else {
      if (!version || !repo) {
        throw new Error("Version and repo are required");
      }
      const { host } = parseRepoSpec(repo);
      if (host === "tangled") {
        const url = await remoteAssetUrl({
          repo,
          file,
          release: version,
          raw: false,
        });
        const response = await this.pluginCache.fetch(url);
        bytes = decodeTangledBlobContent(await response.json(), file);
      } else {
        const url = await remoteAssetUrl({ repo, file, release: version });
        const response = await this.pluginCache.fetch(url);
        bytes = await response.arrayBuffer();
      }
    }
    assertFontMagicBytes(file, bytes);
    const mime = /\.woff2$/i.test(file) ? "font/woff2" : "font/woff";
    return new Blob([bytes], { type: mime });
  }

  async getReadme(pluginId, repo) {
    if (pluginId.endsWith("__LOCAL")) {
      const response = await fetch(`/plugins-local/${pluginId}/README.md`);
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    }
    if (!repo) {
      throw new Error("Repo is required");
    }
    // Fetch from main branch so we show the latest README
    const url = await remoteAssetUrl({ repo, file: "README.md" });
    const response = await fetch(url, { cache: "no-store" });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  }

  // URLs that should be retained in the cache
  // Local plugins have no cached URLs
  async getCacheUrls(pluginId, version, repo) {
    if (pluginId.endsWith("__LOCAL")) {
      return [];
    }
    const files = ["manifest.json", "main.js", "styles.css"];
    try {
      const manifest = await this.getManifest(pluginId, version, repo);
      for (const font of manifest.fonts ?? []) {
        files.push(font.file);
      }
    } catch {
      // If the manifest can't be read the base URLs are still returned so
      // reconcile doesn't purge a partially-cached plugin.
    }
    return await Promise.all(
      files.map((file) => remoteAssetUrl({ repo, file, release: version })),
    );
  }
}
