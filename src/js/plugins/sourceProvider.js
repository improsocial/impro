// Loads a plugin's manifest and source code. Routes per-plugin based on
// the registry listing's `local` flag: local plugins come from /plugins-local/,
// remote plugins come from GitHub release assets via the plugin cache.

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

function remoteAssetUrl(repo, tag, file) {
  return `https://raw.githubusercontent.com/${repo}/${tag}/${file}`;
}

export class SourceProvider {
  constructor(registry, pluginCache, { fetchImpl } = {}) {
    this.registry = registry;
    this.pluginCache = pluginCache;
    this._fetch = fetchImpl ?? ((...args) => window.fetch(...args));
    this._manifestCache = new Map();
  }

  async ensureManifest(pluginId, version) {
    const cacheKey = `${pluginId}@${version ?? ""}`;
    if (this._manifestCache.has(cacheKey)) {
      return this._manifestCache.get(cacheKey);
    }
    let listing;
    try {
      listing = await this._resolveListing(pluginId);
    } catch {
      return null;
    }
    try {
      const manifest = await this._fetchManifest(pluginId, listing, version);
      // Local plugins are served from disk and may change between reads,
      // so always refetch — only cache versioned remote manifests.
      if (!listing.local) this._manifestCache.set(cacheKey, manifest);
      return manifest;
    } catch {
      return null;
    }
  }

  async _resolveListing(pluginId) {
    const listing = await this.registry.getPluginListing(pluginId);
    if (!listing) throw new Error(`not in registry: ${pluginId}`);
    return listing;
  }

  async getManifest(pluginId, version) {
    const listing = await this._resolveListing(pluginId);
    return this._fetchManifest(pluginId, listing, version);
  }

  async _fetchManifest(pluginId, listing, version) {
    if (listing.local) {
      const response = await this._fetch(
        `/plugins-local/${pluginId}/manifest.json`,
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return parsePluginManifest(pluginId, await response.json());
    }
    if (!version) throw new Error(`version required: ${pluginId}`);
    const url = remoteAssetUrl(listing.repo, version, "manifest.json");
    const response = await this.pluginCache.fetch(url);
    return parsePluginManifest(pluginId, await response.json());
  }

  async getLiveManifest(pluginId) {
    const listing = await this._resolveListing(pluginId);
    if (listing.local) {
      const response = await this._fetch(
        `/plugins-local/${pluginId}/manifest.json`,
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return parsePluginManifest(pluginId, await response.json());
    }
    const url = remoteAssetUrl(listing.repo, "main", "manifest.json");
    const response = await this._fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return parsePluginManifest(pluginId, await response.json());
  }

  async getSource(pluginId, version) {
    const listing = await this._resolveListing(pluginId);
    if (listing.local) {
      const response = await this._fetch(`/plugins-local/${pluginId}/main.js`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    }
    if (!version) throw new Error(`version required: ${pluginId}`);
    const url = remoteAssetUrl(listing.repo, version, "main.js");
    const response = await this.pluginCache.fetch(url);
    return await response.text();
  }

  // URLs that should be retained in the cache
  // Local plugins have no cached URLs
  async getCacheUrls(pluginId, version) {
    const listing = await this.registry.getPluginListing(pluginId);
    if (!listing || listing.local) return [];
    if (!version) return [];
    return [
      remoteAssetUrl(listing.repo, version, "manifest.json"),
      remoteAssetUrl(listing.repo, version, "main.js"),
    ];
  }
}
