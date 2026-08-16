import { TangledResolver, decodeTangledBlobContent } from "/js/tangled.js";

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

export function parsePluginManifest(pluginId, manifest) {
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

// Mirrors PluginCache.fetch's error shape, whose `status` marks an error the
// server answered with rather than a network-level failure.
async function fetchOrThrow(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response;
}

export class SourceProvider {
  constructor(pluginCache, tangledResolver = new TangledResolver()) {
    this.pluginCache = pluginCache;
    this.tangledResolver = tangledResolver;
  }

  // The knot's raw=true mode only serves image/video/text mime types (fonts
  // come back 403 "only image, video, and text files can be accessed
  // directly"). Passing raw=false instead gets the JSON-wrapped response
  // (content + encoding, "base64" for binary files) that every file type
  // supports — needed for fonts, usable for any file type.
  async _remoteAssetUrl({ repo, file, release = null, raw = true }) {
    const { host, path } = parseRepoSpec(repo);
    if (host === "tangled") {
      const { knot, repoDid } =
        await this.tangledResolver.resolveRepoInfo(path);
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

  async _fetchRequiredAsset(repo, urlOptions, doFetch) {
    const url = await this._remoteAssetUrl({ repo, ...urlOptions });
    try {
      return await doFetch(url);
    } catch (error) {
      const { host, path } = parseRepoSpec(repo);
      if (host === "tangled" && typeof error?.status === "number") {
        await this.tangledResolver.invalidate(path);
      }
      throw error;
    }
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
    const response = await this._fetchRequiredAsset(
      repo,
      { file: "manifest.json", release: version },
      (url) => this.pluginCache.fetch(url),
    );
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
    const response = await this._fetchRequiredAsset(
      repo,
      { file: "manifest.json" },
      fetchOrThrow,
    );
    return parsePluginManifest(pluginId, await response.json());
  }

  async getLiveManifestFromRepo(repo) {
    if (!repo) {
      throw new Error("Repo is required");
    }
    const response = await this._fetchRequiredAsset(
      repo,
      { file: "manifest.json" },
      fetchOrThrow,
    );
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
    const response = await this._fetchRequiredAsset(
      repo,
      { file: "main.js", release: version },
      (url) => this.pluginCache.fetch(url),
    );
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
    const url = await this._remoteAssetUrl({
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
        const url = await this._remoteAssetUrl({
          repo,
          file,
          release: version,
          raw: false,
        });
        const response = await this.pluginCache.fetch(url);
        bytes = decodeTangledBlobContent(await response.json(), file);
      } else {
        const url = await this._remoteAssetUrl({
          repo,
          file,
          release: version,
        });
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
    const url = await this._remoteAssetUrl({ repo, file: "README.md" });
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
      files.map((file) =>
        this._remoteAssetUrl({ repo, file, release: version }),
      ),
    );
  }
}
