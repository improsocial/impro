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

function remoteAssetUrl({ repo, file, release = null }) {
  if (release) {
    return `https://cdn.jsdelivr.net/gh/${repo}@${release}/${file}`;
  }
  return `https://raw.githubusercontent.com/${repo}/main/${file}`;
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
      const response = await this.pluginCache.fetch(url);
      return await response.text();
    } catch (error) {
      if (error?.status === 404) return null;
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
    return [
      remoteAssetUrl({ repo, file: "manifest.json", release: version }),
      remoteAssetUrl({ repo, file: "main.js", release: version }),
      remoteAssetUrl({ repo, file: "styles.css", release: version }),
    ];
  }
}
