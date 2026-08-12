// Host-mediated persistent storage for binary data a plugin's own worker
// can't reliably cache itself: the plugin sandbox iframe runs with
// sandbox="allow-scripts" and no allow-same-origin, which gives it an
// opaque origin — indexedDB/caches/localStorage inside that context are
// either unavailable or reset on every reload. Backed by the same Cache API
// PluginCache already uses for plugin bundles, in a cache namespaced per
// plugin (so clearing on uninstall is a single caches.delete(), not an
// enumerate-and-filter pass).

const CACHE_PREFIX = "plugin-binary-cache:";

// Cache API keys are Request/URL, not arbitrary strings — this constructs a
// stable, never-dereferenced pseudo-URL per cache key. The .invalid TLD
// (RFC 2606) guarantees it can never resolve to a real host even if
// something upstream ever did try to fetch it.
function keyUrl(key) {
  return `https://plugin-binary-cache.invalid/${encodeURIComponent(key)}`;
}

export class PluginBinaryCache {
  _cacheName(pluginId) {
    return `${CACHE_PREFIX}${pluginId}`;
  }

  async get(pluginId, key) {
    const cache = await caches.open(this._cacheName(pluginId));
    const response = await cache.match(keyUrl(key));
    if (!response) return null;
    return await response.arrayBuffer();
  }

  async put(pluginId, key, arrayBuffer) {
    const cache = await caches.open(this._cacheName(pluginId));
    await cache.put(keyUrl(key), new Response(arrayBuffer));
  }

  async delete(pluginId, key) {
    const cache = await caches.open(this._cacheName(pluginId));
    await cache.delete(keyUrl(key));
  }

  async clear(pluginId) {
    await caches.delete(this._cacheName(pluginId));
  }
}
