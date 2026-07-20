const REQUIRED_MANIFEST_FIELDS = ["id", "name", "version"];

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
  return manifest;
}

// A plugin listing's `repo` field is normally a bare "owner/repo" GitHub
// path. It may also be prefixed with a host name ("host:owner/repo") to
// source from somewhere else — currently just "tangled:" for tangled.sh
// repos. GitHub owner/repo names can't contain ":", so this is unambiguous.
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

// GitHub's raw content host returns a clean 404 for a missing file.
// tangled.sh's blob-fetch backend instead returns 500 with this exact JSON
// error body for a missing blob — verified against a real repo, since it
// has no dedicated "not found" status. Match on the body too (not just the
// 500), so an actual tangled.sh outage still surfaces as a real error
// instead of being silently swallowed as "file doesn't exist".
function isTangledMissingBlobBody(body) {
  if (typeof body !== "string") return false;
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    return false;
  }
  return (
    parsed?.error === "InternalServerError" &&
    parsed?.message === "failed to get blob"
  );
}

function isMissingFileStatus(repo, status, body) {
  if (status === 404) return true;
  if (status !== 500) return false;
  return (
    parseRepoSpec(repo).host === "tangled" && isTangledMissingBlobBody(body)
  );
}

function remoteAssetUrl({ repo, file, release = null }) {
  const { host, path } = parseRepoSpec(repo);
  if (host === "tangled") {
    // tangled.sh serves raw blobs at /raw/<ref>/<path> for both branches
    // and tags; there's no separate "refs/tags/..." form like GitHub's.
    const ref = release ?? "main";
    return `https://tangled.org/${path}/raw/${ref}/${file}`;
  }
  const ref = release ? `refs/tags/${release}` : "refs/heads/main";
  return `https://raw.githubusercontent.com/${repo}/${ref}/${file}`;
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
    const url = remoteAssetUrl({
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
    const url = remoteAssetUrl({ repo, file: "manifest.json" });
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return parsePluginManifest(pluginId, await response.json());
  }

  async getLiveManifestFromRepo(repo) {
    if (!repo) {
      throw new Error("Repo is required");
    }
    const url = remoteAssetUrl({ repo, file: "manifest.json" });
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
    const url = remoteAssetUrl({ repo, file: "main.js", release: version });
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
    const url = remoteAssetUrl({ repo, file: "styles.css", release: version });
    try {
      const response = await this.pluginCache.fetch(url, {
        doCacheNotFound: true,
      });
      return await response.text();
    } catch (error) {
      if (isMissingFileStatus(repo, error?.status, error?.body)) return null;
      throw error;
    }
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
    const url = remoteAssetUrl({ repo, file: "README.md" });
    const response = await fetch(url, { cache: "no-store" });
    const body = await response.text();
    if (!response.ok) {
      if (isMissingFileStatus(repo, response.status, body)) return null;
      throw new Error(`HTTP ${response.status}`);
    }
    return body;
  }

  // URLs that should be retained in the cache
  // Local plugins have no cached URLs
  async getCacheUrls(pluginId, version, repo) {
    if (pluginId.endsWith("__LOCAL")) {
      return [];
    }
    return [
      remoteAssetUrl({ repo, file: "manifest.json", release: version }),
      remoteAssetUrl({ repo, file: "main.js", release: version }),
      remoteAssetUrl({ repo, file: "styles.css", release: version }),
    ];
  }
}
